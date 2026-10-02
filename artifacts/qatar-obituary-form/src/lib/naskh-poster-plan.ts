// مخطّط قالب «النسخ الرسمي»: يحوّل المحتوى المطبَّع إلى أقسام، ثم إلى عناصر بمواضع ثابتة على صورة 1080 بكسل.
// هذا الملف نقي (بلا DOM) حتى يُختبر في Node بدالة قياس وهمية؛ الرسم الفعلي في naskh-poster-engine.ts.
//
// الترتيب كما في الأرشيف: إنا لله ← توفي ← الاسم ← التفاصيل ← الأقارب ← الصلاة ← الدفن ← عزاء الرجال ← عزاء النساء
// ← الهاتف ← الملاحظات ← الدعاء، وشريط الشعار والتواصل مثبّت أسفل الصورة.
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
} as const;

export const NASKH_COLORS = {
  ink: "#1E1C1A",
  text: "#2E2A26",
  muted: "#5F5952",
  line: "#CCC5B9",
  background: "#FAF9F7",
} as const;

export type NaskhRowStyle = "statement" | "name" | "body" | "heading" | "closing";
export type NaskhRow = { style: NaskhRowStyle; text: string; label?: string };
export type NaskhSectionId = "head" | "relatives" | "prayer" | "burial" | "condolenceStart" | "men" | "women" | "phone" | "notes" | "closing";
export type NaskhQrKey = "prayer" | "burial" | "prayerBurialCombined" | "men" | "women";
export type NaskhSection = { id: NaskhSectionId; rows: NaskhRow[]; qrKey?: NaskhQrKey };

export type TextRun = { text: string; weight: 400 | 700; color: string };
export type PlanItem =
  | { kind: "opening"; y: number; h: number; text?: string; px: number }
  | { kind: "line"; section: NaskhSectionId; y: number; h: number; px: number; align: "right" | "center"; xRight: number; runs: TextRun[] }
  | { kind: "separator"; y: number; x: number; width: number }
  | { kind: "qr"; key: NaskhQrKey; x: number; y: number; size: number }
  | { kind: "band"; y: number; h: number };

export type NaskhPlan = {
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
  minHeight?: number;
  maxHeight?: number;
  heightStep?: number;
  /** المخطوطة متاحة والافتتاحية هي العبارة الافتراضية، وإلا تُرسم نصاً. */
  openingIsImage: boolean;
  /** مفاتيح رموز المواقع التي توفرت صورها فعلاً. */
  qrAvailable: Partial<Record<NaskhQrKey, boolean>>;
};

const NBSP = " ";

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
  t = t.replace(/⁦[^⁩]*⁩/gu, (isolate) => isolate.replace(/ /g, NBSP));
  return t.split(" ").filter(Boolean);
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
  sections.push({ id: "head", rows: headRows });

  if (content.relatives.length) {
    const rows: NaskhRow[] = [];
    for (const group of content.relatives) {
      rows.push({ style: "heading", text: `${group.heading}:` });
      rows.push({ style: "body", text: group.membersText });
    }
    sections.push({ id: "relatives", rows });
  } else if (content.relativesNote) {
    sections.push({ id: "relatives", rows: [{ style: "body", text: content.relativesNote }] });
  }

  if (content.hasCombinedPrayerBurial && content.prayerBurialCombined) {
    const rows = eventRows("الدفن", content.prayerBurialCombined.dayTime);
    if (rows.length) sections.push({ id: "burial", rows, qrKey: content.prayerBurialCombined.qrUrl ? "prayerBurialCombined" : undefined });
  } else {
    if (content.prayer) {
      const rows = eventRows(content.prayer.title, content.prayer.day);
      if (rows.length) sections.push({ id: "prayer", rows, qrKey: content.prayer.qrUrl ? "prayer" : undefined });
    }
    if (content.burial) {
      const rows = eventRows(content.burial.title, content.burial.statusText);
      if (rows.length) sections.push({ id: "burial", rows, qrKey: content.burial.qrUrl ? "burial" : undefined });
    }
  }

  if (content.condolenceStart) {
    const split = splitLeadingLabel(content.condolenceStart, ["العزاء"]);
    sections.push({ id: "condolenceStart", rows: [split ? { style: "body", label: split.label, text: split.rest } : { style: "body", text: content.condolenceStart }] });
  }

  if (content.men) {
    const rows = venueRows(content.men);
    if (rows.length) sections.push({ id: "men", rows, qrKey: content.men.qrUrl ? "men" : undefined });
  }
  if (content.women) {
    const rows = venueRows(content.women);
    if (rows.length) sections.push({ id: "women", rows, qrKey: content.women.qrUrl ? "women" : undefined });
  }

  if (content.phoneContacts.length) {
    sections.push({
      id: "phone",
      rows: [{ style: "heading", text: "للتعزية عبر الهاتف" }, ...content.phoneContacts.map((contact) => ({ style: "body" as const, text: contact.formatted }))],
    });
  }

  if (content.notes) {
    sections.push({ id: "notes", rows: splitLines(content.notes).map((line) => ({ style: "body" as const, text: line })) });
  }

  if (content.closing.trim()) sections.push({ id: "closing", rows: [{ style: "closing", text: content.closing.trim() }] });

  return sections;
}

