/**
 * مولّد إعلان الوفاة الموحّد.
 *
 * مصدر واحد لكل قواعد الصياغة (فعل الوفاة، التعريف بالمتوفى، الأقارب، الدفن، العزاء، الختام)
 * يستخدمه نص «نسخ كنص للعرض» وصورة التعزية ومعاينة النموذج، حتى لا تتباعد القواعد بين المخرجات.
 * الصيغ مأخوذة من أرشيف «وفيات قطر». جنس الأقارب لا يُسجَّل لأن خانة الأقارب لا تذكر الإناث،
 * فضمائر الترحّم على الأقارب والأشخاص المرجعيين بصيغة المذكر دائماً (رحمه، رحمهما، رحمهم).
 */
import type {
  CondolenceCard,
  DeceasedPerson,
  LinkedPerson,
  ObituaryRequestInput,
  RelativeGroup,
  RelativeGroupRelationKey,
  RelativePerson,
  SpouseReference,
} from "@workspace/api-client-react";

type Gender = DeceasedPerson["gender"];
type IdentifyBy = NonNullable<DeceasedPerson["identifyBy"]>;
type Mode = NonNullable<ObituaryRequestInput["announcementMode"]>;

export type AnnouncementSection = {
  id: string;
  label?: string;
  lines: string[];
  mapLink?: string;
  audience?: "men" | "women";
  /** موضع بطاقة العزاء في request.condolences (لأقسام البطاقات فقط). */
  cardIndex?: number;
};

export type Announcement = {
  /** النص الكامل بصيغة الأرشيف، جاهز للنسخ. */
  text: string;
  /** عبارة الوفاة الرسمية لرأس الصورة («انتقل إلى رحمة الله تعالى»…). */
  statement: string;
  /** الأسماء كما تظهر بخط كبير في رأس الصورة. */
  posterNames: string;
  /** أسطر قسم «بيانات المتوفى» في الصورة: الاسم/التعريف أولاً (القالب الرسمي لا يعرض الأسماء في الرأس) ثم التفاصيل. */
  posterDetails: string[];
  /** مجموعات الأقارب بصيغتها النهائية (للقوالب البصرية). */
  relativeBlocks: RelativeBlock[];
  /** رأس الإعلان بصيغة الأرشيف لقالب النسخ: الفعل («توفي»)، ثم «الوالد / فلان»، ثم بقية أسطر التعريف. */
  headline: AnnouncementHeadline;
  sections: AnnouncementSection[];
  closing: string;
  warnings: string[];
};

export type AnnouncementHeadline = {
  verb: string;
  name: string;
  rest: string[];
};

// ───────────────────────── أدوات لغوية عامة ─────────────────────────

export function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

const isFemale = (gender?: Gender) => gender === "woman" || gender === "girl";
const isChild = (gender?: Gender) => gender === "boy" || gender === "girl";
const isKnownGender = (gender?: Gender) => gender === "man" || gender === "woman" || gender === "boy" || gender === "girl";

type NounForms = { singular: string; dual: string; plural: string; accusative: string };

const YEARS: NounForms = { singular: "عام", dual: "عامان", plural: "أعوام", accusative: "عاماً" };
const MONTHS: NounForms = { singular: "شهر", dual: "شهران", plural: "أشهر", accusative: "شهراً" };
const DAYS_NOMINATIVE: NounForms = { singular: "يوم", dual: "يومان", plural: "أيام", accusative: "يوماً" };
/** بعد «لمدة» يأتي المثنى مجروراً: «لمدة يومين». */
const DAYS_GENITIVE: NounForms = { singular: "يوم", dual: "يومين", plural: "أيام", accusative: "يوماً" };

/** تمييز العدد: «عام واحد»، «عامان»، «٣ أعوام»، «٦٥ عاماً»، «١٠٠ عام». */
export function countNoun(count: number, forms: NounForms): string {
  if (count === 1) return `${forms.singular} واحد`;
  if (count === 2) return forms.dual;
  const remainder = count % 100;
  if (remainder >= 3 && remainder <= 10) return `${count} ${forms.plural}`;
  if (remainder >= 11) return `${count} ${forms.accusative}`;
  return `${count} ${forms.singular}`;
}

export function formatAge(age: number | null | undefined, unit?: DeceasedPerson["ageUnit"]): string {
  if (age == null || !Number.isFinite(age) || age <= 0) return "";
  const forms = unit === "months" ? MONTHS : unit === "days" ? DAYS_NOMINATIVE : YEARS;
  return countNoun(Math.round(age), forms);
}

export function formatDurationDays(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days) || days <= 0) return "";
  return `لمدة ${countNoun(Math.round(days), DAYS_GENITIVE)}`;
}

/** «عبدالله وأمين وخالد» */
function joinWithAnd(items: string[]): string {
  return items.filter(Boolean).join(" و");
}

/** كل سطر بعد الأول يبدأ بواو العطف: «غانم / وناصر». */
function prefixAnd(lines: string[]): string[] {
  return lines.map((line, index) => (index === 0 ? line : `و${line}`));
}

/** ترحّم على شخص أو أشخاص مذكرين (الأقارب والأشخاص المرجعيون). */
function mercyForMen(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "رحمه الله";
  if (count === 2) return "رحمهما الله";
  return "رحمهم الله";
}

/** ترحّم على المتوفين أنفسهم بحسب جنسهم وعددهم. */
export function mercyForDeceased(people: Array<Pick<DeceasedPerson, "gender">>): string {
  if (people.length === 1) return isFemale(people[0]?.gender) ? "رحمها الله" : "رحمه الله";
  if (people.length === 2) return "رحمهما الله";
  return people.every((person) => isFemale(person.gender)) ? "رحمهن الله" : "رحمهم الله";
}

function isQatari(nationality: string): boolean {
  return /^(?:ال)?قطري(?:ة|ه)?$|^قطر$/u.test(clean(nationality));
}

/** «ليس لديه/لديها/لديهم أقارب»، يكتبه المسؤول حين لا يُذكر أحد من الأقارب (يظهر في النص وفي الصورة). */
export function noRelativesPhrase(people: Array<Pick<DeceasedPerson, "gender">>): string {
  if (people.length > 1) return "ليس لديهم أقارب";
  return people.every((person) => isFemale(person.gender)) ? "ليس لديها أقارب" : "ليس لديه أقارب";
}


const WEEKDAYS_BY_INDEX = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(.*))?$/u;
/** كتابات أخرى لأسماء الأيام كما تصل في الرسائل. */
const WEEKDAY_ALIASES: Record<string, string> = { "الإثنين": "الاثنين", "الاحد": "الأحد", "الاربعاء": "الأربعاء", "الثلاثا": "الثلاثاء" };
/** كلمات اليوم النسبية وبُعدها عن يوم كتابتها. */
const RELATIVE_OFFSETS: Record<string, number> = { "اليوم": 0, "الليلة": 0, "غداً": 1, "غدا": 1, "بكرة": 1, "بكره": 1, "بعد غد": 2, "أمس": -1, "امس": -1 };

function weekdayName(value: string): string {
  const name = WEEKDAY_ALIASES[value] ?? value;
  return WEEKDAYS_BY_INDEX.includes(name) ? name : "";
}

/** «اليوم الأحد» / «غداً الأحد» / «أمس الأحد» / «يوم الأحد»: اسم اليوم دون تاريخ. */
function weekdayPhrase(diff: number, weekday: string, tonight = false): string {
  if (diff === 0) return `${tonight ? "الليلة" : "اليوم"} ${weekday}`;
  if (diff === 1) return `غداً ${weekday}`;
  if (diff === -1) return `أمس ${weekday}`;
  return `يوم ${weekday}`;
}

