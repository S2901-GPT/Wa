export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

export type CondolenceDesignId = "official" | "modern" | "editorial";

export type CondolenceContentItem =
  | {
      kind: "section";
      id: string;
      label?: string;
      text: string;
      tone?: "body" | "identity" | "closing";
      qr?: { key: string; label: string; url: string };
    }
  | {
      kind: "columns";
      id: string;
      label?: string;
      columns: [{ label: string; text: string }, { label: string; text: string }];
    }
  | {
      kind: "qr-row";
      id: string;
      codes: Array<{ key: string; label: string; url: string }>;
    };

export type QrImage = { dataUrl: string; image: HTMLImageElement };

type TextTone = "body" | "identity" | "closing";
type SourceSection = {
  kind: "section";
  id: string;
  label?: string;
  text: string;
  tone: TextTone;
  qrCode?: { key: string; label: string; url: string; image?: QrImage };
};
type SourceQrRow = {
  kind: "qr-row";
  id: string;
  codes: Array<{ key: string; label: string; url: string; qr?: QrImage }>;
};
type SourceBlock = SourceSection | SourceQrRow;

type PreparedSection = SourceSection & {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  labelHeight: number;
  height: number;
  qr?: QrImage;
  qrLabel?: string;
  qrUrlLines: string[];
  qrSize: number;
  scale: number;
  continuation?: boolean;
};
type PreparedQrCode = {
  key: string;
  label: string;
  url: string;
  urlLines: string[];
  qr?: QrImage;
};
type PreparedQrRow = {
  kind: "qr-row";
  id: string;
  codes: PreparedQrCode[];
  columns: number;
  rows: number;
  cellWidth: number;
  qrSize: number;
  height: number;
};
type PreparedBlock = PreparedSection | PreparedQrRow;
type LayoutCell = { block: PreparedBlock; x: number; width: number };
type LayoutRow = {
  cells: LayoutCell[];
  height: number;
  gap: number;
  label?: string;
  labelHeight?: number;
};
type PageLayout = { rows: LayoutRow[]; used: number };

type HeaderLayout = {
  openingLines: string[];
  statementLines: string[];
  nameLines: string[];
  openingSize: number;
  statementSize: number;
  nameSize: number;
  openingLineHeight: number;
  statementLineHeight: number;
  nameLineHeight: number;
  openingY: number;
  statementY: number;
  nameY: number;
  bodyTop: number;
};

const COLORS = {
  official: {
    paper: "#f6f1e8",
    card: "#fffdf9",
    ink: "#29252a",
    accent: "#6b2d43",
    secondary: "#a58c5e",
    muted: "#746c68",
    hairline: "#dfd4c4",
  },
  modern: {
    paper: "#f1f3f1",
    card: "#fffefd",
    ink: "#202d2c",
    accent: "#386b62",
    secondary: "#b56f48",
    muted: "#687371",
    hairline: "#d5ddda",
  },
  editorial: {
    paper: "#f7f4ee",
    card: "#fffdfa",
    ink: "#2b2730",
    accent: "#43536e",
    secondary: "#a8874d",
    muted: "#726d6b",
    hairline: "#ded4c8",
  },
} as const;

const FONT_DISPLAY = '"Noto Naskh Arabic", "Amiri", serif';
const FONT_BODY = '"IBM Plex Sans Arabic", "Tajawal", Arial, sans-serif';
const PAGE_MARGIN = 62;
const CONTENT_WIDTH = IMAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_BOTTOM = 1260;
const ROW_GAP = 14;
const COLUMN_GAP = 18;
const MIN_READABLE_SCALE = 0.94;

const ROW_PLANS: Record<
  CondolenceDesignId,
  Array<
    | { kind: "pair"; ids: [string, string]; rightFraction?: number; label?: string }
    | { kind: "full"; id: string }
  >
> = {
  official: [
    { kind: "full", id: "notice" },
    { kind: "full", id: "deceased-details" },
    { kind: "pair", ids: ["prayer", "burial"], label: "صلاة الجنازة والدفن" },
    { kind: "full", id: "men" },
    { kind: "full", id: "women" },
    { kind: "full", id: "relatives" },
    { kind: "full", id: "phone" },
    { kind: "full", id: "notes" },
    { kind: "full", id: "closing" },
  ],
  modern: [
    { kind: "full", id: "notice" },
    { kind: "pair", ids: ["prayer", "deceased-details"] },
    { kind: "pair", ids: ["relatives", "burial"] },
    { kind: "pair", ids: ["men", "women"] },
    { kind: "pair", ids: ["phone", "notes"] },
    { kind: "full", id: "closing" },
    { kind: "full", id: "locations" },
  ],
  editorial: [
    { kind: "full", id: "notice" },
    { kind: "pair", ids: ["relatives", "deceased-details"], rightFraction: 0.62 },
    { kind: "pair", ids: ["prayer", "burial"], rightFraction: 0.46 },
    { kind: "pair", ids: ["men", "women"] },
    { kind: "full", id: "locations" },
    { kind: "pair", ids: ["notes", "phone"], rightFraction: 0.42 },
    { kind: "full", id: "closing" },
  ],
};

