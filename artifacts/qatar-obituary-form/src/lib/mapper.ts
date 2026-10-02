import type {
  CondolenceCard,
  CondolenceScheduleEntry,
  DeceasedPerson,
  LinkedPerson as ApiLinkedPerson,
  ObituaryRequest,
  ObituaryRequestInput,
  RelativeGroup,
} from "@workspace/api-client-react";
import { RELATION_OPTIONS, relationKeyOf } from "./announcement";
import {
  CHILD_TITLES,
  emptyCondolenceDetails,
  emptyDeceased,
  emptyFormValues,
  type DeceasedFormValues,
  type ObituaryFormValues,
} from "./schema";

/**
 * جسر بين شكل بيانات النموذج (deceasedList، femaleRelations، condolences.type…)
 * وعقد الـ API الذي يقبله الخادم (deceasedPeople، condolenceOptions، condolences[]…).
 * الخادم لا يقبل إلا عقد الـ API، فلا يُرسل النموذج كما هو أبداً.
 */

const clean = (value?: string | null) => (value ?? "").replace(/\s+/gu, " ").trim();
const optional = (value?: string | null) => clean(value) || undefined;

type FormLinked = { title?: string; name?: string; isDeceased?: boolean } | undefined;
type FormDetails = NonNullable<NonNullable<ObituaryFormValues["condolences"]>["men"]>;

function linkedToApi(person: FormLinked): ApiLinkedPerson | undefined {
  if (!clean(person?.name)) return undefined;
  return { ...(optional(person?.title) ? { title: clean(person?.title) } : {}), name: clean(person?.name), deceased: !!person?.isDeceased };
}

function linkedToForm(person?: ApiLinkedPerson) {
  return { title: person?.title ?? "", name: person?.name ?? "", isDeceased: !!person?.deceased };
}

function targetIndex(target: string | undefined, count: number): number | null {
  if (count < 2 || !target || target === "all") return null;
  const index = Number(target);
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}

// ───────────────────────── المتوفون ─────────────────────────

function apiGender(person: DeceasedFormValues): DeceasedPerson["gender"] {
  const child = CHILD_TITLES.includes(person.title ?? "");
  if (person.gender === "أنثى") return child ? "girl" : "woman";
  if (person.gender === "ذكر") return child ? "boy" : "man";
  return "other";
}

function inferIdentifyBy(person: DeceasedFormValues): NonNullable<DeceasedPerson["identifyBy"]> {
  if (person.identifyBy && person.identifyBy !== "auto") return person.identifyBy;
  if (clean(person.fullName)) return "name";
  if (person.femaleRelations?.some((relation) => clean(relation.relatedName))) return "spouse";
  if (clean(person.kunya)) return "kunya";
  if (clean(person.father?.name)) return "father";
  return "name";
}

function deceasedToApi(person: DeceasedFormValues): DeceasedPerson {
  const [spouse, ...otherRelations] = (person.femaleRelations ?? []).filter((relation) => clean(relation.relatedName));
  const age = person.age && person.age > 0 ? person.age : undefined;
  // «في لندن» في الخانة تُكتب «لندن»؛ المولّد يضيف «في».
  const deathPlace = clean(person.deathLocation).replace(/^في\s+/u, "");
  const extraRelationLines = otherRelations.map((relation) =>
    `${relation.relationType} ${[clean(relation.relatedTitle), "/", clean(relation.relatedName)].filter(Boolean).join(" ")}`);
  const note = [clean(person.notes), ...extraRelationLines].filter(Boolean).join("\n");
  const father = linkedToApi(person.father);
  return {
    gender: apiGender(person),
    identifyBy: inferIdentifyBy(person),
    ...(optional(person.fullName) ? { fullName: clean(person.fullName) } : {}),
    ...(optional(person.kunya) ? { kunya: clean(person.kunya) } : {}),
    ...(person.title && person.title !== "none" ? { title: clean(person.title) } : {}),
    ...(age ? { age, ageUnit: person.ageUnit ?? "years" } : {}),
    ...(optional(person.nationality) ? { nationality: clean(person.nationality) } : {}),
    ...(deathPlace ? { deathPlace } : {}),
    ...(note ? { note } : {}),
    ...(person.noChildren ? { noChildren: true } : {}),
    ...(spouse ? {
      spouse: {
        kind: spouse.relationType === "حرم" ? "harem" as const : "widow" as const,
        ...(optional(spouse.relatedTitle) ? { title: clean(spouse.relatedTitle) } : {}),
        name: clean(spouse.relatedName),
        // «أرملة» تعني أن الزوج متوفى.
        deceased: spouse.relationType === "أرملة" || !!spouse.isHusbandDeceased,
      },
    } : {}),
    ...(father ? { father } : {}),
  };
}