/**
 * بُعد يوم الأسبوع المذكور عن يوم العرض. مع كلمة نسبية من الرسالة («غداً الأحد» كُتبت ليلة السبت) يُختار الأحد
 * الأقرب إلى ما قصدته الكلمة، فإن نُشر الإعلان صباح الأحد صار «اليوم الأحد». بلا كلمة نسبية: اليوم أو القادم.
 */
function weekdayDiff(weekday: string, relative: string | undefined, now: Date): number {
  const forward = (WEEKDAYS_BY_INDEX.indexOf(weekday) - now.getDay() + 7) % 7;
  if (relative === undefined) return forward;
  const offset = RELATIVE_OFFSETS[relative] ?? 0;
  const backward = forward - 7;
  return Math.abs(forward - offset) <= Math.abs(backward - offset) ? forward : backward;
}

/**
 * تاريخ من منتقي التاريخ («2026-10-02») بصيغة الإعلان نسبةً إلى يوم النشر:
 * «اليوم الجمعة»، «غداً السبت»، «أمس الخميس»، أو «يوم الأحد 12 أكتوبر». أي نص بعد التاريخ يُلحق كما هو.
 */
export function formatIsoDay(value: string | undefined, now: Date = new Date()): string | null {
  const match = ISO_DATE.exec(clean(value));
  if (!match) return null;
  const [, year, month, day, rest] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  // التاريخ يحدد اليوم فقط ولا يُكتب: «اليوم الأحد»، «غداً الأحد»، «يوم الأحد».
  const text = weekdayPhrase(diff, WEEKDAYS_BY_INDEX[date.getDay()]);
  return rest ? `${text} ${clean(rest)}` : text;
}

/** «اليوم السبت بعد صلاة العصر»، «يوم الخميس»، دون «يوم اليوم». */
export function dayTimePhrase(day?: string, weekday?: string, time?: string, now: Date = new Date()): string {
  const dayText = clean(day);
  const timeText = clean(time);
  const relative = dayText in RELATIVE_OFFSETS ? dayText : undefined;
  // اسم اليوم من حقله، أو من حقل اليوم نفسه («الأحد»)
  const named = weekdayName(clean(weekday)) || weekdayName(dayText);
  let when = "";
  const isoDay = formatIsoDay(dayText, now);
  if (isoDay) when = isoDay;
  // «اليوم / غداً» تُحسب من اسم اليوم لحظة النسخ أو إنشاء الصورة، لا لحظة كتابة الرسالة
  else if (named && (!dayText || relative || weekdayName(dayText))) when = weekdayPhrase(weekdayDiff(named, relative, now), named, relative === "الليلة");
  else if (dayText) when = dayText;
  else if (clean(weekday)) when = `يوم ${clean(weekday)}`;
  return [when, timeText].filter(Boolean).join(" ");
}

/** مواقع لا تحتاج «في» قبلها: «في المجلس»، «بمنطقة»، «مقابل جامع…»، «بجانب…»، «أمام…»، «خلف…»، «قرب…». */
const LOCATION_PREFIXED = /^(?:في|ب|مقابل|أمام|بجانب|بجوار|جنب|خلف|قرب|بالقرب|قريباً|قريبا|عند|داخل|على)\s/u;

function withPrefix(text: string, prefix: string, alreadyPrefixed: RegExp): string {
  const value = clean(text);
  if (!value) return "";
  return alreadyPrefixed.test(value) ? value : `${prefix} ${value}`;
}

// ───────────────────────── صلات القرابة ─────────────────────────

type RelationKey = RelativeGroupRelationKey;

type RoleLabels = {
  /** المتوفى ذكر / أنثى: «والد كل من» / «والدة كل من». */
  male: string;
  female: string;
  /** بديل عند وجود شخص واحد فقط (للعناوين الجمعية مثل «أعمامه»). */
  maleOne?: string;
  femaleOne?: string;
  /** جذر الضمير عند تعدد المتوفين: «إخوت» + «هم» = «إخوتهم». */
  group: string;
  groupOne: string;
  /** هل يُكتب بعد القائمة سطر «أبناء / …» (والد الأشخاص المذكورين). */
  takesReference: boolean;
};

const ROLE_LABELS: Record<Exclude<RelationKey, "other">, RoleLabels> = {
  children: { male: "والد", female: "والدة", group: "أبناؤ", groupOne: "ابن", takesReference: true },
  full_siblings: { male: "شقيق", female: "شقيقة", group: "أشقاؤ", groupOne: "شقيق", takesReference: true },
  siblings: { male: "أخ", female: "أخت", group: "إخوت", groupOne: "أخو", takesReference: true },
  grandchildren: { male: "جد", female: "جدة", group: "أحفاد", groupOne: "حفيد", takesReference: true },
  brothers_children: { male: "عم", female: "عمة", group: "أبناء إخوت", groupOne: "ابن أخي", takesReference: true },
  sisters_children: { male: "خال", female: "خالة", group: "أبناء أخوات", groupOne: "ابن أخت", takesReference: true },
  father: { male: "ابن", female: "ابنة", group: "والد", groupOne: "والد", takesReference: false },
  grandfather: { male: "حفيد", female: "حفيدة", group: "جد", groupOne: "جد", takesReference: false },
  paternal_uncles: { male: "أعمامه", female: "أعمامها", maleOne: "عمه", femaleOne: "عمها", group: "أعمام", groupOne: "عم", takesReference: false },
  maternal_uncles: { male: "أخواله", female: "أخوالها", maleOne: "خاله", femaleOne: "خالها", group: "أخوال", groupOne: "خال", takesReference: false },
  daughters_husbands: { male: "والد زوجة", female: "والدة زوجة", group: "أصهار", groupOne: "صهر", takesReference: false },
  sisters_husbands: { male: "أخو زوجة", female: "أخت زوجة", group: "أزواج أخوات", groupOne: "زوج أخت", takesReference: false },
};

/** خيارات «صلة الأشخاص بالمتوفى» في النموذج، مع العنوان الذي سيظهر في الإعلان. */
export const RELATION_OPTIONS: Array<{ key: RelationKey; label: string; hint: string }> = [
  { key: "children", label: "الأبناء", hint: "والد / والدة كل من" },
  { key: "full_siblings", label: "الأشقاء", hint: "شقيق / شقيقة كل من" },
  { key: "siblings", label: "الإخوة", hint: "أخ / أخت كل من" },
  { key: "grandchildren", label: "الأحفاد", hint: "جد / جدة كل من" },
  { key: "brothers_children", label: "أبناء الأخ", hint: "عم / عمة كل من" },
  { key: "sisters_children", label: "أبناء الأخت", hint: "خال / خالة كل من" },
  { key: "father", label: "الأب", hint: "ابن / ابنة" },
  { key: "grandfather", label: "الجد", hint: "حفيد / حفيدة" },
  { key: "paternal_uncles", label: "الأعمام", hint: "أعمامه / أعمامها" },
  { key: "maternal_uncles", label: "الأخوال", hint: "أخواله / أخوالها" },
  { key: "daughters_husbands", label: "أزواج البنات", hint: "والد / والدة زوجة" },
  { key: "sisters_husbands", label: "أزواج الأخوات", hint: "أخو / أخت زوجة" },
  { key: "other", label: "أخرى (عنوان حر)", hint: "يُكتب العنوان كما هو" },
];

/** معنى سطر «أبناء /» يتغير بحسب الصلة. */
export const REFERENCE_LABELS: Partial<Record<RelationKey, string>> = {
  children: "والد الأبناء (الزوج)",
  full_siblings: "والد الأشقاء (الأب)",
  siblings: "والد الإخوة (الأب)",
  grandchildren: "والد الأحفاد",
  brothers_children: "والدهم (أخو المتوفى)",
  sisters_children: "والدهم (زوج أخت المتوفى)",
};

export function relationTakesReference(key: RelationKey | undefined): boolean {
  return !!key && key !== "other" && ROLE_LABELS[key].takesReference;
}

