import { z } from "zod";

export const DeceasedPersonSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  gender: z.enum(["man", "woman", "boy", "girl", "other"], { required_error: "يرجى تحديد الجنس" }),
  age: z.coerce.number().optional().nullable(),
  nationality: z.string().optional(),
  deathPlace: z.string().optional(),
  title: z.string().optional(),
  occupation: z.string().optional(),
  note: z.string().optional()
});

export const RelativePersonSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  occupation: z.string().optional(),
  deceased: z.boolean().default(false),
});

export const RelativeGroupSchema = z.object({
  relationType: z.string().min(1, "صلة القرابة مطلوبة"),
  relationOther: z.string().optional(),
  familyReference: z.string().optional(),
  people: z.array(RelativePersonSchema).min(1, "يجب إضافة شخص واحد على الأقل")
}).refine(val => {
  if (val.relationType === "أخرى" && (!val.relationOther || val.relationOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد صلة القرابة", path: ["relationOther"] });

export const PrayerSchema = z.object({
  enabled: z.boolean().default(false),
  dayType: z.string().optional(),
  dayOther: z.string().optional(),
  timeType: z.string().optional(),
  timeOther: z.string().optional(),
  place: z.string().optional(),
  mapLink: z.string().optional(),
}).refine(val => {
  if (val.enabled && val.dayType === "أخرى" && (!val.dayOther || val.dayOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد اليوم", path: ["dayOther"] })
.refine(val => {
  if (val.enabled && ["وقت محدد", "أخرى"].includes(val.timeType || "") && (!val.timeOther || val.timeOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد الوقت", path: ["timeOther"] });

export const BurialSchema = z.object({
  status: z.enum(["upcoming", "completed"]),
  outsideQatar: z.boolean().default(false),
  dayType: z.string().optional(),
  dayOther: z.string().optional(),
  timeType: z.string().optional(),
  timeOther: z.string().optional(),
  cemeteryType: z.string().optional(),
  cemeteryOther: z.string().optional(),
  outsideLocation: z.string().optional(),
  mapLink: z.string().optional(),
}).refine(val => {
  if (val.dayType === "أخرى" && (!val.dayOther || val.dayOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد اليوم", path: ["dayOther"] })
.refine(val => {
  if (["وقت محدد", "أخرى"].includes(val.timeType || "") && (!val.timeOther || val.timeOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد الوقت", path: ["timeOther"] })
.refine(val => {
  if (!val.outsideQatar && val.cemeteryType === "أخرى" && (!val.cemeteryOther || val.cemeteryOther.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد المقبرة", path: ["cemeteryOther"] })
.refine(val => {
  if (val.outsideQatar && (!val.outsideLocation || val.outsideLocation.trim().length === 0)) return false;
  return true;
}, { message: "يرجى تحديد مكان الدفن الخارجي", path: ["outsideLocation"] });

export const CondolenceCardSchema = z.object({
  audience: z.enum(["men", "women"]),
  location: z.string().optional(),
  mapLink: z.string().optional(),
  startType: z.string().optional(),
  startOther: z.string().optional(),
  expanded: z.boolean().default(false),
  durationDays: z.coerce.number().optional().nullable(),
  time: z.string().optional(),
  houseNumber: z.string().optional(),
  buildingNumber: z.string().optional(),
  street: z.string().optional(),
  area: z.string().optional(),
  floor: z.string().optional(),
  apartmentNumber: z.string().optional(),
  locationNotes: z.string().optional(),
});

export const CondolencesSchema = z.object({
  phone: z.boolean().default(false),
  none: z.boolean().default(false),
  men: z.boolean().default(false),
  women: z.boolean().default(false),
  menCard: CondolenceCardSchema.optional(),
  womenCard: CondolenceCardSchema.optional(),
  phoneContacts: z.array(z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
  })).default([]),
});

export const ObituaryFormSchema = z.object({
  deceasedPeople: z.array(DeceasedPersonSchema).min(1, "متوفى واحد على الأقل"),
  relatives: z.array(RelativeGroupSchema).default([]),
  prayer: PrayerSchema,
  burial: BurialSchema,
  condolences: CondolencesSchema,
  notes: z.string().optional()
});

export type ObituaryFormValues = z.infer<typeof ObituaryFormSchema>;
