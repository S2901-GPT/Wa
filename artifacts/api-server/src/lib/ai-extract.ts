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
const OPTIONS = ["phone", "men", "women", "men_cemetery", "tbd"] as const;
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
    condolencePhoneContacts: list(obj({ name: str(), phone: str() })),
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
    condolencePhoneContacts: [],
    warnings: [],
  },
  null,
  1,
);

export const SYSTEM_PROMPT = `أنت مساعد يحوّل نص إعلان وفاة من قطر (كما يصل في واتساب) إلى بيانات منظّمة بصيغة JSON حسب المخطط.
القواعد:
- لا تخترع شيئاً. ما لم يرد في النص اتركه فارغاً، واذكر النقص المهم في warnings بجملة قصيرة.
- قد يصل النص مرتباً أو في سطر واحد، أو بلهجة خليجية واختصارات، أو مليئاً بالأخطاء والرموز التعبيرية. افهم المقصود:
  «الرياييل» = الرجال، «الحريم» = النساء، «عقب» = بعد، «الحين» = اليوم، «بكره» = غداً، «المسايه» = الفترة المسائية.
  تجاهل الرموز والعبارات التي ليست من الإعلان (مثل «انشروه» أو «عظم الله أجركم»).
- انقل أسماء الأشخاص كما وردت حرفياً. أما الكلمات العامة وأسماء الأماكن المعروفة فصحّح إملاءها الشائع
  (الوالده ← الوالدة، مقبره ← مقبرة، الوكره ← الوكرة، ابو هامور ← أبو هامور، الغرافه ← الغرافة)،
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
  note فقط لسبب التأجيل أو لوصف دفن تمّ («تم الدفن في مكة المكرمة»)؛ لا تضع فيه الموعد ولا المقبرة، بل وزّعها على day وweekday وtime وcemetery.
- prayer: enabled=true فقط إن ذُكر مسجد أو جامع للصلاة منفصلاً عن المقبرة، مع موعده ومكانه.
- condolences: بطاقة لكل مقر. عزاء الرجال audience=men وعزاء النساء audience=women، وإن تعددت مقرات النساء فبطاقة لكل مقر.
  location المقر كما ورد، area المنطقة، houseNumber رقم المنزل، start بداية العزاء (اليوم، غداً، أو اسم اليوم)،
  durationDays عدد الأيام رقماً، وفترات الاستقبال في schedule مثل {"days":"الفترة المسائية","time":""} والوقت إن ذُكر مثل «من 4:00 مساءً إلى 9:00 مساءً».
- condolenceOptions: men و/أو women حسب البطاقات، و phone إن ذُكرت أرقام للتعزية (في condolencePhoneContacts)،
  و men_cemetery إن قال «يقتصر العزاء على المقبرة»، و tbd إن قال «يُحدَّد لاحقاً».
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

const WEEKDAY_RE = /(?:^|\s)(السبت|الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)(?=\s|$)/u;
const RELATIVE_DAY_RE = /(?:^|\s)(اليوم|غداً|غدا|بعد غد)(?=\s|$)/u;
const PRAYER_TIME_RE = /بعد صلاة (?:الفجر|الظهر|العصر|المغرب|العشاء|الجمعة|التراويح)/u;
const CLOCK_TIME_RE = /(?:الساعة\s*)?\d{1,2}(?::\d{2})?\s*(?:صباحاً|صباحا|ظهراً|ظهرا|عصراً|عصرا|مساءً|مساء)/u;
const CEMETERY_RE = /مقبرة\s+(?:(?:أبو|ابو|أم|ام)\s+\S+|الوكرة\s+الجنوبية|\S+)/u;

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
  const cemetery = take(CEMETERY_RE);
  const time = take(PRAYER_TIME_RE) || take(CLOCK_TIME_RE);
  const weekday = take(WEEKDAY_RE);
  const day = take(RELATIVE_DAY_RE);
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

/** يحوّل ناتج الذكاء الاصطناعي إلى طلب يقبله الخادم، أو يرفضه برسالة واضحة. */
export function toRequest(raw: unknown): ExtractResult {
  const data = (dropEmpty(raw) ?? {}) as Loose;
  if (!isObject(data)) throw new AiError(502, "لم يُرجع الذكاء الاصطناعي بيانات مفهومة، حاول مرة أخرى.");
  const warnings = array(data.warnings).map(text).filter(Boolean).slice(0, 8);

  const people = array(data.deceasedPeople)
    .filter(isObject)
    .filter((person) => text(person.fullName) || text(person.title) || (isObject(person.spouse) && text(person.spouse.name)))
    .map((person) => {
      let gender = pick(person.gender, GENDERS);
      if (!gender) {
        gender = guessGender(person);
        warnings.push("لم يتضح جنس المتوفى من النص، فراجعه قبل الحفظ.");
      }
      return {
        ...person,
        gender,
        age: intOrUndefined(person.age),
        ageUnit: pick(person.ageUnit, AGE_UNITS),
        spouse: isObject(person.spouse) ? { ...person.spouse, kind: pick(person.spouse.kind, ["harem", "widow"] as const) ?? "harem" } : undefined,
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

  const condolences = array(data.condolences)
    .filter(isObject)
    .filter((card) => card.audience === "men" || card.audience === "women")
    .map((card) => ({
      ...card,
      audience: card.audience as "men" | "women",
      durationDays: intOrUndefined(card.durationDays),
      schedule: array(card.schedule)
        .filter(isObject)
        .map((entry) => ({ days: text(entry.days), time: text(entry.time) }))
        .filter((entry) => entry.days || entry.time),
    }));
  const phones = array(data.condolencePhoneContacts).filter(isObject).filter((contact) => text(contact.phone));
  let options = [...new Set(array(data.condolenceOptions).map((option) => pick(option, OPTIONS)).filter(Boolean))] as Array<(typeof OPTIONS)[number]>;
  if (!options.length) {
    options = [...new Set(condolences.map((card) => card.audience))];
    if (phones.length) options.push("phone");
  }

  const prayer = isObject(data.prayer) ? data.prayer : {};
  const burial = isObject(data.burial) ? data.burial : {};
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
    burial: splitBurialNote({ ...burial, status: pick(burial.status, BURIAL_STATUSES) ?? "upcoming", outsideQatar: burial.outsideQatar === true }),
    condolenceOptions: options,
    condolences,
    condolencePhoneContacts: phones,
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
        const result = toRequest(readJson(reply));
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