const LEGACY_RELATIONS: Record<string, RelationKey> = {
  "ابن": "children", "ابنة": "children", "أبناء": "children", "الأبناء": "children", "ابناء": "children",
  "أخ": "siblings", "أخت": "siblings", "إخوة": "siblings", "الإخوة": "siblings", "اخوة": "siblings", "اخوان": "siblings", "إخوان": "siblings",
  "شقيق": "full_siblings", "شقيقة": "full_siblings", "أشقاء": "full_siblings", "الأشقاء": "full_siblings",
  "والد": "father", "أب": "father", "الأب": "father",
  "جد": "grandfather", "الجد": "grandfather",
  "عم": "paternal_uncles", "أعمام": "paternal_uncles", "الأعمام": "paternal_uncles",
  "خال": "maternal_uncles", "أخوال": "maternal_uncles", "الأخوال": "maternal_uncles",
  "حفيد": "grandchildren", "أحفاد": "grandchildren", "الأحفاد": "grandchildren",
  // عناوين نسخة AI Studio السابقة (بضمير الغائب).
  "أبناؤه": "children", "أبناؤها": "children",
  "أخوانه": "siblings", "أخوانها": "siblings", "إخوانه": "siblings", "إخوانها": "siblings", "إخوته": "siblings", "إخوتها": "siblings",
  "أعمامه": "paternal_uncles", "أعمامها": "paternal_uncles",
  "أخواله": "maternal_uncles", "أخوالها": "maternal_uncles",
  "أحفاده": "grandchildren", "أحفادها": "grandchildren",
  "أصهاره": "daughters_husbands", "أصهارها": "daughters_husbands",
};

/** الطلبات القديمة خزّنت الصلة نصاً («ابن»، «أخ»…)؛ نحوّلها إلى مفتاح، وما لا يُعرف يبقى عنواناً حراً. */
export function relationKeyOf(group: Pick<RelativeGroup, "relation" | "relationKey">): RelationKey {
  if (group.relationKey) return group.relationKey;
  return LEGACY_RELATIONS[clean(group.relation)] ?? "other";
}

/** عناوين حرة من قائمة النموذج الأصلية بضمير يتبع المتوفى: «أبناء عمومته / عمومتها / عمومتهم»، وللواحد «ابن عمه». */
const COUSINS = { group: "أبناء عمومت", one: "ابن عم" };
const PRONOUN_RELATIONS: Record<string, { group: string; one: string }> = { "أبناء عمومته": COUSINS, "أبناء عمومتها": COUSINS };

/** «أخرى» دون عنوان مكتوب: لا يُطبع اسم الخيار نفسه في الإعلان. */
export function isBlankRelation(group: Pick<RelativeGroup, "relation" | "relationKey">): boolean {
  const relation = clean(group.relation);
  return relationKeyOf(group) === "other" && (!relation || relation === "أخرى");
}

function roleHeading(
  group: RelativeGroup,
  key: RelationKey,
  count: number,
  perspective: { gender?: Gender } | { groupSuffix: "هم" | "هن" },
): string {
  if (key === "other") {
    if (isBlankRelation(group)) return "الأقارب";
    const relation = clean(group.relation);
    const stems = PRONOUN_RELATIONS[relation];
    if (!stems) return relation;
    const stem = count === 1 ? stems.one : stems.group;
    return stem + ("groupSuffix" in perspective ? perspective.groupSuffix : isFemale(perspective.gender) ? "ها" : "ه");
  }
  const labels = ROLE_LABELS[key];
  if ("groupSuffix" in perspective) {
    return (count === 1 ? labels.groupOne : labels.group) + perspective.groupSuffix;
  }
  const female = isFemale(perspective.gender);
  if (count === 1) return female ? labels.femaleOne ?? labels.female : labels.maleOne ?? labels.male;
  return female ? labels.female : labels.male;
}

/**
 * جهة العمل بين قوسين، والمتقاعد داخل القوسين نفسيهما: «(وزارة الداخلية - متقاعد)».
 * الصفة تُحفظ «وزارة الداخلية (متقاعد)»، فلا تُكتب أقواس متداخلة.
 */
export function formatOccupation(occupation?: string | null): string {
  const text = clean(occupation);
  if (!text) return "";
  const retired = text.match(/^(.*?)\s*\(متقاعد\)$/u);
  if (!retired) return `(${text})`;
  const place = clean(retired[1]);
  return place ? `(${place} - متقاعد)` : "(متقاعد)";
}

function relativeEntry(person: RelativePerson): string {
  return [clean(person.name), formatOccupation(person.occupation)].filter(Boolean).join(" ");
}

/** أسماء القائمة مع الترحّم بين قوسين بجانب كل اسم («سالم (رحمه الله)»)؛ التجميع في آخر القائمة فقط إن طُلب صراحة. */
function relativeNameLines(people: RelativePerson[], placement: RelativeGroup["deceasedPlacement"]): string[] {
  const named = people.filter((person) => clean(person.name));
  const deceased = named.filter((person) => person.deceased);
  const grouped = placement === "grouped";
  if (!grouped) {
    return named.map((person) => (person.deceased ? `${relativeEntry(person)} (${mercyForMen(1)})` : relativeEntry(person)));
  }
  const lines = named.filter((person) => !person.deceased).map(relativeEntry);
  if (deceased.length) lines.push(`${joinWithAnd(deceased.map(relativeEntry))} (${mercyForMen(deceased.length)})`);
  return lines;
}

function linkedPhrase(label: string, person: Pick<LinkedPerson, "title" | "name">): string {
  const head = [clean(label), clean(person.title)].filter(Boolean).join(" ");
  return head ? `${head} / ${clean(person.name)}` : `/ ${clean(person.name)}`;
}

function referenceLine(person: LinkedPerson): string {
  return [linkedPhrase("أبناء", person), person.deceased ? mercyForMen(1) : ""].filter(Boolean).join(" ");
}

/** مجموعة أقارب بعد الصياغة: يستعملها النص (أسطر) والقوالب البصرية («العنوان: الأسماء»). */
export type RelativeBlock = {
  /** «والدة كل من» أو «والدة» عند شخص واحد. */
  heading: string;
  /** الأسماء دون واو العطف، والترحّم ملحق بها. */
  members: string[];
  /** سطر «أبناء الوالد / …» أو السطر الحر بعد القائمة. */
  reference?: string;
  single: boolean;
};

function roleBlock(
  group: RelativeGroup,
  perspective: { gender?: Gender } | { groupSuffix: "هم" | "هن" },
  fallbackReference?: LinkedPerson,
): RelativeBlock | null {
  const key = relationKeyOf(group);
  const names = relativeNameLines(group.people, group.deceasedPlacement);
  if (!names.length) return null;
  const namedCount = group.people.filter((person) => clean(person.name)).length;
  const single = names.length === 1 && namedCount === 1;
  const heading = roleHeading(group, key, namedCount, perspective);
  const referencePerson = clean(group.reference?.name) ? group.reference : fallbackReference;
  const reference = referencePerson && clean(referencePerson.name) && relationTakesReference(key)
    ? referenceLine(referencePerson)
    : clean(group.familyReference) || undefined;
  // العنوان الحر قد يُكتب كاملاً («والدة كل من») فلا يُكرر «كل من».
  const plural = /كل من$/u.test(heading) ? heading : `${heading} كل من`;
  return { heading: single ? heading : plural, members: names, reference, single };
}

/** العنوان في سطر، والأسماء متجاورة في سطر واحد: «مبارك وعبدالله ومحمد وعلي». */
function blockLines(block: RelativeBlock): string[] {
  const lines = block.single ? [`${block.heading} / ${block.members[0]}`] : [block.heading, prefixAnd(block.members).join(" ")];
  if (block.reference) lines.push(block.reference);
  return lines;
}

// ───────────────────────── التعريف بالمتوفى ─────────────────────────

