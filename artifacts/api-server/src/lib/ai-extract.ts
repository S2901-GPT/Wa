/**
 * «طلب من نص»: يحوّل نص إعلان وفاة وصل للمسؤول (واتساب أو غيره) إلى بيانات طلب بالذكاء الاصطناعي.
 * يستعمل Gemini من جهة الخادم عبر واجهته المباشرة (بلا مكتبة إضافية)، ثم يصحّح الناتج ويتحقق منه بعقد الطلب
 * نفسه الذي يقبله الخادم، فلا يصل للمسؤول إلا طلب صالح للحفظ.
 */
import { CreateObituaryRequestBody } from "@workspace/api-zod";

export type ObituaryRequestInput = ReturnType<typeof CreateObituaryRequestBody.parse>;
export type ExtractResult = { request: ObituaryRequestInput; warnings: string[]; debug?: string };

/** الاسم المستعار لأحدث نموذج Flash؛ ويُجرَّب النموذج الثابت إن لم يكن متاحاً للمفتاح. */
export const DEFAULT_MODEL = "gemini-flash-latest";
export const FALLBACK_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class AiError extends Error {
  /** ردّ النموذج مختصراً (إن وُجد) ليُعرض للمسؤول ويُسجَّل، فلا يبقى الفشل بلا أثر. */
  debug?: string;
  constructor(readonly status: number, message: string, debug?: string) {
    super(message);
    this.name = "AiError";
    if (debug) this.debug = debug;
  }
}

/** أسماء المفتاح المحتملة بالترتيب؛ تختلف بين AI Studio والاستضافات الأخرى. */
const KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY", "API_KEY", "GEMINI_KEY"] as const;

export function aiConfig(env: NodeJS.ProcessEnv = process.env): { apiKey: string; model: string } {
  const name = KEY_NAMES.find((key) => (env[key] ?? "").trim());
  return {
    apiKey: name ? (env[name] ?? "").trim() : "",
    model: (env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
  };
}

/** أسماء (لا قيم) متغيرات البيئة التي قد تخص Gemini أو وكيل AI Studio، لتشخيص غياب المفتاح. */
export function aiEnvHints(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => /GEMINI|GENAI|GOOGLE|API_?KEY|APPLET|PROXY|BASE_?URL/iu.test(name))
    .sort()
    .slice(0, 20);
}

/** خدمة منشورة من AI Studio: يمر الطلب بوسيطها الذي يضيف المفتاح، فلا يحتاج التطبيق أن يراه. */
export const AI_STUDIO_PROXY_PATH = "/api-proxy/v1beta/models";

// ───────────────────────── مخطط الناتج (صيغة Gemini) ─────────────────────────

type GeminiSchema = Record<string, unknown>;
const str = (description?: string): GeminiSchema => ({ type: "STRING", ...(description ? { description } : {}) });
const bool = (description?: string): GeminiSchema => ({ type: "BOOLEAN", ...(description ? { description } : {}) });
const int = (description?: string): GeminiSchema => ({ type: "INTEGER", nullable: true, ...(description ? { description } : {}) });
const oneOf = (values: readonly string[], description?: string): GeminiSchema => ({
  type: "STRING",
  format: "enum",
  enum: [...values],
  ...(description ? { description } : {}),
});
// propertyOrdering: بدونه يرتّب Gemini الحقول أبجدياً، وهو ما يضعف الناتج حين يخالف ترتيب التعليمات والمثال.
const obj = (properties: Record<string, GeminiSchema>, required?: string[]): GeminiSchema => ({
  type: "OBJECT",
  properties,
  propertyOrdering: Object.keys(properties),
  ...(required ? { required } : {}),
});
const list = (items: GeminiSchema, description?: string): GeminiSchema => ({ type: "ARRAY", items, ...(description ? { description } : {}) });

const MESSAGE_TYPES = ["announcement", "postponement", "amendment", "condolence_cancellation"] as const;
const MODES = ["single", "unrelated", "siblings", "father_first", "mother_child"] as const;
const GENDERS = ["man", "woman", "boy", "girl"] as const;
const AGE_UNITS = ["years", "months", "days"] as const;
const BURIAL_STATUSES = ["upcoming", "completed", "postponed"] as const;
// «tbd» (سيُحدَّد لاحقاً) أُلغي من النموذج، فلا يُستخرج.
const OPTIONS = ["phone", "men", "women", "men_cemetery"] as const;
const RELATION_LABELS = {
  children: "الأبناء",
  full_siblings: "الأشقاء",
  siblings: "الإخوة",
  grandchildren: "الأحفاد",
  brothers_children: "أبناء الأخ",
  sisters_children: "أبناء الأخت",
  father: "الأب",
  grandfather: "الجد",
  paternal_uncles: "الأعمام",
  maternal_uncles: "الأخوال",
  daughters_husbands: "أزواج البنات",
  sisters_husbands: "أزواج الأخوات",
  other: "أخرى",
} as const;
const RELATION_KEYS = Object.keys(RELATION_LABELS) as Array<keyof typeof RELATION_LABELS>;

const linked = obj({ title: str("مثل: الوالد، المرحوم"), name: str(), deceased: bool("متوفى (رحمه الله)") });

