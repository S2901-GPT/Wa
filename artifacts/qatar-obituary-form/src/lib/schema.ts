import { z } from "zod";

const text = () => z.string().optional();
const trimmed = (value?: string) => (value ?? "").trim();

export const RELATION_KEYS = [
  "children", "full_siblings", "siblings", "grandchildren", "brothers_children", "sisters_children",
  "father", "grandfather", "paternal_uncles", "maternal_uncles", "daughters_husbands", "sisters_husbands", "other",
] as const;

export const LinkedPersonSchema = z.object({
  title: text(),
  name: text(),
  deceased: z.boolean().default(false),
});

export const SpouseSchema = LinkedPersonSchema.extend({
  kind: z.enum(["harem", "widow"]).default("harem"),
});

export const DeceasedPersonSchema = z.object({
  fullName: text(),
  // لا قيمة افتراضية للجنس: يجب أن يختاره المُدخِل صراحة.
  gender: z.enum(["man", "woman", "boy", "girl"], {
    required_error: "يرجى تحديد الجنس",
    invalid_type_error: "يرجى تحديد الجنس",
  }),
  identifyBy: z.enum(["name", "kunya", "spouse", "father", "children"]).default("name"),
  kunya: text(),
  age: z.coerce.number().optional().nullable(),
  ageUnit: z.enum(["years", "months", "days"]).default("years"),
  nationality: text(),
  deathPlace: text(),
  title: text(),
  occupation: text(),
  note: text(),
  noChildren: z.boolean().default(false),
  spouse: SpouseSchema.default({ kind: "harem", deceased: false }),
  father: LinkedPersonSchema.default({ deceased: false }),
}).superRefine((value, ctx) => {
  if (value.identifyBy === "name" && trimmed(value.fullName).length < 2) {
    ctx.addIssue({ code: "custom", path: ["fullName"], message: "الاسم مطلوب، أو اختر طريقة تعريف أخرى" });
  }
  if (value.identifyBy === "kunya" && !trimmed(value.kunya)) {
    ctx.addIssue({ code: "custom", path: ["kunya"], message: "اكتب الكنية" });
  }
  if (value.identifyBy === "spouse" && !trimmed(value.spouse?.name)) {
    ctx.addIssue({ code: "custom", path: ["spouse", "name"], message: "اكتب اسم الزوج" });
  }
  if (value.identifyBy === "father" && !trimmed(value.father?.name)) {
    ctx.addIssue({ code: "custom", path: ["father", "name"], message: "اكتب اسم الأب" });
  }
});

export const RelativePersonSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  occupation: text(),
  deceased: z.boolean().default(false),
});

export const RelativeGroupSchema = z.object({
  relationKey: z.enum(RELATION_KEYS, {
    required_error: "صلة القرابة مطلوبة",
    invalid_type_error: "صلة القرابة مطلوبة",
  }),
  relationOther: text(),
  familyReference: text(),
  reference: LinkedPersonSchema.default({ deceased: false }),
  deceasedPlacement: z.enum(["auto", "inline", "grouped"]).default("auto"),
  /** «all» أو رقم المتوفى (عند تعدد المتوفين). */
  deceasedTarget: z.string().default("all"),
  people: z.array(RelativePersonSchema).min(1, "يجب إضافة شخص واحد على الأقل"),
}).refine((value) => value.relationKey !== "other" || trimmed(value.relationOther).length > 0, {
  message: "اكتب عنوان الصلة",
  path: ["relationOther"],
});

export const PrayerSchema = z.object({
  enabled: z.boolean().default(false),
  dayType: text(),
  dayOther: text(),
  weekday: text(),
  timeType: text(),
  timeOther: text(),
  place: text(),
  mapLink: text(),
}).refine((value) => !(value.enabled && value.dayType === "أخرى" && !trimmed(value.dayOther)), {
  message: "يرجى تحديد اليوم",
  path: ["dayOther"],
}).refine((value) => !(value.enabled && ["وقت محدد", "أخرى"].includes(value.timeType || "") && !trimmed(value.timeOther)), {
  message: "يرجى تحديد الوقت",
  path: ["timeOther"],
});

