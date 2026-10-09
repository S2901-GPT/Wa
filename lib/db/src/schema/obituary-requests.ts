import { z } from "zod";

export const PrefixTitleEnum = z.enum([
  "الوالد", "الوالدة", "الشاب", "الشابة", "الطفل", "الطفلة", "الرضيع", "المولودة",
  "الشيخ", "الشيخة", "فضيلة الشيخ", "سعادة الشيخ", "سعادة", "سعادة السفير", 
  "الدكتور", "الدكتورة", "الأستاذ", "اللواء", "العميد", "النقيب", "شهيد الوطن", "none"
]);

export const FemaleRelationSchema = z.object({
  relationType: z.enum(["أرملة", "حرم"]).default("أرملة"),
  relatedName: z.string().optional().default(""),
  isHusbandDeceased: z.boolean().default(false)
});

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
});

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

export const EventLocationSchema = z.object({
  enabled: z.boolean().optional().default(false),
  status: z.enum(["scheduled", "pending", "done", "cancelled"]).default("scheduled"),
  isOutsideQatar: z.boolean().default(false),
  locationName: z.string().nullish().or(z.literal("")),
  timeDescription: z.string().nullish().or(z.literal("")),
  dateDescription: z.string().nullish().or(z.literal("")), 
  notes: z.string().nullish().or(z.literal("")),
});

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
});

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

export interface ObituaryRequestRow {
  id: number;
  requestNumber: string;
  deceasedName: string;
  status: string;
  payload: ObituaryPayload | Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  /** من أين جاء الطلب (القناة، النص الأصلي، رد الذكاء الاصطناعي…)؛ للمسؤول فقط. */
  audit?: Record<string, unknown>;
  /** الإنشاء ثم كل تعديل: { at, channel, changes[] }. */
  history?: Array<Record<string, unknown>>;
}

export type ObituaryRequestStatus = "new" | "reviewing" | "ready" | "completed";