export async function loadCondolenceFonts() {
  await Promise.allSettled([
    document.fonts.load('700 60px "Noto Naskh Arabic"'),
    document.fonts.load('500 24px "IBM Plex Sans Arabic"'),
    document.fonts.load('500 24px Tajawal'),
  ]);
  await document.fonts.ready;
}

function fontString(weight: number, size: number, family: string) {
  return `${weight} ${Math.max(8, Math.round(size))}px ${family}`;
}

function setRtl(ctx: CanvasRenderingContext2D) {
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number, isUrl = false): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    if (isUrl) {
      const pieces: string[] = [];
      let piece = "";
      for (const character of Array.from(paragraph.trim())) {
        piece += character;
        if (/[/?#&=._:-]/u.test(character)) {
          pieces.push(piece);
          piece = "";
        }
      }
      if (piece) pieces.push(piece);
      let line = "";
      for (const part of pieces) {
        if (line && ctx.measureText(line + part).width > width) {
          lines.push(line);
          line = part;
        } else {
          line += part;
        }
      }
      if (line) lines.push(line);
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= width) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  family: string,
  weight: number,
  align: CanvasTextAlign,
  color: string,
) {
  if (!text) return;
  ctx.save();
  ctx.font = fontString(weight, size, family);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  const measured = ctx.measureText(text).width;
  const ratio = measured > maxWidth && measured > 0 ? maxWidth / measured : 1;
  ctx.translate(x, y);
  ctx.scale(ratio, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  size: number,
  family: string,
  weight: number,
  align: CanvasTextAlign,
  color: string,
) {
  lines.forEach((line, index) => {
    if (line) fitText(ctx, line, x, y + index * lineHeight, maxWidth, size, family, weight, align, color);
  });
}

function headerLayout(
  ctx: CanvasRenderingContext2D,
  opening: string,
  statement: string,
  names: string,
  design: CondolenceDesignId,
  scale: number,
): HeaderLayout {
  const splitHeader = design !== "official";
  const introWidth = splitHeader ? 390 : CONTENT_WIDTH;
  const nameWidth = splitHeader ? 520 : CONTENT_WIDTH;
  const openingSize = (design === "editorial" ? 25 : 24) * scale;
  const statementSize = 18 * scale;
  const openingLineHeight = 30 * scale;
  const statementLineHeight = 25 * scale;
  const openingY = design === "official" ? 118 : 150;
  let statementY = openingY + 36;
  const nameY = design === "official" ? 240 : 174;
  let nameSize = (design === "official" ? 54 : 50) * scale;
  let nameLines: string[] = [];
  let nameLineHeight = Math.round(nameSize * 1.12);
  let openingLines: string[] = [];
  let statementLines: string[] = [];

  ctx.font = fontString(600, openingSize, FONT_DISPLAY);
  openingLines = wrapText(ctx, opening, introWidth);
  ctx.font = fontString(500, statementSize, FONT_BODY);
  statementLines = wrapText(ctx, statement, introWidth);

  if (design === "official") {
    statementY = openingY + Math.max(1, openingLines.length) * openingLineHeight + 8;
    return {
      openingLines,
      statementLines,
      nameLines: [],
      openingSize,
      statementSize,
      nameSize,
      openingLineHeight,
      statementLineHeight,
      nameLineHeight,
      openingY,
      statementY,
      nameY,
      bodyTop: Math.max(210, statementY + statementLines.length * statementLineHeight + 30),
    };
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    ctx.font = fontString(700, nameSize, FONT_DISPLAY);
    nameLines = wrapText(ctx, names, nameWidth, false);
    nameLineHeight = Math.round(nameSize * 1.12);
    const nameEnd = nameY + nameLines.length * nameLineHeight;
    const introEnd = statementY + statementLines.length * statementLineHeight;
    if (Math.max(nameEnd, introEnd) <= 400 || nameSize <= 26 * scale) break;
    nameSize = Math.max(26 * scale, nameSize * 0.9);
  }

  const nameEnd = nameY + nameLines.length * nameLineHeight;
  const introEnd = statementY + statementLines.length * statementLineHeight;
  return {
    openingLines,
    statementLines,
    nameLines,
    openingSize,
    statementSize,
    nameSize,
    openingLineHeight,
    statementLineHeight,
    nameLineHeight,
    openingY,
    statementY,
    nameY,
    bodyTop: Math.max(340, Math.max(nameEnd, introEnd) + 44),
  };
}

function sourceBlocks(items: CondolenceContentItem[], qrImages: Record<string, QrImage>): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  for (const item of items) {
    if (item.kind === "section") {
      if (!item.text.trim() && !item.qr?.url.trim()) continue;
      blocks.push({
        kind: "section",
        id: item.id,
        label: item.label?.trim() || undefined,
        text: item.text,
        tone: item.tone ?? "body",
        qrCode: item.qr ? { ...item.qr, image: qrImages[item.qr.key] } : undefined,
      });
    } else if (item.kind === "columns") {
      for (const column of item.columns) {
        if (!column.text.trim()) continue;
        const id = column.label === "الرجال" ? "men" : column.label === "النساء" ? "women" : `${item.id}-${column.label}`;
        const label = column.label.startsWith("مجلس") ? column.label : `مجلس ${column.label}`;
        blocks.push({ kind: "section", id, label, text: column.text, tone: "body" });
      }
    } else {
      const codes = item.codes
        .filter((code) => code.key.trim() || code.label.trim() || code.url.trim())
        .map((code) => ({ ...code, qr: qrImages[code.key] }));
      if (codes.length) blocks.push({ kind: "qr-row", id: item.id, codes });
    }
  }
  return blocks;
}