const SPOUSE_TITLE_PATTERN = /^(?:حرم|زوجة|أرملة|ارملة)(?:\s|\/|$)/u;

function defaultChildTitle(gender?: Gender): string {
  if (gender === "boy") return "الطفل";
  if (gender === "girl") return "الطفلة";
  return "";
}

function spouseLabel(spouse: SpouseReference, gender?: Gender): string {
  if (spouse.kind === "widow") return isFemale(gender) ? "أرملة" : "أرمل";
  return isFemale(gender) ? "حرم" : "زوج";
}

/** «أرملة»: الجمع «رحمهم الله» يشمل المتوفاة وزوجها (٨٤٪ من الأرشيف). «حرم» وزوجها متوفى: «رحمه الله». */
function spouseMercy(spouse: SpouseReference): string {
  if (spouse.kind === "widow") return "رحمهم الله";
  return spouse.deceased ? mercyForMen(1) : "";
}

function spouseLine(person: DeceasedPerson): string {
  const spouse = person.spouse!;
  return [linkedPhrase(spouseLabel(spouse, person.gender), spouse), spouseMercy(spouse)].filter(Boolean).join(" ");
}

function fatherLine(person: DeceasedPerson): string {
  const father = person.father!;
  return [linkedPhrase(isFemale(person.gender) ? "ابنة" : "ابن", father), father.deceased ? mercyForMen(1) : ""]
    .filter(Boolean).join(" ");
}

/** طريقة التعريف الفعلية: المختارة إن توفرت بياناتها، وإلا أول بديل متاح. */
export function resolveIdentifyBy(person: DeceasedPerson, roles: RelativeGroup[] = []): IdentifyBy | undefined {
  const available: Record<IdentifyBy, boolean> = {
    name: !!clean(person.fullName),
    kunya: !!clean(person.kunya),
    spouse: !!clean(person.spouse?.name),
    father: !!clean(person.father?.name),
    children: roles.some((role) => relationKeyOf(role) === "children" && role.people.some((p) => clean(p.name))),
  };
  if (person.identifyBy && available[person.identifyBy]) return person.identifyBy;
  return (["name", "kunya", "spouse", "father", "children"] as IdentifyBy[]).find((mode) => available[mode]);
}

type IdentityResult = {
  /** السطر الأول يُلحق بفعل الوفاة؛ بقية الأسطر (إن وُجدت) تتبعه. */
  lines: string[];
  /** صيغة مختصرة بلا «/» للعرض في رأس الصورة وقوائم الإدارة. */
  plain: string;
  mode?: IdentifyBy;
  consumedChildrenRole?: RelativeGroup;
  consumedSpouse: boolean;
  consumedFather: boolean;
  /** لقب كُتب بصيغة «حرم …» في خانة اللقب (بيانات قديمة) فيُنقل إلى سطر مستقل بعد الاسم. */
  movedTitleLine?: string;
};

function buildIdentity(person: DeceasedPerson, roles: RelativeGroup[]): IdentityResult {
  const mode = resolveIdentifyBy(person, roles);
  const gender = person.gender;
  let title = clean(person.title);
  let movedTitleLine: string | undefined;
  if (SPOUSE_TITLE_PATTERN.test(title)) {
    movedTitleLine = title;
    title = "";
  }
  title = title || defaultChildTitle(gender);
  const result: IdentityResult = { lines: [], plain: "", mode, consumedSpouse: false, consumedFather: false, movedTitleLine };

  const titled = (value: string) => {
    if (!title) return { phrase: `/ ${value}`, plain: value };
    if (value.startsWith(`${title} `) || value === title) return { phrase: `/ ${value}`, plain: value };
    return { phrase: `${title} / ${value}`, plain: `${title} ${value}` };
  };

  if (mode === "name") {
    const kunya = clean(person.kunya);
    const named = titled(clean(person.fullName));
    const suffix = kunya ? ` (${kunya})` : "";
    result.lines = [named.phrase + suffix];
    result.plain = named.plain + suffix;
  } else if (mode === "kunya") {
    const named = titled(clean(person.kunya));
    result.lines = [named.phrase];
    result.plain = named.plain;
  } else if (mode === "spouse") {
    const line = spouseLine(person);
    result.lines = [line];
    result.plain = line.replace(" / ", " ");
    result.consumedSpouse = true;
  } else if (mode === "father") {
    const line = fatherLine(person);
    result.lines = [line];
    result.plain = line.replace(" / ", " ");
    result.consumedFather = true;
  } else if (mode === "children") {
    const role = roles.find((group) => relationKeyOf(group) === "children" && group.people.some((p) => clean(p.name)))!;
    const label = isFemale(gender) ? "والدة" : "والد";
    const names = relativeNameLines(role.people, role.deceasedPlacement);
    result.lines = [`${label} كل من`, ...prefixAnd(names)];
    if (clean(role.reference?.name)) {
      result.lines.push(referenceLine(role.reference!));
    } else if (clean(person.spouse?.name)) {
      const spouse = person.spouse!;
      result.lines.push(referenceLine({ ...spouse, deceased: spouse.deceased || spouse.kind === "widow" }));
      result.consumedSpouse = true;
    }
    result.plain = `${label} ${joinWithAnd(role.people.filter((p) => clean(p.name)).map((p) => clean(p.name)))}`;
    result.consumedChildrenRole = role;
  }
  return result;
}

/** اسم مختصر للمتوفى في قوائم الإدارة وعناوين الصفحات (لا يضع اسم الزوج مكان اسمها). */
export function describeDeceased(person: DeceasedPerson, roles: RelativeGroup[] = []): string {
  const identity = buildIdentity(person, roles);
  return identity.plain || "متوفى بلا تعريف";
}

export const MESSAGE_TYPE_LABELS: Record<NonNullable<ObituaryRequestInput["messageType"]>, string> = {
  announcement: "إعلان وفاة",
  postponement: "تأجيل دفن",
  amendment: "تعديل",
  condolence_cancellation: "إلغاء عزاء",
};

/** أسماء المتوفين في طلب كامل للعرض في قوائم الإدارة. */
export function describeRequestDeceased(request: Pick<ObituaryRequestInput, "deceasedPeople" | "relatives">): string {
  const people = request.deceasedPeople ?? [];
  return people.map((person, index) => describeDeceased(
    person,
    (request.relatives ?? []).filter((group) => people.length < 2 || group.deceasedIndex == null || group.deceasedIndex === index),
  )).join("، ");
}

/** مكان الوفاة بلا «في» في أوله: الصياغة تضيفها («الوفاة في لندن»)، وقد يصل «في لندن» من الذكاء الاصطناعي أو طلب قديم. */
function deathPlaceOf(person: { deathPlace?: string }): string {
  return clean(person.deathPlace).replace(/^(?:في|ب)\s+/u, "");
}

function personDetailLines(
  person: DeceasedPerson,
  identity: IdentityResult,
  options: { includeAge: boolean; placeInHeading?: boolean; mergePlace?: boolean },
): string[] {
  const lines: string[] = [];
  if (identity.movedTitleLine) lines.push(identity.movedTitleLine);
  if (clean(person.spouse?.name) && !identity.consumedSpouse) lines.push(spouseLine(person));
  if (clean(person.father?.name) && !identity.consumedFather) lines.push(fatherLine(person));
  const nationality = clean(person.nationality);
  const deathPlace = deathPlaceOf(person);
  const placeLine = deathPlace && !options.placeInHeading ? `الوفاة في ${deathPlace}` : "";
  // رأس قالب النسخ (mergePlace): العمر والجنسية ومكان الوفاة في سطر واحد
  const ageLine = [
    options.includeAge ? formatAge(person.age, person.ageUnit) : "",
    nationality && !isQatari(nationality) ? nationality : "",
    options.mergePlace ? placeLine : "",
  ].filter(Boolean).join(" — ");
  if (ageLine) lines.push(ageLine);
  if (clean(person.occupation)) lines.push(clean(person.occupation));
  if (placeLine && !options.mergePlace) lines.push(placeLine);
  if (person.noChildren) lines.push(isFemale(person.gender) ? "(ليس لها أبناء)" : "(ليس له أبناء)");
  if (clean(person.note)) lines.push(clean(person.note));
  return lines;
}

