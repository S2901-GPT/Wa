import { z } from "zod";

// 1. قاموس الألقاب
export const PrefixTitleEnum = z.enum([
  "الوالد", "الوالدة", "الشاب", "الشابة", "الطفل", "الطفلة", "الرضيع", "الرضيعة", "المولودة",
  "الشيخ", "الشيخة", "فضيلة الشيخ", "سعادة الشيخ", "سعادة", "سعادة السفير",
  "الدكتور", "الدكتورة", "الأستاذ", "اللواء", "العميد", "النقيب", "شهيد الوطن", "none"
]);

/** ألقاب الأطفال: تُبنى عليها صيغة «انتقل إلى رحمة الله تعالى الطفل /» و«شفيعاً لوالديه يارب». */
export const CHILD_TITLES = ["الطفل", "الطفلة", "الرضيع", "الرضيعة", "المولودة"];

export const RELATION_KEYS = [
  "children", "full_siblings", "siblings", "grandchildren", "brothers_children", "sisters_children",
  "father", "grandfather", "paternal_uncles", "maternal_uncles", "daughters_husbands", "sisters_husbands", "other",
] as const;

const optionalText = () => z.string().optional().default("");
const trimmed = (value?: string | null) => (value ?? "").trim();

// شخص مرجعي (الأب، الأب المشترك، مرجع «أبناء /») مع حالته
export const LinkedPersonSchema = z.object({
  title: optionalText(),
  name: optionalText(),
  isDeceased: z.boolean().default(false),
});

// 2. علاقات المتوفاة (أرملة، حرم)
export const FemaleRelationSchema = z.object({
  relationType: z.enum(["أرملة", "حرم"]).default("أرملة"),
  relatedTitle: optionalText(),
  relatedName: z.string().optional().default(""),
  isHusbandDeceased: z.boolean().default(false)
});

// 3. مخطط المتوفى (الجنس: ذكر أو أنثى؛ بلا قيمة افتراضية حتى يختاره المُدخِل صراحة)
export const DeceasedPersonSchema = z.object({
  id: z.string().optional(),
  gender: z.enum(["ذكر", "أنثى"], {
    required_error: "يرجى تحديد الجنس",
    invalid_type_error: "يرجى تحديد الجنس",
  }),
  title: PrefixTitleEnum.default("none"),
  fullName: z.string().optional().default(""),
  /** طريقة التعريف في رأس الإعلان؛ «auto» يستنتجها من البيانات المتاحة. */
  identifyBy: z.enum(["auto", "name", "kunya", "spouse", "father", "children"]).default("auto"),
  kunya: optionalText(),
  age: z.coerce.number().optional().nullable(),
  ageUnit: z.enum(["years", "months", "days"]).default("years"),
  nationality: z.string().optional().default(""),
  deathLocation: z.string().optional().default(""),
  notes: z.string().nullish().or(z.literal("")),
  noChildren: z.boolean().default(false),
  femaleRelations: z.array(FemaleRelationSchema).optional().default([]),
  father: LinkedPersonSchema.optional(),
}).superRefine((data, ctx) => {
  const hasName = trimmed(data.fullName).length > 0;
  const hasKunya = trimmed(data.kunya).length > 0;
  const hasRelation = Array.isArray(data.femaleRelations) && data.femaleRelations.some((r) => trimmed(r.relatedName).length > 0);
  const hasFather = trimmed(data.father?.name).length > 0;
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  // الاسم مطلوب، إلا للمتوفاة المعرّفة بزوجها (أرملة فلان / حرم فلان).
  // الكنية والأب لا خانات لهما في النموذج، ويُقبلان فقط حتى لا تتعطل الطلبات القديمة.
  if (data.gender === "أنثى") {
    if (!hasName && !hasRelation && !hasKunya && !hasFather) {
      issue(["fullName"], "يجب إدخال اسم المتوفاة أو التعريف بها (أرملة فلان / حرم فلان)");
    }
  } else if (!hasName && !hasKunya && !hasFather) {
    issue(["fullName"], "اسم المتوفى مطلوب");
  }
});

// 4. مخطط الأقارب (يُذكر الذكور فقط حسب العرف، فلا يُسجَّل جنس القريب)
export const RelativePersonSchema = z.object({
  name: z.string().optional().default(""),
  isDeceased: z.boolean().default(false),
  workplace: z.string().optional().default(""),
  jobStatus: z.enum(["active", "retired", "former", "none"]).default("none"),
});