// ───────────────────────── الأقارب ─────────────────────────

function occupationText(workplace?: string, jobStatus?: string): string {
  const place = clean(workplace);
  if (jobStatus === "retired") return place ? `متقاعد من ${place}` : "متقاعد";
  if (jobStatus === "former") return place ? `${place} سابقاً` : "";
  return place;
}

function relationLabel(group: NonNullable<ObituaryFormValues["relatives"]>[number]): string {
  if (!group.relationKey || group.relationKey === "other") return clean(group.relationType);
  return RELATION_OPTIONS.find((option) => option.key === group.relationKey)?.label ?? clean(group.relationType);
}

/** خيار «أخرى» في قائمة الصلة الأصلية للنموذج. */
export const OTHER_RELATION = "أخرى";

/** مقابل مفتاح الصلة في القائمة الأصلية («الأبناء» المحفوظة تظهر «أبناؤه»). */
const KEY_TO_FORM_RELATION: Partial<Record<NonNullable<RelativeGroup["relationKey"]>, string>> = {
  children: "أبناؤه",
  siblings: "أخوانه",
  paternal_uncles: "أعمامه",
  maternal_uncles: "أخواله",
  daughters_husbands: "أصهاره",
  grandchildren: "أحفاده",
};

/** القيمة المعروضة في قائمة الصلة الأصلية؛ ما لا مقابل له فيها يظهر تحت «أخرى» مع نصه. */
export function relationSelectValue(relationType: string | undefined, relationKey: string | undefined, options: readonly string[]): string {
  const text = clean(relationType);
  if (text && text !== OTHER_RELATION && options.includes(text)) return text;
  const legacy = KEY_TO_FORM_RELATION[relationKey as keyof typeof KEY_TO_FORM_RELATION];
  if (legacy && options.includes(legacy)) return legacy;
  return relationKey || text ? OTHER_RELATION : "";
}

function relativesToApi(groups: ObituaryFormValues["relatives"], count: number): RelativeGroup[] {
  return (groups ?? []).map((group) => {
    const relationKey = group.relationKey ?? relationKeyOf({ relation: clean(group.relationType) });
    const reference = linkedToApi(group.reference);
    return {
      relation: relationLabel({ ...group, relationKey }),
      relationKey,
      ...(reference ? { reference } : {}),
      deceasedPlacement: group.deceasedPlacement ?? "auto",
      deceasedIndex: targetIndex(group.deceasedTarget, count),
      people: (group.persons ?? [])
        .filter((person) => clean(person.name))
        .map((person) => {
          const occupation = occupationText(person.workplace, person.jobStatus);
          return { name: clean(person.name), deceased: !!person.isDeceased, ...(occupation ? { occupation } : {}) };
        }),
    };
  }).filter((group) => group.people.length > 0);
}

// ───────────────────────── العزاء ─────────────────────────

/** «16:00» → «4:00 مساءً». */
export function formatTime12h(value?: string | null): string {
  const text = clean(value);
  const match = /^(\d{1,2}):(\d{2})$/u.exec(text);
  if (!match) return text;
  const hours = Number(match[1]);
  const period = hours >= 12 ? "مساءً" : "صباحاً";
  return `${hours % 12 || 12}:${match[2]} ${period}`;
}

