import type {
  CondolenceCard,
  DeceasedPerson,
  LinkedPerson,
  ObituaryRequest,
  ObituaryRequestInput,
  RelativeGroup,
} from "@workspace/api-client-react";
import { RELATION_OPTIONS, relationKeyOf } from "./announcement";
import {
  emptyCondolenceCard,
  emptyDeceased,
  type CondolenceCardFormValues,
  type DeceasedFormValues,
  type ObituaryFormValues,
} from "./schema";

export const RELATIVE_DAYS = ["اليوم", "غداً", "الليلة", "أمس"];
export const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
export const DAYS = [...RELATIVE_DAYS, ...WEEKDAYS];
export const TIMES = [
  "بعد صلاة الفجر", "بعد صلاة الظهر", "بعد صلاة العصر", "بعد صلاة المغرب", "بعد صلاة العشاء",
  "بعد صلاة الجمعة", "بعد صلاة التراويح",
];
/** مقابر الأرشيف (مسيمير تُكتب أيضاً مسمير/ميسمير؛ المزروعة افتُتحت ٢٠٢٦). */
export const CEMETERIES = [
  "مقبرة مسيمير", "مقبرة الخور", "مقبرة الوكرة الجنوبية", "مقبرة أم صلال", "مقبرة الريان", "مقبرة الرويس",
  "مقبرة مريخ", "مقبرة المزروعة", "مقبرة الوكير", "مقبرة الخريطيات", "مقبرة الكعبان", "مقبرة أبوظلوف",
];
export const CONDOLENCE_STARTS = ["اليوم", "غداً", "بعد الدفن"];

const clean = (value?: string | null) => (value ?? "").replace(/\s+/gu, " ").trim();
const optional = (value?: string | null) => clean(value) || undefined;

const expandValue = (type?: string, other?: string) =>
  type === "أخرى" || type === "وقت محدد" ? clean(other) : clean(type);

function linkedPayload(person?: { title?: string; name?: string; deceased?: boolean }): LinkedPerson | undefined {
  if (!clean(person?.name)) return undefined;
  return { ...(optional(person?.title) ? { title: clean(person?.title) } : {}), name: clean(person?.name), deceased: !!person?.deceased };
}

function targetIndex(target: string | undefined, count: number): number | null {
  if (count < 2 || !target || target === "all") return null;
  const index = Number(target);
  return Number.isInteger(index) && index >= 0 && index < count ? index : null;
}

function deceasedPayload(person: DeceasedFormValues): DeceasedPerson {
  const spouse = linkedPayload(person.spouse);
  const age = person.age && person.age > 0 ? person.age : undefined;
  return {
    gender: person.gender,
    identifyBy: person.identifyBy,
    ...(optional(person.fullName) ? { fullName: clean(person.fullName) } : {}),
    ...(optional(person.kunya) ? { kunya: clean(person.kunya) } : {}),
    ...(age ? { age, ageUnit: person.ageUnit } : {}),
    ...(optional(person.nationality) ? { nationality: clean(person.nationality) } : {}),
    ...(optional(person.deathPlace) ? { deathPlace: clean(person.deathPlace) } : {}),
    ...(optional(person.title) ? { title: clean(person.title) } : {}),
    ...(optional(person.occupation) ? { occupation: clean(person.occupation) } : {}),
    ...(optional(person.note) ? { note: clean(person.note) } : {}),
    ...(person.noChildren ? { noChildren: true } : {}),
    ...(spouse ? {
      spouse: {
        ...spouse,
        kind: person.spouse.kind,
        // «أرملة» تعني أن الزوج متوفى.
        deceased: person.spouse.kind === "widow" ? true : spouse.deceased,
      },
    } : {}),
    ...(linkedPayload(person.father) ? { father: linkedPayload(person.father) } : {}),
  };
}

