// مخطّط صورة التعزية: يحوّل المحتوى المطبَّع إلى أقسام، ثم إلى عناصر بمواضع ثابتة على صورة 1080 بكسل،
// بثمانية تخطيطات (اليمين، المتوسّط، الجدول، العمودان، الصحيفة، العناوين، الترويسة، الهجين) تشترك في المحتوى
// والخط والضبط التلقائي وتختلف في توزيع الوحدات.
// هذا الملف نقي (بلا DOM) حتى يُختبر في Node بدالة قياس وهمية؛ الرسم الفعلي في naskh-poster-engine.ts.
//
// الترتيب كما في الأرشيف: إنا لله ← توفي ← الاسم ← التفاصيل ← الأقارب ← الصلاة ← الدفن ← عزاء الرجال ← عزاء النساء
// ← الهاتف ← الملاحظات ← الدعاء، وشريط الشعار والتواصل أسفل الصورة (أو في ترويسة أعلاها).
//
// الضبط التلقائي عند الامتلاء، بالترتيب: يصغر الاسم (62 ← 54 مع سطرين على الأكثر)، ثم النص قليلاً (حتى 0.94)،
// ثم تطول الصورة (1350 ← الحد الأقصى بخطوات 90)، ثم النص حتى 0.90 (36 × 0.9 = 32.4 بكسل ولا أقل).
import type { NormalizedContent } from "./presentation-normalizer";

export const DEFAULT_OPENING = "إنا لله وإنا إليه راجعون";

export type NaskhFont = { px: number; weight: 400 | 700 };
/** عرض النص بالبكسل لخط النسخ بالحجم والوزن المعطيين (Canvas في المتصفح، ودالة تقريبية في الاختبارات). */
export type MeasureFn = (text: string, font: NaskhFont) => number;

export const NASKH_METRICS = {
  width: 1080,
  minHeight: 1350,
  maxHeight: 1800,
  heightStep: 90,
  inset: 72,
  top: 44,
  bandHeight: 96,
  bandBottom: 36,
  bandGap: 20,
  openingHeight: 96,
  namePx: 62,
  nameMinPx: 54,
  bodyPx: 36,
  headingPx: 38,
  closingPx: 42,
  lineHeight: 1.5,
  nameLineHeight: 1.35,
  qrSize: 150,
  qrGap: 24,
  minGap: 12,
  maxGap: 40,
  groupGap: 8,
  minScale: 0.9,
  softScale: 0.94,
  maxScale: 1.06,
  shortSeparator: 320,
  tableKeyWidth: 220,
  tableGap: 24,
  tablePad: 10,
  colMaxWidth: 560,
  colPad: 20,
  colQrGap: 12,
  frameInset: 30,
  paperInset: 92,
  paperTop: 66,
  paperBandBottom: 52,
  paperNamePx: 56,
  letterheadBandTop: 36,
  letterheadRule: 148,
  letterheadTop: 174,
  letterheadBottom: 44,
  letterheadOpening: 86,
} as const;

export const NASKH_COLORS = {
  ink: "#1E1C1A",
  text: "#2E2A26",
  muted: "#5F5952",
  line: "#CCC5B9",
  frame: "#B9B1A5",
  background: "#FAF9F7",
} as const;

// ───────────────────────── التخطيطات ─────────────────────────

export type NaskhLayoutId = "right" | "center" | "table" | "cols" | "paper" | "headings" | "letterhead" | "hybrid";
export type NaskhLayout = { id: NaskhLayoutId; name: string; description: string };

export const DEFAULT_NASKH_LAYOUT: NaskhLayoutId = "right";

/** التخطيطات المتاحة في الاستوديو بترتيب عرضها؛ الأول هو المعتمد افتراضياً. */
export const NASKH_LAYOUTS: readonly NaskhLayout[] = [
  { id: "right", name: "اليمين", description: "النص من اليمين بفواصل رفيعة بين الأقسام، ورمز الموقع بجانب كل عزاء" },
  { id: "center", name: "المتوسّط", description: "كل شيء في منتصف الصفحة، وأسماء الأقارب في صندوق موسّط" },
  { id: "table", name: "الجدول", description: "الأقارب والدفن والعزاء في جدول، عناوينه عريضة في عمود يميني" },
  { id: "cols", name: "العمودان", description: "عزاء الرجال والنساء جنباً إلى جنب في عمودين، ورمز الموقع تحت كل عمود" },
  { id: "paper", name: "الصحيفة", description: "إطار رفيع حول الصورة، وجملة الوفاة مع الاسم في سطر واحد كما في الصحف" },
  { id: "headings", name: "العناوين", description: "عنوان عريض فوق كل قسم (الدفن، عزاء الرجال، عزاء النساء) والنص تحته" },
  { id: "letterhead", name: "الترويسة", description: "الشعار ومخطوطة «إنا لله» وحسابات التواصل في ترويسة أعلى الصورة" },
  { id: "hybrid", name: "الهجين", description: "الاسم والدعاء في المنتصف وبقية النص من اليمين" },
];

export function isNaskhLayoutId(value: unknown): value is NaskhLayoutId {
  return typeof value === "string" && NASKH_LAYOUTS.some((layout) => layout.id === value);
}

type Align = "right" | "center";
type LayoutSpec = {
  inset: number;
  top: number;
  /** المساحة المحجوزة أسفل المحتوى (الشريط السفلي وهامشه، أو الهامش فقط عند الترويسة). */
  bottomReserve: number;
  headAlign: Align;
  bodyAlign: Align;
  /** أسماء الأقارب من اليمين داخل صندوق موسّط. */
  relativesBox: boolean;
  separator: "full" | "short" | "none";
  venues: "row" | "balanced" | "table" | "cols";
  /** عنوان عريض في سطر مستقل فوق الدفن والصلاة والعزاء بدل العنوان في أول السطر. */
  sectionHeadings: boolean;
  /** «توفي» مع الاسم في سطر واحد. */
  inlineHead: boolean;
  namePx: number;
  openingInContent: boolean;
  band: "bottom" | "top";
  bandBottom: number;
  frame: boolean;
};

