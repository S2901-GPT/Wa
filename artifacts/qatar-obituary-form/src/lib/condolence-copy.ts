import type { ObituaryRequest } from "@workspace/api-client-react";
import type { CondolenceContentItem } from "./condolence-poster-renderer";
import { buildAnnouncement, formatOccupation, makeClosingPrayer, makeDeathStatement } from "./announcement";

// صيغ الوفاة والختام من المولّد الموحّد (تراعي الجنس والعدد والأطفال).
export { makeClosingPrayer, makeDeathStatement };

export type Audience = "men" | "women";

export type EditableCard = {
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
  men?: EditableCard;
  women?: EditableCard;
  phoneContacts: EditableContact[];
  notes: string;
};

type RelativeForWording = {
  name: string;
  occupation?: string;
  deceased: boolean;
};

function clean(value: string | null | undefined): string {
  return (value || "").replace(/\s+/gu, " ").trim();
}

export function formatDeceasedIdentity(title: string | undefined, fullName: string): string {
  const cleanTitle = clean(title);
  const cleanName = clean(fullName);
  if (!cleanTitle) return cleanName;
  if (!cleanName) return cleanTitle;

  const normalizedTitle = cleanTitle.toLocaleLowerCase();
  const normalizedName = cleanName.toLocaleLowerCase();
  if (
    normalizedTitle === normalizedName
    || normalizedName.startsWith(`${normalizedTitle} `)
    || normalizedTitle.startsWith(`${normalizedName} `)
  ) {
    return normalizedName.startsWith(`${normalizedTitle} `) ? cleanName : cleanTitle;
  }

  if (normalizedTitle.includes(normalizedName)) return cleanTitle;
  if (normalizedName.includes(normalizedTitle)) return cleanName;

  // «حرم الشيخ فلان» تعريف بالزوج يأتي بعد اسمها، لا قبله، حتى لا يُقرأ اسم الزوج اسماً لها.
  if (/^(?:حرم|زوجة|أرملة)(?:\s|\/|$)/u.test(cleanTitle)) {
    return `${cleanName}، ${cleanTitle}`;
  }
  return `${cleanTitle} / ${cleanName}`;
}

/** خانة الأقارب لا تذكر الإناث حسب العرف، فالترحّم عليهم بالمذكر دائماً. */
export function formatRelativePerson(
  person: RelativeForWording,
  _relation?: string,
): string {
  return [
    clean(person.name),
    formatOccupation(person.occupation),
    person.deceased ? "رحمه الله" : "",
  ].filter(Boolean).join(" ");
}

export function formatRelativeGroups(request: ObituaryRequest): string {
  return (request.relatives || [])
    .map((group) => {
      const heading = [
        clean(group.relation) || "الأقارب",
        clean(group.familyReference),
      ].filter(Boolean).join(" — ");
      const people = group.people
        .map((person) => formatRelativePerson(person, group.relation))
        .filter(Boolean)
        .map((person) => `• ${person}`);
      return [heading, ...people].filter(Boolean).join("\n");
    })
    .filter((text, index) => {
      const group = request.relatives?.[index];
      return !!text.trim() && !!(
        clean(group?.relation)
        || clean(group?.familyReference)
        || group?.people.some((person) => clean(person.name) || clean(person.occupation))
      );
    })
    .join("\n\n");
}

function detailsForPerson(person: ObituaryRequest["deceasedPeople"][number]): string[] {
  const list: string[] = [];
  if (person.age != null) list.push(`العمر: ${person.age} سنة`);
  if (person.nationality && clean(person.nationality)) list.push(`الجنسية: ${clean(person.nationality)}`);
  if (person.deathPlace && clean(person.deathPlace)) list.push(`مكان الوفاة: ${clean(person.deathPlace)}`);
  if (person.occupation && clean(person.occupation)) list.push(`الجهة: ${clean(person.occupation)}`);
  if (person.note && clean(person.note)) list.push(clean(person.note));
  return list;
}

