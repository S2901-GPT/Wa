import type { ObituaryRequest } from "@workspace/api-client-react";
import type { CondolenceContentItem } from "./condolence-poster-renderer";

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

type DeceasedForWording = {
  gender?: string | null;
};

type RelativeForWording = {
  name: string;
  occupation?: string;
  deceased: boolean;
};

const FEMININE_RELATIONS = new Set([
  "والدة", "أم", "ابنة", "بنت", "أخت", "شقيقة", "عمة", "خالة", "جدة",
  "زوجة", "زوجة/حرم", "حرم", "أرملة", "بنات", "أخوات", "عمات", "خالات",
  "جدات", "حفيدات",
]);

const MASCULINE_RELATIONS = new Set([
  "والد", "أب", "ابن", "ولد", "أخ", "شقيق", "عم", "خال", "جد", "زوج",
  "أرمل", "أبناء", "إخوة", "أعمام", "أخوال", "أجداد", "أحفاد",
]);

function clean(value: string | null | undefined): string {
  return (value || "").replace(/\s+/gu, " ").trim();
}

function relativeRelationKey(relation: string): string {
  return clean(relation).replace(/^ال/u, "");
}

export function inferRelativeGender(relation: string): "feminine" | "masculine" | "unknown" {
  const key = relativeRelationKey(relation);
  const matchesRelation = (known: Set<string>) =>
    [...known].some((value) => key === value || key.startsWith(`${value} `) || key.startsWith(`${value}/`));
  if (matchesRelation(FEMININE_RELATIONS)) return "feminine";
  if (matchesRelation(MASCULINE_RELATIONS)) return "masculine";
  return "unknown";
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

  if (/^(?:حرم|زوجة)(?:\s|\/|$)/u.test(cleanTitle)) {
    return `${cleanTitle}، ${cleanName}`;
  }
  return `${cleanTitle} ${cleanName}`;
}

export function makeDeathStatement(people: DeceasedForWording[]): string {
  if (people.length === 1) {
    const gender = people[0]?.gender;
    if (gender === "woman" || gender === "girl") return "انتقلت إلى رحمة الله تعالى";
    if (gender === "man" || gender === "boy") return "انتقل إلى رحمة الله تعالى";
    return "في ذمة الله تعالى";
  }
  if (people.length === 2) {
    const bothWomen = people.every((person) => person.gender === "woman" || person.gender === "girl");
    return bothWomen ? "انتقلتا إلى رحمة الله تعالى" : "انتقلا إلى رحمة الله تعالى";
  }
  if (people.length > 2) {
    const allWomen = people.every((person) => person.gender === "woman" || person.gender === "girl");
    return allWomen ? "انتقلن إلى رحمة الله تعالى" : "انتقلوا إلى رحمة الله تعالى";
  }
  return "تغمد الله الفقيد بواسع رحمته";
}

export function makeClosingPrayer(people: DeceasedForWording[]): string {
  if (people.length === 1) {
    const gender = people[0]?.gender;
    if (gender === "woman" || gender === "girl") {
      return "رحمها الله وغفر لها، وأسكنها فسيح جناته.";
    }
    if (gender === "man" || gender === "boy") {
      return "رحمه الله وغفر له، وأسكنه فسيح جناته.";
    }
    return "اللهم اغفر للفقيد وارحمه، وأسكنه فسيح جناتك.";
  }
  if (people.length === 2) {
    return "رحمهما الله وغفر لهما، وأسكنهما فسيح جناته.";
  }
  if (people.length > 2 && people.every((person) => person.gender === "woman" || person.gender === "girl")) {
    return "اللهم ارحمهن واغفر لهن، وأسكنهن فسيح جناتك.";
  }
  if (people.length > 2) {
    return "اللهم ارحمهم واغفر لهم، وأسكنهم فسيح جناتك.";
  }
  return "اللهم اغفر للفقيد وارحمه، وأسكنه فسيح جناتك.";
}