export const RESPONSE_SCHEMA: GeminiSchema = obj(
  {
    messageType: oneOf(MESSAGE_TYPES),
    relatedRequestNumber: str("رقم الطلب الأصلي إن ذُكر (للتعديل أو التأجيل أو الإلغاء)"),
    announcementMode: oneOf(MODES, "صيغة الإعلان عند تعدد المتوفين فقط"),
    sharedParent: linked,
    cancellation: obj({ audience: oneOf(["men", "women", "all"]), from: str(), reason: str(), phoneOnly: bool() }),
    deceasedPeople: list(
      obj(
        {
          fullName: str("الاسم كما ورد بلا لقب"),
          title: str("اللقب كما ورد: الوالد، الوالدة، الشاب، الشابة، الطفل، الطفلة…"),
          gender: oneOf(GENDERS),
          age: int(),
          ageUnit: oneOf(AGE_UNITS),
          nationality: str(),
          deathPlace: str("مكان الوفاة إن كان خارج قطر، مثل: في لندن"),
          occupation: str(),
          note: str("سطر إضافي يُكتب كما هو"),
          spouse: obj({ kind: oneOf(["harem", "widow"]), title: str(), name: str(), deceased: bool() }),
        },
        ["gender"],
      ),
    ),
    relatives: list(
      obj(
        {
          relation: str("عنوان المجموعة بالعربية، مثل: الأبناء"),
          relationKey: oneOf(RELATION_KEYS),
          reference: linked,
          people: list(obj({ name: str(), occupation: str("جهة العمل أو «متقاعد»"), deceased: bool() }, ["name", "deceased"])),
        },
        ["relation", "relationKey", "people"],
      ),
    ),
    noRelatives: bool(),
    prayer: obj({ enabled: bool(), day: str(), weekday: str(), time: str(), place: str(), mapLink: str() }, ["enabled"]),
    burial: obj(
      {
        status: oneOf(BURIAL_STATUSES),
        day: str("اليوم، غداً، أو التاريخ كما ورد"),
        weekday: str("اسم اليوم مثل: الأربعاء"),
        time: str("مثل: بعد صلاة العصر، أو الساعة 9:30 مساءً"),
        cemetery: str("مثل: مقبرة مسيمير"),
        mapLink: str(),
        outsideQatar: bool(),
        outsideLocation: str(),
        note: str("سبب التأجيل أو وصف دفن تمّ فقط؛ لا موعد ولا مقبرة هنا"),
      },
      ["status", "outsideQatar"],
    ),
    condolences: list(
      obj(
        {
          audience: oneOf(["men", "women"]),
          location: str("مقر العزاء كما ورد، مثل: مجلس العائلة"),
          area: str("المنطقة إن ذُكرت منفصلة"),
          houseNumber: str(),
          start: str("بداية العزاء: اليوم، غداً، أو اسم اليوم"),
          durationDays: int(),
          time: str("وقت العزاء إن ورد نصاً حراً"),
          until: str(),
          mapLink: str(),
          schedule: list(obj({ days: str("الفترة الصباحية، الفترة المسائية، يوم الجمعة"), time: str() })),
        },
        ["audience"],
      ),
    ),
    condolenceOptions: list(oneOf(OPTIONS)),
    condolenceNote: str(),
    notes: str(),
    warnings: list(str(), "ملاحظات قصيرة بالعربية عمّا لم يتضح في النص"),
  },
  ["deceasedPeople", "relatives", "prayer", "burial", "condolences", "warnings"],
);

// ───────────────────────── التعليمات ─────────────────────────

/** مثال واحد كامل (أسماء وهمية) يثبّت شكل الناتج وأسماء الحقول مهما كان النموذج. */
const EXAMPLE_INPUT = `توفيت الوالدة / مريم عبدالله الكواري
والدة كل من: فهد، سعد (رحمه الله)
الدفن اليوم الاثنين بعد صلاة العصر في مقبرة مسيمير
العزاء للرجال من الثلاثاء في مجلس الكواري بالغرافة لمدة 3 أيام الفترة المسائية
وللنساء في منزل الفقيدة بالغرافة منزل رقم 12
https://maps.google.com/?q=25.3,51.4`;
const EXAMPLE_OUTPUT = JSON.stringify(
  {
    messageType: "announcement",
    deceasedPeople: [{ fullName: "مريم عبدالله الكواري", title: "الوالدة", gender: "woman" }],
    relatives: [
      { relation: "الأبناء", relationKey: "children", people: [{ name: "فهد", deceased: false }, { name: "سعد", deceased: true }] },
    ],
    prayer: { enabled: false },
    burial: { status: "upcoming", outsideQatar: false, day: "اليوم", weekday: "الاثنين", time: "بعد صلاة العصر", cemetery: "مقبرة مسيمير" },
    condolences: [
      { audience: "men", location: "مجلس الكواري", area: "الغرافة", start: "الثلاثاء", durationDays: 3, schedule: [{ days: "الفترة المسائية", time: "" }] },
      { audience: "women", location: "منزل الفقيدة", area: "الغرافة", houseNumber: "12", mapLink: "https://maps.google.com/?q=25.3,51.4" },
    ],
    condolenceOptions: ["men", "women"],
    warnings: [],
  },
  null,
  1,
);