export const BurialSchema = z.object({
  status: z.enum(["upcoming", "completed", "postponed"]),
  outsideQatar: z.boolean().default(false),
  dayType: text(),
  dayOther: text(),
  weekday: text(),
  timeType: text(),
  timeOther: text(),
  cemeteryType: text(),
  cemeteryOther: text(),
  outsideLocation: text(),
  mapLink: text(),
  postponeNote: text(),
}).refine((value) => !(value.dayType === "أخرى" && !trimmed(value.dayOther)), {
  message: "يرجى تحديد اليوم",
  path: ["dayOther"],
}).refine((value) => !(["وقت محدد", "أخرى"].includes(value.timeType || "") && !trimmed(value.timeOther)), {
  message: "يرجى تحديد الوقت",
  path: ["timeOther"],
}).refine((value) => !(!value.outsideQatar && value.cemeteryType === "أخرى" && !trimmed(value.cemeteryOther)), {
  message: "يرجى تحديد المقبرة",
  path: ["cemeteryOther"],
});

export const CondolenceScheduleSchema = z.object({
  days: text(),
  time: text(),
});

export const CondolenceCardSchema = z.object({
  audience: z.enum(["men", "women"]),
  deceasedTarget: z.string().default("all"),
  location: text(),
  mapLink: text(),
  startType: text(),
  startOther: text(),
  /** إظهار التفاصيل في الواجهة فقط؛ القيم تُحفظ حتى لو طُويت. */
  expanded: z.boolean().default(false),
  durationDays: z.coerce.number().optional().nullable(),
  time: text(),
  until: text(),
  schedule: z.array(CondolenceScheduleSchema).default([]),
  houseNumber: text(),
  buildingNumber: text(),
  street: text(),
  area: text(),
  floor: text(),
  apartmentNumber: text(),
  locationNotes: text(),
});

export const CondolencesSchema = z.object({
  none: z.boolean().default(false),
  phone: z.boolean().default(false),
  men: z.boolean().default(false),
  menMode: z.enum(["venue", "cemetery"]).default("venue"),
  women: z.boolean().default(false),
  tbd: z.boolean().default(false),
  phoneAudience: z.enum(["all", "men", "women"]).default("all"),
  note: text(),
  cards: z.array(CondolenceCardSchema).default([]),
  phoneContacts: z.array(z.object({
    name: text(),
    phone: text(),
  })).default([]),
});

export const CancellationSchema = z.object({
  audience: z.enum(["men", "women", "all"]).default("men"),
  from: text(),
  reason: text(),
  phoneOnly: z.boolean().default(false),
});

export const ObituaryFormSchema = z.object({
  messageType: z.enum(["announcement", "postponement", "amendment", "condolence_cancellation"]).default("announcement"),
  relatedRequestNumber: text(),
  announcementMode: z.enum(["single", "unrelated", "siblings", "father_first", "mother_child"]).default("single"),
  sharedParent: LinkedPersonSchema.default({ deceased: false }),
  cancellation: CancellationSchema.default({ audience: "men", phoneOnly: false }),
  deceasedPeople: z.array(DeceasedPersonSchema).min(1, "متوفى واحد على الأقل"),
  relatives: z.array(RelativeGroupSchema).default([]),
  prayer: PrayerSchema,
  burial: BurialSchema,
  condolences: CondolencesSchema,
  notes: text(),
}).superRefine((value, ctx) => {
  const multiple = value.deceasedPeople.length > 1;
  const mode = multiple ? value.announcementMode : "single";

  if ((mode === "siblings" || mode === "father_first") && !trimmed(value.sharedParent?.name)) {
    ctx.addIssue({ code: "custom", path: ["sharedParent", "name"], message: "اكتب اسم الأب المشترك" });
  }
  if (mode === "siblings" || mode === "father_first" || mode === "mother_child") {
    value.deceasedPeople.forEach((person, index) => {
      if ((mode !== "mother_child" || index > 0) && trimmed(person.fullName).length < 2) {
        ctx.addIssue({ code: "custom", path: ["deceasedPeople", index, "fullName"], message: "الاسم مطلوب في هذه الصيغة" });
      }
    });
  }

  value.deceasedPeople.forEach((person, index) => {
    if (person.identifyBy !== "children") return;
    const hasChildren = value.relatives.some((group) =>
      group.relationKey === "children"
      && (group.deceasedTarget === "all" || group.deceasedTarget === String(index))
      && group.people.some((relative) => trimmed(relative.name)));
    if (!hasChildren) {
      ctx.addIssue({
        code: "custom",
        path: ["relatives"],
        message: "اخترت التعريف بالمتوفى عبر أبنائه: أضف مجموعة «الأبناء» بأسمائهم.",
      });
    }
  });

  const isAnnouncement = value.messageType === "announcement" || value.messageType === "amendment";
  const prayerCoversSchedule = value.prayer.enabled && !!value.prayer.dayType && !!value.prayer.timeType;
  if (isAnnouncement && value.burial.status === "upcoming" && !value.burial.outsideQatar) {
    if (!value.burial.dayType && !prayerCoversSchedule) {
      ctx.addIssue({ code: "custom", path: ["burial", "dayType"], message: "يرجى تحديد يوم الدفن" });
    }
    if (!value.burial.timeType && !prayerCoversSchedule) {
      ctx.addIssue({ code: "custom", path: ["burial", "timeType"], message: "يرجى تحديد وقت الدفن" });
    }
    if (!value.burial.cemeteryType) {
      ctx.addIssue({ code: "custom", path: ["burial", "cemeteryType"], message: "يرجى تحديد المقبرة" });
    }
  }
  if (isAnnouncement && value.burial.outsideQatar && value.burial.status !== "postponed" && !trimmed(value.burial.outsideLocation)) {
    ctx.addIssue({ code: "custom", path: ["burial", "outsideLocation"], message: "يرجى تحديد مكان الدفن الخارجي" });
  }
});