export function formatRelativePerson(
  person: RelativeForWording,
  relation: string,
): string {
  const details = [
    clean(person.name),
    person.occupation && `العمل: ${clean(person.occupation)}`,
  ].filter(Boolean);
  if (person.deceased) {
    const gender = inferRelativeGender(relation);
    details.push(gender === "feminine" ? "رحمها الله تعالى" : "رحمه الله تعالى");
  }
  return details.join(" — ");
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

function detailsForPerson(person: ObituaryRequest["deceasedPeople"][number]): string {
  return [
    person.age != null ? `العمر: ${person.age}` : "",
    person.nationality && `الجنسية: ${clean(person.nationality)}`,
    person.deathPlace && `مكان الوفاة: ${clean(person.deathPlace)}`,
    person.occupation && `الجهة / الصفة: ${clean(person.occupation)}`,
    person.note && `ملاحظة: ${clean(person.note)}`,
  ].filter(Boolean).join("\n");
}

function formatDuration(value: string): string {
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return clean(value);
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يومًا`;
}

function cardText(card: EditableCard | undefined): string {
  if (!card) return "";
  return [
    card.start.trim() && `بداية العزاء: ${card.start.trim()}`,
    card.durationDays.trim() && `المدة: ${formatDuration(card.durationDays.trim())}`,
    card.time.trim() && `الفترة: ${card.time.trim()}`,
    card.location.trim() && `المجلس: ${card.location.trim()}`,
    card.address.trim(),
  ].filter(Boolean).join("\n");
}

export function createCondolenceImageDraft(request: ObituaryRequest): ImageDraft {
  const men = request.condolences.find((card) => card.audience === "men");
  const women = request.condolences.find((card) => card.audience === "women");
  const people = request.deceasedPeople || [];
  const prayerText = [
    request.prayer?.day && `اليوم: ${request.prayer.day}`,
    request.prayer?.time && `الوقت: ${request.prayer.time}`,
    request.prayer?.place && `المسجد / مكان الصلاة: ${request.prayer.place}`,
  ].filter(Boolean).join("\n");
  const burialText = [
    request.burial?.status && `حالة الدفن: ${request.burial.status === "completed" ? "تم الدفن" : "سيتم الدفن"}`,
    request.burial?.day && `اليوم / التاريخ: ${request.burial.day}`,
    request.burial?.time && `الوقت: ${request.burial.time}`,
    request.burial?.outsideQatar
      ? request.burial.outsideLocation && `مكان الدفن خارج قطر: ${request.burial.outsideLocation}`
      : request.burial?.cemetery && `المقبرة: ${request.burial.cemetery}`,
  ].filter(Boolean).join("\n");

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
        card.buildingNumber && `رقم المبنى: ${card.buildingNumber}`,
        card.floor && `الطابق: ${card.floor}`,
        card.apartmentNumber && `رقم الشقة: ${card.apartmentNumber}`,
        card.locationNotes,
      ].filter(Boolean).join("، "),
      mapLink: card.mapLink || "",
    };
  };

  return {
    deceasedNames: people.map((person) => person.fullName),
    deceasedTitles: people.map((person) => person.title || ""),
    opening: "إنا لله وإنا إليه راجعون",
    prayerText,
    prayerMapLink: request.prayer?.mapLink || "",
    burialText,
    burialMapLink: request.burial?.mapLink || "",
    closing: makeClosingPrayer(people),
    men: cardToDraft(men),
    women: cardToDraft(women),
    phoneContacts: (request.condolencePhoneContacts || []).map((contact) => ({
      name: contact.name || "",
      phone: contact.phone || "",
    })),
    notes: request.notes || "",
  };
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
} {
  const people = request.deceasedPeople || [];
  const identities = people.map((person, index) => formatDeceasedIdentity(
    draft.deceasedTitles[index] ?? person.title,
    draft.deceasedNames[index] ?? person.fullName,
  ));
  const items: CondolenceContentItem[] = [];
  const section = (
    id: string,
    text: string,
    label?: string,
    tone: "body" | "identity" | "closing" = "body",
    qr?: { key: string; label: string; url: string },
  ) => {
    if (text.trim() || qr?.url.trim()) items.push({ kind: "section", id, text, label, tone, qr });
  };
  const qrFor = (key: string, label: string) => {
    const url = qrUrls[key]?.trim();
    return url ? { key, label, url } : undefined;
  };

  const deceasedDetails = people.map((person, index) => {
    const details = detailsForPerson(person);
    const identity = identities[index];
    return [
      identity,
      details,
    ].filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
  section(
    "deceased-details",
    deceasedDetails,
    people.length > 1 ? "بيانات المتوفين" : "بيانات المتوفى",
    "identity",
  );

  if (draft.prayerText.trim() || qrUrls.prayer?.trim()) {
    section("prayer", draft.prayerText, "صلاة الجنازة", "body", qrFor("prayer", "موقع الصلاة"));
  }
  if (draft.burialText.trim() || qrUrls.burial?.trim()) {
    section("burial", draft.burialText, "الدفن", "body", qrFor("burial", "موقع الدفن"));
  }

  const menText = cardText(draft.men);
  const womenText = cardText(draft.women);
  section("men", menText, "عزاء الرجال", "body", qrFor("men", "موقع الرجال"));
  section("women", womenText, "عزاء النساء", "body", qrFor("women", "موقع النساء"));

  const relativeGroups = (request.relatives || []).filter((group) =>
    clean(group.relation)
    || clean(group.familyReference)
    || group.people.some((person) => clean(person.name) || clean(person.occupation)),
  );
  if (relativeGroups.length) {
    const familyText = relativeGroups.map((group) => {
      const peopleText = group.people
        .map((person) => formatRelativePerson(person, group.relation))
        .filter(Boolean)
        .map((person) => `• ${person}`)
        .join("\n");
      const heading = [
        clean(group.relation) || "الأقارب",
        clean(group.familyReference),
      ].filter(Boolean).join(" — ");
      return [heading, peopleText].filter(Boolean).join("\n");
    }).join("\n\n");
    section("relatives", familyText, "الأقارب وصلات القرابة");
  }

  const contacts = draft.phoneContacts
    .filter((contact) => contact.name.trim() || contact.phone.trim())
    .map((contact) => [contact.name.trim(), contact.phone.trim()].filter(Boolean).join(" — "));
  if (contacts.length) section("phone", contacts.join("\n"), "التعزية عبر الهاتف");
  if (draft.notes.trim()) section("notes", draft.notes, "ملاحظات");
  section("closing", draft.closing, undefined, "closing");

  return {
    opening: draft.opening,
    statement: makeDeathStatement(people),
    names: identities.filter(Boolean).join("، "),
    items,
  };
}