/** «4:00 مساءً» → «16:00» (لإعادة الجدول إلى منتقي الوقت عند التعديل). */
function parseTime12h(value: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)$/u.exec(clean(value));
  if (!match) return "";
  let hours = Number(match[1]) % 12;
  if (match[3] === "مساءً") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

const PERIOD_LABELS = { morning: "الفترة الصباحية", evening: "الفترة المسائية", friday: "يوم الجمعة" } as const;

function rangeText(from?: string | null, to?: string | null): string {
  const start = formatTime12h(from);
  const end = formatTime12h(to);
  if (start && end) return `من ${start} إلى ${end}`;
  if (start) return `من ${start}`;
  if (end) return `حتى ${end}`;
  return "";
}

function scheduleToApi(details: FormDetails): CondolenceScheduleEntry[] {
  const entries: CondolenceScheduleEntry[] = [];
  const schedule = details.schedule;
  if (schedule?.enabled) {
    const morning = rangeText(schedule.morningFrom, schedule.morningTo);
    const evening = rangeText(schedule.eveningFrom, schedule.eveningTo);
    if (morning) entries.push({ days: PERIOD_LABELS.morning, time: morning });
    if (evening) entries.push({ days: PERIOD_LABELS.evening, time: evening });
    if (clean(schedule.fridayNote)) entries.push({ days: PERIOD_LABELS.friday, time: clean(schedule.fridayNote) });
  }
  for (const window of details.windows ?? []) {
    const text = [clean(window.note), clean(window.timeString)].filter(Boolean).join(" ");
    if (text && !entries.some((entry) => `${entry.days} ${entry.time}` === text)) entries.push({ days: "", time: text });
  }
  return entries;
}

function cardToApi(details: FormDetails | undefined, audience: "men" | "women", start: string, count: number): CondolenceCard | null {
  if (!details) return null;
  const schedule = scheduleToApi(details);
  return {
    audience,
    deceasedIndex: targetIndex(details.deceasedTarget ?? "all", count),
    ...(optional(details.locationName) ? { location: clean(details.locationName) } : {}),
    ...(optional(details.mapsLink) ? { mapLink: clean(details.mapsLink) } : {}),
    ...(start ? { start } : {}),
    ...(details.durationDays ? { durationDays: details.durationDays } : {}),
    ...(optional(details.until) ? { until: clean(details.until) } : {}),
    ...(schedule.length ? { schedule } : {}),
  };
}

/** «ناصر (الأبناء): 5555» → { name: «ناصر», phone: «5555» }. */
function parsePhone(entry: string): { name?: string; phone?: string } {
  const text = clean(entry);
  const separator = text.lastIndexOf(":");
  if (separator < 0) return /\d/u.test(text) ? { phone: text } : { name: text };
  const name = clean(text.slice(0, separator)).replace(/\s*\([^)]*\)$/u, "");
  const phone = clean(text.slice(separator + 1));
  return { ...(name ? { name } : {}), ...(phone ? { phone } : {}) };
}

// ───────────────────────── النموذج ← الـ API ─────────────────────────

const BURIAL_STATUS_TO_API = { scheduled: "upcoming", done: "completed", pending: "postponed", cancelled: "postponed" } as const;

/**
 * mapFormToPayload: يحوّل قيم النموذج إلى عقد الـ API (ObituaryRequestInput) الذي يقبله الخادم.
 */