export const KinshipGroupSchema = z.object({
  /** عنوان المجموعة كما يظهر في النموذج، أو العنوان الحر عند «أخرى». */
  relationType: z.string().optional().default("أقارب"),
  relationKey: z.enum(RELATION_KEYS).optional(),
  reference: LinkedPersonSchema.optional(),
  deceasedPlacement: z.enum(["auto", "inline", "grouped"]).default("auto"),
  /** «all» أو رقم المتوفى الذي تخصه المجموعة عند تعدد المتوفين. */
  deceasedTarget: z.string().default("all"),
  persons: z.array(RelativePersonSchema).optional().default([]),
});

// 5. اللوجستيات: الصلاة والدفن
export const EventLocationSchema = z.object({
  enabled: z.boolean().optional().default(false),
  status: z.enum(["scheduled", "pending", "done", "cancelled"]).default("scheduled"),
  isOutsideQatar: z.boolean().default(false),
  locationName: z.string().nullish().or(z.literal("")),
  timeDescription: z.string().nullish().or(z.literal("")),
  dateDescription: z.string().nullish().or(z.literal("")),
  notes: z.string().nullish().or(z.literal("")),
});

// 6. هندسة العزاء
export const CondolenceWindowSchema = z.object({
  periodType: z.enum(["morning", "evening", "after_taraweeh", "exact_time", "open"]).optional().default("evening"),
  timeString: z.string().nullish().or(z.literal("")),
  note: z.string().nullish().or(z.literal("")),
});

export const CondolenceScheduleSchema = z.object({
  /** قديم: كان مفتاح «إضافة أوقات للعزاء». يُقرأ فقط حتى لا تضيع أوقات طلب قديم. */
  enabled: z.boolean().default(false),
  /** اختيار الفترة يكفي وحده («الفترة المسائية»)، والوقت يُضاف بعدها إن وُجد. */
  morning: z.boolean().default(false),
  evening: z.boolean().default(false),
  friday: z.boolean().default(false),
  morningFrom: z.string().nullish().or(z.literal("")),
  morningTo: z.string().nullish().or(z.literal("")),
  eveningFrom: z.string().nullish().or(z.literal("")),
  eveningTo: z.string().nullish().or(z.literal("")),
  fridayNote: z.string().nullish().or(z.literal("")),
});

export const CondolenceDetailsSchema = z.object({
  locationName: z.string().nullish().or(z.literal("")),
  mapsLink: z.string().nullish().or(z.literal("")),
  durationDays: z.coerce.number().nullish(),
  schedule: CondolenceScheduleSchema.optional(),
  windows: z.array(CondolenceWindowSchema).optional().default([]),
  /** «all» أو رقم المتوفى: «عزاء النساء لـسعود رحمه الله». */
  deceasedTarget: z.string().optional().default("all"),
  until: z.string().nullish().or(z.literal("")),
});

export const ExtraVenueSchema = CondolenceDetailsSchema.extend({
  audience: z.enum(["men", "women"]),
});

export const CondolenceSchema = z.object({
  type: z.enum(["full", "men_only", "women_only", "cemetery_only", "phone_only", "tbd", "none"]).default("full"),
  men: CondolenceDetailsSchema.optional(),
  women: CondolenceDetailsSchema.optional(),
  /** مواقع إضافية: «عزاء النساء الأول / الثاني» أو عزاء منفصل لكل متوفى. */
  extraVenues: z.array(ExtraVenueSchema).optional().default([]),
  phones: z.array(z.string()).optional().default([]),
  /** أرقام التعزية مع مقرات العزاء (في «هاتف فقط» تظهر دائماً). */
  withPhones: z.boolean().optional().default(false),
  phoneAudience: z.enum(["all", "men", "women"]).optional().default("all"),
  cancellationOrRestrictionReason: z.string().nullish().or(z.literal(""))
}).superRefine((data, ctx) => {
  if (data.type === "full" || data.type === "men_only") {
    if (!data.men?.locationName || data.men.locationName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "اسم ووصف مقر عزاء الرجال مطلوب",
        path: ["men", "locationName"],
      });
    }
  }
  if (data.type === "full" || data.type === "women_only") {
    if (!data.women?.locationName || data.women.locationName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "اسم ووصف مقر عزاء النساء مطلوب",
        path: ["women", "locationName"],
      });
    }
  }
  (data.extraVenues ?? []).forEach((venue, index) => {
    if (!trimmed(venue.locationName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "اسم ووصف المقر مطلوب",
        path: ["extraVenues", index, "locationName"],
      });
    }
  });
});