export const SYSTEM_PROMPT = `أنت مساعد يحوّل نص إعلان وفاة من قطر (كما يصل في واتساب) إلى بيانات منظّمة بصيغة JSON حسب المخطط.
القواعد:
- لا تخترع شيئاً. ما لم يرد في النص اتركه فارغاً، واذكر النقص المهم في warnings بجملة قصيرة.
- كل الحقول النصية تُنشر حرفياً في الإعلان، فلا تكتب فيها أي تعليق أو تخمين أو توصية أو عبارة من عندك
  (مثل «يرجى مراجعة»، «قد يُدفن»، «للتأكيد»، «نُقلت الأسماء كما وردت»، «تأكد من صحة المعلومات»). كل ما تريد قوله ضعه في warnings.
- قد يصل النص مرتباً أو في سطر واحد، أو بلهجة خليجية واختصارات، أو مليئاً بالأخطاء والرموز التعبيرية. افهم المقصود:
  «الرياييل» = الرجال، «الحريم» = النساء، «عقب» = بعد، «الحين» = اليوم، «بكره» = غداً، «المسايه» = الفترة المسائية.
  تجاهل الرموز والعبارات التي ليست من الإعلان (مثل «انشروه» أو «عظم الله أجركم»).
- انقل أسماء الأشخاص كما وردت حرفياً. أما الكلمات العامة وأسماء الأماكن المعروفة فصحّح إملاءها الشائع
  (الوالده ← الوالدة، مقبره ← مقبرة، الوكره ← الوكرة، الغرافه ← الغرافة)،
  واكتب وصف المقر بالفصحى (مجلس العيال ← مجلس الأبناء، البيت ← منزل الفقيد أو منزل الفقيدة). انسخ روابط الخرائط كما هي.
- صلة المرسل بالمتوفى (خالي، عمي، جدتي…) ليست من أقارب الإعلان: لا تضعها في relatives، واذكر ذلك في warnings.
- إن عُرف المتوفى بكنيته فقط (أم ناصر) فضعها في fullName، ونبّه في warnings إلى أن الاسم الكامل لم يُذكر.
- deceasedPeople: لكل متوفى سطر. fullName بلا لقب، وtitle هو اللقب (الوالد، الوالدة، الشاب، الطفل…).
  gender: man للرجل، woman للمرأة، boy للولد الصغير، girl للبنت الصغيرة. استدلّ من اللقب والأفعال (توفي/توفيت) والضمائر.
  العمر رقم في age ووحدته في ageUnit (years أو months أو days).
  المتوفاة المعرّفة بزوجها: «أرملة فلان» ← spouse.kind=widow و deceased=true، و«حرم فلان» ← spouse.kind=harem.
- أكثر من متوفى: announcementMode = siblings للإخوة من أب واحد مع sharedParent (اسم الأب)، و father_first لـ«أبناء فلان»،
  و mother_child لأم مع أبنائها، و unrelated لغير ذلك. لمتوفى واحد لا تملأ announcementMode.
- relatives: مجموعات أقارب من منظور المتوفى. relationKey: children (والد/والدة كل من)، full_siblings (شقيق)، siblings (أخ)،
  grandchildren (جد)، brothers_children (عم)، sisters_children (خال)، paternal_uncles (أعمامه)، maternal_uncles (أخواله)،
  daughters_husbands (والد زوجة)، sisters_husbands (أخو زوجة)، father (ابن فلان)، grandfather (حفيد فلان)، وغيرها other.
  people: اسم كل شخص كما ورد (غالباً الاسم الأول)، deceased=true لمن ذُكر بعده «رحمه الله»، وجهة العمل أو «متقاعد» في occupation.
  إن عُرّف الأبناء بأبيهم («أبناء المرحوم فلان»، أو سطر «أبناء الوالد / فلان رحمه الله» بعد الأسماء) فضع الأب في reference
  لمجموعة الأبناء: title «الوالد»، name الاسم، deceased=true إن ذُكر «رحمه الله» أو «المرحوم». لا تجعله متوفى ثانياً ولا قريباً.
  إن قال النص صراحةً لا أقارب فاجعل noRelatives=true.
- burial: status = upcoming للدفن القادم، completed إن قال «تم الدفن»، postponed إن قال «تأجيل الدفن». day مثل «اليوم» أو «غداً»،
  weekday اسم اليوم، time مثل «بعد صلاة العصر» أو «الساعة 9:30 مساءً»، cemetery مثل «مقبرة مسيمير». الدفن خارج قطر: outsideQatar=true مع outsideLocation.
  «مقبرة أبو هامور» (أو ابو هامور، بوهامور) اسم متعارف عليه لمقبرة مسيمير وليست مقبرة مستقلة: اكتب cemetery «مقبرة مسيمير».
  أما منطقة أبو هامور كمقر للعزاء فاكتبها كما هي.
  اكتب weekday كلما ورد اسم اليوم ولو مع «اليوم» أو «غداً»، فالتطبيق يحسب «اليوم / غداً» منه لحظة النشر.
  note: اتركه فارغاً للدفن القادم (upcoming) دائماً؛ الموعد والمقبرة في حقولهما. يُملأ فقط عند postponed بسبب التأجيل كما ورد،
  أو عند completed بما ورد في النص عن الدفن الذي تم. لا تكتب «تم الدفن» من عندك.
- prayer: enabled=true فقط إن ذُكر مسجد أو جامع للصلاة منفصلاً عن المقبرة، مع موعده ومكانه.
- condolences: بطاقة لكل مقر. عزاء الرجال audience=men وعزاء النساء audience=women، وإن تعددت مقرات النساء فبطاقة لكل مقر.
  location المقر كما ورد، area المنطقة، houseNumber رقم المنزل، start بداية العزاء (اليوم، غداً، أو اسم اليوم)،
  durationDays عدد الأيام رقماً، وفترات الاستقبال في schedule مثل {"days":"الفترة المسائية","time":""} والوقت إن ذُكر مثل «من 4:00 مساءً إلى 9:00 مساءً».
  إن ذُكر عزاء للنساء بأي صيغة (النساء، الحريم، للنساء) فلا بد من بطاقة audience=women ولو كان المقر مقر الرجال نفسه، والمثل للرجال.
- condolenceOptions: men و/أو women حسب البطاقات، و phone إن كان العزاء عبر الهاتف، و men_cemetery إن قال «يقتصر العزاء على المقبرة».
  لا تنقل أي رقم هاتف إلى أي حقل: أرقام الهواتف لا تُنشر في الإعلانات. إن قال النص إن مقر العزاء سيُحدَّد لاحقاً فاترك condolences فارغة واذكر ذلك في warnings.
- messageType: announcement للإعلان العادي، postponement لرسالة تأجيل الدفن، amendment لتعديل إعلان سابق، condolence_cancellation لإلغاء عزاء.
- لا تضع في notes ما وضعته في حقل آخر.

أجب بكائن JSON واحد فقط بهذا الشكل (احذف الحقول التي لا يرد ما يملؤها، ولا تترك المفاتيح الأساسية فارغة إن وردت بياناتها في النص):
${EXAMPLE_OUTPUT}

مثال كامل. النص:
"""
${EXAMPLE_INPUT}
"""
الناتج:
${EXAMPLE_OUTPUT}`;