function cardPayload(card: CondolenceCardFormValues, deceasedCount: number): CondolenceCard {
  const start = expandValue(card.startType, card.startOther);
  const schedule = (card.schedule ?? [])
    .map((entry) => ({ days: clean(entry.days), time: clean(entry.time) }))
    .filter((entry) => entry.days || entry.time);
  return {
    audience: card.audience,
    deceasedIndex: targetIndex(card.deceasedTarget, deceasedCount),
    ...(optional(card.location) ? { location: clean(card.location) } : {}),
    ...(optional(card.mapLink) ? { mapLink: clean(card.mapLink) } : {}),
    ...(start ? { start } : {}),
    // التفاصيل تُحفظ دائماً، حتى لو طُوي قسمها في الواجهة.
    ...(card.durationDays ? { durationDays: card.durationDays } : {}),
    ...(optional(card.time) ? { time: clean(card.time) } : {}),
    ...(optional(card.until) ? { until: clean(card.until) } : {}),
    ...(schedule.length ? { schedule } : {}),
    ...(optional(card.houseNumber) ? { houseNumber: clean(card.houseNumber) } : {}),
    ...(optional(card.buildingNumber) ? { buildingNumber: clean(card.buildingNumber) } : {}),
    ...(optional(card.street) ? { street: clean(card.street) } : {}),
    ...(optional(card.area) ? { area: clean(card.area) } : {}),
    ...(optional(card.floor) ? { floor: clean(card.floor) } : {}),
    ...(optional(card.apartmentNumber) ? { apartmentNumber: clean(card.apartmentNumber) } : {}),
    ...(optional(card.locationNotes) ? { locationNotes: clean(card.locationNotes) } : {}),
  };
}

function relationLabel(group: ObituaryFormValues["relatives"][number]): string {
  if (group.relationKey === "other") return clean(group.relationOther);
  return RELATION_OPTIONS.find((option) => option.key === group.relationKey)?.label ?? "";
}

export function mapFormToPayload(data: ObituaryFormValues): ObituaryRequestInput {
  const count = data.deceasedPeople.length;
  const mode = count > 1 ? (data.announcementMode === "single" ? "unrelated" : data.announcementMode) : "single";
  const condolences = data.condolences;
  const options = condolences.none
    ? []
    : [
        ...(condolences.men && condolences.menMode === "venue" ? ["men" as const] : []),
        ...(condolences.men && condolences.menMode === "cemetery" ? ["men_cemetery" as const] : []),
        ...(condolences.women ? ["women" as const] : []),
        ...(condolences.phone ? ["phone" as const] : []),
        ...(condolences.tbd ? ["tbd" as const] : []),
      ];
  const sharedParent = mode === "siblings" || mode === "father_first" ? linkedPayload(data.sharedParent) : undefined;
  const relativeDay = (day?: string) => RELATIVE_DAYS.includes(day ?? "");

  return {
    messageType: data.messageType,
    ...(data.messageType !== "announcement" && optional(data.relatedRequestNumber)
      ? { relatedRequestNumber: clean(data.relatedRequestNumber) }
      : {}),
    announcementMode: mode,
    ...(sharedParent ? { sharedParent } : {}),
    ...(data.messageType === "condolence_cancellation" ? {
      cancellation: {
        audience: data.cancellation.audience,
        from: clean(data.cancellation.from),
        reason: clean(data.cancellation.reason),
        phoneOnly: data.cancellation.phoneOnly,
      },
    } : {}),
    deceasedPeople: data.deceasedPeople.map(deceasedPayload),
    relatives: data.relatives.map((group): RelativeGroup => ({
      relation: relationLabel(group),
      relationKey: group.relationKey,
      ...(optional(group.familyReference) ? { familyReference: clean(group.familyReference) } : {}),
      ...(linkedPayload(group.reference) ? { reference: linkedPayload(group.reference) } : {}),
      deceasedPlacement: group.deceasedPlacement,
      deceasedIndex: targetIndex(group.deceasedTarget, count),
      people: group.people.map((person) => ({
        name: clean(person.name),
        deceased: person.deceased,
        ...(optional(person.occupation) ? { occupation: clean(person.occupation) } : {}),
      })),
    })),
    prayer: {
      enabled: data.prayer.enabled,
      ...(data.prayer.enabled ? {
        day: expandValue(data.prayer.dayType, data.prayer.dayOther),
        ...(relativeDay(data.prayer.dayType) && optional(data.prayer.weekday) ? { weekday: clean(data.prayer.weekday) } : {}),
        time: expandValue(data.prayer.timeType, data.prayer.timeOther),
        place: clean(data.prayer.place),
        mapLink: clean(data.prayer.mapLink),
      } : {}),
    },
    burial: {
      status: data.burial.status,
      outsideQatar: data.burial.outsideQatar,
      day: expandValue(data.burial.dayType, data.burial.dayOther),
      ...(relativeDay(data.burial.dayType) && optional(data.burial.weekday) ? { weekday: clean(data.burial.weekday) } : {}),
      time: expandValue(data.burial.timeType, data.burial.timeOther),
      cemetery: !data.burial.outsideQatar ? expandValue(data.burial.cemeteryType, data.burial.cemeteryOther) || undefined : undefined,
      outsideLocation: data.burial.outsideQatar ? clean(data.burial.outsideLocation) : undefined,
      mapLink: clean(data.burial.mapLink),
      ...(data.burial.status === "postponed" && optional(data.burial.postponeNote) ? { postponeNote: clean(data.burial.postponeNote) } : {}),
    },
    condolenceOptions: options,
    ...(options.includes("phone") ? { phoneAudience: condolences.phoneAudience } : {}),
    ...(optional(condolences.note) ? { condolenceNote: clean(condolences.note) } : {}),
    condolences: condolences.cards
      .filter((card) => (card.audience === "men" ? options.includes("men") : options.includes("women")))
      .map((card) => cardPayload(card, count)),
    condolencePhoneContacts: options.includes("phone")
      ? condolences.phoneContacts
          .filter((contact) => clean(contact.name) || clean(contact.phone))
          .map((contact) => ({
            ...(optional(contact.name) ? { name: clean(contact.name) } : {}),
            ...(optional(contact.phone) ? { phone: clean(contact.phone) } : {}),
          }))
      : [],
    ...(optional(data.notes) ? { notes: data.notes!.trim() } : {}),
  };
}