export function mapFormToPayload(data: ObituaryFormValues): ObituaryRequestInput {
  const people = data.deceasedList ?? [];
  const count = people.length;
  const mode = count > 1 ? (data.announcementMode === "single" ? "unrelated" : data.announcementMode) : "single";
  const burial = data.burial;
  const prayer = data.prayer;
  const burialStatus = BURIAL_STATUS_TO_API[burial?.status ?? "scheduled"];
  const outside = !!burial?.isOutsideQatar;
  const prayerEnabled = !!prayer?.enabled && burialStatus !== "completed" && !!clean(prayer?.locationName);
  // في النموذج: الصلاة المنفصلة لها مكان فقط، وموعدها هو موعد الدفن المُدخل.
  const prayerDay = clean(prayer?.dateDescription) || clean(burial?.dateDescription);
  const prayerTime = clean(prayer?.timeDescription) || clean(burial?.timeDescription);

  const cond = data.condolences;
  const type = cond?.type ?? "none";
  const options: ObituaryRequestInput["condolenceOptions"] = [];
  if (type === "full" || type === "men_only") options.push("men");
  if (type === "full" || type === "women_only") options.push("women");
  if (type === "cemetery_only") options.push("men_cemetery");
  if (type === "tbd") options.push("tbd");
  const phones = (cond?.phones ?? []).map(parsePhone).filter((contact) => contact.name || contact.phone);
  if (type === "phone_only" || (cond?.withPhones && phones.length)) options.push("phone");

  const start = [clean(data.condolenceStartDate), clean(data.condolenceStartTime)].filter(Boolean).join(" ");
  const cards = [
    options.includes("men") ? cardToApi(cond?.men, "men", start, count) : null,
    options.includes("women") ? cardToApi(cond?.women, "women", start, count) : null,
    ...(cond?.extraVenues ?? [])
      .filter((venue) => options.includes(venue.audience))
      .map((venue) => cardToApi(venue, venue.audience, start, count)),
  ].filter((card): card is CondolenceCard => !!card);

  const sharedParent = mode === "siblings" || mode === "father_first" ? linkedToApi(data.sharedParent) : undefined;

  return {
    messageType: data.messageType ?? "announcement",
    ...(data.messageType !== "announcement" && optional(data.relatedRequestNumber)
      ? { relatedRequestNumber: clean(data.relatedRequestNumber) }
      : {}),
    announcementMode: mode,
    ...(sharedParent ? { sharedParent } : {}),
    ...(data.messageType === "condolence_cancellation" && data.cancellation ? {
      cancellation: {
        audience: data.cancellation.audience,
        from: clean(data.cancellation.from),
        reason: clean(data.cancellation.reason),
        phoneOnly: !!data.cancellation.phoneOnly,
      },
    } : {}),
    deceasedPeople: people.map(deceasedToApi),
    relatives: relativesToApi(data.relatives, count),
    prayer: {
      enabled: prayerEnabled,
      ...(prayerEnabled ? { day: prayerDay, time: prayerTime, place: clean(prayer?.locationName) } : {}),
    },
    burial: {
      status: burialStatus,
      outsideQatar: outside,
      day: clean(burial?.dateDescription),
      time: clean(burial?.timeDescription),
      ...(outside ? { outsideLocation: clean(burial?.locationName) } : { cemetery: optional(burial?.locationName) }),
      ...(optional(burial?.notes) ? { note: clean(burial?.notes) } : {}),
    },
    condolenceOptions: options,
    ...(options.includes("phone") ? { phoneAudience: type === "phone_only" ? "all" : cond?.phoneAudience ?? "all" } : {}),
    ...(optional(cond?.cancellationOrRestrictionReason) ? { condolenceNote: clean(cond?.cancellationOrRestrictionReason) } : {}),
    condolences: cards,
    condolencePhoneContacts: options.includes("phone") ? phones : [],
    ...(optional(data.notes) ? { notes: data.notes!.trim() } : {}),
  };
}

// ───────────────────────── الـ API ← النموذج ─────────────────────────

const PREFIX_TITLES = new Set([
  "الوالد", "الوالدة", "الشاب", "الشابة", "الطفل", "الطفلة", "الرضيع", "الرضيعة", "المولودة",
  "الشيخ", "الشيخة", "فضيلة الشيخ", "سعادة الشيخ", "سعادة", "سعادة السفير",
  "الدكتور", "الدكتورة", "الأستاذ", "اللواء", "العميد", "النقيب", "شهيد الوطن",
]);

