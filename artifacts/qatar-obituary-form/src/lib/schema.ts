import { z } from "zod";

// 1. قاموس الألقاب
export const PrefixTitleEnum = z.enum([
  "الوالد", "الوالدة", "الشاب", "الشابة", "الطفل", "الطفلة", "الرضيع", "المولودة",
  "الشيخ", "الشيخة", "فضيلة الشيخ", "سعادة الشيخ", "سعادة", "سعادة السفير", 
  "الدكتور", "الدكتورة", "الأستاذ", "اللواء", "العميد", "النقيب", "شهيد الوطن", "none"
]);

// 2. علاقات المتوفاة (أرملة، حرم)
export const FemaleRelationSchema = z.object({
  relationType: z.enum(["أرملة", "حرم"]).default("أرملة"),
  relatedName: z.string().optional().default(""),
  isHusbandDeceased: z.boolean().default(false)
});

// 3. مخطط المتوفى (الجنس: ذكر أو أنثى فقط)
export const DeceasedPersonSchema = z.object({
  id: z.string().optional(),
  gender: z.enum(["ذكر", "أنثى"]).default("ذكر"),
  title: PrefixTitleEnum.default("none"),
  fullName: z.string().optional().default(""),
  age: z.coerce.number().optional().nullable(),
  nationality: z.string().optional().default(""),
  deathLocation: z.string().optional().default(""),
  notes: z.string().nullish().or(z.literal("")),
  femaleRelations: z.array(FemaleRelationSchema).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.gender === "أنثى") {
    const hasName = typeof data.fullName === "string" && data.fullName.trim().length > 0;
    const hasRelation = Array.isArray(data.femaleRelations) && data.femaleRelations.some(
      r => typeof r.relatedName === "string" && r.relatedName.trim().length > 0
    );
    if (!hasName && !hasRelation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "يجب إدخال اسم المتوفاة أو صلة قرابة (مثل: أرملة فلان)",
        path: ["fullName"]
      });
    }
  } else {
    if (!data.fullName || typeof data.fullName !== "string" || data.fullName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "اسم المتوفى مطلوب",
        path: ["fullName"]
      });
    }
  }
});

// 4. مخطط الأقارب
export const RelativePersonSchema = z.object({
  name: z.string().optional().default(""),
  isDeceased: z.boolean().default(false),
  workplace: z.string().optional().default(""),
  jobStatus: z.enum(["active", "retired", "former", "none"]).default("none"),
});

export const KinshipGroupSchema = z.object({
  relationType: z.string().optional().default("أقارب"), 
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
  enabled: z.boolean().default(false),
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
});

export const CondolenceSchema = z.object({
  type: z.enum(["full", "men_only", "women_only", "cemetery_only", "phone_only", "none"]).default("full"),
  men: CondolenceDetailsSchema.optional(),
  women: CondolenceDetailsSchema.optional(),
  phones: z.array(z.string()).optional().default([]),
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
});

// 7. المخطط الجذري
export const ObituaryPayloadSchema = z.object({
  deceasedList: z.array(DeceasedPersonSchema).min(1, "يجب إضافة متوفى واحد على الأقل"), 
  relatives: z.array(KinshipGroupSchema).optional().default([]),
  prayer: EventLocationSchema.optional(),
  burial: EventLocationSchema.optional(),
  condolences: CondolenceSchema.optional(), 
  condolenceStartDate: z.string().nullish().or(z.literal("")),
  condolenceStartTime: z.string().nullish().or(z.literal("")),
  notes: z.string().nullish().or(z.literal("")),
});

export type ObituaryPayload = z.infer<typeof ObituaryPayloadSchema>;

export const ObituaryFormSchema = ObituaryPayloadSchema;
export type ObituaryFormValues = ObituaryPayload;