function splitChoice(value: string | undefined, choices: string[], otherLabel = "أخرى") {
  const text = clean(value);
  if (!text) return { type: "", other: "" };
  return choices.includes(text) ? { type: text, other: "" } : { type: otherLabel, other: text };
}

function linkedForm(person?: LinkedPerson) {
  return { title: person?.title ?? "", name: person?.name ?? "", deceased: !!person?.deceased };
}

function cardForm(card: CondolenceCard): CondolenceCardFormValues {
  const start = splitChoice(card.start, CONDOLENCE_STARTS);
  const base = emptyCondolenceCard(card.audience);
  return {
    ...base,
    deceasedTarget: card.deceasedIndex != null ? String(card.deceasedIndex) : "all",
    location: card.location ?? "",
    mapLink: card.mapLink ?? "",
    startType: start.type,
    startOther: start.other,
    expanded: Boolean(
      card.durationDays || card.time || card.until || card.schedule?.length || card.houseNumber || card.buildingNumber
      || card.street || card.area || card.floor || card.apartmentNumber || card.locationNotes,
    ),
    durationDays: card.durationDays ?? null,
    time: card.time ?? "",
    until: card.until ?? "",
    schedule: (card.schedule ?? []).map((entry) => ({ days: entry.days ?? "", time: entry.time ?? "" })),
    houseNumber: card.houseNumber ?? "",
    buildingNumber: card.buildingNumber ?? "",
    street: card.street ?? "",
    area: card.area ?? "",
    floor: card.floor ?? "",
    apartmentNumber: card.apartmentNumber ?? "",
    locationNotes: card.locationNotes ?? "",
  };
}