/**
 * strict: يفرض المخطط على الناتج (مفاتيح مضمونة). بعض النماذج تُرجع تحت هذا القيد كائناً شبه فارغ،
 * فتُعاد المحاولة بلا مخطط اعتماداً على المثال في التعليمات.
 */
export function buildGeminiBody(text: string, { strict = true }: { strict?: boolean } = {}) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: `نص الإعلان:\n"""\n${text}\n"""` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      ...(strict ? { responseSchema: RESPONSE_SCHEMA } : {}),
      temperature: 0.1,
    },
  };
}

export const HOLLOW_WARNING =
  "لم يستخرج الذكاء الاصطناعي بيانات كافية من النص (الاسم أو الدفن أو العزاء). جرّب مرة أخرى، أو أدخل الطلب من النموذج، وأرسل «تفاصيل تقنية» لمن يتابع التطبيق.";

/** ناتج أجوف: نص طويل عاد منه اسم ناقص، أو إعلان بلا دفن ولا عزاء ولا أقارب. */
export function isHollow(result: ExtractResult, inputLength: number): boolean {
  const { request } = result;
  const named = request.deceasedPeople.some((person) => text(person.fullName) || text(person.title) || text(person.spouse?.name));
  if (!named) return true;
  if (inputLength < 80 || (request.messageType ?? "announcement") !== "announcement") return false;
  const burial = request.burial;
  const hasBurial = Boolean(burial.day || burial.weekday || burial.time || burial.cemetery || burial.note || burial.outsideLocation);
  return !hasBurial && request.condolences.length === 0 && request.relatives.length === 0 && !request.prayer.enabled;
}

const snippet = (reply: string): string => reply.replace(/\s+/gu, " ").trim().slice(0, 700);