function deceasedToForm(person: DeceasedPerson): DeceasedFormValues {
  const female = person.gender === "woman" || person.gender === "girl";
  const known = person.gender !== "other";
  const title = clean(person.title);
  const childTitle = person.gender === "boy" ? "الطفل" : person.gender === "girl" ? "الطفلة" : "none";
  const titleKnown = PREFIX_TITLES.has(title);
  return {
    ...emptyDeceased(),
    // «other» (سجلات قديمة) لا يُحوَّل إلى قيمة افتراضية؛ يُطلب اختيار الجنس من جديد.
    gender: (known ? (female ? "أنثى" : "ذكر") : undefined) as DeceasedFormValues["gender"],
    title: (titleKnown ? title : childTitle) as DeceasedFormValues["title"],
    fullName: person.fullName ?? "",
    identifyBy: person.identifyBy ?? "auto",
    kunya: person.kunya ?? "",
    age: person.age ?? null,
    ageUnit: person.ageUnit ?? "years",
    nationality: person.nationality ?? "",
    deathLocation: person.deathPlace ?? "",
    // لقب حر غير موجود في القائمة (مثل «الوالد اللواء متقاعد») والصفة لا يضيعان.
    notes: [title && !titleKnown ? title : "", person.occupation ?? "", person.note ?? ""].filter(Boolean).join("\n"),
    noChildren: !!person.noChildren,
    femaleRelations: person.spouse?.name ? [{
      relationType: person.spouse.kind === "harem" ? "حرم" : "أرملة",
      relatedTitle: person.spouse.title ?? "",
      relatedName: person.spouse.name,
      isHusbandDeceased: person.spouse.kind === "widow" || !!person.spouse.deceased,
    }] : [],
    father: linkedToForm(person.father),
  };
}

function scheduleToForm(entries: CondolenceScheduleEntry[] | undefined, fallbackTime?: string) {
  const schedule = { ...emptyCondolenceDetails().schedule };
  const windows: FormDetails["windows"] = [];
  for (const entry of entries ?? []) {
    const range = /^(?:من\s+(.+?))?(?:\s*(?:إلى|حتى)\s+(.+))?$/u.exec(clean(entry.time));
    if (entry.days === PERIOD_LABELS.morning && range) {
      schedule.enabled = true;
      schedule.morningFrom = parseTime12h(range[1] ?? "");
      schedule.morningTo = parseTime12h(range[2] ?? "");
    } else if (entry.days === PERIOD_LABELS.evening && range) {
      schedule.enabled = true;
      schedule.eveningFrom = parseTime12h(range[1] ?? "");
      schedule.eveningTo = parseTime12h(range[2] ?? "");
    } else if (entry.days === PERIOD_LABELS.friday) {
      schedule.enabled = true;
      schedule.fridayNote = entry.time ?? "";
    } else {
      windows.push({ periodType: "exact_time", timeString: clean(`${entry.days ?? ""} ${entry.time ?? ""}`), note: "" });
    }
  }
  if (clean(fallbackTime)) windows.push({ periodType: "exact_time", timeString: clean(fallbackTime), note: "" });
  return { schedule, windows };
}

function cardToForm(card: CondolenceCard): FormDetails {
  const location = [
    card.location,
    card.area && `منطقة ${card.area}`,
    card.street && `شارع ${card.street}`,
    card.buildingNumber && `بناية ${card.buildingNumber}`,
    card.houseNumber && `منزل رقم ${card.houseNumber}`,
    card.floor && `الطابق ${card.floor}`,
    card.apartmentNumber && `شقة ${card.apartmentNumber}`,
    card.locationNotes,
  ].filter(Boolean).join(" - ");
  const { schedule, windows } = scheduleToForm(card.schedule, card.time);
  return {
    ...emptyCondolenceDetails(),
    locationName: location,
    mapsLink: card.mapLink ?? "",
    durationDays: card.durationDays ?? null,
    schedule,
    windows,
    deceasedTarget: card.deceasedIndex != null ? String(card.deceasedIndex) : "all",
    until: card.until ?? "",
  };
}

const BURIAL_STATUS_TO_FORM = { upcoming: "scheduled", completed: "done", postponed: "pending" } as const;

