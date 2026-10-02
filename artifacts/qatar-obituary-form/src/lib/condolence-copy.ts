import type { CondolenceCard, ObituaryRequest } from "@workspace/api-client-react";
import type { CondolenceContentItem } from "./condolence-poster-renderer";
import { buildAnnouncement, posterCardLines, type Announcement } from "./announcement";

export type Audience = "men" | "women";

export type EditableCard = {
  audience: Audience;
  /** موضع البطاقة في request.condolences. */
  sourceIndex: number;
  /** معرّف قسم الصورة ومفتاح QR: men، women، women-2… */
  sectionId: string;
  location: string;
  start: string;
  time: string;
  durationDays: string;
  address: string;
  mapLink: string;
};

export type EditableContact = { name: string; phone: string };

export type ImageDraft = {
  deceasedNames: string[];
  deceasedTitles: string[];
  opening: string;
  prayerText: string;
  prayerMapLink: string;
  burialText: string;
  burialMapLink: string;
  closing: string;
  cards: EditableCard[];
  phoneContacts: EditableContact[];
  notes: string;
};

const ADDRESS_LABELS = {
  area: "المنطقة",
  street: "الشارع",
  houseNumber: "رقم المنزل",
  buildingNumber: "رقم المبنى",
  floor: "الطابق",
  apartmentNumber: "رقم الشقة",
} as const;
type AddressField = keyof typeof ADDRESS_LABELS;

function formatAddressDraft(card: CondolenceCard): string {
  return [
    ...(Object.keys(ADDRESS_LABELS) as AddressField[]).map((key) => card[key] && `${ADDRESS_LABELS[key]}: ${card[key]}`),
    card.locationNotes,
  ].filter(Boolean).join("، ");
}

export function parseAddressDraft(address: string): Partial<Record<AddressField | "locationNotes", string | undefined>> {
  const fieldByLabel = Object.fromEntries(
    (Object.entries(ADDRESS_LABELS) as Array<[AddressField, string]>).map(([key, label]) => [label, key]),
  ) as Record<string, AddressField>;
  const fields: Partial<Record<AddressField, string | undefined>> = {};
  const notes: string[] = [];
  for (const part of address.split(/،\s*/u).map((value) => value.trim()).filter(Boolean)) {
    const separator = part.indexOf(":");
    const label = separator >= 0 ? part.slice(0, separator).trim() : "";
    const key = fieldByLabel[label];
    if (key) fields[key] = part.slice(separator + 1).trim() || undefined;
    else notes.push(part);
  }
  return {
    area: fields.area,
    street: fields.street,
    houseNumber: fields.houseNumber,
    buildingNumber: fields.buildingNumber,
    floor: fields.floor,
    apartmentNumber: fields.apartmentNumber,
    locationNotes: notes.join("، ") || undefined,
  };
}

/** معرّفات أقسام البطاقات كما يولّدها المولّد الموحّد (للمعاينة ورموز QR). */
function cardSectionIds(announcement: Announcement): Map<number, string> {
  const ids = new Map<number, string>();
  for (const section of announcement.sections) {
    if ("cardIndex" in section && typeof section.cardIndex === "number") ids.set(section.cardIndex, section.id);
  }
  return ids;
}

export function createCondolenceImageDraft(request: ObituaryRequest): ImageDraft {
  const announcement = buildAnnouncement(request);
  const sectionText = (id: string) => announcement.sections.find((section) => section.id === id)?.lines.join("\n") ?? "";
  const ids = cardSectionIds(announcement);
  const people = request.deceasedPeople || [];

  return {
    deceasedNames: people.map((person) => person.fullName ?? ""),
    deceasedTitles: people.map((person) => person.title ?? ""),
    opening: "إنا لله وإنا إليه راجعون",
    prayerText: sectionText("prayer"),
    prayerMapLink: request.prayer?.enabled ? request.prayer.mapLink ?? "" : "",
    burialText: sectionText("burial"),
    burialMapLink: request.burial?.mapLink ?? "",
    closing: announcement.closing,
    cards: (request.condolences || []).flatMap((card, sourceIndex) => {
      const sectionId = ids.get(sourceIndex);
      if (!sectionId) return [];
      return [{
        audience: card.audience,
        sourceIndex,
        sectionId,
        location: card.location ?? "",
        start: card.start ?? "",
        time: card.time ?? "",
        durationDays: card.durationDays == null ? "" : String(card.durationDays),
        address: formatAddressDraft(card),
        mapLink: card.mapLink ?? "",
      }];
    }),
    phoneContacts: (request.condolencePhoneContacts || []).map((contact) => ({
      name: contact.name ?? "",
      phone: contact.phone ?? "",
    })),
    notes: request.notes ?? "",
  };
}