export const CancellationSchema = z.object({
  audience: z.enum(["men", "women", "all"]).default("men"),
  from: optionalText(),
  reason: optionalText(),
  phoneOnly: z.boolean().default(false),
});

// 7. المخطط الجذري
export const ObituaryPayloadSchema = z.object({
  messageType: z.enum(["announcement", "postponement", "amendment", "condolence_cancellation"]).default("announcement"),
  relatedRequestNumber: optionalText(),
  cancellation: CancellationSchema.optional(),
  announcementMode: z.enum(["single", "unrelated", "siblings", "father_first", "mother_child"]).default("single"),
  sharedParent: LinkedPersonSchema.optional(),
  deceasedList: z.array(DeceasedPersonSchema).min(1, "يجب إضافة متوفى واحد على الأقل"),
  relatives: z.array(KinshipGroupSchema).optional().default([]),
  noRelatives: z.boolean().default(false),
  prayer: EventLocationSchema.optional(),
  burial: EventLocationSchema.optional(),
  condolences: CondolenceSchema.optional(),
  condolenceStartDate: z.string().nullish().or(z.literal("")),
  condolenceStartTime: z.string().nullish().or(z.literal("")),
  notes: z.string().nullish().or(z.literal("")),
}).superRefine((data, ctx) => {
  const multiple = data.deceasedList.length > 1;
  const mode = multiple ? data.announcementMode : "single";
  if ((mode === "siblings" || mode === "father_first") && !trimmed(data.sharedParent?.name)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sharedParent", "name"], message: "اكتب اسم الأب المشترك" });
  }
  if (mode === "siblings" || mode === "father_first" || mode === "mother_child") {
    data.deceasedList.forEach((person, index) => {
      if ((mode !== "mother_child" || index > 0) && !trimmed(person.fullName)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deceasedList", index, "fullName"], message: "الاسم مطلوب في هذه الصيغة" });
      }
    });
  }
});

export type ObituaryPayload = z.infer<typeof ObituaryPayloadSchema>;

export const ObituaryFormSchema = ObituaryPayloadSchema;
export type ObituaryFormValues = ObituaryPayload;
export type DeceasedFormValues = ObituaryFormValues["deceasedList"][number];

export function emptyDeceased(): DeceasedFormValues {
  return {
    gender: undefined as unknown as DeceasedFormValues["gender"],
    title: "none",
    fullName: "",
    identifyBy: "auto",
    kunya: "",
    age: null,
    ageUnit: "years",
    nationality: "",
    deathLocation: "",
    notes: "",
    noChildren: false,
    femaleRelations: [],
    father: { title: "", name: "", isDeceased: false },
  };
}

export function emptyCondolenceDetails() {
  return {
    locationName: "",
    mapsLink: "",
    durationDays: null,
    schedule: {
      enabled: false,
      morning: false,
      evening: false,
      friday: false,
      morningFrom: "",
      morningTo: "",
      eveningFrom: "",
      eveningTo: "",
      fridayNote: "",
    },
    windows: [],
    deceasedTarget: "all",
    until: "",
  };
}

export function emptyFormValues(): ObituaryFormValues {
  return {
    messageType: "announcement",
    relatedRequestNumber: "",
    cancellation: { audience: "men", from: "", reason: "", phoneOnly: false },
    announcementMode: "single",
    sharedParent: { title: "", name: "", isDeceased: false },
    deceasedList: [emptyDeceased()],
    relatives: [],
    noRelatives: false,
    burial: {
      enabled: false,
      status: "scheduled",
      isOutsideQatar: false,
      locationName: "",
      dateDescription: "",
      timeDescription: "",
      notes: "",
    },
    prayer: {
      enabled: false,
      status: "scheduled",
      isOutsideQatar: false,
      locationName: "",
      dateDescription: "",
      timeDescription: "",
      notes: "",
    },
    condolences: {
      type: "full",
      men: emptyCondolenceDetails(),
      women: emptyCondolenceDetails(),
      extraVenues: [],
      phones: [],
      withPhones: false,
      phoneAudience: "all",
      cancellationOrRestrictionReason: "",
    },
    condolenceStartDate: "",
    condolenceStartTime: "",
    notes: "",
  };
}