function prepareSection(
  ctx: CanvasRenderingContext2D,
  source: SourceSection,
  width: number,
  scale: number,
): PreparedSection {
  const fontSize = (source.tone === "closing" ? 26 : source.tone === "identity" ? 25 : 23) * scale;
  const lineHeight = (source.tone === "closing" ? 36 : source.tone === "identity" ? 34 : 32) * scale;
  const labelHeight = source.label ? 30 * scale : 0;
  const padding = 16 * scale;
  const qrSize = source.qrCode ? Math.min(128 * scale, width * 0.3) : 0;
  const textWidth = Math.max(100, width - padding * 2 - (qrSize ? qrSize + 34 * scale : 0) - 12);
  ctx.font = fontString(source.tone === "body" ? 500 : 600, fontSize, source.tone === "body" ? FONT_BODY : FONT_DISPLAY);
  const lines = source.text.trim() ? wrapText(ctx, source.text, textWidth) : [];
  const qrUrlLines = source.qrCode && !source.qrCode.image
    ? (() => {
        ctx.font = fontString(400, 9 * scale, FONT_BODY);
        return wrapText(ctx, source.qrCode.url, Math.max(80, qrSize + 12), true);
      })()
    : [];
  const qrContentHeight = qrSize
    ? qrSize + (source.qrCode?.label ? 20 * scale : 0) + (qrUrlLines.length ? qrUrlLines.length * 11 * scale + 10 * scale : 0)
    : 0;
  const textContentHeight = lines.length * lineHeight;
  return {
    ...source,
    lines,
    fontSize,
    lineHeight,
    labelHeight,
    qr: source.qrCode?.image,
    qrLabel: source.qrCode?.label,
    qrUrlLines,
    qrSize,
    scale,
    height: Math.max(
      58 * scale,
      padding * 2 + labelHeight + Math.max(textContentHeight, qrContentHeight),
    ),
  };
}

function prepareQrRow(
  ctx: CanvasRenderingContext2D,
  source: SourceQrRow,
  width: number,
  scale: number,
): PreparedQrRow {
  const columns = Math.min(2, source.codes.length);
  const rows = Math.ceil(source.codes.length / columns);
  const cellWidth = (width - 24 * scale - 14 * scale * (columns - 1)) / columns;
  const qrSize = source.codes.some((code) => code.qr)
    ? Math.min(112 * scale, cellWidth - 24 * scale)
    : 0;
  const urlFontSize = Math.max(9, 10 * scale);
  const codes = source.codes.map((code) => {
    ctx.font = fontString(400, urlFontSize, FONT_BODY);
    return {
      ...code,
      urlLines: code.qr || !code.url ? [] : wrapText(ctx, code.url, Math.max(80, cellWidth - 20), true),
    };
  });
  const codeCellHeight = qrSize + 40 * scale
    + (codes.some((code) => code.urlLines.length) ? 12 * scale + Math.max(...codes.map((code) => code.urlLines.length)) * 12 * scale : 0);
  return {
    kind: "qr-row",
    id: source.id,
    codes,
    columns,
    rows,
    cellWidth,
    qrSize,
    height: 16 * scale + rows * codeCellHeight + (rows - 1) * 8 * scale + 18 * scale,
  };
}