// ───────────────────────── تصحيح الناتج ─────────────────────────

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** يحذف القيم الفارغة (null، نص فارغ) حتى لا يرفضها العقد ولا تظهر في الإعلان. */
export function dropEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropEmpty).filter((item) => item !== undefined);
  if (isObject(value)) {
    const out: Loose = {};
    for (const [key, item] of Object.entries(value)) {
      const cleaned = dropEmpty(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() ? value.trim() : undefined;
  return value;
}

const SPOUSE_PREFIX_RE = /^(حرم|زوجة|أرملة|ارملة)\s*\/?\s*/u;
const FEMALE_TITLE = /(الوالدة|الشابة|الطفلة|الرضيعة|السيدة|الحاجة|المرحومة|الجدة|الأم)/u;
const CHILD_TITLE = /(الطفل|الرضيع)/u;

function guessGender(person: Loose): (typeof GENDERS)[number] {
  const title = text(person.title);
  const female = FEMALE_TITLE.test(title) || isObject(person.spouse);
  if (CHILD_TITLE.test(title)) return female ? "girl" : "boy";
  return female ? "woman" : "man";
}

const intOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;

const WEEKDAY_RE = /(?:^|\s)(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الثلاثا|الأربعاء|الاربعاء|الخميس|الجمعة|الجمعه)(?=\s|$)/u;
const RELATIVE_DAY_RE = /(?:^|\s)(اليوم|الحين|الليلة|الليله|غداً|غدا|بكرة|بكره|بعد غد)(?=\s|$)/u;
const PRAYER_TIME_RE = /(?:بعد|عقب) صلاة (?:الفجر|الظهر|العصر|المغرب|العشاء|الجمعة|التراويح)/u;
const CLOCK_TIME_RE = /(?:الساعة\s*)?\d{1,2}(?::\d{2})?\s*(?:صباحاً|صباحا|ظهراً|ظهرا|عصراً|عصرا|مساءً|مساء)/u;
const CEMETERY_RE = /(?:(?<!\p{L})|(?<=(?<!\p{L})ب))(?:مقبرة|مقابر)\s+(?:(?:أبو|ابو|بو|أم|ام)\s+\S+|الوكرة\s+الجنوبية|\S+)/u;

/** الكتابة المعتمدة لما يرد بالعامية أو بلا همزة: «الاحد» ← «الأحد»، «بكره» ← «غداً»، «عقب صلاة» ← «بعد صلاة». */
const SPELLING: Record<string, string> = {
  "الاحد": "الأحد",
  "الإثنين": "الاثنين",
  "الثلاثا": "الثلاثاء",
  "الاربعاء": "الأربعاء",
  "الجمعه": "الجمعة",
  "غدا": "غداً",
  "بكرة": "غداً",
  "بكره": "غداً",
  "الحين": "اليوم",
  "الليله": "الليلة",
};
const canonical = (word: string): string => SPELLING[word] ?? word;

/**
 * النموذج قد يضع موعد الدفن والمقبرة كلها في note أو time («الساعة 9:30 مساءً في مقبرة مسيمير اليوم الاثنين»)،
 * فيخرج الإعلان «الدفن» ثم جملة مبعثرة مع تنبيهات بأن اليوم والمقبرة غير محددين. هنا تُفكّ إلى حقولها.
 */
export function splitBurialNote(burial: Loose): Loose {
  if (burial.status === "postponed") return burial;
  const have = { day: text(burial.day), weekday: text(burial.weekday), time: text(burial.time), cemetery: text(burial.cemetery), note: text(burial.note) };
  // يُفكّ فقط حين تغيب المقبرة، أو حين تكون الملاحظة كل ما ورد عن الدفن.
  const blob = !have.cemetery ? `${have.time} ${have.note}` : !have.day && !have.weekday && !have.time ? have.note : "";
  if (!blob.trim()) return burial;
  let rest = ` ${blob} `;
  const take = (re: RegExp): string => {
    const match = re.exec(rest);
    if (!match) return "";
    rest = rest.replace(match[0], " ");
    return match[0].trim();
  };
  const { cemetery, time, weekday, day } = burialParts(take);
  if (!cemetery && !time && !weekday && !day) return burial;
  const leftover = rest.replace(/(?:^|\s)(?:في|و|بـ|ب)(?=\s|$)/gu, " ").replace(/[،,.]+/gu, " ").replace(/\s+/gu, " ").trim();
  return {
    ...burial,
    day: day || have.day || undefined,
    weekday: weekday || have.weekday || undefined,
    time: time || undefined,
    cemetery: cemetery || have.cemetery || undefined,
    note: /\p{L}{3,}/u.test(leftover) ? leftover : undefined,
  };
}

/** «مقبرة أبو هامور» (أو «ابو هامور»، «بوهامور») اسم متعارف عليه لمقبرة مسيمير، لا مقبرة مستقلة. */
export function canonicalCemetery(value: string): string {
  const name = value.trim();
  if (!name) return name;
  return /^(?:(?:مقبر[ةه]|مقابر)\s*)?[أا]?بو\s*هامور$/u.test(name) ? "مقبرة مسيمير" : name;
}

/** يلتقط من جملة الدفن المقبرة والوقت واسم اليوم و«اليوم / غداً» بالكتابة المعتمدة؛ take يقتطع ما يطابق من الجملة. */
function burialParts(take: (re: RegExp) => string) {
  const cemetery = canonicalCemetery(take(CEMETERY_RE).replace(/^مقبرة (?:ابو|ام) /u, (match) => match.replace(" ا", " أ")));
  const time = (take(PRAYER_TIME_RE) || take(CLOCK_TIME_RE)).replace(/^عقب /u, "بعد ");
  const weekday = canonical(take(WEEKDAY_RE));
  const day = canonical(take(RELATIVE_DAY_RE));
  return { cemetery, time, weekday, day };
}

/** ملاحظة لا تقول شيئاً سوى أن الدفن تم («تم الدفن»، «وتمت الصلاة والدفن»)؛ الحالة completed تكفي لكتابتها. */
const BARE_DONE_RE = /^و?(?:تم(?:ت)?\s+(?:الصلاة\s+و)?(?:الدفن|دفنه|دفنها)|دُفن|دُفنت)\s*[.،]*$/u;

/** بداية جملة الدفن في الرسالة («الدفن»، «والدفن»، «يُدفن»، «سيوارى الثرى»…)، لا «تم الدفن» ولا «تأجيل الدفن». */
const BURIAL_START_RE = /(?<=^|\s)(?<!(?:تم|وتم|تأجيل|تاجيل)\s)(?:و?الدفن|و?سيتم\s+(?:الدفن|دفن\S*)|و?(?:سي|ست|ي|ت)ُ?(?:دفن|وارى(?:\s+الثرى)?))(?=\s|$)/u;
/** نهاية جملة الدفن: سطر جديد، أو بداية العزاء، أو رابط. */
const BURIAL_END_RE = /\n|\s(?=و?(?:ال)?عزاء|و?للرجال|و?للنساء|و?الرجال|و?النساء|https?:)/u;

/**
 * يقرأ موعد الدفن ومقبرته من نص الرسالة نفسه. النموذج (خاصة مع المخطط الصارم) قد يُرجع الدفن فارغاً
 * رغم وضوح الجملة («الدفن اليوم الاحد بعد صلاة العصر في مقبرة مسيمير»)، فتُكمَّل الحقول الناقصة منها فقط.
 */
export function burialFromSource(source: string): { day?: string; weekday?: string; time?: string; cemetery?: string } {
  const start = BURIAL_START_RE.exec(source);
  if (!start) return {};
  const after = source.slice(start.index + start[0].length);
  const end = BURIAL_END_RE.exec(after);
  let rest = ` ${end ? after.slice(0, end.index) : after} `;
  const take = (re: RegExp): string => {
    const match = re.exec(rest);
    if (!match) return "";
    rest = rest.replace(match[0], " ");
    return match[0].trim();
  };
  const parts = burialParts(take);
  return Object.fromEntries(Object.entries(parts).filter(([, value]) => value));
}

const WOMEN_START_RE = /(?<=^|\s)(?:و?عزاء\s+(?:النساء|الحريم)|و?للنساء|و?للحريم|و?النساء|و?الحريم)(?=\s|:|$)/u;
const MEN_START_RE = /(?<=^|\s)(?:و?عزاء\s+(?:الرجال|الرياييل)|و?للرجال|و?للرياييل|و?الرجال|و?الرياييل)(?=\s|:|$)/u;
/** نهاية جملة العزاء: سطر جديد، أو بداية جملة الجمهور الآخر، أو الدفن/الصلاة. */
const CONDOLENCE_END_RE = /\n|\s(?=و?عزاء\s|و?للرجال|و?للنساء|و?للحريم|و?للرياييل|و?الرجال|و?النساء|و?الحريم|و?الرياييل|و?الدفن|و?الصلاة|و?صلاة\s)/u;

/**
 * يقرأ مقر عزاء الرجال أو النساء من نص الرسالة نفسه. النموذج (خاصة بالمخطط الصارم) قد يُسقط بطاقة النساء
 * أو العزاء كله رغم وضوحه («والنساء في منزل الفقيدة بالهلال»)، فتُكمَّل البطاقة الناقصة منه فقط.
 */
export function condolenceFromSource(source: string, audience: "men" | "women"): { location: string; mapLink?: string } | undefined {
  const start = (audience === "women" ? WOMEN_START_RE : MEN_START_RE).exec(source);
  if (!start) return undefined;
  const after = source.slice(start.index + start[0].length);
  const end = CONDOLENCE_END_RE.exec(after);
  let rest = (end ? after.slice(0, end.index) : after).trim().replace(/^[:،,]\s*/u, "");
  const link = /https?:\/\/\S+/u.exec(rest);
  const mapLink = link?.[0].replace(/[.،,]+$/u, "");
  if (link) rest = rest.replace(link[0], " ");
  rest = rest.replace(/^(?:في|ب)\s+/u, "").replace(/\s+/gu, " ").replace(/[\s.،,:]+$/u, "").trim();
  if (!rest) return undefined;
  return mapLink ? { location: rest, mapLink } : { location: rest };
}

/** توحيد الكتابة للمقارنة: بلا تشكيل ولا تطويل، والهمزات ألفاً، والتاء المربوطة هاءً، والألف المقصورة ياءً. */
function foldArabic(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي");
}

/** كلمات النص (3 أحرف فأكثر) بعد التوحيد ونزع «و/ف» ثم «ب/بال/لل/ال» من أولها. */
function stems(value: string): string[] {
  return foldArabic(value)
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => {
      const bare = word.replace(/^(?:و|ف)?(?:بال|كال|لل|ال|ب)?/u, "");
      return bare.length >= 3 ? bare : word;
    })
    .filter((word) => word.length >= 3);
}

/**
 * نص حرّ وردت معظم كلماته في الرسالة. النموذج قد يكتب في الملاحظات جملة ليست في الرسالة إطلاقاً
 * (نسخ مرة مثالاً من التعليمات: «تم الدفن في مكة المكرمة»)، فتُحذف ولا تُنشر.
 */
export function inSource(value: string, source: string): boolean {
  const words = stems(value);
  if (!words.length || !source.trim()) return true;
  const known = new Set(stems(source));
  return words.filter((word) => known.has(word)).length / words.length >= 0.6;
}

const COMMENTARY_RE =
  /يرجى|يُرجى|الرجاء|نرجو|للتأكيد|للتأكد|تأكد|التحقق|مراجعة|راجع|التواصل مع|تواصل معنا|يُنصح|ينصح|قد (?:يُ|ي|تُ|ت)[\u0600-\u06FF]+|ربما|محتمل|غير (?:مؤكد|واضح|محدد)|لم (?:يُذكر|يذكر|تُذكر|تذكر)|لم يرد|لم ترد|نُقلت|نقلت|كما وردت|كما ورد|وفيات قطر|الذكاء الاصطناعي|النموذج|في الإعلان|في النص/u;

/**
 * الحقول النصية تُنشر حرفياً، لكن النموذج قد يكتب فيها تعليقاته («يرجى مراجعة إدارة المقبرة للتأكيد»، «نُقلت
 * الأسماء كما وردت»). الجمل التي تحمل علامات التعليق تُحذف من الحقل وتُنقل إلى warnings ليراها المسؤول.
 */
export function stripCommentary(value: unknown, warnings: string[]): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const sentences = raw.split(/(?<=[.!؟?])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const sentence of sentences) {
    if (COMMENTARY_RE.test(sentence)) warnings.push(`حُذف من الإعلان تعليق للذكاء الاصطناعي: «${sentence.replace(/[.!؟?]+$/u, "")}»`);
    else kept.push(sentence);
  }
  const result = kept.join(" ").trim();
  return result || undefined;
}