const BOTTOM_BAND_RESERVE = NASKH_METRICS.bandBottom + NASKH_METRICS.bandHeight + NASKH_METRICS.bandGap;

const BASE_SPEC: LayoutSpec = {
  inset: NASKH_METRICS.inset,
  top: NASKH_METRICS.top,
  bottomReserve: BOTTOM_BAND_RESERVE,
  headAlign: "right",
  bodyAlign: "right",
  relativesBox: false,
  separator: "full",
  venues: "row",
  sectionHeadings: false,
  inlineHead: false,
  namePx: NASKH_METRICS.namePx,
  openingInContent: true,
  band: "bottom",
  bandBottom: NASKH_METRICS.bandBottom,
  frame: false,
};

const LAYOUT_SPECS: Record<NaskhLayoutId, LayoutSpec> = {
  right: BASE_SPEC,
  center: { ...BASE_SPEC, headAlign: "center", bodyAlign: "center", relativesBox: true, separator: "short", venues: "balanced" },
  table: { ...BASE_SPEC, headAlign: "center", separator: "none", venues: "table" },
  cols: { ...BASE_SPEC, headAlign: "center", bodyAlign: "center", relativesBox: true, separator: "short", venues: "cols" },
  paper: {
    ...BASE_SPEC,
    inset: NASKH_METRICS.paperInset,
    top: NASKH_METRICS.paperTop,
    bottomReserve: NASKH_METRICS.paperBandBottom + NASKH_METRICS.bandHeight + NASKH_METRICS.bandGap,
    bandBottom: NASKH_METRICS.paperBandBottom,
    headAlign: "center",
    bodyAlign: "center",
    relativesBox: true,
    venues: "balanced",
    inlineHead: true,
    namePx: NASKH_METRICS.paperNamePx,
    frame: true,
  },
  headings: { ...BASE_SPEC, headAlign: "center", bodyAlign: "center", relativesBox: true, separator: "short", venues: "balanced", sectionHeadings: true },
  letterhead: {
    ...BASE_SPEC,
    top: NASKH_METRICS.letterheadTop,
    bottomReserve: NASKH_METRICS.letterheadBottom,
    headAlign: "center",
    openingInContent: false,
    band: "top",
  },
  hybrid: { ...BASE_SPEC, headAlign: "center" },
};

// ───────────────────────── الأقسام ─────────────────────────

/** «title»: عنوان قسم مستقل (38 بكسل) في تخطيطَي العناوين والعمودين؛ «heading»: عنوان مجموعة الأقارب أو الهاتف (36 بكسل). */
export type NaskhRowStyle = "statement" | "name" | "body" | "heading" | "title" | "closing";
export type NaskhRow = { style: NaskhRowStyle; text: string; label?: string };
/** «men» و«women» لأول موقع عزاء، و«women-2» و«men-2»… لما بعده حين تتعدد المواقع (لكل موقع قسمه ورمزه). */
export type VenueSectionId = "men" | "women" | `men-${number}` | `women-${number}`;
export type NaskhSectionId = "head" | "relatives" | "prayer" | "burial" | "condolenceStart" | VenueSectionId | "phone" | "notes" | "closing";
export type NaskhQrKey = "prayer" | "burial" | "prayerBurialCombined" | VenueSectionId;

export function isVenueId(id: string): id is VenueSectionId {
  return id === "men" || id === "women" || /^(?:men|women)-\d+$/.test(id);
}

/**
 * روابط رموز الموقع لكل أقسام الصورة (الصلاة، الدفن، وكل موقع عزاء بمفتاحه) لتُحوَّل إلى صور QR.
 * مفتاح أول موقع «men»/«women» والتالي «men-2»/«women-2»، وهو ما يستعمله المخطّط.
 */
export function posterQrUrls(content: NormalizedContent): Record<string, string | undefined> {
  const urls: Record<string, string | undefined> = {
    prayer: content.prayer?.qrUrl,
    burial: content.burial?.qrUrl,
    prayerBurialCombined: content.prayerBurialCombined?.qrUrl,
    men: content.men?.qrUrl,
    women: content.women?.qrUrl,
  };
  for (const audience of ["men", "women"] as const) {
    (content[audience]?.sites ?? []).forEach((site, index) => {
      if (index > 0) urls[`${audience}-${index + 1}`] = site.qrUrl;
    });
  }
  return urls;
}
export type NaskhSection = { id: NaskhSectionId; title: string; rows: NaskhRow[]; qrKey?: NaskhQrKey };

export type TextRun = { text: string; weight: 400 | 700; color: string };
export type PlanItem =
  | { kind: "opening"; y: number; h: number; text?: string; px: number }
  | { kind: "line"; section: NaskhSectionId; y: number; h: number; px: number; align: Align; xRight: number; runs: TextRun[] }
  | { kind: "separator"; y: number; x: number; width: number }
  | { kind: "vline"; x: number; y: number; h: number }
  | { kind: "qr"; key: NaskhQrKey; x: number; y: number; size: number }
  | { kind: "frame"; x: number; y: number; width: number; height: number }
  | { kind: "band"; position: "bottom" | "top"; y: number; h: number; x: number; width: number };