function planLayout(
  ctx: CanvasRenderingContext2D,
  blocks: SourceBlock[],
  design: CondolenceDesignId,
  scale: number,
): LayoutRow[] {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const consumed = new Set<string>();
  const rows: LayoutRow[] = [];

  const makeSectionCell = (source: SourceSection, x: number, width: number): LayoutCell => ({
    block: prepareSection(ctx, source, width, scale),
    x,
    width,
  });
  const makeQrCell = (source: SourceQrRow): LayoutCell => ({
    block: prepareQrRow(ctx, source, CONTENT_WIDTH, scale),
    x: PAGE_MARGIN,
    width: CONTENT_WIDTH,
  });

  // أقسام بلا موضع ثابت في الخطة: «women-2» و«men-cemetery» تتبع قسم جمهورها، والباقي («سيُحدَّد لاحقاً»…) قبل الدعاء الختامي.
  const plannedIds = new Set(ROW_PLANS[design].flatMap((plan) => (plan.kind === "full" ? [plan.id] : plan.ids)));
  const pushFullRow = (source: SourceBlock) => {
    consumed.add(source.id);
    rows.push({
      cells: [source.kind === "qr-row"
        ? makeQrCell(source)
        : makeSectionCell(source, PAGE_MARGIN, CONTENT_WIDTH)],
      height: 0,
      gap: ROW_GAP * scale,
    });
  };
  const pushUnplanned = (prefixes?: string[]) => {
    for (const source of blocks) {
      if (plannedIds.has(source.id) || consumed.has(source.id)) continue;
      if (!prefixes || prefixes.some((prefix) => source.id.startsWith(`${prefix}-`))) pushFullRow(source);
    }
  };

  for (const plan of ROW_PLANS[design]) {
    if (plan.kind === "full" && plan.id === "closing") pushUnplanned();
    if (plan.kind === "full") {
      const source = byId.get(plan.id);
      if (!source) {
        pushUnplanned([plan.id]);
        continue;
      }
      consumed.add(plan.id);
      rows.push({
        cells: [source.kind === "qr-row"
          ? makeQrCell(source)
          : makeSectionCell(source, PAGE_MARGIN, CONTENT_WIDTH)],
        height: 0,
        gap: ROW_GAP * scale,
      });
      pushUnplanned([plan.id]);
      continue;
    }

    const [rightId, leftId] = plan.ids;
    const rightSource = byId.get(rightId);
    const leftSource = byId.get(leftId);
    if (rightSource) consumed.add(rightId);
    if (leftSource) consumed.add(leftId);
    const sources = [rightSource, leftSource].filter((source): source is SourceSection => !!source && source.kind === "section");
    if (!sources.length) {
      pushUnplanned(plan.ids);
      continue;
    }

    if (sources.length === 1) {
      rows.push({
        cells: [makeSectionCell(sources[0], PAGE_MARGIN, CONTENT_WIDTH)],
        height: 0,
        gap: ROW_GAP * scale,
        label: plan.label,
        labelHeight: plan.label ? 30 * scale : 0,
      });
      pushUnplanned(plan.ids);
      continue;
    }

    const innerWidth = CONTENT_WIDTH - COLUMN_GAP * scale;
    const rightWidth = innerWidth * (plan.rightFraction ?? 0.5);
    const leftWidth = innerWidth - rightWidth;
    const rightX = PAGE_MARGIN + leftWidth + COLUMN_GAP * scale;
    const cells: LayoutCell[] = [];
    if (rightSource?.kind === "section") cells.push(makeSectionCell(rightSource, rightX, rightWidth));
    if (leftSource?.kind === "section") cells.push(makeSectionCell(leftSource, PAGE_MARGIN, leftWidth));
    rows.push({
      cells,
      height: 0,
      gap: ROW_GAP * scale,
      label: plan.label,
      labelHeight: plan.label ? 30 * scale : 0,
    });
    pushUnplanned(plan.ids);
  }

  for (const source of blocks) {
    if (!consumed.has(source.id)) pushFullRow(source);
  }

  return rows.map((row) => ({
    ...row,
    height: Math.max(...row.cells.map((cell) => cell.block.height)) + (row.labelHeight ?? 0),
  }));
}