/** اسم رأس الصورة: بلا «/» في أوله عندما لا لقب (النص يبقى «توفي / فلان» كالأرشيف). */
const headlineName = (value: string) => value.replace(/^\/\s*/u, "").trim();

/** «انتقل/انتقلت إلى رحمة الله تعالى» للأطفال، و«توفي/توفيت» للبالغين كما في الأرشيف. */
function singleVerb(gender?: Gender): string {
  if (gender === "man") return "توفي";
  if (gender === "woman") return "توفيت";
  if (gender === "boy") return "انتقل إلى رحمة الله تعالى";
  if (gender === "girl") return "انتقلت إلى رحمة الله تعالى";
  return "في ذمة الله";
}

function groupVerb(people: DeceasedPerson[]): string {
  const allFemale = people.every((person) => isFemale(person.gender));
  if (people.every((person) => isChild(person.gender))) {
    return allFemale ? "انتقلت إلى رحمة الله تعالى كل من" : "انتقل إلى رحمة الله تعالى كل من";
  }
  return allFemale ? "توفيت كل من" : "توفي كل من";
}

/** عبارة الصورة الرسمية بحسب الجنس والعدد. */
export function makeDeathStatement(people: Array<Pick<DeceasedPerson, "gender">>): string {
  const allFemale = people.length > 0 && people.every((person) => isFemale(person.gender));
  if (people.length === 1) {
    const gender = people[0]?.gender;
    if (isFemale(gender)) return "انتقلت إلى رحمة الله تعالى";
    if (gender === "man" || gender === "boy") return "انتقل إلى رحمة الله تعالى";
    return "في ذمة الله تعالى";
  }
  if (people.length === 2) return allFemale ? "انتقلتا إلى رحمة الله تعالى" : "انتقلا إلى رحمة الله تعالى";
  if (people.length > 2) return allFemale ? "انتقلن إلى رحمة الله تعالى" : "انتقلوا إلى رحمة الله تعالى";
  return "إنا لله وإنا إليه راجعون";
}

/**
 * الختام: البالغ «الله يرحمه ويغفر له»، الطفل «شفيعاً لوالديه يارب»،
 * والمجموعة المختلطة بين بالغ وطفل بالجمع «الله يرحمهم ويغفر لهم».
 */
export function makeClosingPrayer(people: Array<Pick<DeceasedPerson, "gender">>): string {
  if (!people.length || people.some((person) => !isKnownGender(person.gender))) return "";
  const children = people.filter((person) => isChild(person.gender));
  if (people.length === 1) {
    const gender = people[0].gender;
    if (gender === "boy") return "شفيعاً لوالديه يارب";
    if (gender === "girl") return "شفيعاً لوالديها يارب";
    return gender === "woman" ? "الله يرحمها ويغفر لها" : "الله يرحمه ويغفر له";
  }
  if (children.length === people.length) return "شفيعاً لوالديهم يارب";
  if (children.length > 0) return "الله يرحمهم ويغفر لهم";
  if (people.length === 2) return "الله يرحمهما ويغفر لهما";
  if (people.every((person) => isFemale(person.gender))) return "الله يرحمهن ويغفر لهن";
  return "الله يرحمهم ويغفر لهم";
}

function childGroupHeading(people: DeceasedPerson[]): string {
  const allFemale = people.every((person) => isFemale(person.gender));
  if (people.length === 2) return allFemale ? "انتقلت إلى رحمة الله تعالى الطفلتان" : "انتقل إلى رحمة الله تعالى الطفلان";
  return allFemale ? "انتقلت إلى رحمة الله تعالى الطفلات" : "انتقل إلى رحمة الله تعالى الأطفال";
}

function rolesFor(request: ObituaryRequestInput, index: number, mode: Mode): RelativeGroup[] {
  const count = request.deceasedPeople.length;
  return (request.relatives ?? []).filter((group) => {
    const target = group.deceasedIndex;
    const valid = target != null && target >= 0 && target < count;
    if (mode === "single") return true;
    if (mode === "mother_child") return valid ? target === index : index === 0;
    return valid && target === index;
  });
}

function groupRoles(request: ObituaryRequestInput, mode: Mode): RelativeGroup[] {
  if (mode === "single" || mode === "mother_child") return [];
  const count = request.deceasedPeople.length;
  return (request.relatives ?? []).filter((group) => group.deceasedIndex == null || group.deceasedIndex < 0 || group.deceasedIndex >= count);
}

/** «توفي الوالد / محمد في لندن»: مكان الوفاة يُلحق بسطر الاسم إن كان التعريف بالاسم أو الكنية. */
function headingPlaceSuffix(person: DeceasedPerson, identity: IdentityResult): string {
  const deathPlace = deathPlaceOf(person);
  return deathPlace && (identity.mode === "name" || identity.mode === "kunya") ? ` في ${deathPlace}` : "";
}

function sharedParentLine(request: ObituaryRequestInput): string {
  const parent = request.sharedParent;
  if (!parent || !clean(parent.name)) return "";
  return referenceLine(parent);
}

type IdentityComposition = {
  identityLines: string[];
  headline: AnnouncementHeadline;
  relativesLines: string[];
  relativeBlocks: RelativeBlock[];
  posterNames: string;
  posterDetails: string[];
  shortIdentity: string;
};