/** يطبّق تعديلات محرر الصورة على نسخة من الطلب؛ يُستعمل للمعاينة وللحفظ معاً. */
export function applyImageDraft(request: ObituaryRequest, draft: ImageDraft): ObituaryRequest {
  const condolences = request.condolences.map((card, index) => {
    const edited = draft.cards.find((item) => item.sourceIndex === index);
    if (!edited) return card;
    const days = Number(edited.durationDays);
    return {
      ...card,
      location: edited.location.trim() || undefined,
      start: edited.start.trim() || undefined,
      time: edited.time.trim() || undefined,
      durationDays: edited.durationDays.trim() && Number.isFinite(days) ? days : null,
      ...parseAddressDraft(edited.address.trim()),
      mapLink: edited.mapLink.trim() || undefined,
    };
  });
  const contacts = draft.phoneContacts
    .filter((contact) => contact.name.trim() || contact.phone.trim())
    .map((contact) => ({
      ...(contact.name.trim() ? { name: contact.name.trim() } : {}),
      ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
    }));
  return {
    ...request,
    deceasedPeople: request.deceasedPeople.map((person, index) => ({
      ...person,
      fullName: draft.deceasedNames[index]?.trim() || undefined,
      title: draft.deceasedTitles[index]?.trim() || undefined,
    })),
    condolences,
    prayer: { ...request.prayer, mapLink: draft.prayerMapLink.trim() || undefined },
    burial: { ...request.burial, mapLink: draft.burialMapLink.trim() || undefined },
    condolencePhoneContacts: request.condolenceOptions.includes("phone") || request.condolencePhoneContacts.length > 0
      ? contacts
      : request.condolencePhoneContacts,
    notes: draft.notes.trim() || undefined,
  };
}

/** مفاتيح روابط QR في الصورة: الصلاة، الدفن، وكل بطاقة عزاء بمعرّف قسمها. */
export function draftQrLinks(draft: ImageDraft): Record<string, string> {
  return {
    prayer: draft.prayerMapLink.trim(),
    burial: draft.burialMapLink.trim(),
    ...Object.fromEntries(draft.cards.map((card) => [card.sectionId, card.mapLink.trim()])),
  };
}

export function qrLabelFor(key: string): string {
  if (key === "prayer") return "موقع الصلاة";
  if (key === "burial") return "موقع الدفن";
  const [audience, position] = key.split("-");
  const base = audience === "women" ? "موقع النساء" : "موقع الرجال";
  return position ? `${base} ${position}` : base;
}

export function buildCondolencePosterContent(
  request: ObituaryRequest,
  draft: ImageDraft,
  qrUrls: Record<string, string>,
): {
  opening: string;
  statement: string;
  names: string;
  items: CondolenceContentItem[];
  warnings: string[];
  relativesText: string;
  detailsText: string;
} {
  const edited = applyImageDraft(request, draft);
  const announcement = buildAnnouncement(edited);
  const items: CondolenceContentItem[] = [];
  const qrFor = (key: string) => {
    const url = qrUrls[key]?.trim();
    return url ? { key, label: qrLabelFor(key), url } : undefined;
  };
  const section = (
    id: string,
    text: string,
    label?: string,
    tone: "body" | "identity" | "closing" = "body",
    qr?: { key: string; label: string; url: string },
  ) => {
    if (text.trim() || qr?.url.trim()) items.push({ kind: "section", id, text, label, tone, qr });
  };

  for (const block of announcement.sections) {
    const text = block.lines.join("\n");
    if (block.id === "closing") continue;
    if (block.id === "prayer") {
      section("prayer", draft.prayerText, block.label, "body", qrFor("prayer"));
    } else if (block.id === "burial") {
      section("burial", draft.burialText, block.label, "body", qrFor("burial"));
    } else if ("cardIndex" in block && typeof block.cardIndex === "number") {
      const card = edited.condolences[block.cardIndex];
      section(block.id, card ? posterCardLines(edited, card).join("\n") : text, block.label, "body", qrFor(block.id));
    } else if (block.id === "deceased-details") {
      section(block.id, text, block.label, "identity");
    } else if (block.id === "notes") {
      section("notes", draft.notes, block.label);
    } else {
      section(block.id, text, block.label);
    }
  }
  // مسار احتياطي: محرر الصلاة/الدفن قد يحتوي نصاً حتى لو لم يولّد الطلب القسم.
  if (!items.some((item) => item.id === "prayer") && draft.prayerText.trim()) section("prayer", draft.prayerText, "صلاة الجنازة", "body", qrFor("prayer"));
  section("closing", draft.closing, undefined, "closing");

  return {
    opening: draft.opening,
    statement: announcement.statement,
    names: announcement.posterNames,
    items,
    warnings: announcement.warnings,
    relativesText: announcement.sections.find((block) => block.id === "relatives")?.lines.join("\n") ?? "",
    detailsText: announcement.posterDetails.join("\n"),
  };
}