export function formatDuration(value: string): string {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return clean(value);
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
}

export function createCondolenceImageDraft(request: ObituaryRequest): ImageDraft {
  const men = request.condolences?.find((card) => card.audience === "men");
  const women = request.condolences?.find((card) => card.audience === "women");
  const people = request.deceasedPeople || [];

  const announcement = buildAnnouncement({ ...request, messageType: "announcement" });
  const sectionText = (id: string) => announcement.sections.find((section) => section.id === id)?.lines.join("\n") ?? "";
  const prayerText = sectionText("prayer");
  const burialText = sectionText("burial");

  const cardToDraft = (card: ObituaryRequest["condolences"][number] | undefined): EditableCard | undefined => {
    if (!card) return undefined;
    return {
      location: card.location || "",
      start: card.start || "",
      time: card.time || "",
      durationDays: card.durationDays == null ? "" : String(card.durationDays),
      address: [
        card.area && `المنطقة: ${card.area}`,
        card.street && `الشارع: ${card.street}`,
        card.houseNumber && `رقم المنزل: ${card.houseNumber}`,
        card.buildingNumber && `المبنى: ${card.buildingNumber}`,
        card.floor && `الطابق: ${card.floor}`,
        card.apartmentNumber && `الشقة: ${card.apartmentNumber}`,
        card.locationNotes,
      ].filter(Boolean).join("، "),
      mapLink: card.mapLink || "",
    };
  };

  return {
    deceasedNames: people.map((person) => person.fullName ?? ""),
    deceasedTitles: people.map((person) => person.title || ""),
    opening: "إنا لله وإنا إليه راجعون",
    prayerText,
    prayerMapLink: request.prayer?.mapLink || "",
    burialText,
    burialMapLink: request.burial?.mapLink || "",
    closing: announcement.closing,
    men: cardToDraft(men),
    women: cardToDraft(women),
    phoneContacts: (request.condolencePhoneContacts || []).map((contact) => ({
      name: contact.name || "",
      phone: contact.phone || "",
    })),
    notes: request.notes || "",
  };
}