export type NaskhPlan = {
  layout: NaskhLayoutId;
  width: number;
  height: number;
  scale: number;
  namePx: number;
  /** أصغر حجم خط مستخدم في النص بعد الضبط. */
  minTextPx: number;
  gap: number;
  /** بقي المحتوى أطول من الصورة حتى بعد كل الضبط (نادر جداً). */
  overflow: boolean;
  items: PlanItem[];
};

export type NaskhPlanOptions = {
  layout?: NaskhLayoutId;
  minHeight?: number;
  maxHeight?: number;
  heightStep?: number;
  /** المخطوطة متاحة والافتتاحية هي العبارة الافتراضية، وإلا تُرسم نصاً. */
  openingIsImage: boolean;
  /** مفاتيح رموز المواقع التي توفرت صورها فعلاً. */
  qrAvailable: Partial<Record<NaskhQrKey, boolean>>;
};

const NBSP = "\u00A0";

/**
 * يقسم النص إلى كلمات لا تُكسر من داخلها: «سالم رحمه الله»، «بدر (رحمه الله)»، «4:00 مساءً»، «من 4:00»،
 * وأرقام الهاتف داخل عزل الاتجاه. (ملاحظة: \s في JavaScript يطابق المسافة غير الفاصلة، لذا نقسم على المسافة العادية فقط.)
 */
export function tokenizeArabic(text: string): string[] {
  let t = text.replace(/\s+/gu, " ").trim();
  if (!t) return [];
  t = t.replace(/(\S+) \(\s*(رحمه|رحمها|رحمهما|رحمهم|رحمهن) الله\s*\)/gu, (_, name: string, mercy: string) => `${name}${NBSP}(${mercy}${NBSP}الله)`);
  t = t.replace(/(\S+) (رحمه|رحمها|رحمهما|رحمهم|رحمهن) الله/gu, (_, name: string, mercy: string) => `${name}${NBSP}${mercy}${NBSP}الله`);
  // جهة العمل مع صاحبها في سطر واحد: «مبارك (وزارة الداخلية - متقاعد)» (للأقواس القصيرة فقط حتى لا يتجاوز السطر)
  t = t.replace(/(\S+) (\([^()]{1,40}\))/gu, (_, name: string, group: string) => `${name}${NBSP}${group.replace(/ /g, NBSP)}`);
  t = t.replace(/(\d{1,2}:\d{2}) (صباحاً|ظهراً|عصراً|مساءً)/gu, `$1${NBSP}$2`);
  t = t.replace(/(^| )(من|إلى|حتى) (\d)/gu, `$1$2${NBSP}$3`);
  // «منزل رقم ٨٦» و«لمدة ٣ أيام» و«الساعة ٩:٣٠» لا ينكسر الرقم عن كلمته
  t = t.replace(/(^| )(رقم|لمدة|الساعة) ([\d٠-٩]\S*)/gu, `$1$2${NBSP}$3`);
  t = t.replace(/⁦[^⁩]*⁩/gu, (isolate) => isolate.replace(/ /g, NBSP));
  return t.split(" ").filter(Boolean);
}

/**
 * أرقام عربية مشرقية في الصورة (٩:٣٠، منزل رقم ٨٦) كما في الأرشيف. خط النسخ يرسمها على خط الحروف نفسه،
 * أما الأرقام اللاتينية فليست فيه فتسقط إلى خط بديل بحجم وخط قاعدة مختلفين (ظهر ذلك على iPad).
 */
