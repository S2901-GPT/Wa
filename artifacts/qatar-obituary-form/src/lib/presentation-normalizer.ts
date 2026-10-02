import type { CondolenceCard, ObituaryRequest } from "@workspace/api-client-react";
import { buildAnnouncement, describeDeceased, posterCardLines } from "./announcement";
import { formatDuration } from "./condolence-copy";

export type NormalizedContent = {
  opening: string;
  statement: string;
  deceasedList: Array<{
    fullName: string;
    title?: string;
    identity: string;
    details: string[];
  }>;
  deceasedCombinedNames: string;
  hasCombinedPrayerBurial: boolean;
  prayerBurialCombined?: {
    title: string;
    dayTime: string;
    place: string;
    qrUrl?: string;
    qrLabel?: string;
  };
  prayer?: {
    title: string;
    day?: string;
    time?: string;
    place?: string;
    qrUrl?: string;
    qrLabel?: string;
  };
  burial?: {
    title: string;
    statusText: string;
    day?: string;
    time?: string;
    place?: string;
    qrUrl?: string;
    qrLabel?: string;
  };
  men?: {
    title: string;
    startAndDuration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrUrl?: string;
    qrLabel?: string;
  };
  women?: {
    title: string;
    startAndDuration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrUrl?: string;
    qrLabel?: string;
  };
  phoneContacts: Array<{
    name?: string;
    phone: string;
    formatted: string;
  }>;
  relatives: Array<{
    heading: string;
    membersText: string;
    membersList: string[];
  }>;
  notes?: string;
  closing: string;
};