function splitTallRow(row: LayoutRow, capacity: number, scale: number): LayoutRow[] {
  const onlyBlock = row.cells.length === 1 ? row.cells[0].block : undefined;
  if (onlyBlock?.kind === "qr-row") {
    const cell = row.cells[0];
    const block = onlyBlock;
    const perPage = Math.max(1, Math.ceil(block.codes.length / 2));
    const chunks: LayoutRow[] = [];
    for (let offset = 0; offset < block.codes.length; offset += perPage) {
      const codes = block.codes.slice(offset, offset + perPage);
      const columns = Math.min(2, codes.length);
      const rows = Math.ceil(codes.length / columns);
      const cellHeight = block.qrSize + 40 * scale
        + (codes.some((code) => code.urlLines.length) ? 12 * scale + Math.max(...codes.map((code) => code.urlLines.length)) * 12 * scale : 0);
      const nextBlock: PreparedQrRow = {
        ...block,
        codes,
        columns,
        rows,
        height: 34 * scale + rows * cellHeight + (rows - 1) * 8 * scale,
      };
      chunks.push({ cells: [{ ...cell, block: nextBlock }], height: nextBlock.height, gap: row.gap });
    }
    return chunks;
  }

  const sections = row.cells.filter((cell): cell is LayoutCell & { block: PreparedSection } => cell.block.kind === "section");
  if (!sections.length) return [row];
  const maximumContentHeight = Math.max(34 * scale, capacity - row.gap - (row.labelHeight ?? 0));
  const maximumLines = Math.max(
    1,
    Math.floor((maximumContentHeight - 35 * scale) / Math.max(1, ...sections.map(({ block }) => block.lineHeight))),
  );
  const offsets = new Map(sections.map(({ block }) => [block.id, 0]));
  const chunks: LayoutRow[] = [];

  while (sections.some(({ block }) => (offsets.get(block.id) ?? 0) < block.lines.length)) {
    const cells = sections.flatMap((cell) => {
      const offset = offsets.get(cell.block.id) ?? 0;
      if (offset >= cell.block.lines.length) return [];
      const lines = cell.block.lines.slice(offset, offset + maximumLines);
      offsets.set(cell.block.id, offset + lines.length);
      const continuation = offset > 0;
      const sectionLabelHeight = continuation && !cell.block.label
        ? 27 * scale
        : cell.block.labelHeight;
      const qrSize = continuation ? 0 : cell.block.qrSize;
      const qrContentHeight = qrSize
        ? qrSize + (cell.block.qrLabel ? 20 * scale : 0) + (cell.block.qrUrlLines.length ? cell.block.qrUrlLines.length * 11 * scale + 10 * scale : 0)
        : 0;
      const block: PreparedSection = {
        ...cell.block,
        lines,
        qr: continuation ? undefined : cell.block.qr,
        qrSize,
        qrUrlLines: continuation ? [] : cell.block.qrUrlLines,
        continuation,
        label: continuation
          ? cell.block.label
            ? `${cell.block.label} · تابع`
            : "متابعة"
          : cell.block.label,
        labelHeight: sectionLabelHeight,
        height: 28 * scale + sectionLabelHeight
          + Math.max(lines.length * cell.block.lineHeight, qrContentHeight),
      };
      return [{ ...cell, block }];
    });
    chunks.push({
      cells,
      height: Math.max(...cells.map((cell) => cell.block.height))
        + (chunks.length === 0 ? row.labelHeight ?? 0 : 0),
      gap: row.gap,
      label: chunks.length === 0 ? row.label : undefined,
      labelHeight: chunks.length === 0 ? row.labelHeight : 0,
    });
  }
  return chunks;
}

function paginateRows(rows: LayoutRow[], capacity: number, scale: number): PageLayout[] {
  const pages: PageLayout[] = [{ rows: [], used: 0 }];
  const current = () => pages[pages.length - 1];
  const nextPage = () => pages.push({ rows: [], used: 0 });

  for (const originalRow of rows) {
    const rowParts = originalRow.height > capacity
      ? splitTallRow(originalRow, capacity, scale)
      : [originalRow];
    for (const row of rowParts) {
      const page = current();
      const gap = page.rows.length ? row.gap : 0;
      if (page.rows.length && page.used + gap + row.height > capacity) {
        nextPage();
      }
      const target = current();
      const targetGap = target.rows.length ? row.gap : 0;
      target.rows.push({ ...row, gap: targetGap });
      target.used += targetGap + row.height;
    }
  }
  return pages.filter((page) => page.rows.length);
}

function colorsFor(design: CondolenceDesignId) {
  return COLORS[design];
}

