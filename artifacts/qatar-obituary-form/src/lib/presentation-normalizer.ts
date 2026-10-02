import type { ObituaryRequest } from "@workspace/api-client-react";
import {
  formatDeceasedIdentity,
  makeDeathStatement,
  makeClosingPrayer,
  formatRelativePerson,
  inferRelativeGender,
  formatDuration,
} from "./condolence-copy";

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

// Main Presentation Normalizer entry point
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
  const people = request.deceasedPeople || [];

  // 1. Process Deceased People
  const deceasedList = people.map((person, index) => {
    const title = draftOverrides?.deceasedTitles?.[index] ?? person.title;
    const name = draftOverrides?.deceasedNames?.[index] ?? person.fullName;
    const identity = formatDeceasedIdentity(title, name);

    const details: string[] = [];
    if (person.age != null) details.push(`العمر: ${person.age} سنة`);
    if (person.nationality && cleanText(person.nationality)) details.push(`الجنسية: ${cleanText(person.nationality)}`);
    if (person.deathPlace && cleanText(person.deathPlace)) details.push(`مكان الوفاة: ${cleanText(person.deathPlace)}`);
    if (person.occupation && cleanText(person.occupation)) details.push(cleanText(person.occupation));
    if (person.note && cleanText(person.note)) details.push(cleanText(person.note));

    return {
      fullName: name,
      title: title || undefined,
      identity,
      details,
    };
  });

  const deceasedCombinedNames = deceasedList.map((d) => d.identity).join("، ");

  // 2. Prayer & Burial Extraction
  const prayerPlace = cleanText(request.prayer?.place);
  const prayerDay = cleanText(request.prayer?.day);
  const prayerTime = cleanText(request.prayer?.time);
  const prayerMap = cleanText(draftOverrides?.prayerMapLink ?? request.prayer?.mapLink);

  const burialCemetery = request.burial?.outsideQatar
    ? `${cleanText(request.burial?.outsideLocation) || ""} (خارج قطر)`
    : cleanText(request.burial?.cemetery);
  const burialDay = cleanText(request.burial?.day);
  const burialTime = cleanText(request.burial?.time);
  const burialStatus = request.burial?.status === "completed" ? "تم الدفن" : "سيتم الدفن";
  const burialMap = cleanText(draftOverrides?.burialMapLink ?? request.burial?.mapLink);

  const hasPrayer = Boolean(request.prayer?.enabled || prayerPlace || prayerDay || prayerTime || prayerMap);
  const hasBurial = Boolean(request.burial && (burialCemetery || burialDay || burialTime || burialMap));

  // 3. Check if Prayer & Burial are in the same place -> Combine them!
  const isSameLocation = hasPrayer && hasBurial && areLocationsEquivalent(prayerPlace, prayerMap, burialCemetery, burialMap);

  let hasCombinedPrayerBurial = false;
  let prayerBurialCombined: NormalizedContent["prayerBurialCombined"] = undefined;
  let prayer: NormalizedContent["prayer"] = undefined;
  let burial: NormalizedContent["burial"] = undefined;

  if (isSameLocation) {
    hasCombinedPrayerBurial = true;
    const unifiedPlace = prayerPlace || burialCemetery;
    const unifiedDay = prayerDay || burialDay;
    const unifiedTime = prayerTime || burialTime;
    const dayTime = [unifiedDay, unifiedTime].filter(Boolean).join(" — ");

    // Suppress QR if famous landmark (like Mesaimeer Cemetery)
    const suppress = isKnownLocationSuppressed(unifiedPlace);
    const validQrUrl = !suppress && (prayerMap || burialMap) ? (prayerMap || burialMap) : undefined;

    prayerBurialCombined = {
      title: "صلاة الجنازة والدفن",
      dayTime: dayTime || "سيتم الإعلان عن الموعد",
      place: unifiedPlace,
      qrUrl: validQrUrl,
      qrLabel: validQrUrl ? "الموقع" : undefined,
    };
  } else {
    if (hasPrayer) {
      const suppress = isKnownLocationSuppressed(prayerPlace);
      const validQr = !suppress && prayerMap ? prayerMap : undefined;
      prayer = {
        title: "صلاة الجنازة",
        day: prayerDay ? `اليوم: ${prayerDay}` : undefined,
        time: prayerTime ? `الوقت: ${prayerTime}` : undefined,
        place: prayerPlace ? `المسجد: ${prayerPlace}` : undefined,
        qrUrl: validQr,
        qrLabel: validQr ? "موقع الصلاة" : undefined,
      };
    }
    if (hasBurial) {
      const suppress = isKnownLocationSuppressed(burialCemetery);
      const validQr = !suppress && burialMap ? burialMap : undefined;
      burial = {
        title: "الدفن",
        statusText: burialStatus,
        day: burialDay ? `اليوم: ${burialDay}` : undefined,
        time: burialTime ? `الوقت: ${burialTime}` : undefined,
        place: burialCemetery ? `المقبرة: ${burialCemetery}` : undefined,
        qrUrl: validQr,
        qrLabel: validQr ? "موقع الدفن" : undefined,
      };
    }
  }

  // 4. Men Condolence
  const menCard = request.condolences?.find((c) => c.audience === "men");
  let men: NormalizedContent["men"] = undefined;
  if (menCard) {
    const rawLoc = menCard.location;
    const rawAddr = [
      menCard.area && `المنطقة: ${menCard.area}`,
      menCard.street && `الشارع: ${menCard.street}`,
      menCard.houseNumber && `المنزل: ${menCard.houseNumber}`,
      menCard.buildingNumber && `المبنى: ${menCard.buildingNumber}`,
      menCard.floor && `الطابق: ${menCard.floor}`,
      menCard.apartmentNumber && `الشقة: ${menCard.apartmentNumber}`,
      menCard.locationNotes,
    ].filter(Boolean).join("، ");

    const { location: cleanLoc, address: cleanAddr } = deduplicateLocationAndAddress(rawLoc, rawAddr, menCard.area || undefined);
    const menMap = cleanText(draftOverrides?.menMapLink ?? menCard.mapLink);
    const suppress = isKnownLocationSuppressed(cleanLoc) || isKnownLocationSuppressed(cleanAddr);
    const validQr = !suppress && menMap ? menMap : undefined;

    men = {
      title: "عزاء الرجال",
      startAndDuration: formatStartAndDuration(menCard.start || undefined, menCard.durationDays),
      time: menCard.time ? cleanText(menCard.time) : undefined,
      location: cleanLoc || undefined,
      address: cleanAddr || undefined,
      qrUrl: validQr,
      qrLabel: validQr ? "موقع المجلس" : undefined,
    };
  }

  // 5. Women Condolence
  const womenCard = request.condolences?.find((c) => c.audience === "women");
  let women: NormalizedContent["women"] = undefined;
  if (womenCard) {
    const rawLoc = womenCard.location;
    const rawAddr = [
      womenCard.area && `المنطقة: ${womenCard.area}`,
      womenCard.street && `الشارع: ${womenCard.street}`,
      womenCard.houseNumber && `المنزل: ${womenCard.houseNumber}`,
      womenCard.buildingNumber && `المبنى: ${womenCard.buildingNumber}`,
      womenCard.floor && `الطابق: ${womenCard.floor}`,
      womenCard.apartmentNumber && `الشقة: ${womenCard.apartmentNumber}`,
      womenCard.locationNotes,
    ].filter(Boolean).join("، ");

    const { location: cleanLoc, address: cleanAddr } = deduplicateLocationAndAddress(rawLoc, rawAddr, womenCard.area || undefined);
    const womenMap = cleanText(draftOverrides?.womenMapLink ?? womenCard.mapLink);
    const suppress = isKnownLocationSuppressed(cleanLoc) || isKnownLocationSuppressed(cleanAddr);
    const validQr = !suppress && womenMap ? womenMap : undefined;

    women = {
      title: "عزاء النساء",
      startAndDuration: formatStartAndDuration(womenCard.start || undefined, womenCard.durationDays),
      time: womenCard.time ? cleanText(womenCard.time) : undefined,
      location: cleanLoc || undefined,
      address: cleanAddr || undefined,
      qrUrl: validQr,
      qrLabel: validQr ? "موقع العزاء" : undefined,
    };
  }

  // 6. Phone Contacts with LTR isolated numbers
  const phoneContacts = (request.condolencePhoneContacts || [])
    .filter((c) => cleanText(c.phone))
    .map((c) => {
      const name = cleanText(c.name);
      const rawPhone = cleanText(c.phone);
      const ltrPhone = formatPhoneNumberLtr(rawPhone);
      const formatted = name ? `${name}: ${ltrPhone}` : ltrPhone;
      return {
        name: name || undefined,
        phone: rawPhone,
        formatted,
      };
    });

  // 7. Relatives (Deduplicating relationship prefix)
  const relatives = (request.relatives || [])
    .filter((group) => group.people && group.people.length > 0)
    .map((group) => {
      const relLabel = cleanText(group.relation) || "الأقارب";
      const familyRef = cleanText(group.familyReference);
      const heading = [relLabel, familyRef].filter(Boolean).join(" — ");

      const membersList = group.people
        .map((p) => formatRelativePerson(p, group.relation))
        .filter(Boolean);

      return {
        heading,
        membersText: membersList.join("، "),
        membersList,
      };
    })
    .filter((g) => g.membersList.length > 0);

  // 8. Notes & Closing
  const notes = cleanText(draftOverrides?.notes ?? request.notes);
  const closing = cleanText(draftOverrides?.closing) || makeClosingPrayer(people);
  const opening = cleanText(draftOverrides?.opening) || "إنا لله وإنا إليه راجعون";
  const statement = makeDeathStatement(people);

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