export function mapPayloadToForm(payload: ObituaryRequest): ObituaryFormValues {
  const options = payload.condolenceOptions || [];
  const burialDay = splitChoice(payload.burial?.day, DAYS);
  const burialTime = splitChoice(payload.burial?.time, TIMES);
  const prayerDay = splitChoice(payload.prayer?.day, DAYS);
  const prayerTime = splitChoice(payload.prayer?.time, TIMES);
  const cemetery = splitChoice(payload.burial?.cemetery, CEMETERIES);
  const count = payload.deceasedPeople.length;

  return {
    messageType: payload.messageType ?? "announcement",
    relatedRequestNumber: payload.relatedRequestNumber ?? "",
    announcementMode: payload.announcementMode ?? (count > 1 ? "unrelated" : "single"),
    sharedParent: linkedForm(payload.sharedParent),
    cancellation: {
      audience: payload.cancellation?.audience ?? "men",
      from: payload.cancellation?.from ?? "",
      reason: payload.cancellation?.reason ?? "",
      phoneOnly: !!payload.cancellation?.phoneOnly,
    },
    deceasedPeople: payload.deceasedPeople.map((person) => ({
      ...emptyDeceased(),
      fullName: person.fullName ?? "",
      // الجنس «other» (سجلات قديمة) لا يُحوَّل إلى قيمة افتراضية؛ يُطلب اختياره من جديد.
      gender: (person.gender === "other" ? undefined : person.gender) as DeceasedFormValues["gender"],
      identifyBy: person.identifyBy ?? "name",
      kunya: person.kunya ?? "",
      age: person.age ?? null,
      ageUnit: person.ageUnit ?? "years",
      nationality: person.nationality ?? "",
      deathPlace: person.deathPlace ?? "",
      title: person.title ?? "",
      occupation: person.occupation ?? "",
      note: person.note ?? "",
      noChildren: !!person.noChildren,
      spouse: { ...linkedForm(person.spouse), kind: person.spouse?.kind ?? "harem" },
      father: linkedForm(person.father),
    })),
    relatives: (payload.relatives || []).map((group) => {
      const key = relationKeyOf(group);
      return {
        relationKey: key,
        relationOther: key === "other" ? group.relation : "",
        familyReference: group.familyReference ?? "",
        reference: linkedForm(group.reference),
        deceasedPlacement: group.deceasedPlacement ?? "auto",
        deceasedTarget: group.deceasedIndex != null ? String(group.deceasedIndex) : "all",
        people: group.people.map((person) => ({
          name: person.name,
          occupation: person.occupation ?? "",
          deceased: person.deceased,
        })),
      };
    }),
    prayer: {
      enabled: payload.prayer?.enabled || false,
      dayType: prayerDay.type,
      dayOther: prayerDay.other,
      weekday: payload.prayer?.weekday ?? "",
      timeType: prayerTime.type,
      timeOther: prayerTime.other,
      place: payload.prayer?.place ?? "",
      mapLink: payload.prayer?.mapLink ?? "",
    },
    burial: {
      status: payload.burial?.status || "upcoming",
      outsideQatar: payload.burial?.outsideQatar || false,
      dayType: burialDay.type,
      dayOther: burialDay.other,
      weekday: payload.burial?.weekday ?? "",
      timeType: burialTime.type,
      timeOther: burialTime.other,
      cemeteryType: cemetery.type,
      cemeteryOther: cemetery.other,
      outsideLocation: payload.burial?.outsideLocation ?? "",
      mapLink: payload.burial?.mapLink ?? "",
      postponeNote: payload.burial?.postponeNote ?? "",
    },
    condolences: {
      none: options.length === 0,
      phone: options.includes("phone"),
      men: options.includes("men") || options.includes("men_cemetery"),
      menMode: options.includes("men_cemetery") && !options.includes("men") ? "cemetery" : "venue",
      women: options.includes("women"),
      tbd: options.includes("tbd"),
      phoneAudience: payload.phoneAudience ?? "all",
      note: payload.condolenceNote ?? "",
      cards: (payload.condolences || []).map(cardForm),
      phoneContacts: (payload.condolencePhoneContacts || []).map((contact) => ({
        name: contact.name ?? "",
        phone: contact.phone ?? "",
      })),
    },
    notes: payload.notes ?? "",
  };
}