function drawBrand(ctx: CanvasRenderingContext2D, design: CondolenceDesignId) {
  const colors = colorsFor(design);
  setRtl(ctx);
  ctx.fillStyle = colors.accent;
  if (design === "official") {
    ctx.fillRect(PAGE_MARGIN, 38, CONTENT_WIDTH, 2);
    fitText(ctx, "دولة قطر · إعلان وفاة", IMAGE_WIDTH / 2, 66, 420, 15, FONT_BODY, 600, "center", colors.muted);
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(IMAGE_WIDTH / 2 - 38, 82, 76, 3);
    return;
  }
  if (design === "modern") {
    ctx.fillRect(PAGE_MARGIN, 40, 8, 48);
    fitText(ctx, "إعلان وفاة", IMAGE_WIDTH - PAGE_MARGIN, 58, 260, 15, FONT_BODY, 700, "right", colors.ink);
    fitText(ctx, "دولة قطر", IMAGE_WIDTH - PAGE_MARGIN, 81, 260, 13, FONT_BODY, 500, "right", colors.muted);
    return;
  }
  fitText(ctx, "دولة قطر / إعلان وفاة", IMAGE_WIDTH - PAGE_MARGIN, 53, 310, 15, FONT_BODY, 500, "right", colors.muted);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(PAGE_MARGIN, 67, 96, 2);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  header: HeaderLayout,
  design: CondolenceDesignId,
) {
  const colors = colorsFor(design);
  setRtl(ctx);
  if (design === "official") {
    drawLines(ctx, header.openingLines, IMAGE_WIDTH / 2, header.openingY, CONTENT_WIDTH - 52, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "center", colors.ink);
    drawLines(ctx, header.statementLines, IMAGE_WIDTH / 2, header.statementY, CONTENT_WIDTH - 52, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "center", colors.accent);
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(IMAGE_WIDTH / 2 - 34, header.bodyTop - 12, 68, 2);
    return;
  }
  if (design === "modern") {
    const leftCenter = PAGE_MARGIN + 200;
    const rightCenter = IMAGE_WIDTH - PAGE_MARGIN - 270;
    ctx.fillStyle = colors.hairline;
    ctx.fillRect(PAGE_MARGIN + 410, 116, 1, header.bodyTop - 138);
    drawLines(ctx, header.openingLines, leftCenter, header.openingY, 390, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "center", colors.secondary);
    drawLines(ctx, header.statementLines, leftCenter, header.statementY, 390, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "center", colors.muted);
    drawLines(ctx, header.nameLines, rightCenter, header.nameY, 520, header.nameLineHeight, header.nameSize, FONT_DISPLAY, 700, "center", colors.ink);
    return;
  }

  const leftCenter = PAGE_MARGIN + 205;
  const rightCenter = IMAGE_WIDTH - PAGE_MARGIN - 260;
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(PAGE_MARGIN + 418, 123, 2, header.bodyTop - 146);
  drawLines(ctx, header.openingLines, leftCenter, header.openingY, 390, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "center", colors.accent);
  drawLines(ctx, header.statementLines, leftCenter, header.statementY, 390, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "center", colors.muted);
  drawLines(ctx, header.nameLines, rightCenter, header.nameY, 520, header.nameLineHeight, header.nameSize, FONT_DISPLAY, 700, "center", colors.ink);
  ctx.strokeStyle = colors.hairline;
  ctx.beginPath();
  ctx.moveTo(PAGE_MARGIN, header.bodyTop - 11);
  ctx.lineTo(IMAGE_WIDTH - PAGE_MARGIN, header.bodyTop - 11);
  ctx.stroke();
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  design: CondolenceDesignId,
) {
  const colors = colorsFor(design);
  if (design === "official") {
    ctx.save();
    ctx.shadowColor = "rgba(56, 37, 42, 0.10)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = colors.card;
    drawRoundedRectPath(ctx, x, y, width, height, 16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = colors.hairline;
    ctx.lineWidth = 1;
    drawRoundedRectPath(ctx, x, y, width, height, 16);
    ctx.stroke();
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x + width - 5, y + 14, 3, Math.max(0, height - 28));
    return;
  }
  if (design === "editorial") {
    ctx.fillStyle = colors.card;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x + width - 3, y, 3, height);
    ctx.strokeStyle = colors.hairline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = colors.card;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(x, y, width, 5);
}