export function toArabicIndicDigits(text: string): string {
  return text.replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

/** يلفّ الكلمات في أسطر لا يتجاوز عرضها الحد، والكلمة الأطول من السطر تبقى سطراً وحدها. */
export function wrapAtoms(atoms: string[], maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const atom of atoms) {
    const candidate = line ? `${line} ${atom}` : atom;
    if (!line || measure(candidate) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = atom;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** سطران متوازنان بدل سطر طويل وكلمة يتيمة، للاسم. */
export function balanceTwoLines(atoms: string[], maxWidth: number, measure: (text: string) => number): string[] {
  const greedy = wrapAtoms(atoms, maxWidth, measure);
  if (greedy.length !== 2) return greedy;
  let best = greedy;
  let bestWidth = Math.max(measure(greedy[0]), measure(greedy[1]));
  for (let split = 1; split < atoms.length; split += 1) {
    const first = atoms.slice(0, split).join(" ");
    const second = atoms.slice(split).join(" ");
    const w1 = measure(first);
    const w2 = measure(second);
    if (w1 > maxWidth || w2 > maxWidth) continue;
    const widest = Math.max(w1, w2);
    if (widest < bestWidth) {
      bestWidth = widest;
      best = [first, second];
    }
  }
  return best;
}

/** عناوين تبدأ بها جمل الصلاة والدفن في المولّد، وتُرسم بخط عريض؛ الأطول أولاً. */
export const KNOWN_LEADING_LABELS = ["تمت صلاة الجنازة", "صلاة الجنازة", "تأجيل الدفن", "وتم الدفن", "تم الدفن", "والدفن", "الدفن", "الصلاة"];

export function splitLeadingLabel(line: string, extraLabels: string[] = []): { label: string; rest: string } | null {
  const text = line.trim();
  const labels = [...extraLabels.filter(Boolean), ...KNOWN_LEADING_LABELS].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    if (text === label) return { label, rest: "" };
    if (text.startsWith(`${label} `)) return { label, rest: text.slice(label.length + 1).trim() };
  }
  return null;
}

const splitLines = (text: string | undefined): string[] => (text ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
const isHeadingLine = (line: string) => /:$/u.test(line);
const stripColon = (text: string) => text.replace(/:$/u, "").trim();

/** صفوف قسم الصلاة أو الدفن: العنوان عريض في أول السطر الأول، وبقية الأسطر عادية. */
function eventRows(title: string, text: string | undefined): NaskhRow[] {
  const lines = splitLines(text);
  if (!lines.length) return [];
  const [first, ...rest] = lines;
  const split = splitLeadingLabel(first, [title]);
  const firstRow: NaskhRow = split ? { style: "body", label: split.label, text: split.rest } : { style: "body", label: title, text: first };
  return [firstRow, ...rest.map((line) => ({ style: "body" as const, text: line }))];
}

/**
 * صفوف العزاء: «عزاء الرجال» أو «والنساء» عريضاً في أول الجملة، والأسطر التالية (المدة، الفترات) تحتها.
 * وعند وجود مواقع مرقّمة («الموقع الأول:») يُكتب العنوان في سطر ثم كل موقع بعنوانه في أول سطره.
 */
function venueRows(venue: NonNullable<NormalizedContent["men"]>): NaskhRow[] {
  const lines = splitLines(venue.location);
  if (!lines.length) return [];
  const rows: NaskhRow[] = [];
  const hasHeadings = lines.some(isHeadingLine);
  if (hasHeadings) rows.push({ style: "heading", text: venue.title });
  let pendingLabel: string | undefined;
  lines.forEach((line, index) => {
    if (isHeadingLine(line)) {
      pendingLabel = line;
      return;
    }
    if (pendingLabel) {
      rows.push({ style: "body", label: pendingLabel, text: line });
      pendingLabel = undefined;
      return;
    }
    if (index === 0) {
      const split = splitLeadingLabel(line, [venue.flowLabel, venue.title]);
      rows.push(split ? { style: "body", label: split.label, text: split.rest } : { style: "body", label: venue.flowLabel, text: line });
      return;
    }
    rows.push({ style: "body", text: line });
  });
  if (pendingLabel) rows.push({ style: "heading", text: pendingLabel });
  return rows;
}

export function buildNaskhSections(content: NormalizedContent): NaskhSection[] {
  const sections: NaskhSection[] = [];

  const headRows: NaskhRow[] = [];
  const verb = content.headline.verb.trim();
  const name = content.headline.name.trim() || content.deceasedCombinedNames;
  if (verb) headRows.push({ style: "statement", text: verb });
  if (name) headRows.push({ style: "name", text: name });
  for (const line of content.headline.rest) if (line.trim()) headRows.push({ style: "body", text: line.trim() });
  sections.push({ id: "head", title: "", rows: headRows });

  if (content.relatives.length) {
    const rows: NaskhRow[] = [];
    for (const group of content.relatives) {
      rows.push({ style: "heading", text: `${group.heading}:` });
      rows.push({ style: "body", text: group.reference ? group.membersList.join(" و") : group.membersText });
      if (group.reference) rows.push({ style: "body", text: group.reference });
    }
    sections.push({ id: "relatives", title: "الأقارب", rows });
  } else if (content.relativesNote) {
    sections.push({ id: "relatives", title: "الأقارب", rows: [{ style: "body", text: content.relativesNote }] });
  }

  if (content.hasCombinedPrayerBurial && content.prayerBurialCombined) {
    const rows = eventRows("الدفن", content.prayerBurialCombined.dayTime);
    if (rows.length) sections.push({ id: "burial", title: "الدفن", rows, qrKey: content.prayerBurialCombined.qrUrl ? "prayerBurialCombined" : undefined });
  } else {
    if (content.prayer) {
      const rows = eventRows(content.prayer.title, content.prayer.day);
      if (rows.length) sections.push({ id: "prayer", title: content.prayer.title, rows, qrKey: content.prayer.qrUrl ? "prayer" : undefined });
    }
    if (content.burial) {
      const rows = eventRows(content.burial.title, content.burial.statusText);
      if (rows.length) sections.push({ id: "burial", title: content.burial.title, rows, qrKey: content.burial.qrUrl ? "burial" : undefined });
    }
  }

  if (content.condolenceStart) {
    const split = splitLeadingLabel(content.condolenceStart, ["العزاء"]);
    sections.push({ id: "condolenceStart", title: "العزاء", rows: [split ? { style: "body", label: split.label, text: split.rest } : { style: "body", text: content.condolenceStart }] });
  }

  for (const audience of ["men", "women"] as const) {
    const venue = content[audience];
    if (!venue) continue;
    if (venue.sites && venue.sites.length > 1) {
      // مواقع متعددة: لكل موقع قسمه وعنوانه («عزاء النساء الأول») ورمزه بجانبه
      venue.sites.forEach((site, index) => {
        const id: VenueSectionId = index === 0 ? audience : `${audience}-${index + 1}`;
        const [first = "", ...rest] = site.lines.map((line) => line.trim()).filter(Boolean);
        const rows: NaskhRow[] = [{ style: "body", label: site.label, text: first }, ...rest.map((text) => ({ style: "body" as const, text }))];
        sections.push({ id, title: site.label, rows, qrKey: site.qrUrl ? id : undefined });
      });
      continue;
    }
    const rows = venueRows(venue);
    if (rows.length) sections.push({ id: audience, title: venue.title, rows, qrKey: venue.qrUrl ? audience : undefined });
  }

  if (content.phoneLines.length) {
    sections.push({
      id: "phone",
      title: "التعزية عبر الهاتف",
      rows: content.phoneLines.map((line) => ({ style: "body" as const, text: line })),
    });
  }

  if (content.notes) {
    sections.push({ id: "notes", title: "ملاحظات", rows: splitLines(content.notes).map((line) => ({ style: "body" as const, text: line })) });
  }

  if (content.closing.trim()) sections.push({ id: "closing", title: "", rows: [{ style: "closing", text: content.closing.trim() }] });

  return sections;
}

// ───────────────────────── القياس والتوزيع ─────────────────────────

type MeasuredLine = { h: number; px: number; w: number; runs: TextRun[] };
type Placed =
  | { kind: "line"; section: NaskhSectionId; dy: number; h: number; px: number; align: Align; xRight: number; runs: TextRun[] }
  | { kind: "qr"; key: NaskhQrKey; x: number; dy: number; size: number }
  | { kind: "separator"; dy: number; x: number; width: number }
  | { kind: "vline"; x: number; dy: number; h: number };
type Block = { kind: "opening" | "section"; h: number; parts: Placed[]; section?: NaskhSectionId };

type Geometry = { left: number; right: number; center: number; contentWidth: number };
type PlanContext = { spec: LayoutSpec; geo: Geometry; scale: number; namePx: number; measure: MeasureFn; opts: NaskhPlanOptions };

function fontFor(style: NaskhRowStyle, ctx: PlanContext): NaskhFont & { color: string; lineHeight: number } {
  const { scale, namePx } = ctx;
  switch (style) {
    case "statement":
      return { px: NASKH_METRICS.bodyPx * scale, weight: 400, color: NASKH_COLORS.muted, lineHeight: NASKH_METRICS.lineHeight };
    case "name":
      return { px: namePx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.nameLineHeight };
    case "heading":
      return { px: NASKH_METRICS.bodyPx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.lineHeight };
    case "title":
      return { px: NASKH_METRICS.headingPx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.lineHeight };
    case "closing":
      return { px: NASKH_METRICS.closingPx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.lineHeight };
    default:
      return { px: NASKH_METRICS.bodyPx * scale, weight: 400, color: NASKH_COLORS.text, lineHeight: NASKH_METRICS.lineHeight };
  }
}

/** عرض سطر من عدة مقاطع (عنوان عريض ثم نص) مع مسافة بحجم الخط العادي بينها. */
function runsWidth(runs: TextRun[], px: number, measure: MeasureFn): number {
  const visible = runs.filter((run) => run.text);
  const space = visible.length > 1 ? measure(" ", { px, weight: 400 }) * (visible.length - 1) : 0;
  return visible.reduce((sum, run) => sum + measure(run.text, { px, weight: run.weight }), space);
}

function measureRow(row: NaskhRow, maxWidth: number, ctx: PlanContext): MeasuredLine[] {
  const { measure } = ctx;
  const font = fontFor(row.style, ctx);
  const regular: NaskhFont = { px: font.px, weight: font.weight };
  const measureRegular = (text: string) => measure(text, regular);
  const lineH = Math.round(font.px * font.lineHeight);
  const atoms = tokenizeArabic(row.text);
  const line = (runs: TextRun[]): MeasuredLine => ({ h: lineH, px: font.px, w: runsWidth(runs, font.px, measure), runs });

  if (row.style === "name") {
    return balanceTwoLines(atoms, maxWidth, measureRegular).map((text) => line([{ text, weight: font.weight, color: font.color }]));
  }

  if (!row.label) {
    const lines = atoms.length ? wrapAtoms(atoms, maxWidth, measureRegular) : [""];
    return lines.map((text) => line([{ text, weight: font.weight, color: font.color }]));
  }

  // عنوان عريض في أول السطر الأول ثم النص العادي، والأسطر التالية بكامل العرض.
  const bold: NaskhFont = { px: font.px, weight: 700 };
  const labelRun: TextRun = { text: row.label, weight: 700, color: NASKH_COLORS.ink };
  const labelW = measure(row.label, bold) + measure(" ", regular);
  const firstWidth = Math.max(maxWidth - labelW, maxWidth * 0.35);
  const lines: MeasuredLine[] = [];
  let first = "";
  let index = 0;
  while (index < atoms.length) {
    const candidate = first ? `${first} ${atoms[index]}` : atoms[index];
    if (measureRegular(candidate) <= firstWidth || !first) {
      first = candidate;
      index += 1;
    } else break;
  }
  lines.push(line(first ? [labelRun, { text: first, weight: 400, color: font.color }] : [labelRun]));
  for (const text of wrapAtoms(atoms.slice(index), maxWidth, measureRegular)) {
    lines.push(line([{ text, weight: 400, color: font.color }]));
  }
  return lines;
}

/** يقيس صفوف قسم كامل بعرض معيّن، مع فراغ صغير بين مجموعات الأقارب. */
function measureRows(section: NaskhSectionId, rows: NaskhRow[], maxWidth: number, ctx: PlanContext): MeasuredLine[] {
  const lines: MeasuredLine[] = [];
  rows.forEach((row, rowIndex) => {
    const measured = measureRow(row, maxWidth, ctx);
    if (section === "relatives" && row.style === "heading" && rowIndex > 0 && measured[0]) measured[0] = { ...measured[0], h: measured[0].h + Math.round(NASKH_METRICS.groupGap * ctx.scale) };
    lines.push(...measured);
  });
  return lines;
}

const sumH = (lines: MeasuredLine[]) => lines.reduce((sum, line) => sum + line.h, 0);

type PlaceMode = { align: Align; xRight?: number; center?: number };

/** يضع الأسطر تحت بعضها من dy: من اليمين عند xRight، أو موسّطة حول center. */
function placeLines(section: NaskhSectionId, lines: MeasuredLine[], mode: PlaceMode, startDy: number): Placed[] {
  let dy = startDy;
  return lines.map((line) => {
    const xRight = mode.align === "center" ? (mode.center ?? 0) + line.w / 2 : mode.xRight ?? 0;
    const placed: Placed = { kind: "line", section, dy, h: line.h, px: line.px, align: mode.align, xRight, runs: line.runs };
    dy += line.h;
    return placed;
  });
}

function bodyMode(ctx: PlanContext, align: Align = ctx.spec.bodyAlign): PlaceMode {
  return align === "center" ? { align, center: ctx.geo.center } : { align, xRight: ctx.geo.right };
}

/** قسم عادي: أسطر متتالية بمحاذاة النص، أو صندوق موسّط بأسطر من اليمين (الأقارب في التخطيطات الموسّطة). */
function plainBlock(section: NaskhSection, ctx: PlanContext, align: Align, box = false): Block {
  const lines = measureRows(section.id, section.rows, ctx.geo.contentWidth, ctx);
  const widest = lines.reduce((max, line) => Math.max(max, line.w), 0);
  const mode: PlaceMode = box ? { align: "right", xRight: ctx.geo.center + widest / 2 } : bodyMode(ctx, align);
  return { kind: "section", section: section.id, h: sumH(lines), parts: placeLines(section.id, lines, mode, 0) };
}

function qrSizeOf(section: NaskhSection, ctx: PlanContext): number {
  return section.qrKey && ctx.opts.qrAvailable[section.qrKey] ? Math.round(NASKH_METRICS.qrSize * ctx.scale) : 0;
}

/** عزاء في صف: النص من اليمين ورمز الموقع يساره، أو النص موسّطاً بين فراغين متساويين ورمزه في اليسار. */
function venueBlock(section: NaskhSection, ctx: PlanContext, balanced: boolean): Block {
  const qr = qrSizeOf(section, ctx);
  const reserve = qr ? qr + NASKH_METRICS.qrGap : 0;
  const maxWidth = ctx.geo.contentWidth - reserve * (balanced ? 2 : 1);
  const lines = measureRows(section.id, section.rows, maxWidth, ctx);
  const textH = sumH(lines);
  const h = Math.max(textH, qr);
  const parts: Placed[] = placeLines(section.id, lines, balanced ? { align: "center", center: ctx.geo.center } : { align: "right", xRight: ctx.geo.right }, (h - textH) / 2);
  if (qr) parts.push({ kind: "qr", key: section.qrKey!, x: ctx.geo.left, dy: (h - qr) / 2, size: qr });
  return { kind: "section", section: section.id, h, parts };
}

/** عزاء الرجال والنساء في عمودين: العنوان ثم النص موسّطين، ورمز الموقع أسفل العمود، وخط رأسي بينهما. */
function colsBlock(venues: NaskhSection[], ctx: PlanContext): Block {
  const { geo, scale } = ctx;
  const colW = Math.min(NASKH_METRICS.colMaxWidth, geo.contentWidth / venues.length);
  const totalW = colW * venues.length;
  const maxWidth = colW - NASKH_METRICS.colPad * 2;
  const columns = venues.map((section, index) => {
    const rows: NaskhRow[] = [{ style: "title", text: section.title }, ...stripFirstLabel(section).rows];
    const lines = measureRows(section.id, rows, maxWidth, ctx);
    const qr = qrSizeOf(section, ctx);
    const textH = sumH(lines);
    const h = textH + (qr ? Math.round(NASKH_METRICS.colQrGap * scale) + qr : 0);
    // العمود الأول يميناً (الصفحة من اليمين إلى اليسار)
    const center = geo.center + totalW / 2 - colW * (index + 0.5);
    return { section, lines, qr, textH, h, center };
  });
  const h = columns.reduce((max, column) => Math.max(max, column.h), 0);
  const parts: Placed[] = [];
  columns.forEach((column, index) => {
    parts.push(...placeLines(column.section.id, column.lines, { align: "center", center: column.center }, 0));
    if (column.qr) parts.push({ kind: "qr", key: column.section.qrKey!, x: column.center - column.qr / 2, dy: h - column.qr, size: column.qr });
    if (index > 0) parts.push({ kind: "vline", x: Math.round(geo.center + totalW / 2 - colW * index), dy: 0, h });
  });
  return { kind: "section", section: venues[0].id, h, parts };
}

type TableRow = { key: string; values: NaskhRow[]; qrKey?: NaskhQrKey; section: NaskhSectionId };

/** صفوف الجدول: مجموعات الأقارب كل منها صف، والدفن والعزاء وبقية الأقسام بعنوانها في العمود الأيمن. */
function tableRows(sections: NaskhSection[]): TableRow[] {
  const rows: TableRow[] = [];
  for (const section of sections) {
    const source = section.rows;
    if (section.id === "relatives" && source.some((row) => row.style === "heading")) {
      let current: TableRow | null = null;
      for (const row of source) {
        if (row.style === "heading") {
          current = { key: stripColon(row.text), values: [], section: section.id };
          rows.push(current);
        } else if (current) current.values.push(row);
        else rows.push({ key: section.title, values: [row], section: section.id });
      }
      continue;
    }
    const [first, ...rest] = source;
    if (!first) continue;
    if (first.label) {
      const key = isVenueId(section.id) ? section.title : first.label;
      rows.push({ key, values: [...(first.text ? [{ style: "body" as const, text: first.text }] : []), ...rest], qrKey: section.qrKey, section: section.id });
    } else if (first.style === "heading") {
      rows.push({ key: stripColon(first.text), values: rest, qrKey: section.qrKey, section: section.id });
    } else {
      rows.push({ key: section.title, values: source, qrKey: section.qrKey, section: section.id });
    }
  }
  return rows;
}

function tableBlock(sections: NaskhSection[], ctx: PlanContext): Block {
  const { geo, scale, measure } = ctx;
  const pad = Math.round(NASKH_METRICS.tablePad * scale);
  const gap = NASKH_METRICS.tableGap;
  const keyW = Math.round(NASKH_METRICS.tableKeyWidth * scale);
  const keyFont = fontFor("heading", ctx);
  const keyPx = NASKH_METRICS.bodyPx * scale;
  const keyLineH = Math.round(keyPx * NASKH_METRICS.lineHeight);
  const parts: Placed[] = [];
  let dy = 0;
  for (const row of tableRows(sections)) {
    const qr = row.qrKey && ctx.opts.qrAvailable[row.qrKey] ? Math.round(NASKH_METRICS.qrSize * scale) : 0;
    const valueMax = geo.contentWidth - keyW - gap - (qr ? qr + gap : 0);
    const keyLines = wrapAtoms(tokenizeArabic(row.key), keyW, (text) => measure(text, { px: keyPx, weight: 700 }));
    const valueLines = measureRows(row.section, row.values, valueMax, ctx);
    const keyH = keyLines.length * keyLineH;
    const valuesH = sumH(valueLines);
    const rowH = Math.max(keyH, valuesH, qr) + pad * 2;
    parts.push({ kind: "separator", dy, x: geo.left, width: geo.contentWidth });
    keyLines.forEach((text, index) => {
      parts.push({ kind: "line", section: row.section, dy: dy + pad + index * keyLineH, h: keyLineH, px: keyPx, align: "right", xRight: geo.right, runs: [{ text, weight: 700, color: keyFont.color }] });
    });
    parts.push(...placeLines(row.section, valueLines, { align: "right", xRight: geo.right - keyW - gap }, dy + (rowH - valuesH) / 2));
    if (qr) parts.push({ kind: "qr", key: row.qrKey!, x: geo.left, dy: dy + (rowH - qr) / 2, size: qr });
    dy += rowH;
  }
  parts.push({ kind: "separator", dy, x: geo.left, width: geo.contentWidth });
  return { kind: "section", section: sections[0]?.id ?? "relatives", h: dy + 1, parts };
}

/** يحذف العنوان من أول سطر (عند وجود عنوان مستقل فوق القسم). */
function stripFirstLabel(section: NaskhSection): NaskhSection {
  const [first, ...rest] = section.rows;
  if (!first?.label) return section;
  return { ...section, rows: [...(first.text ? [{ style: "body" as const, text: first.text }] : []), ...rest] };
}

/** عنوان عريض في سطر فوق الدفن والصلاة والعزاء («العناوين»). */
function withHeading(section: NaskhSection): NaskhSection {
  const first = section.rows[0];
  if (!first?.label) return section;
  const heading = isVenueId(section.id) ? section.title : first.label;
  return { ...section, rows: [{ style: "title", text: heading }, ...stripFirstLabel(section).rows] };
}

/** «توفي» مع الاسم في سطر واحد («الصحيفة»). */
function inlineHead(section: NaskhSection): NaskhSection {
  const [statement, name, ...rest] = section.rows;
  if (statement?.style !== "statement" || name?.style !== "name") return section;
  return { ...section, rows: [{ style: "name", text: `${statement.text} ${name.text}` }, ...rest] };
}

const HEADED_SECTIONS: ReadonlySet<NaskhSectionId> = new Set(["prayer", "burial", "condolenceStart"]);

function buildBlocks(sections: NaskhSection[], ctx: PlanContext): Block[] {
  const { spec, scale } = ctx;
  const blocks: Block[] = [];
  if (spec.openingInContent) {
    const openingH = ctx.opts.openingIsImage ? Math.round(NASKH_METRICS.openingHeight * scale) : Math.round(NASKH_METRICS.closingPx * scale * NASKH_METRICS.lineHeight);
    blocks.push({ kind: "opening", h: openingH, parts: [] });
  }

  const head = sections.find((section) => section.id === "head");
  const closing = sections.find((section) => section.id === "closing");
  const middle = sections.filter((section) => section.id !== "head" && section.id !== "closing");

  if (head) blocks.push(plainBlock(spec.inlineHead ? inlineHead(head) : head, ctx, spec.headAlign));

  if (spec.venues === "table") {
    if (middle.length) blocks.push(tableBlock(middle, ctx));
  } else {
    const venues = middle.filter((section) => isVenueId(section.id));
    // عمودان فقط حين يكون لكل من الرجال والنساء موقع واحد؛ وإلا تُرتَّب المواقع صفوفاً ليبقى لكل موقع رمزه بجانبه
    const useCols = spec.venues === "cols" && venues.length === 2 && venues[0].id === "men" && venues[1].id === "women";
    for (const section of middle) {
      const isVenue = isVenueId(section.id);
      if (isVenue && useCols) {
        if (section === venues[0]) blocks.push(colsBlock(venues, ctx));
        continue;
      }
      if (isVenue) {
        blocks.push(venueBlock(spec.sectionHeadings ? withHeading(section) : section, ctx, spec.venues !== "row"));
        continue;
      }
      const shaped = spec.sectionHeadings && HEADED_SECTIONS.has(section.id) ? withHeading(section) : section;
      blocks.push(plainBlock(shaped, ctx, spec.bodyAlign, section.id === "relatives" && spec.relativesBox));
    }
  }

  if (closing) blocks.push(plainBlock(closing, ctx, "center"));
  return blocks;
}

function nameLineCount(blocks: Block[], namePx: number, scale: number): number {
  const head = blocks.find((block) => block.section === "head");
  if (!head) return 0;
  const px = namePx * scale;
  return head.parts.filter((part) => part.kind === "line" && Math.abs(part.px - px) < 0.01).length;
}

export function planNaskhLayout(content: NormalizedContent, measure: MeasureFn, opts: NaskhPlanOptions): NaskhPlan {
  const layout = opts.layout ?? DEFAULT_NASKH_LAYOUT;
  const spec = LAYOUT_SPECS[layout];
  const minHeight = opts.minHeight ?? NASKH_METRICS.minHeight;
  const maxHeight = Math.max(minHeight, opts.maxHeight ?? NASKH_METRICS.maxHeight);
  const step = opts.heightStep ?? NASKH_METRICS.heightStep;
  const sections = buildNaskhSections(content);
  const geo: Geometry = { left: spec.inset, right: NASKH_METRICS.width - spec.inset, center: NASKH_METRICS.width / 2, contentWidth: NASKH_METRICS.width - spec.inset * 2 };
  const nameMinPx = Math.min(spec.namePx, NASKH_METRICS.nameMinPx);

  let scale = 1;
  let namePx: number = spec.namePx;
  let height = minHeight;
  const context = (): PlanContext => ({ spec, geo, scale, namePx, measure, opts });
  let blocks = buildBlocks(sections, context());
  const separators = spec.separator === "none" ? 0 : Math.max(0, blocks.filter((block) => block.kind === "section").length - 1);
  const zone = (h: number) => h - spec.top - spec.bottomReserve;
  const slots = () => Math.max(0, blocks.length - 1) + separators;
  const spanWith = (gap: number) => blocks.reduce((sum, block) => sum + block.h, 0) + separators + slots() * gap;
  const over = () => spanWith(NASKH_METRICS.minGap) > zone(height);
  const remeasure = () => { blocks = buildBlocks(sections, context()); };

  // 1) الاسم: سطران على الأكثر، ويصغر قبل أي شيء آخر
  while ((nameLineCount(blocks, namePx, scale) > 2 || over()) && namePx > nameMinPx) {
    namePx -= 2;
    remeasure();
  }
  // 2) تصغير خفيف
  while (over() && scale > NASKH_METRICS.softScale + 1e-9) {
    scale = Math.round((scale - 0.02) * 100) / 100;
    remeasure();
  }
  // 3) إطالة الصورة
  while (over() && height + step <= maxHeight) height += step;
  // 4) تصغير حتى الحد الأدنى
  while (over() && scale > NASKH_METRICS.minScale + 1e-9) {
    scale = Math.round((scale - 0.02) * 100) / 100;
    remeasure();
  }
  // 5) تكبير خفيف إن بقي فراغ كبير، دون أن يزيد الاسم سطراً
  const nameLines = nameLineCount(blocks, namePx, scale);
  const roomy = () => zone(height) - spanWith(0) > slots() * NASKH_METRICS.maxGap;
  while (scale < NASKH_METRICS.maxScale - 1e-9 && roomy()) {
    const previous = blocks;
    scale = Math.round((scale + 0.02) * 100) / 100;
    remeasure();
    if (over() || nameLineCount(blocks, namePx, scale) > nameLines) {
      scale = Math.round((scale - 0.02) * 100) / 100;
      blocks = previous;
      break;
    }
  }

  const overflow = over();
  const gap = overflow ? NASKH_METRICS.minGap : Math.max(NASKH_METRICS.minGap, Math.min(NASKH_METRICS.maxGap, (zone(height) - spanWith(0)) / Math.max(1, slots())));
  const span = spanWith(gap);
  const contentTop = spec.top + Math.max(0, (zone(height) - span) / 2);

  const items: PlanItem[] = [];
  if (spec.frame) {
    const inset = NASKH_METRICS.frameInset;
    items.push({ kind: "frame", x: inset, y: inset, width: NASKH_METRICS.width - inset * 2, height: height - inset * 2 });
  }
  let y = contentTop;
  let minTextPx = Infinity;
  let sectionIndex = 0;
  for (const block of blocks) {
    if (block.kind === "section" && sectionIndex > 0 && spec.separator !== "none") {
      const width = spec.separator === "short" ? NASKH_METRICS.shortSeparator : geo.contentWidth;
      items.push({ kind: "separator", y, x: spec.separator === "short" ? geo.center - width / 2 : geo.left, width });
      y += 1 + gap;
    }
    if (block.kind === "opening") {
      items.push({ kind: "opening", y, h: block.h, px: Math.round(NASKH_METRICS.closingPx * scale), text: opts.openingIsImage ? undefined : content.opening });
    } else {
      sectionIndex += 1;
      for (const part of block.parts) {
        if (part.kind === "line") {
          items.push({ kind: "line", section: part.section, y: y + part.dy, h: part.h, px: part.px, align: part.align, xRight: part.xRight, runs: part.runs });
          if (part.runs.some((run) => run.text)) minTextPx = Math.min(minTextPx, part.px);
        } else if (part.kind === "qr") {
          items.push({ kind: "qr", key: part.key, x: part.x, y: y + part.dy, size: part.size });
        } else if (part.kind === "separator") {
          items.push({ kind: "separator", y: y + part.dy, x: part.x, width: part.width });
        } else {
          items.push({ kind: "vline", x: part.x, y: y + part.dy, h: part.h });
        }
      }
    }
    y += block.h + gap;
  }

  if (spec.band === "top") {
    items.push({ kind: "band", position: "top", y: NASKH_METRICS.letterheadBandTop, h: NASKH_METRICS.bandHeight, x: geo.left, width: geo.contentWidth });
    items.push({ kind: "separator", y: NASKH_METRICS.letterheadRule, x: geo.left, width: geo.contentWidth });
    items.push({ kind: "separator", y: NASKH_METRICS.letterheadRule + 4, x: geo.left, width: geo.contentWidth });
  } else {
    items.push({ kind: "band", position: "bottom", y: height - spec.bandBottom - NASKH_METRICS.bandHeight, h: NASKH_METRICS.bandHeight, x: geo.left, width: geo.contentWidth });
  }

  return { layout, width: NASKH_METRICS.width, height, scale, namePx, minTextPx: Number.isFinite(minTextPx) ? minTextPx : 0, gap, overflow, items };
}
