import { ObituaryPayload, ObituaryPayloadSchema } from "./schema";

const VALID_TITLES = new Set([
  "الوالد", "الوالدة", "الشاب", "الشابة", "الطفل", "الطفلة", "الرضيع", "المولودة",
  "الشيخ", "الشيخة", "فضيلة الشيخ", "سعادة الشيخ", "سعادة", "سعادة السفير", 
  "الدكتور", "الدكتورة", "الأستاذ", "اللواء", "العميد", "النقيب", "شهيد الوطن", "none"
]);

const VALID_JOB_STATUSES = new Set(["active", "retired", "former", "none"]);
const VALID_EVENT_STATUSES = new Set(["scheduled", "pending", "done", "cancelled"]);
const VALID_LOCATION_TYPES = new Set(["منزل", "مجلس", "خيمة", "قاعة", "شقة", "none"]);
const VALID_CONDOLENCE_TYPES = new Set(["full", "men_only", "women_only", "cemetery_only", "phone_only", "none"]);

const DAYS = ["اليوم", "غداً", "السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const TIMES = ["بعد صلاة الفجر", "بعد صلاة الظهر", "بعد صلاة العصر", "بعد صلاة المغرب", "بعد صلاة العشاء", "بعد صلاة الجمعة"];
const CEMETERIES = [
  "مقبرة مسيمير", "مقبرة الخور", "مقبرة الوكرة الجنوبية", "مقبرة أم صلال علي", 
  "مقبرة الرويس", "مقبرة الريان", "مقبرة الدحيل", "مقبرة الذخيرة", 
  "مقبرة الخريطيات", "مقبرة عين خالد", "مقبرة الوكير", "مقبرة أم قرن", 
  "مقبرة الوسيل", "مقبرة المزروعة"
];

function mapGender(gender?: unknown): "ذكر" | "أنثى" {
  if (typeof gender !== "string") return "ذكر";
  const g = gender.trim();
  if (g === "أنثى" || g === "امرأة" || g === "woman" || g === "female" || g === "بنت" || g === "girl") return "أنثى";
  return "ذكر";
}

function mapTitle(title?: unknown): any {
  if (typeof title === "string" && VALID_TITLES.has(title.trim())) {
    return title.trim();
  }
  return "none";
}

function mapLocationType(val?: unknown, fallbackText?: string): "منزل" | "مجلس" | "خيمة" | "قاعة" | "شقة" | "none" {
  if (typeof val === "string" && VALID_LOCATION_TYPES.has(val.trim())) {
    return val.trim() as any;
  }
  if (typeof fallbackText === "string") {
    if (fallbackText.includes("مجلس")) return "مجلس";
    if (fallbackText.includes("خيمة")) return "خيمة";
    if (fallbackText.includes("قاعة")) return "قاعة";
    if (fallbackText.includes("شقة")) return "شقة";
    if (fallbackText.includes("منزل") || fallbackText.includes("بيت")) return "منزل";
  }
  return "none";
}

function mapUrl(url?: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function mapCondolenceDetails(cardOrDetails: any) {
  if (!cardOrDetails || typeof cardOrDetails !== "object") return undefined;

  const detailedLocationParts = [
    cardOrDetails.locationName || cardOrDetails.location,
    cardOrDetails.area ? `منطقة ${cardOrDetails.area}` : "",
    cardOrDetails.street ? `شارع ${cardOrDetails.street}` : "",
    cardOrDetails.buildingNumber ? `مبنى ${cardOrDetails.buildingNumber}` : "",
    cardOrDetails.houseNumber ? `منزل ${cardOrDetails.houseNumber}` : "",
    cardOrDetails.floor ? `طابق ${cardOrDetails.floor}` : "",
    cardOrDetails.apartmentNumber ? `شقة ${cardOrDetails.apartmentNumber}` : "",
  ].filter(Boolean);

  const locationName = detailedLocationParts.length > 0 
    ? detailedLocationParts.join(" - ") 
    : (cardOrDetails.locationName || cardOrDetails.location || undefined);

  const mapsLink = mapUrl(cardOrDetails.mapsLink || cardOrDetails.mapLink);

  const durationDays = typeof cardOrDetails.durationDays === "number" && !isNaN(cardOrDetails.durationDays)
    ? cardOrDetails.durationDays
    : (typeof cardOrDetails.durationDays === "string" && cardOrDetails.durationDays.trim() !== "" 
        ? parseInt(cardOrDetails.durationDays, 10) 
        : undefined);

  const rawSchedule = cardOrDetails.schedule;
  const schedule = rawSchedule ? {
    enabled: Boolean(rawSchedule.enabled),
    morningFrom: typeof rawSchedule.morningFrom === "string" ? rawSchedule.morningFrom.trim() : "",
    morningTo: typeof rawSchedule.morningTo === "string" ? rawSchedule.morningTo.trim() : "",
    eveningFrom: typeof rawSchedule.eveningFrom === "string" ? rawSchedule.eveningFrom.trim() : "",
    eveningTo: typeof rawSchedule.eveningTo === "string" ? rawSchedule.eveningTo.trim() : "",
    fridayNote: typeof rawSchedule.fridayNote === "string" ? rawSchedule.fridayNote.trim() : "",
  } : undefined;

  let windows: any[] | undefined = undefined;
  if (Array.isArray(cardOrDetails.windows) && cardOrDetails.windows.length > 0) {
    windows = cardOrDetails.windows;
  } else if (schedule?.enabled) {
    const generated: any[] = [];
    if (schedule.morningFrom || schedule.morningTo) {
      generated.push({
        periodType: "morning",
        timeString: `من ${schedule.morningFrom || "..."} إلى ${schedule.morningTo || "..."}`,
        note: "الفترة الصباحية",
      });
    }
    if (schedule.eveningFrom || schedule.eveningTo) {
      generated.push({
        periodType: "evening",
        timeString: `من ${schedule.eveningFrom || "..."} إلى ${schedule.eveningTo || "..."}`,
        note: "الفترة المسائية",
      });
    }
    if (schedule.fridayNote) {
      generated.push({
        periodType: "exact_time",
        timeString: schedule.fridayNote,
        note: "يوم الجمعة",
      });
    }
    if (generated.length > 0) windows = generated;
  } else if (cardOrDetails.time || cardOrDetails.startType || cardOrDetails.start) {
    const timeStr = typeof cardOrDetails.time === "string" ? cardOrDetails.time.trim() : undefined;
    const startDesc = cardOrDetails.startType
      ? (cardOrDetails.startType === "أخرى" ? cardOrDetails.startOther : cardOrDetails.startType)
      : (cardOrDetails.start || "");

    const note = [
      startDesc ? `بداية العزاء: ${startDesc}` : "",
      cardOrDetails.locationNotes?.trim() || ""
    ].filter(Boolean).join(" - ") || undefined;

    let periodType: "morning" | "evening" | "after_taraweeh" | "exact_time" | "open" = "open";
    if (timeStr) {
      if (timeStr.includes("صباح")) periodType = "morning";
      else if (timeStr.includes("مساء") || timeStr.includes("عصر") || timeStr.includes("مغرب") || timeStr.includes("عشاء")) periodType = "evening";
      else if (timeStr.includes("تراويح")) periodType = "after_taraweeh";
      else periodType = "exact_time";
    }

    if (timeStr || note) {
      windows = [{
        periodType,
        timeString: timeStr,
        note,
      }];
    }
  }

  return {
    locationName: locationName || undefined,
    mapsLink,
    durationDays: durationDays && !isNaN(durationDays) ? durationDays : undefined,
    schedule,
    windows,
  };
}

/**
 * mapFormToPayload:
 * الجسر الآمن الذي يحول مدخلات النموذج الحالية (سواء بالهيكلة السابقة أو الجزئية)
 * إلى كائن يتطابق 100% مع ObituaryPayloadSchema الجديد.
 */
export function mapFormToPayload(data: any): ObituaryPayload {
  const safeData = data && typeof data === "object" ? data : {};

  // 1. المتوفين: تحويل deceasedPeople / deceasedList
  const rawDeceased = Array.isArray(safeData.deceasedList) && safeData.deceasedList.length > 0
    ? safeData.deceasedList
    : Array.isArray(safeData.deceasedPeople) && safeData.deceasedPeople.length > 0
      ? safeData.deceasedPeople
      : [{ fullName: safeData.deceasedName || "متوفى", gender: "رجل" }];

  const deceasedList = rawDeceased.map((d: any) => {
    const gender = mapGender(d?.gender);
    const title = mapTitle(d?.title);
    const fullName = typeof d?.fullName === "string" && d.fullName.trim().length > 0 
      ? d.fullName.trim() 
      : undefined;

    const age = typeof d?.age === "number" && !isNaN(d.age) 
      ? d.age 
      : (typeof d?.age === "string" && d.age.trim() !== "" ? parseInt(d.age, 10) : undefined);

    const nationality = typeof d?.nationality === "string" && d.nationality.trim().length > 0
      ? d.nationality.trim()
      : undefined;

    const deathLocation = typeof d?.deathLocation === "string" && d.deathLocation.trim().length > 0
      ? d.deathLocation.trim()
      : typeof d?.deathPlace === "string" && d.deathPlace.trim().length > 0
        ? d.deathPlace.trim()
        : undefined;

    const femaleRelations = Array.isArray(d?.femaleRelations) && d.femaleRelations.length > 0
      ? d.femaleRelations.map((fr: any) => {
          const relType = fr?.relationType === "حرم" ? "حرم" as const : "أرملة" as const;
          return {
            relationType: relType,
            relatedName: fr?.relatedName || "",
            isHusbandDeceased: relType === "أرملة" ? true : Boolean(fr?.isHusbandDeceased),
          };
        })
      : undefined;

    return {
      ...(d?.id ? { id: d.id } : {}),
      gender,
      title,
      fullName: fullName || (gender === "أنثى" && femaleRelations && femaleRelations.length > 0 ? undefined : (fullName || "الفقيد")),
      age: age && !isNaN(age) ? age : undefined,
      nationality,
      deathLocation,
      notes: typeof d?.notes === "string" && d.notes.trim() ? d.notes.trim() : undefined,
      femaleRelations,
    };
  });

  // 2. الأقارب: تحويل المصفوفة إلى relatives مع persons و isDeceased و workplace
  const rawRelatives = Array.isArray(safeData.relatives) ? safeData.relatives : [];
  const relatives = rawRelatives.map((r: any) => {
    const relationType = r?.relationType === "أخرى"
      ? (r?.relationOther?.trim() || "أخرى")
      : (r?.relationType?.trim() || r?.relation?.trim() || "أقارب");

    const sourcePersons = Array.isArray(r?.persons)
      ? r.persons
      : Array.isArray(r?.people)
        ? r.people
        : [];

    const persons = sourcePersons.map((p: any) => ({
      name: typeof p?.name === "string" ? p.name.trim() : "",
      isDeceased: Boolean(p?.isDeceased ?? p?.deceased ?? false),
      workplace: p?.workplace?.trim() || p?.occupation?.trim() || undefined,
      jobStatus: VALID_JOB_STATUSES.has(p?.jobStatus) ? p.jobStatus : "none",
    })).filter((p: any) => p.name.length > 0);

    return {
      relationType,
      persons: persons.length > 0 ? persons : [{ name: "قريب", isDeceased: false, jobStatus: "none" as const }],
    };
  }).filter((r: any) => r.persons.length > 0);

  // 3. الدفن: EventLocationSchema
  const rawBurial = safeData.burial || {};
  const burialStatus = (() => {
    const s = rawBurial.status;
    if (s === "done" || s === "completed") return "done" as const;
    if (s === "pending") return "pending" as const;
    if (s === "cancelled") return "cancelled" as const;
    return "scheduled" as const;
  })();

  const isBurialOutside = Boolean(rawBurial.isOutsideQatar ?? rawBurial.outsideQatar ?? false);
  const burialLocation = isBurialOutside
    ? (rawBurial.locationName?.trim() || rawBurial.outsideLocation?.trim() || undefined)
    : (rawBurial.locationName?.trim() 
        || (rawBurial.cemeteryType === "أخرى" ? rawBurial.cemeteryOther?.trim() : rawBurial.cemeteryType?.trim())
        || rawBurial.cemetery?.trim()
        || undefined);

  const burialDate = rawBurial.dateDescription?.trim()
    || (rawBurial.dayType === "أخرى" ? rawBurial.dayOther?.trim() : rawBurial.dayType?.trim())
    || rawBurial.day?.trim()
    || undefined;

  const burialTime = rawBurial.timeDescription?.trim()
    || (["وقت محدد", "أخرى"].includes(rawBurial.timeType || "") ? rawBurial.timeOther?.trim() : rawBurial.timeType?.trim())
    || rawBurial.time?.trim()
    || undefined;

  const burialNotes = typeof rawBurial.notes === "string" && rawBurial.notes.trim() ? rawBurial.notes.trim() : undefined;

  const burial = burialStatus === "done" ? {
    status: "done" as const,
    isOutsideQatar: false,
    locationName: undefined,
    dateDescription: undefined,
    timeDescription: undefined,
    notes: burialNotes,
  } : {
    status: burialStatus,
    isOutsideQatar: isBurialOutside,
    locationName: burialLocation,
    dateDescription: burialDate,
    timeDescription: burialTime,
    notes: burialNotes,
  };

  // 4. الصلاة: فصل الصلاة ككيان مستقل (نشط فقط إذا كان الدفن غير منتهٍ والزر مفعلاً يدوياً)
  const rawPrayer = safeData.prayer || {};
  const isPrayerActive = Boolean(
    burialStatus !== "done" &&
    rawPrayer.enabled === true &&
    (rawPrayer.locationName?.trim() || rawPrayer.place?.trim())
  );

  const prayer = isPrayerActive ? {
    enabled: true,
    status: (VALID_EVENT_STATUSES.has(rawPrayer.status) ? rawPrayer.status : "scheduled") as "scheduled" | "pending" | "done" | "cancelled",
    isOutsideQatar: Boolean(rawPrayer.isOutsideQatar ?? false),
    locationName: rawPrayer.locationName?.trim() || rawPrayer.place?.trim() || undefined,
    dateDescription: rawPrayer.dateDescription?.trim()
      || (rawPrayer.dayType === "أخرى" ? rawPrayer.dayOther?.trim() : rawPrayer.dayType?.trim())
      || rawPrayer.day?.trim()
      || undefined,
    timeDescription: rawPrayer.timeDescription?.trim()
      || (["وقت محدد", "أخرى"].includes(rawPrayer.timeType || "") ? rawPrayer.timeOther?.trim() : rawPrayer.timeType?.trim())
      || rawPrayer.time?.trim()
      || undefined,
    notes: typeof rawPrayer.notes === "string" && rawPrayer.notes.trim() ? rawPrayer.notes.trim() : undefined,
  } : undefined;

  // 5. العزاء: تحويل نوع العزاء والتفاصيل
  const rawCond = safeData.condolences || {};
  let condType: "full" | "men_only" | "women_only" | "cemetery_only" | "phone_only" | "none" = "full";

  if (typeof rawCond.type === "string" && VALID_CONDOLENCE_TYPES.has(rawCond.type)) {
    condType = rawCond.type as any;
  } else if (rawCond.none === true || (Array.isArray(safeData.condolenceOptions) && safeData.condolenceOptions.length === 0)) {
    condType = "none";
  } else {
    const hasMen = Boolean(rawCond.men || rawCond.menCard || (Array.isArray(safeData.condolenceOptions) && safeData.condolenceOptions.includes("men")));
    const hasWomen = Boolean(rawCond.women || rawCond.womenCard || (Array.isArray(safeData.condolenceOptions) && safeData.condolenceOptions.includes("women")));
    const hasPhone = Boolean(rawCond.phone || (Array.isArray(rawCond.phones) && rawCond.phones.length > 0) || (Array.isArray(rawCond.phoneContacts) && rawCond.phoneContacts.length > 0) || (Array.isArray(safeData.condolenceOptions) && safeData.condolenceOptions.includes("phone")));

    if (hasMen && hasWomen) condType = "full";
    else if (hasMen && !hasWomen) condType = "men_only";
    else if (!hasMen && hasWomen) condType = "women_only";
    else if (hasPhone) condType = "phone_only";
    else condType = "none";
  }

  // الهواتف: تسطيح كائنات الهواتف إلى مصفوفة نصوص phones: string[]
  const phonesList: string[] = [];
  if (Array.isArray(rawCond.phones)) {
    rawCond.phones.forEach((p: unknown) => {
      if (typeof p === "string" && p.trim()) phonesList.push(p.trim());
    });
  }
  const sourceContacts = Array.isArray(rawCond.phoneContacts) 
    ? rawCond.phoneContacts 
    : Array.isArray(safeData.condolencePhoneContacts) 
      ? safeData.condolencePhoneContacts 
      : [];

  sourceContacts.forEach((c: any) => {
    if (!c) return;
    if (typeof c === "string" && c.trim()) {
      phonesList.push(c.trim());
    } else if (typeof c === "object") {
      const phone = typeof c.phone === "string" ? c.phone.trim() : "";
      const name = typeof c.name === "string" ? c.name.trim() : "";
      if (name && phone) phonesList.push(`${name}: ${phone}`);
      else if (phone) phonesList.push(phone);
      else if (name) phonesList.push(name);
    }
  });

  const condolences = {
    type: condType,
    men: (condType === "full" || condType === "men_only") 
      ? mapCondolenceDetails(rawCond.men || rawCond.menCard) 
      : undefined,
    women: (condType === "full" || condType === "women_only") 
      ? mapCondolenceDetails(rawCond.women || rawCond.womenCard) 
      : undefined,
    phones: phonesList.length > 0 ? Array.from(new Set(phonesList)) : undefined,
    cancellationOrRestrictionReason: typeof rawCond.cancellationOrRestrictionReason === "string" && rawCond.cancellationOrRestrictionReason.trim()
      ? rawCond.cancellationOrRestrictionReason.trim()
      : undefined,
  };

  const payload: ObituaryPayload = {
    deceasedList,
    relatives: relatives.length > 0 ? relatives : undefined,
    burial,
    prayer,
    condolences,
    condolenceStartDate: typeof safeData.condolenceStartDate === "string" && safeData.condolenceStartDate.trim() ? safeData.condolenceStartDate.trim() : undefined,
    notes: typeof safeData.notes === "string" && safeData.notes.trim() ? safeData.notes.trim() : undefined,
  };

  return ObituaryPayloadSchema.parse(payload);
}

/**
 * mapPayloadToForm:
 * يحول كائن الـ Payload المحفوظ (بأي صيغة) إلى حالة النموذج
 * بما يضمن التوافق التام مع واجهات التعديل والعرض.
 */
export function mapPayloadToForm(payload: any): any {
  if (!payload || typeof payload !== "object") return {};

  const deceasedSource = Array.isArray(payload.deceasedList) && payload.deceasedList.length > 0
    ? payload.deceasedList
    : Array.isArray(payload.deceasedPeople) && payload.deceasedPeople.length > 0
      ? payload.deceasedPeople
      : [{ fullName: payload.deceasedName || "", gender: "man" }];

  const deceasedPeople = deceasedSource.map((d: any) => {
    let genderEng = "man";
    const g = d?.gender;
    if (g === "امرأة" || g === "woman" || g === "female") genderEng = "woman";
    else if (g === "ولد" || g === "boy") genderEng = "boy";
    else if (g === "بنت" || g === "girl") genderEng = "girl";
    else if (g === "آخر" || g === "other") genderEng = "other";

    return {
      id: d?.id,
      fullName: d?.fullName || "",
      gender: genderEng,
      age: typeof d?.age === "number" ? d.age : null,
      nationality: d?.nationality || "",
      deathPlace: d?.deathLocation || d?.deathPlace || "",
      title: d?.title && d.title !== "none" ? d.title : "",
      occupation: d?.occupation || "",
      note: d?.note || "",
      femaleRelations: d?.femaleRelations || [],
    };
  });

  const relatives = (Array.isArray(payload.relatives) ? payload.relatives : []).map((r: any) => {
    const rawPersons = Array.isArray(r.persons) ? r.persons : Array.isArray(r.people) ? r.people : [];
    const relationType = r.relationType || r.relation || "";
    const isStandard = ["والد", "والدة", "ابن", "ابنة", "أخ", "أخت", "شقيق", "شقيقة", "عم", "عمة", "خال", "خالة", "جد", "جدة", "زوج", "زوجة/حرم", "أرمل", "أرملة"].includes(relationType);

    return {
      relationType: isStandard ? relationType : "أخرى",
      relationOther: isStandard ? "" : relationType,
      familyReference: r.familyReference || "",
      people: rawPersons.map((p: any) => ({
        name: p.name || "",
        occupation: p.workplace || p.occupation || "",
        deceased: Boolean(p.isDeceased ?? p.deceased ?? false),
        jobStatus: p.jobStatus || "none",
      })),
      persons: rawPersons.map((p: any) => ({
        name: p.name || "",
        workplace: p.workplace || p.occupation || "",
        isDeceased: Boolean(p.isDeceased ?? p.deceased ?? false),
        jobStatus: p.jobStatus || "none",
      })),
    };
  });

  const mapDay = (val?: string) => val && DAYS.includes(val) ? { type: val, other: "" } : { type: val ? "أخرى" : "", other: val || "" };
  const mapTime = (val?: string) => val && TIMES.includes(val) ? { type: val, other: "" } : { type: val ? "أخرى" : "", other: val || "" };

  const burialDay = mapDay(payload.burial?.dateDescription || payload.burial?.day);
  const burialTime = mapTime(payload.burial?.timeDescription || payload.burial?.time);
  const cemetery = payload.burial?.locationName || payload.burial?.cemetery || "";
  const isOutside = Boolean(payload.burial?.isOutsideQatar ?? payload.burial?.outsideQatar ?? false);

  const prayerDay = mapDay(payload.prayer?.dateDescription || payload.prayer?.day);
  const prayerTime = mapTime(payload.prayer?.timeDescription || payload.prayer?.time);
  const hasPrayer = Boolean(payload.prayer && (payload.prayer.locationName || payload.prayer.place || payload.prayer.dateDescription || payload.prayer.day));

  const cond = payload.condolences || {};
  const condType = cond.type || "full";
  const isNone = condType === "none" || cond.none === true;
  const isPhoneOnly = condType === "phone_only";
  const hasMen = !isNone && !isPhoneOnly && (condType === "full" || condType === "men_only" || Boolean(cond.men || cond.menCard));
  const hasWomen = !isNone && !isPhoneOnly && (condType === "full" || condType === "women_only" || Boolean(cond.women || cond.womenCard));
  const hasPhone = !isNone && (isPhoneOnly || Boolean(cond.phones && cond.phones.length > 0) || Boolean(cond.phoneContacts && cond.phoneContacts.length > 0) || cond.phone === true);

  const mapCardToForm = (c: any, aud: "men" | "women") => {
    if (!c) return {
      audience: aud, location: "", mapLink: "", startType: "", startOther: "", expanded: false,
      durationDays: null, time: "", houseNumber: "", buildingNumber: "", street: "", area: "", floor: "", apartmentNumber: "", locationNotes: ""
    };
    const firstWindow = Array.isArray(c.windows) && c.windows[0] ? c.windows[0] : null;
    return {
      audience: aud,
      location: c.locationName || c.location || "",
      mapLink: c.mapsLink || c.mapLink || "",
      startType: c.startType || "",
      startOther: c.startOther || "",
      expanded: Boolean(c.durationDays || firstWindow?.timeString || c.windows?.length),
      durationDays: c.durationDays ?? null,
      time: firstWindow?.timeString || c.time || "",
      houseNumber: c.houseNumber || "",
      buildingNumber: c.buildingNumber || "",
      street: c.street || "",
      area: c.area || "",
      floor: c.floor || "",
      apartmentNumber: c.apartmentNumber || "",
      locationNotes: firstWindow?.note || c.locationNotes || "",
    };
  };

  const rawPhones = cond.phones || [];
  const phoneContacts = (rawPhones.length > 0
    ? rawPhones.map((p: string) => {
        if (p.includes(":")) {
          const [n, num] = p.split(":");
          return { name: n.trim(), phone: num.trim() };
        }
        return { name: "", phone: p };
      })
    : (cond.phoneContacts || [])).map((pc: any) => ({
      name: pc.name || "",
      phone: pc.phone || "",
    }));

  return {
    deceasedPeople,
    deceasedList: payload.deceasedList || deceasedPeople,
    relatives,
    prayer: {
      enabled: hasPrayer,
      status: payload.prayer?.status || "scheduled",
      isOutsideQatar: Boolean(payload.prayer?.isOutsideQatar),
      dayType: prayerDay.type,
      dayOther: prayerDay.other,
      timeType: prayerTime.type,
      timeOther: prayerTime.other,
      place: payload.prayer?.locationName || payload.prayer?.place || "",
      locationName: payload.prayer?.locationName || payload.prayer?.place || "",
      dateDescription: payload.prayer?.dateDescription || "",
      timeDescription: payload.prayer?.timeDescription || "",
      mapLink: payload.prayer?.mapLink || "",
      notes: payload.prayer?.notes || "",
    },
    burial: {
      status: payload.burial?.status === "done" ? "done" : (payload.burial?.status || "scheduled"),
      outsideQatar: isOutside,
      isOutsideQatar: isOutside,
      dayType: burialDay.type,
      dayOther: burialDay.other,
      timeType: burialTime.type,
      timeOther: burialTime.other,
      cemeteryType: cemetery && CEMETERIES.includes(cemetery) ? cemetery : (cemetery ? "أخرى" : ""),
      cemeteryOther: cemetery && !CEMETERIES.includes(cemetery) ? cemetery : "",
      locationName: cemetery,
      outsideLocation: isOutside ? cemetery : "",
      dateDescription: payload.burial?.dateDescription || "",
      timeDescription: payload.burial?.timeDescription || "",
      mapLink: payload.burial?.mapLink || "",
      notes: payload.burial?.notes || "",
    },
    condolences: {
      none: isNone,
      phone: hasPhone,
      men: hasMen,
      women: hasWomen,
      type: condType,
      menCard: mapCardToForm(cond.men || cond.menCard, "men"),
      womenCard: mapCardToForm(cond.women || cond.womenCard, "women"),
      phoneContacts,
      phones: rawPhones,
    },
    condolenceStartDate: payload.condolenceStartDate || "",
    notes: payload.notes || "",
  };
}