function drawSectionCard(
  ctx: CanvasRenderingContext2D,
  block: PreparedSection,
  x: number,
  y: number,
  width: number,
  frameHeight: number,
  design: CondolenceDesignId,
) {
  const colors = colorsFor(design);
  const height = Math.max(block.height, frameHeight);
  drawPanel(ctx, x, y, width, height, design);
  const scale = block.scale;
  const paddingX = (design === "official" ? 24 : 20) * scale;
  let cursor = y + (design === "official" ? 33 : 29) * scale;
  if (block.label) {
    const labelColor = design === "modern" ? colors.secondary : colors.accent;
    fitText(ctx, block.label, x + width - paddingX, cursor, width - paddingX * 2, (design === "official" ? 18 : 16) * scale, FONT_BODY, 700, "right", labelColor);
    if (design === "editorial") {
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(x + 20 * scale, cursor - 7 * scale, 26 * scale, 2 * scale);
    }
    cursor += block.labelHeight;
  } else if (block.tone === "closing" && block.continuation) {
    fitText(ctx, "متابعة الدعاء", x + width - paddingX, cursor, width - paddingX * 2, 14, FONT_BODY, 600, "right", colors.accent);
    cursor += block.labelHeight;
  }

  const fontSize = block.fontSize;
  const family = block.tone === "body" ? FONT_BODY : FONT_DISPLAY;
  const weight = block.tone === "body" ? 500 : 600;
  const color = block.tone === "closing" ? colors.accent : colors.ink;
  const contentWidth = width - paddingX * 2 - (block.qrSize ? block.qrSize + 34 * scale : 0);
  const align = design === "official" && block.tone === "closing" ? "center" : "right";
  const textX = align === "center" ? x + width / 2 : x + width - paddingX;
  if (block.qrSize > 0) {
    const qrX = x + paddingX;
    const qrY = cursor + (block.label ? 5 * scale : 0);
    ctx.fillStyle = "#ffffff";
    drawRoundedRectPath(ctx, qrX - 5 * scale, qrY - 5 * scale, block.qrSize + 10 * scale, block.qrSize + 10 * scale, 7 * scale);
    ctx.fill();
    if (block.qr) {
      ctx.drawImage(block.qr.image, qrX, qrY, block.qrSize, block.qrSize);
    } else {
      fitText(ctx, "تعذر إنشاء QR", qrX + block.qrSize / 2, qrY + block.qrSize / 2, block.qrSize - 10 * scale, 12 * scale, FONT_BODY, 500, "center", colors.muted);
    }
    if (block.qrLabel) {
      fitText(ctx, block.qrLabel, qrX + block.qrSize / 2, qrY + block.qrSize + 22 * scale, block.qrSize + 10 * scale, 13 * scale, FONT_BODY, 600, "center", colors.ink);
    }
    if (block.qrUrlLines.length) {
      ctx.save();
      ctx.direction = "ltr";
      drawLines(
        ctx,
        block.qrUrlLines,
        qrX + block.qrSize / 2,
        qrY + block.qrSize + 36 * scale,
        block.qrSize + 12 * scale,
        11 * scale,
        9 * scale,
        FONT_BODY,
        400,
        "center",
        colors.muted,
      );
      ctx.restore();
    }
  }
  drawLines(
    ctx,
    block.lines,
    textX,
    cursor + (block.label ? 4 : 0),
    contentWidth,
    block.lineHeight,
    fontSize,
    family,
    weight,
    align,
    color,
  );
}

function drawQrCard(
  ctx: CanvasRenderingContext2D,
  block: PreparedQrRow,
  x: number,
  y: number,
  width: number,
  frameHeight: number,
  design: CondolenceDesignId,
) {
  const colors = colorsFor(design);
  const height = Math.max(block.height, frameHeight);
  drawPanel(ctx, x, y, width, height, design);
  fitText(ctx, "مواقع العزاء والصلاة", x + width - 20, y + 29, width - 40, 15, FONT_BODY, 700, "right", colors.accent);

  const innerWidth = width - 28;
  const gap = 12;
  const cellWidth = (innerWidth - gap * (block.columns - 1)) / block.columns;
  const top = y + 46;
  block.codes.forEach((code, index) => {
    const visualIndex = index % block.columns;
    const rowIndex = Math.floor(index / block.columns);
    const codeX = x + 14 + (block.columns - 1 - visualIndex) * (cellWidth + gap);
    const center = codeX + cellWidth / 2;
    const codeY = top + rowIndex * (block.qrSize + 52);
    if (code.qr && block.qrSize > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center - block.qrSize / 2 - 4, codeY - 4, block.qrSize + 8, block.qrSize + 8);
      ctx.drawImage(code.qr.image, center - block.qrSize / 2, codeY, block.qrSize, block.qrSize);
    }
    const labelY = codeY + block.qrSize + 21;
    fitText(ctx, code.label, center, labelY, cellWidth - 8, 15, FONT_BODY, 700, "center", colors.ink);
    if (!code.qr && code.urlLines.length) {
      ctx.save();
      ctx.direction = "ltr";
      drawLines(ctx, code.urlLines, center, labelY + 16, cellWidth - 12, 12, 9, FONT_BODY, 400, "center", colors.muted);
      ctx.restore();
    }
  });
}