// Clean string helper
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize Arabic for fuzzy comparison
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return cleanText(text)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[ـ\u064B-\u065F]/g, "") // remove tashkeel & tatweel
    .replace(/[\-–—_:،,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Known Qatar landmarks where QR codes MUST NEVER be shown
export function isKnownLocationSuppressed(locationText: string): boolean {
  if (!locationText) return false;
  const norm = normalizeArabic(locationText);

  // Mesaimeer Cemetery
  if (
    norm.includes("مسيمير") ||
    (norm.includes("مقبره") && norm.includes("مسيمير")) ||
    norm.includes("mesaimeer")
  ) {
    return true;
  }

  // Imam Muhammad ibn Abd al-Wahhab Mosque
  if (
    (norm.includes("محمد بن عبد الوهاب") || norm.includes("محمد بن عبدالوهاب")) &&
    (norm.includes("جامع") || norm.includes("مسجد") || norm.includes("الدوله"))
  ) {
    return true;
  }

  return false;
}

// Format clean natural address from key-value parts or strings
export function formatNaturalAddress(address: string | undefined, areaFallback?: string): string {
  if (!address) return cleanText(areaFallback);

  const clean = cleanText(address);
  if (!clean) return cleanText(areaFallback);

  // If already free-form clean address without DB field labels
  if (!clean.includes(":") && !clean.includes("المنطقة") && !clean.includes("الشارع")) {
    return clean;
  }

  // Parse key-value parts
  const parts: string[] = [];
  const tokens = clean.split(/[،,]/).map((t) => t.trim()).filter(Boolean);

  let area = "";
  let street = "";
  let building = "";
  let house = "";
  let floor = "";
  let apt = "";
  const extra: string[] = [];

  for (const token of tokens) {
    const colonIdx = token.indexOf(":");
    if (colonIdx > 0) {
      const label = token.slice(0, colonIdx).trim();
      const val = token.slice(colonIdx + 1).trim();
      if (!val) continue;

      if (label.includes("المنطقة")) area = val;
      else if (label.includes("الشارع")) street = val.startsWith("شارع") ? val : `شارع ${val}`;
      else if (label.includes("مبنى") || label.includes("المبنى")) building = val.startsWith("مبنى") ? val : `مبنى ${val}`;
      else if (label.includes("منزل") || label.includes("المنزل")) house = val.startsWith("منزل") ? val : `منزل ${val}`;
      else if (label.includes("طابق") || label.includes("الطابق")) floor = val.startsWith("طابق") ? val : `طابق ${val}`;
      else if (label.includes("شقة") || label.includes("الشقة")) apt = val.startsWith("شقة") ? val : `شقة ${val}`;
      else extra.push(val);
    } else {
      extra.push(token);
    }
  }

  if (!area && areaFallback) area = cleanText(areaFallback);

  if (area) parts.push(area);
  if (street) parts.push(street);
  if (building) parts.push(building);
  if (house) parts.push(house);
  if (floor) parts.push(floor);
  if (apt) parts.push(apt);
  if (extra.length) parts.push(...extra);

  return parts.join("، ");
}

// Deduplicate location & address (e.g. area appearing in both)
export function deduplicateLocationAndAddress(
  location: string | undefined,
  address: string | undefined,
  areaFallback?: string,
): { location: string; address: string } {
  let cleanLoc = cleanText(location);
  let cleanAddr = formatNaturalAddress(address, areaFallback);

  if (!cleanLoc && cleanAddr) return { location: cleanAddr, address: "" };
  if (cleanLoc && !cleanAddr) return { location: cleanLoc, address: "" };

  const normLoc = normalizeArabic(cleanLoc);
  const normAddr = normalizeArabic(cleanAddr);

  // If address is identical to location
  if (normLoc === normAddr || normLoc.includes(normAddr)) {
    return { location: cleanLoc, address: "" };
  }

  // Remove redundant area mentions from location if address starts with it
  // E.g. "مجلس العائلة في منطقة الدفنة" -> "مجلس العائلة"
  if (cleanLoc.includes(" في منطقة ")) {
    const areaPart = cleanLoc.split(" في منطقة ")[1]?.trim();
    if (areaPart && cleanAddr.includes(areaPart)) {
      cleanLoc = cleanLoc.split(" في منطقة ")[0]?.trim() || cleanLoc;
    }
  } else if (cleanLoc.includes(" في ")) {
    const areaPart = cleanLoc.split(" في ")[1]?.trim();
    if (areaPart && cleanAddr.includes(areaPart)) {
      cleanLoc = cleanLoc.split(" في ")[0]?.trim() || cleanLoc;
    }
  }

  return { location: cleanLoc, address: cleanAddr };
}

// Check if two locations refer to the same physical place
export function areLocationsEquivalent(
  locA: string | undefined,
  mapA: string | undefined,
  locB: string | undefined,
  mapB: string | undefined,
): boolean {
  const normMapA = cleanText(mapA).toLowerCase();
  const normMapB = cleanText(mapB).toLowerCase();

  // If both have identical map links
  if (normMapA && normMapB && normMapA === normMapB) {
    return true;
  }

  const normA = normalizeArabic(locA || "");
  const normB = normalizeArabic(locB || "");

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Check if both refer to Mesaimeer cemetery
  if (normA.includes("مسيمير") && normB.includes("مسيمير")) {
    return true;
  }

  // Check if one contains the other
  if (normA.includes(normB) || normB.includes(normA)) {
    return true;
  }

  return false;
}

// Phone Number LTR Formatter
// Keeps "+974 5512 3456" in strict Left-to-Right order so it never gets inverted in RTL context
export function formatPhoneNumberLtr(phone: string): string {
  const cleaned = cleanText(phone);
  if (!cleaned) return "";

  // Normalize spaces in phone numbers
  const standardPhone = cleaned.replace(/\s+/g, " ");

  // Enclose with Unicode Left-to-Right Embedding (U+202A) and Pop Directional Formatting (U+202C)
  // or Left-to-Right Isolate (U+2066) / Pop Directional Isolate (U+2069)
  return `\u2066${standardPhone}\u2069`;
}

// Natural Arabic date & duration formatter
export function formatStartAndDuration(start?: string, durationDays?: string | number | null): string {
  const cleanStart = cleanText(start);
  const dur = durationDays != null ? formatDuration(String(durationDays)) : "";

  if (cleanStart && dur) {
    return `${cleanStart} — ${dur}`;
  }
  return cleanStart || dur || "";
}

const LOCATION_ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];

// Main Presentation Normalizer entry point
/**
 * يبني محتوى القوالب البصرية من المولّد الموحّد (announcement.ts) حتى تطابق صياغة الصورة
 * نص الإعلان المنسوخ: «انتقلت إلى رحمة الله تعالى»، «أرملة الوالد / فلان رحمهم الله»، «والدة كل من»،
 * «الدفن اليوم بعد صلاة العصر في مقبرة مسيمير»، «شفيعاً لوالديه يارب»…
 */
export function normalizeObituaryPresentation(
  request: ObituaryRequest,
  draftOverrides?: {
    deceasedNames?: string[];
    deceasedTitles?: string[];
    opening?: string;
    prayerMapLink?: string;
    burialMapLink?: string;
    menMapLink?: string;
    womenMapLink?: string;
    notes?: string;
    closing?: string;
  },
): NormalizedContent {
  // تعديلات محرر الصورة تُطبَّق على نسخة من الطلب قبل الصياغة.
  const edited: ObituaryRequest = {
    ...request,
    // الصورة تعرض الإعلان نفسه؛ رسائل التأجيل والإلغاء نصوص قصيرة لا قوالب.
    messageType: request.messageType === "amendment" ? "amendment" : "announcement",
    deceasedPeople: (request.deceasedPeople || []).map((person, index) => ({
      ...person,
      ...(draftOverrides?.deceasedNames?.[index] !== undefined ? { fullName: draftOverrides.deceasedNames[index] || undefined } : {}),
      ...(draftOverrides?.deceasedTitles?.[index] !== undefined ? { title: draftOverrides.deceasedTitles[index] || undefined } : {}),
    })),
    notes: draftOverrides?.notes ?? request.notes,
  };
  const announcement = buildAnnouncement(edited);
  const section = (id: string) => announcement.sections.find((item) => item.id === id);
  const people = edited.deceasedPeople;

  // 1. المتوفون: سطر التعريف، ثم التفاصيل (العمر، الجنسية لغير القطري، «حرم الشيخ / …»…)
  const [, ...details] = announcement.posterDetails;
  const deceasedList = people.length <= 1
    ? people.map((person) => ({
        fullName: person.fullName ?? "",
        title: person.title || undefined,
        identity: announcement.posterNames || describeDeceased(person, edited.relatives),
        details,
      }))
    : [{
        fullName: people.map((person) => person.fullName ?? "").filter(Boolean).join("، "),
        title: undefined,
        identity: announcement.posterNames,
        details: announcement.posterDetails,
      }];
  const deceasedCombinedNames = announcement.posterNames;

  // 2. الصلاة والدفن: جمل المولّد كما هي (دون «يوم اليوم» أو عناوين «اليوم: …»).
  const prayerLines = section("prayer")?.lines ?? [];
  const burialLines = section("burial")?.lines ?? [];
  const prayerMap = cleanText(draftOverrides?.prayerMapLink ?? request.prayer?.mapLink);
  const burialMap = cleanText(draftOverrides?.burialMapLink ?? request.burial?.mapLink);
  const burialPlaceText = request.burial?.outsideQatar ? cleanText(request.burial?.outsideLocation) : cleanText(request.burial?.cemetery);
  const qrFor = (place: string, url: string) => (!isKnownLocationSuppressed(place) && url ? url : undefined);

  let hasCombinedPrayerBurial = false;
  let prayerBurialCombined: NormalizedContent["prayerBurialCombined"] = undefined;
  let prayer: NormalizedContent["prayer"] = undefined;
  let burial: NormalizedContent["burial"] = undefined;

  if (!prayerLines.length && burialLines.length) {
    // لا صلاة منفصلة: الصلاة والدفن في الموقع نفسه.
    hasCombinedPrayerBurial = true;
    const qrUrl = qrFor(burialPlaceText, burialMap || prayerMap);
    prayerBurialCombined = {
      title: "صلاة الجنازة والدفن",
      dayTime: burialLines.join("\n"),
      place: "",
      qrUrl,
      qrLabel: qrUrl ? "الموقع" : undefined,
    };
  } else {
    if (prayerLines.length) {
      const qrUrl = qrFor(cleanText(request.prayer?.place), prayerMap);
      prayer = {
        title: "صلاة الجنازة",
        day: prayerLines.join("\n"),
        qrUrl,
        qrLabel: qrUrl ? "موقع الصلاة" : undefined,
      };
    }
    if (burialLines.length) {
      const qrUrl = qrFor(burialPlaceText, burialMap);
      burial = {
        title: "الدفن",
        statusText: burialLines.join("\n"),
        qrUrl,
        qrLabel: qrUrl ? "موقع الدفن" : undefined,
      };
    }
  }

  // 3. العزاء: كل جمهور في قسم واحد؛ المواقع الإضافية تُضاف أسطراً فيه.
  const condolenceBlock = (audience: "men" | "women"): NormalizedContent["men"] => {
    const blocks = announcement.sections.filter((item) => item.audience === audience);
    if (!blocks.length) return undefined;
    const lines = blocks.flatMap((block, index) => {
      const card: CondolenceCard | undefined = typeof block.cardIndex === "number" ? edited.condolences?.[block.cardIndex] : undefined;
      const body = card ? posterCardLines(edited, card) : block.lines;
      const base = audience === "men" ? "عزاء الرجال" : "عزاء النساء";
      // العنوان العام للقسم هو «عزاء النساء» أصلاً، فالمواقع المرقّمة تُسمّى «الموقع الأول/الثاني».
      const numbered = block.label === `${base} (${index + 1})`;
      const heading = numbered
        ? `الموقع ${LOCATION_ORDINALS[index] ?? index + 1}:`
        : blocks.length > 1 || block.label !== base ? `${block.label}:` : "";
      return index === 0 && !heading ? body : [heading, ...body].filter(Boolean);
    });
    const firstCard = blocks[0]?.cardIndex != null ? edited.condolences?.[blocks[0].cardIndex!] : undefined;
    const override = audience === "men" ? draftOverrides?.menMapLink : draftOverrides?.womenMapLink;
    const map = cleanText(override ?? firstCard?.mapLink);
    const qrUrl = qrFor(cleanText(firstCard?.location), map);
    return {
      title: audience === "men" ? "عزاء الرجال" : "عزاء النساء",
      location: lines.join("\n"),
      qrUrl,
      qrLabel: qrUrl ? (audience === "men" ? "موقع المجلس" : "موقع العزاء") : undefined,
    };
  };
  const men = condolenceBlock("men");
  const women = condolenceBlock("women");

  // 4. أرقام الهاتف (الأرقام معزولة باتجاه LTR)
  const phoneContacts = (edited.condolencePhoneContacts || [])
    .filter((c) => cleanText(c.phone))
    .map((c) => {
      const name = cleanText(c.name);
      const rawPhone = cleanText(c.phone);
      const ltrPhone = formatPhoneNumberLtr(rawPhone);
      return { name: name || undefined, phone: rawPhone, formatted: name ? `${name}: ${ltrPhone}` : ltrPhone };
    });

  // 5. الأقارب من منظور المتوفى، والترحّم عليهم بالمذكر (رحمه/رحمهما/رحمهم).
  const relatives = announcement.relativeBlocks.map((block) => ({
    heading: block.heading,
    membersList: block.members,
    membersText: [block.members.join(" و"), block.reference].filter(Boolean).join(" — "),
  }));

  // 6. الملاحظات والختام
  const notes = cleanText(edited.notes);
  const closing = cleanText(draftOverrides?.closing) || announcement.closing;
  const opening = cleanText(draftOverrides?.opening) || "إنا لله وإنا إليه راجعون";
  const statement = edited.messageType === "amendment" ? `تعديل / ${announcement.statement}` : announcement.statement;

  return {
    opening,
    statement,
    deceasedList,
    deceasedCombinedNames,
    hasCombinedPrayerBurial,
    prayerBurialCombined,
    prayer,
    burial,
    men,
    women,
    phoneContacts,
    relatives,
    notes: notes || undefined,
    closing,
  };
}