/**
 * mapPayloadToForm: يحوّل طلباً محفوظاً (عقد الـ API) إلى قيم النموذج لصفحة التعديل.
 */
export function mapPayloadToForm(request: ObituaryRequest): ObituaryFormValues {
  const base = emptyFormValues();
  const options = request.condolenceOptions ?? [];
  const cards = request.condolences ?? [];
  const menCards = cards.filter((card) => card.audience === "men");
  const womenCards = cards.filter((card) => card.audience === "women");
  const hasMen = options.includes("men");
  const hasWomen = options.includes("women");
  const type = !options.length ? "none"
    : options.includes("men_cemetery") ? "cemetery_only"
    : options.includes("tbd") && !hasMen && !hasWomen ? "tbd"
    : hasMen && hasWomen ? "full"
    : hasMen ? "men_only"
    : hasWomen ? "women_only"
    : "phone_only";
  const firstStart = clean(cards[0]?.start);
  const startMatch = /^(\d{4}-\d{2}-\d{2})(?:\s+(.*))?$/u.exec(firstStart);
  const burial = request.burial;

  return {
    ...base,
    messageType: request.messageType ?? "announcement",
    relatedRequestNumber: request.relatedRequestNumber ?? "",
    cancellation: {
      audience: request.cancellation?.audience ?? "men",
      from: request.cancellation?.from ?? "",
      reason: request.cancellation?.reason ?? "",
      phoneOnly: !!request.cancellation?.phoneOnly,
    },
    announcementMode: request.announcementMode ?? (request.deceasedPeople.length > 1 ? "unrelated" : "single"),
    sharedParent: linkedToForm(request.sharedParent),
    deceasedList: request.deceasedPeople.map(deceasedToForm),
    relatives: (request.relatives ?? []).map((group) => ({
      relationType: group.relation,
      relationKey: relationKeyOf(group),
      reference: linkedToForm(group.reference),
      deceasedPlacement: group.deceasedPlacement ?? "auto",
      deceasedTarget: group.deceasedIndex != null ? String(group.deceasedIndex) : "all",
      persons: group.people.map((person) => ({
        name: person.name,
        isDeceased: person.deceased,
        workplace: person.occupation ?? "",
        jobStatus: "none" as const,
      })),
    })),
    burial: {
      ...base.burial!,
      status: BURIAL_STATUS_TO_FORM[burial?.status ?? "upcoming"],
      isOutsideQatar: !!burial?.outsideQatar,
      locationName: burial?.outsideQatar ? burial?.outsideLocation ?? "" : burial?.cemetery ?? "",
      dateDescription: burial?.day ?? "",
      timeDescription: burial?.time ?? "",
      notes: burial?.note ?? "",
    },
    prayer: {
      ...base.prayer!,
      enabled: !!request.prayer?.enabled,
      locationName: request.prayer?.place ?? "",
      dateDescription: request.prayer?.day ?? "",
      timeDescription: request.prayer?.time ?? "",
    },
    condolences: {
      ...base.condolences!,
      type,
      men: menCards[0] ? cardToForm(menCards[0]) : emptyCondolenceDetails(),
      women: womenCards[0] ? cardToForm(womenCards[0]) : emptyCondolenceDetails(),
      extraVenues: [
        ...menCards.slice(1).map((card) => ({ ...cardToForm(card), audience: "men" as const })),
        ...womenCards.slice(1).map((card) => ({ ...cardToForm(card), audience: "women" as const })),
      ],
      phones: (request.condolencePhoneContacts ?? [])
        .map((contact) => [clean(contact.name), clean(contact.phone)].filter(Boolean).join(": "))
        .filter(Boolean),
      withPhones: options.includes("phone") && type !== "phone_only",
      phoneAudience: request.phoneAudience ?? "all",
      cancellationOrRestrictionReason: request.condolenceNote ?? "",
    },
    condolenceStartDate: startMatch ? startMatch[1] : "",
    condolenceStartTime: startMatch ? startMatch[2] ?? "" : firstStart,
    notes: request.notes ?? "",
  };
}