function drawPage(
  canvas: HTMLCanvasElement,
  page: PageLayout,
  opening: string,
  statement: string,
  names: string,
  pageIndex: number,
  pageCount: number,
  scale: number,
  design: CondolenceDesignId,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز لوحة رسم الصورة");
  const colors = colorsFor(design);
  ctx.clearRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  setRtl(ctx);
  drawBrand(ctx, design);
  if (pageIndex > 0 && names) {
    fitText(ctx, `متابعة: ${names}`, IMAGE_WIDTH / 2, 101, CONTENT_WIDTH, 14, FONT_BODY, 500, "center", colorsFor(design).muted);
  }
  const header = headerLayout(ctx, opening, statement, names, design, scale);
  drawHeader(ctx, header, design);

  const capacity = Math.max(100, CONTENT_BOTTOM - header.bodyTop);
  let closingRowIndex = -1;
  if (pageIndex === pageCount - 1) {
    for (let index = 0; index < page.rows.length; index += 1) {
      if (page.rows[index].cells.some((cell) => cell.block.kind === "section" && cell.block.id === "closing")) {
        closingRowIndex = index;
      }
    }
  }
  const freeSpace = Math.max(0, capacity - page.used);
  const extraGap = closingRowIndex >= 0 && page.rows.length > 1
    ? freeSpace / (page.rows.length - 1)
    : 0;
  let y = header.bodyTop;
  for (let rowIndex = 0; rowIndex < page.rows.length; rowIndex += 1) {
    const row = page.rows[rowIndex];
    y += row.gap;
    if (rowIndex > 0 && closingRowIndex >= 0) y += extraGap;
    if (rowIndex === closingRowIndex && page.rows.length === 1) {
      y = CONTENT_BOTTOM - row.height;
    }
    if (row.label) {
      const labelHeight = row.labelHeight ?? 0;
      fitText(
        ctx,
        row.label,
        IMAGE_WIDTH - PAGE_MARGIN,
        y + Math.min(21 * scale, labelHeight - 4 * scale),
        CONTENT_WIDTH,
        17 * scale,
        FONT_BODY,
        700,
        "right",
        colors.accent,
      );
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(
        PAGE_MARGIN,
        y + Math.max(8 * scale, labelHeight - 7 * scale),
        36 * scale,
        2 * scale,
      );
    }
    const cardY = y + (row.labelHeight ?? 0);
    const cardHeight = row.height - (row.labelHeight ?? 0);
    for (const cell of row.cells) {
      if (cell.block.kind === "section") {
        drawSectionCard(ctx, cell.block, cell.x, cardY, cell.width, cardHeight, design);
      } else {
        drawQrCard(ctx, cell.block, cell.x, cardY, cell.width, cardHeight, design);
      }
    }
    y += row.height;
  }

  const footer = pageCount > 1
    ? `دولة قطر · ${pageIndex + 1} / ${pageCount}`
    : "دولة قطر";
  fitText(ctx, footer, IMAGE_WIDTH / 2, 1324, 360, 13, FONT_BODY, 400, "center", colors.muted);
}

export function renderCondolencePages(options: {
  designId: CondolenceDesignId;
  opening: string;
  statement: string;
  names: string;
  items: CondolenceContentItem[];
  qrImages: Record<string, QrImage>;
}): HTMLCanvasElement[] {
  const measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) throw new Error("تعذر قياس النص");
  const design = options.designId;
  const blocks = sourceBlocks(options.items, options.qrImages);
  const headerScales = [1, 0.97, MIN_READABLE_SCALE];
  let scale = headerScales[headerScales.length - 1];
  let rows: LayoutRow[] = [];
  let header = headerLayout(ctx, options.opening, options.statement, options.names, design, scale);
  let capacity = CONTENT_BOTTOM - header.bodyTop;

  for (const candidate of headerScales) {
    const candidateHeader = headerLayout(ctx, options.opening, options.statement, options.names, design, candidate);
    const candidateRows = planLayout(ctx, blocks, design, candidate);
    const candidateCapacity = Math.max(100, CONTENT_BOTTOM - candidateHeader.bodyTop);
    const totalHeight = candidateRows.reduce((sum, row) => sum + row.gap + row.height, 0);
    scale = candidate;
    rows = candidateRows;
    header = candidateHeader;
    capacity = candidateCapacity;
    if (totalHeight <= candidateCapacity) break;
  }

  const pages = paginateRows(rows, Math.max(100, capacity), scale);
  return pages.map((page, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    drawPage(
      canvas,
      page,
      options.opening,
      options.statement,
      options.names,
      index,
      pages.length,
      scale,
      design,
    );
    return canvas;
  });
}