function composeIdentity(request: ObituaryRequestInput, warnings: string[]): IdentityComposition {
  const people = request.deceasedPeople ?? [];
  const mode: Mode = people.length <= 1
    ? "single"
    : request.announcementMode && request.announcementMode !== "single" ? request.announcementMode : "unrelated";

  people.forEach((person, index) => {
    if (!isKnownGender(person.gender)) {
      warnings.push(`جنس المتوفى ${people.length > 1 ? `رقم ${index + 1} ` : ""}غير محدد؛ لا يمكن صياغة فعل الوفاة والدعاء بشكل صحيح.`);
    }
  });

  const identities = people.map((person, index) => buildIdentity(person, rolesFor(request, index, mode)));
  identities.forEach((identity, index) => {
    if (!identity.mode) warnings.push(`تعذر التعريف بالمتوفى ${people.length > 1 ? `رقم ${index + 1}` : ""}: أدخل الاسم أو الكنية أو الزوج أو الأب أو الأبناء.`.replace(/\s+:/u, ":"));
    else if (people[index].identifyBy && people[index].identifyBy !== identity.mode) {
      warnings.push(`طريقة التعريف المختارة للمتوفى ${people.length > 1 ? `رقم ${index + 1} ` : ""}تنقصها بيانات؛ استُخدم بديل متاح.`);
    }
  });

  const relativeBlocks: RelativeBlock[] = [];
  const renderRole = (
    group: RelativeGroup,
    perspective: { gender?: Gender } | { groupSuffix: "هم" | "هن" },
    fallbackReference?: LinkedPerson,
  ) => {
    const block = roleBlock(group, perspective, fallbackReference);
    if (!block) return [];
    relativeBlocks.push(block);
    return blockLines(block);
  };

  const rolesLinesFor = (index: number, identity: IdentityResult, gender?: Gender) => {
    const person = people[index];
    const fatherAvailable = clean(person.father?.name) && !identity.consumedFather ? person.father : undefined;
    const lines: string[] = [];
    for (const role of rolesFor(request, index, mode)) {
      if (role === identity.consumedChildrenRole) continue;
      const key = relationKeyOf(role);
      const usesFather = (key === "siblings" || key === "full_siblings") && !clean(role.reference?.name) && fatherAvailable;
      lines.push(...renderRole(role, { gender }, usesFather ? fatherAvailable : undefined));
      if (usesFather) identity.consumedFather = true;
    }
    return lines;
  };

  const groupSuffix = people.every((person) => isFemale(person.gender)) ? "هن" : "هم";
  const groupRoleLines = groupRoles(request, mode).flatMap((role) => renderRole(role, { groupSuffix }));

  if (mode === "single") {
    const person = people[0];
    const identity = identities[0];
    const relativesLines = rolesLinesFor(0, identity, person.gender);
    const [first = "", ...rest] = identity.lines;
    const placeSuffix = headingPlaceSuffix(person, identity);
    const details = personDetailLines(person, identity, { includeAge: true, placeInHeading: !!placeSuffix });
    return {
      identityLines: [`${singleVerb(person.gender)} ${first}${placeSuffix}`.trim(), ...rest, ...details],
      headline: { verb: singleVerb(person.gender), name: headlineName(first), rest: [...rest, ...personDetailLines(person, identity, { includeAge: true, mergePlace: true })] },
      relativesLines,
      relativeBlocks,
      posterNames: identity.plain,
      posterDetails: [identity.plain, ...rest, ...(placeSuffix ? [`الوفاة${placeSuffix}`] : []), ...details].filter(Boolean),
      shortIdentity: first,
    };
  }

  if (mode === "siblings" || mode === "father_first") {
    const parentLine = sharedParentLine(request);
    if (!parentLine) warnings.push("صيغة الإخوة تحتاج اسم الأب المشترك (سطر «أبناء /»).");
    const names = people.map((person, index) => identities[index].plain);
    const ages = people.map((person) => formatAge(person.age, person.ageUnit));
    const extra = people.flatMap((person, index) => {
      const roleLines = rolesLinesFor(index, identities[index], person.gender);
      return [...personDetailLines(person, identities[index], { includeAge: false }), ...roleLines];
    });
    const allChildren = people.every((person) => isChild(person.gender));
    let identityLines: string[];
    let posterDetails: string[];
    let nameLines: string[];
    if (mode === "siblings") {
      const heading = allChildren ? childGroupHeading(people) : groupVerb(people);
      nameLines = names.map((name, index) => [name, ages[index]].filter(Boolean).join(" — "));
      identityLines = [heading, ...nameLines, ...(parentLine ? [parentLine] : []), ...extra];
      posterDetails = [...nameLines, ...(parentLine ? [parentLine] : []), ...extra];
    } else {
      const verb = allChildren ? "انتقل إلى رحمة الله تعالى" : people.every((person) => isFemale(person.gender)) ? "توفيت" : "توفي";
      const heading = parentLine ? `${verb} ${parentLine}` : verb;
      nameLines = ages.some(Boolean)
        ? prefixAnd(names.map((name, index) => [name, ages[index]].filter(Boolean).join(" — ")))
        : [joinWithAnd(names)];
      identityLines = [heading, ...nameLines, ...extra];
      posterDetails = [...(parentLine ? [parentLine] : []), ...nameLines, ...extra];
    }
    return {
      identityLines,
      headline: { verb: identityLines[0] ?? "", name: joinWithAnd(names), rest: identityLines.slice(1).filter((line) => !nameLines.includes(line)) },
      relativesLines: groupRoleLines,
      relativeBlocks,
      posterNames: joinWithAnd(names),
      posterDetails,
      shortIdentity: `${joinWithAnd(names)}${parentLine ? ` ${parentLine}` : ""}`,
    };
  }

  if (mode === "mother_child") {
    const parent = people[0];
    const parentIdentity = identities[0];
    const parentRoleLines = rolesLinesFor(0, parentIdentity, parent.gender);
    const [first = "", ...rest] = parentIdentity.lines;
    const placeSuffix = headingPlaceSuffix(parent, parentIdentity);
    const lines = [
      `${singleVerb(parent.gender)} ${first}${placeSuffix}`,
      ...rest,
      ...personDetailLines(parent, parentIdentity, { includeAge: true, placeInHeading: !!placeSuffix }),
    ];
    const posterParts = [parentIdentity.plain];
    people.slice(1).forEach((child, offset) => {
      const index = offset + 1;
      const relation = isFemale(parent.gender)
        ? (isFemale(child.gender) ? "ابنتها" : "ابنها")
        : (isFemale(child.gender) ? "ابنته" : "ابنه");
      const title = clean(child.title) || defaultChildTitle(child.gender);
      const name = clean(child.fullName) || clean(child.kunya);
      if (!name) warnings.push(`اسم المتوفى رقم ${index + 1} مطلوب في صيغة «الأم والطفل».`);
      lines.push(`و${[relation, title].filter(Boolean).join(" ")} / ${name}`);
      posterParts.push(`${[relation, title].filter(Boolean).join(" ")} ${name}`);
      const childIdentity = { ...identities[index], consumedSpouse: true, consumedFather: true };
      const childRoleLines = rolesLinesFor(index, identities[index], child.gender);
      lines.push(...personDetailLines(child, childIdentity, { includeAge: true }), ...childRoleLines);
    });
    return {
      identityLines: lines,
      headline: { verb: singleVerb(parent.gender), name: headlineName(first), rest: [...(placeSuffix ? [`الوفاة${placeSuffix}`] : []), ...lines.slice(1)] },
      relativesLines: parentRoleLines,
      relativeBlocks,
      posterNames: joinWithAnd(posterParts),
      posterDetails: [parentIdentity.plain, ...(placeSuffix ? [`الوفاة${placeSuffix}`] : []), ...lines.slice(1)].filter(Boolean),
      shortIdentity: `${first} و${posterParts.slice(1).join(" و")}`,
    };
  }

  // unrelated: «توفي كل من» ثم كتلة لكل متوفى.
  const blocks = people.map((person, index) => {
    const identity = identities[index];
    const roleLines = rolesLinesFor(index, identity, person.gender);
    return [...identity.lines, ...personDetailLines(person, identity, { includeAge: true }), ...roleLines];
  });
  const flattened = blocks.flatMap((block, index) => (index === 0 ? block : ["", ...block]));
  return {
    identityLines: [groupVerb(people), ...flattened],
    headline: { verb: groupVerb(people), name: joinWithAnd(identities.map((identity) => identity.plain)), rest: flattened.filter((line) => !identities.some((identity) => identity.lines[0] === line)) },
    relativesLines: groupRoleLines,
    relativeBlocks,
    posterNames: joinWithAnd(identities.map((identity) => identity.plain)),
    posterDetails: flattened,
    shortIdentity: joinWithAnd(identities.map((identity) => identity.lines[0] ?? "")),
  };
}

// ───────────────────────── الصلاة والدفن ─────────────────────────

function cemeteryPhrase(cemetery: string): string {
  const value = clean(cemetery);
  if (!value) return "";
  return /^مقبر[ةه]/u.test(value) ? value : `مقبرة ${value}`;
}

function burialPlace(request: ObituaryRequestInput): string {
  const burial = request.burial;
  if (burial.outsideQatar) return clean(burial.outsideLocation) || "خارج قطر";
  return cemeteryPhrase(burial.cemetery ?? "");
}

function sentence(parts: Array<string | undefined>): string {
  return parts.map((part) => clean(part)).filter(Boolean).join(" ");
}