/** يحوّل ناتج الذكاء الاصطناعي إلى طلب يقبله الخادم، أو يرفضه برسالة واضحة. */
export function toRequest(raw: unknown, source = ""): ExtractResult {
  const data = (dropEmpty(raw) ?? {}) as Loose;
  if (!isObject(data)) throw new AiError(502, "لم يُرجع الذكاء الاصطناعي بيانات مفهومة، حاول مرة أخرى.");
  const warnings = array(data.warnings).map(text).filter(Boolean).slice(0, 8);
  const modelWarnings = warnings.length;
  // الملاحظات تُنشر حرفياً: بلا تعليقات النموذج، وبلا جمل لم ترد في الرسالة
  const freeText = (value: unknown): string | undefined => {
    const kept = stripCommentary(value, warnings);
    if (kept && !inSource(kept, source)) {
      warnings.push(`حُذف من الإعلان نص لم يرد في الرسالة: «${kept}»`);
      return undefined;
    }
    return kept;
  };

  const people = array(data.deceasedPeople)
    .filter(isObject)
    .filter((person) => text(person.fullName) || text(person.title) || (isObject(person.spouse) && text(person.spouse.name)))
    .map((person) => {
      let gender = pick(person.gender, GENDERS);
      if (!gender) {
        gender = guessGender(person);
        warnings.push("لم يتضح جنس المتوفى من النص، فراجعه قبل الحفظ.");
      }
      let fullName: string | undefined = text(person.fullName) || undefined;
      type Spouse = Loose & { kind: "harem" | "widow" };
      let spouse: Spouse | undefined = isObject(person.spouse) ? { ...person.spouse, kind: pick(person.spouse.kind, ["harem", "widow"] as const) ?? "harem" } : undefined;
      // «حرم فلان» في خانة الاسم: المتوفاة معرّفة بزوجها، فيُنقل إلى spouse ولا يُكتب مرتين
      const prefixed = fullName ? SPOUSE_PREFIX_RE.exec(fullName) : null;
      if (prefixed && fullName) {
        const rest = fullName.slice(prefixed[0].length).trim();
        const spouseName = spouse ? text(spouse.name) : "";
        if (rest && (!spouseName || foldArabic(rest) === foldArabic(spouseName))) {
          const widow = /أرملة|ارملة/u.test(prefixed[1]);
          spouse = { ...(spouse ?? {}), name: spouseName || rest, kind: widow ? "widow" : (spouse?.kind ?? "harem"), deceased: widow ? true : spouse?.deceased === true };
          fullName = undefined;
          warnings.push("عُرِّفت المتوفاة بزوجها ولم يُذكر اسمها في الرسالة.");
        }
      }
      return {
        ...person,
        fullName,
        gender,
        note: freeText(person.note),
        age: intOrUndefined(person.age),
        ageUnit: pick(person.ageUnit, AGE_UNITS),
        spouse,
      };
    });
  if (!people.length) throw new AiError(422, "لم أجد في النص اسم المتوفى. تأكد أن النص إعلان وفاة ثم حاول مرة أخرى.");

  const relatives = array(data.relatives)
    .filter(isObject)
    .map((group) => {
      const relationKey = pick(group.relationKey, RELATION_KEYS) ?? "other";
      return {
        ...group,
        relationKey,
        relation: text(group.relation) || RELATION_LABELS[relationKey],
        people: array(group.people)
          .filter(isObject)
          .filter((person) => text(person.name))
          .map((person) => ({ ...person, deceased: person.deceased === true })),
      };
    })
    .filter((group) => group.people.length > 0);

  type Card = Loose & { audience: "men" | "women"; schedule: Array<{ days: string; time: string }> };
  const condolences: Card[] = array(data.condolences)
    .filter(isObject)
    .filter((card) => card.audience === "men" || card.audience === "women")
    .map((card): Card => ({
      ...card,
      audience: card.audience as "men" | "women",
      locationNotes: freeText(card.locationNotes),
      durationDays: intOrUndefined(card.durationDays),
      schedule: array(card.schedule)
        .filter(isObject)
        .map((entry) => ({ days: text(entry.days), time: text(entry.time) }))
        .filter((entry) => entry.days || entry.time),
    }));
  // بطاقة أسقطها النموذج رغم ورودها في الرسالة تُؤخذ من النص مباشرة
  for (const audience of ["men", "women"] as const) {
    if (condolences.some((card) => card.audience === audience)) continue;
    const found = condolenceFromSource(source, audience);
    if (!found) continue;
    condolences.push({ audience, ...found, schedule: [] });
    warnings.push(`أُخذ عزاء ${audience === "women" ? "النساء" : "الرجال"} من نص الرسالة مباشرة لأن النموذج أغفله؛ راجعه قبل الحفظ.`);
  }
  // أرقام الهواتف لا تُنشر (قرار جديد): لا تُنقل إلى الطلب، ووجودها في الرسالة يعني التعزية عبر الهاتف.
  const phones = array(data.condolencePhoneContacts).filter(isObject).filter((contact) => text(contact.phone));
  if (phones.length) warnings.push("لم تُنقل أرقام الهواتف الواردة في الرسالة: لا تُنشر أرقام في الإعلانات.");
  if (array(data.condolenceOptions).includes("tbd")) warnings.push("تذكر الرسالة أن مقر العزاء سيُحدَّد لاحقاً؛ أضفه عند وصوله.");
  let options = [...new Set(array(data.condolenceOptions).map((option) => pick(option, OPTIONS)).filter(Boolean))] as Array<(typeof OPTIONS)[number]>;
  if (!options.length) {
    options = [...new Set(condolences.map((card) => card.audience))];
    if (phones.length) options.push("phone");
  }
  for (const card of condolences) if (!options.includes(card.audience)) options.push(card.audience);

  const prayer = isObject(data.prayer) ? data.prayer : {};
  const burial = isObject(data.burial) ? data.burial : {};
  burial.note = freeText(burial.note);
  const burialStatus = pick(burial.status, BURIAL_STATUSES) ?? "upcoming";
  const fixedBurial = splitBurialNote({ ...burial, status: burialStatus, outsideQatar: burial.outsideQatar === true });
  // ما نقص من موعد الدفن ومقبرته يُكمَّل من جملة الدفن في الرسالة نفسها
  if (burialStatus === "upcoming" && fixedBurial.outsideQatar !== true) {
    const fromText = burialFromSource(source);
    const filled = (["day", "weekday", "time", "cemetery"] as const).filter((key) => !text(fixedBurial[key]) && fromText[key]);
    for (const key of filled) fixedBurial[key] = fromText[key];
    // تنبيهات النموذج نفسه عن نقص الدفن لم تعد صحيحة (تنبيهات التطبيق تبقى)
    if (filled.length) warnings.splice(0, modelWarnings, ...warnings.slice(0, modelWarnings).filter((warning) => !/الدفن|المقبرة|مقبرة/u.test(warning)));
  }
  // النموذج يكتب أحياناً «تم الدفن» في ملاحظة دفن قادم، فيخرج الإعلان بموعد الدفن ثم «تم الدفن». لا ملاحظة للدفن القادم،
  // ولا ملاحظة تقول «تم الدفن» فقط في أي حالة (الحالة completed تكتبها).
  if (text(fixedBurial.cemetery)) fixedBurial.cemetery = canonicalCemetery(text(fixedBurial.cemetery));
  const burialNote = text(fixedBurial.note);
  if (burialNote && (burialStatus === "upcoming" || BARE_DONE_RE.test(burialNote))) {
    delete fixedBurial.note;
    if (!BARE_DONE_RE.test(burialNote)) warnings.push(`حُذفت من الإعلان ملاحظة الدفن «${burialNote}»: الدفن قادم وموعده ومقبرته في حقولهما.`);
  }
  const mode = people.length > 1 ? pick(data.announcementMode, MODES) : undefined;

  const candidate = {
    ...data,
    warnings: undefined,
    messageType: pick(data.messageType, MESSAGE_TYPES) ?? "announcement",
    announcementMode: mode,
    sharedParent: mode && isObject(data.sharedParent) ? data.sharedParent : undefined,
    deceasedPeople: people,
    relatives,
    noRelatives: relatives.length === 0 && data.noRelatives === true ? true : undefined,
    prayer: { ...prayer, enabled: prayer.enabled === true },
    burial: fixedBurial,
    condolenceOptions: options,
    condolences,
    condolencePhoneContacts: [],
    condolenceNote: freeText(data.condolenceNote),
    notes: freeText(data.notes),
  };

  const parsed = CreateObituaryRequestBody.safeParse(dropEmpty(candidate));
  if (!parsed.success) {
    throw new AiError(422, "تعذّر تحويل النص إلى طلب كامل. حاول مرة أخرى، أو أدخل الطلب من النموذج.");
  }
  return { request: parsed.data, warnings: [...new Set(warnings)] };
}