export type CondolencePosterStructured = {
  opening: string;
  statement: string;
  names: string;
  deceasedPeople: Array<{
    fullName: string;
    title?: string;
    identity: string;
    details: string[];
  }>;
  prayer: {
    day?: string;
    time?: string;
    place?: string;
    text: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  burial: {
    statusText: string;
    day?: string;
    time?: string;
    cemetery?: string;
    text: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  menCondolence: {
    start?: string;
    duration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  womenCondolence: {
    start?: string;
    duration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  phoneContacts: Array<{ name: string; phone: string }>;
  relatives: Array<{
    heading: string;
    members: string[];
  }>;
  notes: string | null;
  closing: string;
  items: CondolenceContentItem[];
};

export function buildCondolencePosterContent(
  request: ObituaryRequest,
  draft: ImageDraft,
  qrUrls: Record<string, string>,
): CondolencePosterStructured {
  const people = request.deceasedPeople || [];
  const deceasedData = people.map((person, index) => {
    const title = draft.deceasedTitles[index] ?? person.title;
    const name = draft.deceasedNames[index] ?? person.fullName ?? "";
    const identity = formatDeceasedIdentity(title, name);
    const details = detailsForPerson(person);
    return {
      fullName: name,
      title: title || undefined,
      identity,
      details,
    };
  });

  const identities = deceasedData.map((d) => d.identity).filter(Boolean);

  const qrFor = (key: string, label: string) => {
    const url = qrUrls[key]?.trim();
    return url ? { key, label, url } : undefined;
  };

  // Prayer
  let prayer: CondolencePosterStructured["prayer"] = null;
  if (draft.prayerText.trim() || qrUrls.prayer?.trim() || request.prayer?.enabled) {
    const qrInfo = qrFor("prayer", "مسح موقع الصلاة");
    prayer = {
      day: request.prayer?.day,
      time: request.prayer?.time,
      place: request.prayer?.place,
      text: draft.prayerText.trim(),
      qrKey: qrInfo?.key,
      qrLabel: qrInfo?.label,
      qrUrl: qrInfo?.url,
    };
  }

  // Burial
  let burial: CondolencePosterStructured["burial"] = null;
  if (draft.burialText.trim() || qrUrls.burial?.trim() || request.burial) {
    const qrInfo = qrFor("burial", "مسح موقع الدفن");
    const statusText = request.burial?.status === "completed" ? "تم الدفن" : request.burial?.status === "postponed" ? "تأجيل الدفن حتى إشعار آخر" : "سيتم الدفن";
    const cemetery = request.burial?.outsideQatar
      ? `${request.burial.outsideLocation || ""} (خارج قطر)`
      : request.burial?.cemetery;
    burial = {
      statusText,
      day: request.burial?.day,
      time: request.burial?.time,
      cemetery,
      text: draft.burialText.trim(),
      qrKey: qrInfo?.key,
      qrLabel: qrInfo?.label,
      qrUrl: qrInfo?.url,
    };
  }

  // Men
  let menCondolence: CondolencePosterStructured["menCondolence"] = null;
  if (draft.men && (draft.men.location || draft.men.time || draft.men.start || draft.men.address || qrUrls.men?.trim())) {
    const qrInfo = qrFor("men", "موقع مجلس الرجال");
    menCondolence = {
      start: draft.men.start.trim() || undefined,
      duration: draft.men.durationDays.trim() ? formatDuration(draft.men.durationDays.trim()) : undefined,
      time: draft.men.time.trim() || undefined,
      location: draft.men.location.trim() || undefined,
      address: draft.men.address.trim() || undefined,
      qrKey: qrInfo?.key,
      qrLabel: qrInfo?.label,
      qrUrl: qrInfo?.url,
    };
  }

  // Women
  let womenCondolence: CondolencePosterStructured["womenCondolence"] = null;
  if (draft.women && (draft.women.location || draft.women.time || draft.women.start || draft.women.address || qrUrls.women?.trim())) {
    const qrInfo = qrFor("women", "موقع عزاء النساء");
    womenCondolence = {
      start: draft.women.start.trim() || undefined,
      duration: draft.women.durationDays.trim() ? formatDuration(draft.women.durationDays.trim()) : undefined,
      time: draft.women.time.trim() || undefined,
      location: draft.women.location.trim() || undefined,
      address: draft.women.address.trim() || undefined,
      qrKey: qrInfo?.key,
      qrLabel: qrInfo?.label,
      qrUrl: qrInfo?.url,
    };
  }

  // Relatives
  const relatives: CondolencePosterStructured["relatives"] = (request.relatives || [])
    .filter((group) =>
      clean(group.relation)
      || clean(group.familyReference)
      || group.people.some((person) => clean(person.name) || clean(person.occupation)),
    )
    .map((group) => {
      const heading = [
        clean(group.relation) || "الأقارب",
        clean(group.familyReference),
      ].filter(Boolean).join(" — ");
      const members = group.people
        .map((person) => formatRelativePerson(person, group.relation))
        .filter(Boolean);
      return { heading, members };
    })
    .filter((g) => g.members.length > 0);

  // Phone Contacts
  const phoneContacts = draft.phoneContacts
    .filter((c) => c.name.trim() || c.phone.trim())
    .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }));

  // Notes
  const notes = draft.notes.trim() || null;

  // Legacy items array for backwards compatibility
  const items: CondolenceContentItem[] = [];

  return {
    opening: draft.opening || "إنا لله وإنا إليه راجعون",
    statement: makeDeathStatement(people),
    names: identities.join("، "),
    deceasedPeople: deceasedData,
    prayer,
    burial,
    menCondolence,
    womenCondolence,
    phoneContacts,
    relatives,
    notes,
    closing: draft.closing || makeClosingPrayer(people),
    items,
  };
}