export type ObituaryFormValues = z.infer<typeof ObituaryFormSchema>;
export type DeceasedFormValues = ObituaryFormValues["deceasedPeople"][number];
export type CondolenceCardFormValues = ObituaryFormValues["condolences"]["cards"][number];

/** يحدد ما إذا كان يوم الدفن ووقته ومقبرته مطلوبة (لإظهار علامة * بما يطابق التحقق الفعلي). */
export function burialScheduleRequired(value: Pick<ObituaryFormValues, "messageType" | "burial" | "prayer">): {
  day: boolean;
  time: boolean;
  cemetery: boolean;
} {
  const isAnnouncement = value.messageType === "announcement" || value.messageType === "amendment";
  const upcomingInQatar = isAnnouncement && value.burial?.status === "upcoming" && !value.burial?.outsideQatar;
  const prayerCoversSchedule = !!value.prayer?.enabled && !!value.prayer?.dayType && !!value.prayer?.timeType;
  return {
    day: upcomingInQatar && !prayerCoversSchedule,
    time: upcomingInQatar && !prayerCoversSchedule,
    cemetery: upcomingInQatar,
  };
}

export function emptyDeceased(): DeceasedFormValues {
  return {
    fullName: "",
    gender: undefined as unknown as DeceasedFormValues["gender"],
    identifyBy: "name",
    kunya: "",
    age: null,
    ageUnit: "years",
    nationality: "",
    deathPlace: "",
    title: "",
    occupation: "",
    note: "",
    noChildren: false,
    spouse: { kind: "harem", title: "", name: "", deceased: false },
    father: { title: "", name: "", deceased: false },
  };
}

export function emptyCondolenceCard(audience: "men" | "women"): CondolenceCardFormValues {
  return {
    audience,
    deceasedTarget: "all",
    location: "",
    mapLink: "",
    startType: "",
    startOther: "",
    expanded: false,
    durationDays: null,
    time: "",
    until: "",
    schedule: [],
    houseNumber: "",
    buildingNumber: "",
    street: "",
    area: "",
    floor: "",
    apartmentNumber: "",
    locationNotes: "",
  };
}

export function emptyFormValues(): ObituaryFormValues {
  return {
    messageType: "announcement",
    relatedRequestNumber: "",
    announcementMode: "single",
    sharedParent: { title: "", name: "", deceased: false },
    cancellation: { audience: "men", from: "", reason: "", phoneOnly: false },
    deceasedPeople: [emptyDeceased()],
    relatives: [],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false },
    condolences: {
      none: true,
      phone: false,
      men: false,
      menMode: "venue",
      women: false,
      tbd: false,
      phoneAudience: "all",
      note: "",
      cards: [],
      phoneContacts: [],
    },
    notes: "",
  };
}