/** يستخرج نص JSON من رد النموذج (قد يحيطه بعلامات ```json). */
export function readJson(reply: string): unknown {
  const body = reply.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(body);
  } catch {
    throw new AiError(502, "لم يُرجع الذكاء الاصطناعي بيانات مفهومة، حاول مرة أخرى.");
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** يرسل النص إلى Gemini ويعيد طلباً صالحاً مع الملاحظات. */
export async function extractRequest(
  input: string,
  {
    apiKey,
    model,
    endpoint = ENDPOINT,
    fetchImpl = fetch,
    timeoutMs = 45_000,
  }: { apiKey: string; model: string; endpoint?: string; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<ExtractResult> {
  const models = model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL];
  let last: { result?: ExtractResult; failure?: AiError; reply: string } | undefined;

  nextModel: for (const [index, name] of models.entries()) {
    for (const strict of [true, false]) {
      let response: Response;
      try {
        response = await fetchImpl(`${endpoint}/${encodeURIComponent(name)}:generateContent`, {
          method: "POST",
          // بلا مفتاح (عبر وسيط AI Studio) لا تُرسل الترويسة، فالوسيط يضيفها.
          headers: { "content-type": "application/json", ...(apiKey ? { "x-goog-api-key": apiKey } : {}) },
          body: JSON.stringify(buildGeminiBody(input, { strict })),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new AiError(502, "تعذّر الاتصال بخدمة الذكاء الاصطناعي، حاول مرة أخرى.");
      }
      // نموذج غير متاح لهذا المفتاح: جرّب النموذج الثابت.
      if (response.status === 404 && index < models.length - 1) continue nextModel;
      if (response.status === 429) throw new AiError(429, "خدمة الذكاء الاصطناعي مشغولة الآن، حاول بعد دقيقة.");
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        const detail = await response.text().catch(() => "");
        if (/API.?key|PERMISSION|UNAUTHENTICATED/iu.test(detail)) throw new AiError(503, "مفتاح خدمة الذكاء الاصطناعي غير صالح على الخادم.");
        // المخطط نفسه مرفوض (نموذج لا يدعمه): أعد المحاولة بدونه.
        if (strict) continue;
        throw new AiError(502, "رفضت خدمة الذكاء الاصطناعي الطلب، حاول مرة أخرى.", snippet(detail));
      }
      if (!response.ok) throw new AiError(502, "تعذّر الحصول على نتيجة من الذكاء الاصطناعي، حاول مرة أخرى.");

      const data = (await response.json().catch(() => null)) as Loose | null;
      const candidate = isObject(data) ? array(data.candidates)[0] : undefined;
      const parts = isObject(candidate) && isObject(candidate.content) ? array(candidate.content.parts) : [];
      const reply = parts.map((part) => (isObject(part) ? text(part.text) : "")).join("");
      if (!reply) {
        const finish = isObject(candidate) ? text(candidate.finishReason) : "";
        last = { failure: new AiError(502, "لم يُرجع الذكاء الاصطناعي نتيجة لهذا النص، حاول مرة أخرى.", snippet(JSON.stringify(data ?? {}))), reply: finish };
        continue;
      }
      try {
        const result = toRequest(readJson(reply), input);
        if (!isHollow(result, input.length)) return result;
        last = { result, reply };
      } catch (error) {
        if (!(error instanceof AiError)) throw error;
        last = { failure: error, reply };
      }
      // ناتج أجوف أو غير مفهوم: المحاولة الثانية بلا مخطط، ثم النموذج التالي.
    }
  }

  if (last?.result) return { ...last.result, warnings: [HOLLOW_WARNING, ...last.result.warnings], debug: snippet(last.reply) };
  if (last?.failure) {
    if (!last.failure.debug && last.reply) last.failure.debug = snippet(last.reply);
    throw last.failure;
  }
  throw new AiError(502, "نموذج الذكاء الاصطناعي غير متاح، حاول لاحقاً.");
}