function prayerAndBurial(
  request: ObituaryRequestInput,
  warnings: string[],
  now?: Date,
): { prayer: AnnouncementSection; burial: AnnouncementSection } {
  const { prayer, burial } = request;
  const status = burial.status;
  const prayerLines: string[] = [];
  const burialLines: string[] = [];
  const place = burialPlace(request);
  const burialWhen = dayTimePhrase(burial.day, burial.weekday, burial.time, now);
  const prayerEnabled = prayer.enabled && status !== "postponed";
  const note = clean(burial.note);

  const prayerWhen = prayerEnabled ? dayTimePhrase(prayer.day, prayer.weekday, prayer.time, now) : "";
  if (prayerEnabled) {
    const prayerPlace = clean(prayer.place);
    prayerLines.push(sentence([
      status === "completed" ? "تمت صلاة الجنازة" : "صلاة الجنازة",
      prayerWhen,
      prayerPlace ? `في ${prayerPlace}` : "",
    ]));
  }

  if (status === "postponed") {
    burialLines.push("تأجيل الدفن حتى إشعار آخر");
    if (note) burialLines.push(note);
  } else if (status === "completed" && note && !burialWhen && !clean(burial.cemetery) && !clean(burial.outsideLocation)) {
    // ملاحظة مثل «تم الدفن في مكة المكرمة» تصف الدفن كاملاً، فلا نضيف «تم الدفن» قبلها.
    burialLines.push(/^(?:تم|تمت|وتم)\s/u.test(note) ? note : `تم الدفن ${note}`);
  } else {
    const verb = status === "completed"
      ? (prayerEnabled ? "وتم الدفن" : "تم الدفن")
      : (prayerEnabled ? "والدفن" : "الدفن");
    // الدفن يلي الصلاة مباشرة؛ لا نكرر الموعد إن كان هو نفسه.
    const when = prayerEnabled && burialWhen === prayerWhen ? "" : burialWhen;
    burialLines.push(sentence([verb, when, place ? `في ${place}` : ""]));
    if (note) burialLines.push(note);
    if (status === "upcoming" && !burial.outsideQatar) {
      if (!clean(burial.day) && !clean(burial.weekday) && !(prayerEnabled && clean(prayer.day))) warnings.push("يوم الدفن غير محدد.");
      if (!clean(burial.time) && !(prayerEnabled && clean(prayer.time))) warnings.push("وقت الدفن غير محدد.");
      if (!clean(burial.cemetery)) warnings.push("المقبرة غير محددة.");
    }
  }

  return {
    prayer: { id: "prayer", label: "صلاة الجنازة", lines: prayerLines.filter(Boolean), mapLink: prayerEnabled ? clean(prayer.mapLink) : "" },
    burial: { id: "burial", label: "الدفن", lines: burialLines.filter(Boolean), mapLink: status === "postponed" ? "" : clean(burial.mapLink) },
  };
}

// ───────────────────────── العزاء ─────────────────────────

const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];

function startPhrase(start?: string, now?: Date): string {
  const value = clean(start);
  if (!value) return "";
  const isoDay = formatIsoDay(value, now);
  if (isoDay) return `من ${isoDay}`;
  if (value === "اليوم") return "من اليوم";
  if (value === "غداً" || value === "غدا") return "من الغد";
  return withPrefix(value, "من", /^(?:من|بعد|حتى|ابتداءً|ابتداء)\s/u);
}

function addressPhrase(card: CondolenceCard): string {
  const parts = [
    clean(card.street) && withPrefix(card.street ?? "", "شارع", /^شارع/u),
    clean(card.houseNumber) && withPrefix(card.houseNumber ?? "", "منزل رقم", /^منزل/u),
    clean(card.buildingNumber) && withPrefix(card.buildingNumber ?? "", "بناية", /^(?:بناية|مبنى|عمارة)/u),
    clean(card.floor) && withPrefix(card.floor ?? "", "الطابق", /^الطابق/u),
    clean(card.apartmentNumber) && withPrefix(card.apartmentNumber ?? "", "شقة", /^شقة/u),
  ].filter(Boolean);
  return parts.join(" / ");
}

/** أسطر بطاقة عزاء واحدة: «عزاء الرجال من اليوم في … لمدة ٣ أيام، الفترة المسائية». */
export function condolenceCardLines(card: CondolenceCard, label: string, now?: Date): string[] {
  const location = clean(card.location);
  const area = clean(card.area);
  const where = location
    ? `${withPrefix(location, "في", LOCATION_PREFIXED)}${area && !location.includes(area) ? ` بمنطقة ${area}` : ""}`
    : area ? `في ${area}` : "";
  const address = addressPhrase(card);
  const opening = sentence([label, startPhrase(card.start, now), where]);
  const first = address ? `${opening}${where ? "، " : " "}${address}` : opening;
  const timing = [
    formatDurationDays(card.durationDays),
    clean(card.time),
    clean(card.until) && withPrefix(formatIsoDay(card.until, now) ?? card.until ?? "", "حتى", /^حتى/u),
  ].filter(Boolean).join("، ");
  const schedule = (card.schedule ?? [])
    .map((entry) => sentence([entry.days, entry.time]))
    .filter(Boolean);
  return [first, timing, ...schedule, clean(card.locationNotes)].filter(Boolean);
}

function deceasedShortName(person: DeceasedPerson | undefined, roles: RelativeGroup[]): string {
  if (!person) return "";
  return clean(person.fullName) || clean(person.kunya) || describeDeceased(person, roles);
}

function cardTargetLabel(request: ObituaryRequestInput, card: CondolenceCard): string {
  const people = request.deceasedPeople ?? [];
  const target = card.deceasedIndex;
  if (target == null || target < 0 || target >= people.length) return "";
  return `لـ${deceasedShortName(people[target], request.relatives ?? [])} ${mercyForDeceased([people[target]])}`;
}

/** أسطر البطاقة في الصورة: عنوان القسم («عزاء النساء لـسعود رحمه الله») يظهر فوقها، فلا يُكرر داخل النص. */
export function posterCardLines(_request: ObituaryRequestInput, card: CondolenceCard, now?: Date): string[] {
  return condolenceCardLines(card, "", now);
}

