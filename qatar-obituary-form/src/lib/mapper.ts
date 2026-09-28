import { ObituaryFormValues } from "./schema";
import { ObituaryRequestInput, ObituaryRequest } from "@workspace/api-client-react";

const DAYS = ["اليوم", "غداً", "السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const TIMES = ["بعد صلاة الفجر", "بعد صلاة الظهر", "بعد صلاة العصر", "بعد صلاة المغرب", "بعد صلاة العشاء", "بعد صلاة الجمعة"];
const CEMETERIES = ["مقبرة مسيمير", "مقبرة الخور", "مقبرة الوكرة الجنوبية", "مقبرة أم صلال علي", "مقبرة الرويس", "مقبرة الريان", "مقبرة الدحيل", "مقبرة الذخيرة", "مقبرة الخريطيات", "مقبرة عين خالد", "مقبرة الوكير", "مقبرة أم قرن", "مقبرة الوسيل", "مقبرة المزروعة"];

const expandValue = (type?: string, other?: string) =>
  type === "أخرى" ? other || "" : type || "";

function cardPayload(card: NonNullable<ObituaryFormValues["condolences"]["menCard"]>, audience: "men" | "women") {
  return {
    audience,
    ...(card.location ? { location: card.location } : {}),
    ...(card.mapLink ? { mapLink: card.mapLink } : {}),
    ...(expandValue(card.startType, card.startOther) ? { start: expandValue(card.startType, card.startOther) } : {}),
    ...(card.expanded && card.durationDays ? { durationDays: card.durationDays } : {}),
    ...(card.expanded && card.time ? { time: card.time } : {}),
    ...(card.expanded && card.houseNumber ? { houseNumber: card.houseNumber } : {}),
    ...(card.expanded && card.buildingNumber ? { buildingNumber: card.buildingNumber } : {}),
    ...(card.expanded && card.street ? { street: card.street } : {}),
    ...(card.expanded && card.area ? { area: card.area } : {}),
    ...(card.expanded && card.floor ? { floor: card.floor } : {}),
    ...(card.expanded && card.apartmentNumber ? { apartmentNumber: card.apartmentNumber } : {}),
    ...(card.expanded && card.locationNotes ? { locationNotes: card.locationNotes } : {}),
  };
}

export function mapFormToPayload(data: ObituaryFormValues): ObituaryRequestInput {
  const options = data.condolences.none
    ? []
    : [
        ...(data.condolences.phone ? ["phone" as const] : []),
        ...(data.condolences.men ? ["men" as const] : []),
        ...(data.condolences.women ? ["women" as const] : []),
      ];

  return {
    deceasedPeople: data.deceasedPeople.map((d) => ({
      fullName: d.fullName,
      gender: d.gender,
      ...(d.age ? { age: d.age } : {}),
      ...(d.nationality ? { nationality: d.nationality } : {}),
      ...(d.deathPlace ? { deathPlace: d.deathPlace } : {}),
      ...(d.title ? { title: d.title } : {}),
      ...(d.occupation ? { occupation: d.occupation } : {}),
      ...(d.note ? { note: d.note } : {}),
    })),
    relatives: data.relatives.map((r) => ({
      relation: r.relationType === "أخرى" ? (r.relationOther || "أخرى") : r.relationType,
      ...(r.familyReference ? { familyReference: r.familyReference } : {}),
      people: r.people.map((p) => ({
        name: p.name,
        deceased: p.deceased,
        ...(p.occupation ? { occupation: p.occupation } : {}),
      })),
    })),
    prayer: {
      enabled: data.prayer.enabled,
      ...(data.prayer.enabled ? {
        day: expandValue(data.prayer.dayType, data.prayer.dayOther),
        time: expandValue(data.prayer.timeType, data.prayer.timeOther),
        place: data.prayer.place,
        mapLink: data.prayer.mapLink,
      } : {}),
    },
    burial: {
      status: data.burial.status,
      outsideQatar: data.burial.outsideQatar,
      day: expandValue(data.burial.dayType, data.burial.dayOther),
      time: expandValue(data.burial.timeType, data.burial.timeOther),
      cemetery: !data.burial.outsideQatar ? (data.burial.cemeteryType === "أخرى" ? data.burial.cemeteryOther : data.burial.cemeteryType) : undefined,
      outsideLocation: data.burial.outsideQatar ? data.burial.outsideLocation : undefined,
      mapLink: data.burial.mapLink,
    },
    condolenceOptions: options,
    condolences: [
      ...(data.condolences.men && data.condolences.menCard ? [cardPayload(data.condolences.menCard, "men")] : []),
      ...(data.condolences.women && data.condolences.womenCard ? [cardPayload(data.condolences.womenCard, "women")] : []),
    ],
    condolencePhoneContacts: data.condolences.phone
      ? data.condolences.phoneContacts
          .filter((contact) => contact.name?.trim() || contact.phone?.trim())
          .map((contact) => ({
            ...(contact.name?.trim() ? { name: contact.name.trim() } : {}),
            ...(contact.phone?.trim() ? { phone: contact.phone.trim() } : {}),
          }))
      : [],
    ...(data.notes ? { notes: data.notes } : {}),
  };
}

function mapStart(start?: string) {
  if (!start) return { type: "", other: "" };
  if (["اليوم", "غداً"].includes(start)) return { type: start, other: "" };
  return { type: "أخرى", other: start };
}

function mapCard(card: ObituaryRequest["condolences"][number] | undefined, audience: "men" | "women") {
  const start = mapStart(card?.start);
  return {
    audience,
    location: card?.location || "",
    mapLink: card?.mapLink || "",
    startType: start.type,
    startOther: start.other,
    expanded: Boolean(card && (
      card.durationDays || card.time || card.houseNumber || card.buildingNumber ||
      card.street || card.area || card.floor || card.apartmentNumber || card.locationNotes
    )),
    durationDays: card?.durationDays ?? null,
    time: card?.time || "",
    houseNumber: card?.houseNumber || "",
    buildingNumber: card?.buildingNumber || "",
    street: card?.street || "",
    area: card?.area || "",
    floor: card?.floor || "",
    apartmentNumber: card?.apartmentNumber || "",
    locationNotes: card?.locationNotes || "",
  };
}

export function mapPayloadToForm(payload: ObituaryRequest): ObituaryFormValues {
  const options = payload.condolenceOptions || [];
  const menCard = payload.condolences?.find((card) => card.audience === "men");
  const womenCard = payload.condolences?.find((card) => card.audience === "women");
  const mapDay = (value?: string) => value && DAYS.includes(value) ? { type: value, other: "" } : { type: value ? "أخرى" : "", other: value || "" };
  const mapTime = (value?: string) => value && TIMES.includes(value) ? { type: value, other: "" } : { type: value ? "أخرى" : "", other: value || "" };
  const burialDay = mapDay(payload.burial?.day);
  const burialTime = mapTime(payload.burial?.time);
  const prayerDay = mapDay(payload.prayer?.day);
  const prayerTime = mapTime(payload.prayer?.time);
  const cemetery = payload.burial?.cemetery || "";

  return {
    deceasedPeople: payload.deceasedPeople.map((d) => ({
      fullName: d.fullName,
      gender: d.gender,
      age: d.age ?? null,
      nationality: d.nationality || "",
      deathPlace: d.deathPlace || "",
      title: d.title || "",
      occupation: d.occupation || "",
      note: d.note || "",
    })),
    relatives: (payload.relatives || []).map((r) => ({
      relationType: ["والد", "والدة", "ابن", "ابنة", "أخ", "أخت", "شقيق", "شقيقة", "عم", "عمة", "خال", "خالة", "جد", "جدة", "زوج", "زوجة/حرم", "أرمل", "أرملة"].includes(r.relation) ? r.relation : "أخرى",
      relationOther: ["والد", "والدة", "ابن", "ابنة", "أخ", "أخت", "شقيق", "شقيقة", "عم", "عمة", "خال", "خالة", "جد", "جدة", "زوج", "زوجة/حرم", "أرمل", "أرملة"].includes(r.relation) ? "" : r.relation,
      familyReference: r.familyReference || "",
      people: r.people.map((p) => ({
        name: p.name,
        occupation: p.occupation || "",
        deceased: p.deceased,
      })),
    })),
    prayer: {
      enabled: payload.prayer?.enabled || false,
      dayType: prayerDay.type,
      dayOther: prayerDay.other,
      timeType: prayerTime.type,
      timeOther: prayerTime.other,
      place: payload.prayer?.place || "",
      mapLink: payload.prayer?.mapLink || "",
    },
    burial: {
      status: payload.burial?.status || "upcoming",
      outsideQatar: payload.burial?.outsideQatar || false,
      dayType: burialDay.type,
      dayOther: burialDay.other,
      timeType: burialTime.type,
      timeOther: burialTime.other,
      cemeteryType: cemetery ? (CEMETERIES.includes(cemetery) ? cemetery : "أخرى") : "",
      cemeteryOther: cemetery && !CEMETERIES.includes(cemetery) ? cemetery : "",
      outsideLocation: payload.burial?.outsideLocation || "",
      mapLink: payload.burial?.mapLink || "",
    },
    condolences: {
      none: options.length === 0,
      phone: options.includes("phone"),
      men: options.includes("men"),
      women: options.includes("women"),
      menCard: mapCard(menCard, "men"),
      womenCard: mapCard(womenCard, "women"),
      phoneContacts: (payload.condolencePhoneContacts || []).map((contact) => ({
        name: contact.name || "",
        phone: contact.phone || "",
      })),
    },
    notes: payload.notes || "",
  };
}