type MeasuredLine = { h: number; px: number; align: "right" | "center"; runs: TextRun[] };
type MeasuredBlock = { kind: "opening" | "section" | "separator"; h: number; section?: NaskhSectionId; lines: MeasuredLine[]; qrKey?: NaskhQrKey; textH: number };

function fontFor(style: NaskhRowStyle, scale: number, namePx: number): NaskhFont & { color: string; lineHeight: number; align: "right" | "center" } {
  switch (style) {
    case "statement":
      return { px: NASKH_METRICS.bodyPx * scale, weight: 400, color: NASKH_COLORS.muted, lineHeight: NASKH_METRICS.lineHeight, align: "right" };
    case "name":
      return { px: namePx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.nameLineHeight, align: "right" };
    case "heading":
      return { px: NASKH_METRICS.bodyPx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.lineHeight, align: "right" };
    case "closing":
      return { px: NASKH_METRICS.closingPx * scale, weight: 700, color: NASKH_COLORS.ink, lineHeight: NASKH_METRICS.lineHeight, align: "center" };
    default:
      return { px: NASKH_METRICS.bodyPx * scale, weight: 400, color: NASKH_COLORS.text, lineHeight: NASKH_METRICS.lineHeight, align: "right" };
  }
}

function measureRow(row: NaskhRow, maxWidth: number, scale: number, namePx: number, measure: MeasureFn): MeasuredLine[] {
  const font = fontFor(row.style, scale, namePx);
  const regular: NaskhFont = { px: font.px, weight: font.weight };
  const measureRegular = (text: string) => measure(text, regular);
  const lineH = Math.round(font.px * font.lineHeight);
  const atoms = tokenizeArabic(row.text);

  if (row.style === "name") {
    const lines = balanceTwoLines(atoms, maxWidth, measureRegular);
    return lines.map((text) => ({ h: lineH, px: font.px, align: font.align, runs: [{ text, weight: font.weight, color: font.color }] }));
  }

  if (!row.label) {
    const lines = atoms.length ? wrapAtoms(atoms, maxWidth, measureRegular) : [""];
    return lines.map((text) => ({ h: lineH, px: font.px, align: font.align, runs: [{ text, weight: font.weight, color: font.color }] }));
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
  lines.push({ h: lineH, px: font.px, align: font.align, runs: first ? [labelRun, { text: first, weight: 400, color: font.color }] : [labelRun] });
  for (const text of wrapAtoms(atoms.slice(index), maxWidth, measureRegular)) {
    lines.push({ h: lineH, px: font.px, align: font.align, runs: [{ text, weight: 400, color: font.color }] });
  }
  return lines;
}

function measureBlocks(sections: NaskhSection[], scale: number, namePx: number, measure: MeasureFn, opts: NaskhPlanOptions): MeasuredBlock[] {
  const contentWidth = NASKH_METRICS.width - NASKH_METRICS.inset * 2;
  const blocks: MeasuredBlock[] = [];
  const openingH = opts.openingIsImage ? Math.round(NASKH_METRICS.openingHeight * scale) : Math.round(NASKH_METRICS.closingPx * scale * NASKH_METRICS.lineHeight);
  blocks.push({ kind: "opening", h: openingH, lines: [], textH: openingH });

  sections.forEach((section, index) => {
    if (index > 0) blocks.push({ kind: "separator", h: 1, lines: [], textH: 1 });
    const hasQr = !!section.qrKey && !!opts.qrAvailable[section.qrKey];
    const qrSize = Math.round(NASKH_METRICS.qrSize * scale);
    const maxWidth = hasQr ? contentWidth - qrSize - NASKH_METRICS.qrGap : contentWidth;
    const lines: MeasuredLine[] = [];
    section.rows.forEach((row, rowIndex) => {
      const measured = measureRow(row, maxWidth, scale, namePx, measure);
      // فراغ صغير بين مجموعات الأقارب
      if (section.id === "relatives" && row.style === "heading" && rowIndex > 0 && measured[0]) measured[0] = { ...measured[0], h: measured[0].h + Math.round(NASKH_METRICS.groupGap * scale) };
      lines.push(...measured);
    });
    const textH = lines.reduce((sum, line) => sum + line.h, 0);
    blocks.push({ kind: "section", section: section.id, h: hasQr ? Math.max(textH, qrSize) : textH, lines, qrKey: hasQr ? section.qrKey : undefined, textH });
  });
  return blocks;
}

function nameLineCount(blocks: MeasuredBlock[], namePx: number, scale: number): number {
  const head = blocks.find((block) => block.section === "head");
  if (!head) return 0;
  const px = namePx * scale;
  return head.lines.filter((line) => Math.abs(line.px - px) < 0.01).length;
}

export function planNaskhLayout(content: NormalizedContent, measure: MeasureFn, opts: NaskhPlanOptions): NaskhPlan {
  const minHeight = opts.minHeight ?? NASKH_METRICS.minHeight;
  const maxHeight = Math.max(minHeight, opts.maxHeight ?? NASKH_METRICS.maxHeight);
  const step = opts.heightStep ?? NASKH_METRICS.heightStep;
  const sections = buildNaskhSections(content);

  let scale = 1;
  let namePx: number = NASKH_METRICS.namePx;
  let height = minHeight;
  let blocks = measureBlocks(sections, scale, namePx, measure, opts);
  const zone = (h: number) => h - NASKH_METRICS.top - NASKH_METRICS.bandBottom - NASKH_METRICS.bandHeight - NASKH_METRICS.bandGap;
  const spanWith = (gap: number) => blocks.reduce((sum, block) => sum + block.h, 0) + Math.max(0, blocks.length - 1) * gap;
  const over = () => spanWith(NASKH_METRICS.minGap) > zone(height);
  const remeasure = () => { blocks = measureBlocks(sections, scale, namePx, measure, opts); };

  // 1) الاسم: سطران على الأكثر، ويصغر قبل أي شيء آخر
  while ((nameLineCount(blocks, namePx, scale) > 2 || over()) && namePx > NASKH_METRICS.nameMinPx) {
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
  const roomy = () => zone(height) - spanWith(0) > Math.max(0, blocks.length - 1) * NASKH_METRICS.maxGap;
  while (scale < NASKH_METRICS.maxScale - 1e-9 && roomy()) {
    const previous = blocks;
    const nextScale = Math.round((scale + 0.02) * 100) / 100;
    scale = nextScale;
    remeasure();
    if (over() || nameLineCount(blocks, namePx, scale) > nameLines) {
      scale = Math.round((scale - 0.02) * 100) / 100;
      blocks = previous;
      break;
    }
  }

  const overflow = over();
  const count = Math.max(1, blocks.length - 1);
  const gap = overflow ? NASKH_METRICS.minGap : Math.max(NASKH_METRICS.minGap, Math.min(NASKH_METRICS.maxGap, (zone(height) - spanWith(0)) / count));
  const span = spanWith(gap);
  const contentTop = NASKH_METRICS.top + Math.max(0, (zone(height) - span) / 2);
  const xRight = NASKH_METRICS.width - NASKH_METRICS.inset;
  const contentWidth = NASKH_METRICS.width - NASKH_METRICS.inset * 2;

  const items: PlanItem[] = [];
  let y = contentTop;
  let minTextPx = Infinity;
  for (const block of blocks) {
    if (block.kind === "opening") {
      items.push({ kind: "opening", y, h: block.h, px: Math.round(NASKH_METRICS.closingPx * scale), text: opts.openingIsImage ? undefined : content.opening });
    } else if (block.kind === "separator") {
      items.push({ kind: "separator", y, x: NASKH_METRICS.inset, width: contentWidth });
    } else {
      let lineY = y + (block.h - block.textH) / 2;
      for (const line of block.lines) {
        items.push({ kind: "line", section: block.section!, y: lineY, h: line.h, px: line.px, align: line.align, xRight: line.align === "center" ? NASKH_METRICS.width / 2 : xRight, runs: line.runs });
        if (line.runs.some((run) => run.text)) minTextPx = Math.min(minTextPx, line.px);
        lineY += line.h;
      }
      if (block.qrKey) {
        const size = Math.round(NASKH_METRICS.qrSize * scale);
        items.push({ kind: "qr", key: block.qrKey, x: NASKH_METRICS.inset, y: y + (block.h - size) / 2, size });
      }
    }
    y += block.h + gap;
  }
  items.push({ kind: "band", y: height - NASKH_METRICS.bandBottom - NASKH_METRICS.bandHeight, h: NASKH_METRICS.bandHeight });

  return { width: NASKH_METRICS.width, height, scale, namePx, minTextPx: Number.isFinite(minTextPx) ? minTextPx : 0, gap, overflow, items };
}