function condolenceSections(request: ObituaryRequestInput, warnings: string[], now?: Date): AnnouncementSection[] {
  const options = request.condolenceOptions ?? [];
  const cards = request.condolences ?? [];
  const people = request.deceasedPeople ?? [];
  const sections: AnnouncementSection[] = [];
  const note = clean(request.condolenceNote);
  let noteUsed = false;

  const hasMenVenue = options.includes("men") && cards.some((card) => card.audience === "men");
  // بداية مشتركة لكل المواقع تُكتب مرة واحدة «العزاء من …» قبلها، كما في الأرشيف، بدل تكرارها في كل جملة.
  const venueCards = cards.filter((card) => options.includes(card.audience));
  const starts = venueCards.map((card) => clean(card.start));
  const sharedStart = venueCards.length > 1 && starts[0] && starts.every((start) => start === starts[0]) ? starts[0] : "";
  for (const audience of ["men", "women"] as const) {
    if (!options.includes(audience)) continue;
    const audienceCards = cards
      .map((card, cardIndex) => ({ card, cardIndex }))
      .filter(({ card }) => card.audience === audience);
    audienceCards.forEach(({ card, cardIndex }, position) => {
      const base = audience === "men" ? "عزاء الرجال" : "عزاء النساء";
      let label = base;
      const targetLabel = cardTargetLabel(request, card);
      if (targetLabel) {
        label = `${base} ${targetLabel}`;
      } else if (audienceCards.length > 1) {
        label = `${base} ${ORDINALS[position] ?? position + 1}`;
      } else if (audience === "women" && hasMenVenue) {
        label = "والنساء";
      }
      const lines = condolenceCardLines(sharedStart ? { ...card, start: "" } : card, label, now);
      if (!clean(card.location) && !clean(card.area) && !addressPhrase(card) && !clean(card.mapLink)) {
        warnings.push(`مكان ${base}${audienceCards.length > 1 ? ` (${position + 1})` : ""} غير محدد.`);
      }
      sections.push({
        id: position === 0 ? audience : `${audience}-${position + 1}`,
        label: targetLabel ? `${base} ${targetLabel}` : audienceCards.length > 1 ? `${base} (${position + 1})` : base,
        lines,
        mapLink: clean(card.mapLink),
        audience,
        cardIndex,
      });
    });
  }

  if (sharedStart && sections.length) sections.unshift({ id: "condolence-start", lines: [`العزاء ${startPhrase(sharedStart, now)}`] });

  // ما يخص الرجال وحدهم (المقبرة فقط، أو الهاتف) يُكتب قبل عزاء النساء كما في بقية الإعلانات
  const beforeWomen = (section: (typeof sections)[number]) => {
    const firstWomen = sections.findIndex((item) => item.audience === "women");
    sections.splice(firstWomen === -1 ? sections.length : firstWomen, 0, section);
  };
  if (options.includes("men_cemetery")) {
    const hasMenCards = sections.some((section) => section.audience === "men");
    beforeWomen({
      id: hasMenCards ? "men-cemetery" : "men",
      label: "عزاء الرجال",
      lines: [sentence(["عزاء الرجال في المقبرة فقط", note])],
      audience: "men",
    });
    noteUsed = !!note;
  }
  const other: string[] = [];
  if (options.includes("phone")) {
    const audience = request.phoneAudience ?? "all";
    const label = audience === "men" ? "عزاء الرجال" : audience === "women" ? "عزاء النساء" : "العزاء";
    const phoneLines: string[] = [];
    if (audience === "women" && !options.includes("men") && !options.includes("men_cemetery")) phoneLines.push("لا يوجد عزاء للرجال");
    if (audience === "men" && !options.includes("women")) phoneLines.push("لا يوجد عزاء للنساء");
    const prefix = phoneLines.length ? "و" : "";
    // لا تُنشر أرقام الهواتف ولا أسماء أصحابها (قرار جديد)، حتى لو حملها طلب قديم.
    phoneLines.push(`${prefix}${label} عبر الهاتف`);
    const phoneSection = { id: "phone", label: "التعزية عبر الهاتف", lines: phoneLines };
    if (audience === "men") beforeWomen(phoneSection);
    else sections.push(phoneSection);
  }
  if (options.includes("tbd")) other.push("العزاء: سيُحدَّد لاحقاً");
  // لا عزاء: لا يُكتب شيء عن العزاء (لا «لا يوجد عزاء» ولا سببه)
  if (!options.length) noteUsed = true;
  if (note && !noteUsed) other.push(note);
  if (other.length) sections.push({ id: "condolence-other", label: "العزاء", lines: other });
  return sections;
}

// ───────────────────────── تجميع الإعلان ─────────────────────────

/** سطور إلغاء العزاء؛ بلا shortIdentity تُكتب دون «في عزاء فلان» (للصورة، فعنوانها يذكر المتوفى). */
export function cancellationLines(request: ObituaryRequestInput, shortIdentity: string): string[] {
  const cancellation = request.cancellation ?? {};
  const audience = cancellation.audience === "women" ? "عزاء النساء" : cancellation.audience === "all" ? "العزاء" : "عزاء الرجال";
  const reason = clean(cancellation.reason);
  const people = request.deceasedPeople ?? [];
  const lines = [
    `${reason ? `${reason}، ` : ""}تقرر إلغاء ${sentence([audience, cancellation.from])}${shortIdentity ? ` في عزاء ${sentence([shortIdentity, mercyForDeceased(people)])}` : ""}`,
  ];
  // دون أرقام هواتف (قرار جديد)
  if (cancellation.phoneOnly) lines.push("ويُكتفى بتلقي العزاء عبر الهاتف");
  return lines;
}

function joinSections(blocks: string[][]): string {
  return blocks
    .map((lines) => lines.filter((line) => line !== undefined).join("\n").replace(/\n{3,}/gu, "\n\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

export type AnnouncementOptions = {
  /** يوم النشر الذي تُحسب منه «اليوم/غداً» لتواريخ منتقي التاريخ (الافتراضي: الآن). */
  now?: Date;
};

export function buildAnnouncement(request: ObituaryRequestInput, options: AnnouncementOptions = {}): Announcement {
  const { now } = options;
  const warnings: string[] = [];
  const people = request.deceasedPeople ?? [];
  const messageType = request.messageType ?? "announcement";
  const identity = composeIdentity(request, warnings);
  if ((request.relatives ?? []).some((group) => isBlankRelation(group) && group.people.some((person) => clean(person.name)))) {
    warnings.push("صلة القرابة لإحدى مجموعات الأقارب غير مكتوبة (أخرى)؛ كُتب العنوان «الأقارب».");
  }
  const closing = makeClosingPrayer(people);
  const statement = makeDeathStatement(people);

  if (messageType === "postponement") {
    const lines = [`تأجيل دفن ${sentence([identity.shortIdentity, mercyForDeceased(people)])} حتى إشعار آخر`];
    if (clean(request.burial?.note)) lines.push(clean(request.burial.note));
    const notes = clean(request.notes) ? [clean(request.notes)] : [];
    const sections: AnnouncementSection[] = [
      { id: "notice", lines },
      ...(notes.length ? [{ id: "notes", label: "ملاحظات", lines: notes }] : []),
    ];
    return {
      text: joinSections([lines, notes]),
      statement,
      posterNames: identity.posterNames,
      posterDetails: identity.posterDetails,
      relativeBlocks: identity.relativeBlocks,
      headline: identity.headline,
      sections,
      closing: "",
      warnings,
    };
  }

  if (messageType === "condolence_cancellation") {
    const lines = cancellationLines(request, identity.shortIdentity);
    const notes = clean(request.notes) ? [clean(request.notes)] : [];
    return {
      text: joinSections([lines, notes]),
      statement,
      posterNames: identity.posterNames,
      posterDetails: identity.posterDetails,
      relativeBlocks: identity.relativeBlocks,
      headline: identity.headline,
      sections: [{ id: "notice", lines }, ...(notes.length ? [{ id: "notes", label: "ملاحظات", lines: notes }] : [])],
      closing: "",
      warnings,
    };
  }

  const { prayer, burial } = prayerAndBurial(request, warnings, now);
  const condolences = condolenceSections(request, warnings, now);
  const notes = clean(request.notes) ? [request.notes!.trim()] : [];
  if (!closing && people.length) warnings.push("لم يُكتب الدعاء الختامي لأن جنس أحد المتوفين غير محدد.");

  const withLink = (section: AnnouncementSection) => [...section.lines, ...(section.lines.length && section.mapLink ? [section.mapLink] : [])];
  const notice = messageType === "amendment" ? ["تعديل /"] : [];
  // المرسل أكّد أنه لا أقارب يُذكرون: يُكتب ذلك في موضع الأقارب بدل تركه فارغاً
  const noRelatives = request.noRelatives === true && !identity.relativeBlocks.length && !identity.relativesLines.length ? [noRelativesPhrase(people)] : [];
  const text = joinSections([
    [...notice, ...identity.identityLines, ...identity.relativesLines, ...noRelatives],
    [...withLink(prayer), ...withLink(burial)],
    condolences.flatMap(withLink),
    notes,
    closing ? [closing] : [],
  ]);

  const sections: AnnouncementSection[] = [
    ...(notice.length ? [{ id: "notice", lines: notice }] : []),
    { id: "deceased-details", label: people.length > 1 ? "بيانات المتوفين" : "بيانات المتوفى", lines: identity.posterDetails },
    { id: "relatives", label: "الأقارب", lines: [...identity.relativesLines, ...noRelatives] },
    prayer,
    burial,
    ...condolences,
    ...(notes.length ? [{ id: "notes", label: "ملاحظات", lines: notes }] : []),
    ...(closing ? [{ id: "closing", lines: [closing] }] : []),
  ].filter((section) => section.lines.length || section.mapLink);

  return {
    text,
    statement,
    posterNames: identity.posterNames,
    posterDetails: identity.posterDetails,
    relativeBlocks: identity.relativeBlocks,
    headline: identity.headline,
    sections,
    closing,
    warnings: [...new Set(warnings)],
  };
}
