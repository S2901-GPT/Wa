export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

export type CondolenceDesignId = "official" | "modern" | "editorial";

export type CondolenceContentItem =
  | { kind: "section"; label?: string; text: string; tone?: "body" | "closing"; gap?: number }
  | {
      kind: "columns";
      label?: string;
      columns: [{ label: string; text: string }, { label: string; text: string }];
      gap?: number;
    }
  | {
      kind: "qr-row";
      codes: Array<{ key: string; label: string; url: string }>;
      gap?: number;
    };

export type QrImage = { dataUrl: string; image: HTMLImageElement };

type TextTone = "body" | "closing";
type PreparedSection = {
  kind: "section";
  label?: string;
  lines: string[];
  tone: TextTone;
  lineHeight: number;
  labelHeight: number;
  topOffset: number;
  gap: number;
};
type PreparedColumns = {
  kind: "columns";
  label?: string;
  columns: [{ label: string; lines: string[] }, { label: string; lines: string[] }];
  rowCount: number;
  lineHeight: number;
  labelHeight: number;
  columnLabelHeight: number;
  topOffset: number;
  gap: number;
};
type PreparedQrCode = {
  key: string;
  label: string;
  url: string;
  labelLines: string[];
  urlLines: string[];
  qr?: QrImage;
  continuation?: boolean;
};
type PreparedQrRow = {
  kind: "qr-row";
  codes: PreparedQrCode[];
  size: number;
  cardWidth: number;
  height: number;
  gap: number;
};
type PreparedBlock = PreparedSection | PreparedColumns | PreparedQrRow;

type PageSection = Omit<PreparedSection, "gap"> & { continuation: boolean; gap: number };
type PageColumns = Omit<PreparedColumns, "gap" | "rowCount"> & { continuation: boolean; gap: number };
type PageQrRow = Omit<PreparedQrRow, "gap"> & { gap: number; continuation?: boolean };
type PageBlock = PageSection | PageColumns | PageQrRow;
type PageLayout = { blocks: PageBlock[]; used: number };

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
    paper: "#f8f4ec",
    card: "#fffdf8",
    ink: "#25232a",
    accent: "#762f43",
    secondary: "#af9464",
    muted: "#716b6a",
    hairline: "#ded3c1",
  },
  modern: {
    paper: "#f1f0eb",
    card: "#fbfaf6",
    ink: "#1d3035",
    accent: "#c46c43",
    secondary: "#46676d",
    muted: "#6c7674",
    hairline: "#cbd4cf",
  },
  editorial: {
    paper: "#fbf6ee",
    card: "#fffaf3",
    ink: "#2d2630",
    accent: "#ad4e43",
    secondary: "#b28a4c",
    muted: "#746c6a",
    hairline: "#dfcfc0",
  },
} as const;

const FONT_DISPLAY = '"Noto Naskh Arabic", "Amiri", serif';
const FONT_BODY = '"IBM Plex Sans Arabic", "Tajawal", Arial, sans-serif';
const CONTENT_BOTTOM = 1225;
const CONTENT_WIDTH = 900;

export async function loadCondolenceFonts() {
  await Promise.allSettled([
    document.fonts.load('700 60px "Noto Naskh Arabic"'),
    document.fonts.load('500 24px "IBM Plex Sans Arabic"'),
    document.fonts.load('500 24px Tajawal'),
  ]);
  await document.fonts.ready;
}

function designColors(design: CondolenceDesignId) {
  return COLORS[design];
}

function fontString(weight: number, size: number, family: string) {
  return `${weight} ${Math.max(8, Math.round(size))}px ${family}`;
}

function setRtl(ctx: CanvasRenderingContext2D) {
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";
}

function wrapUrl(ctx: CanvasRenderingContext2D, url: string, width: number): string[] {
  const pieces: string[] = [];
  let piece = "";
  for (const character of Array.from(url)) {
    piece += character;
    if (/[/?#&=._:-]/u.test(character)) {
      pieces.push(piece);
      piece = "";
    }
  }
  if (piece) pieces.push(piece);
  if (!pieces.length) return [url];

  const lines: string[] = [];
  let line = "";
  for (const part of pieces) {
    const candidate = line + part;
    if (line && ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = part;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * Lines are broken at whitespace only. A long word is kept intact and is
 * horizontally fitted when painted, rather than being silently split or cut.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  isUrl = false,
  compactParagraphs = false,
): string[] {
  if (isUrl) return wrapUrl(ctx, text, width);
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) {
      if (paragraphIndex < paragraphs.length - 1) lines.push("");
      return;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= width) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (paragraphIndex < paragraphs.length - 1 && !compactParagraphs) lines.push("");
  });
  return lines.length ? lines : [""];
}

function textLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  size: number,
  family: string,
  weight: number,
  isUrl = false,
) {
  ctx.font = fontString(weight, size, family);
  return wrapText(ctx, text, width, isUrl);
}

function sectionFont(tone: TextTone, scale: number) {
  return {
    family: tone === "closing" ? FONT_DISPLAY : FONT_BODY,
    weight: tone === "closing" ? 600 : 500,
    size: (tone === "closing" ? 25 : 21) * scale,
  };
}

function qrRowMetrics(codes: PreparedQrCode[], design: CondolenceDesignId) {
  const gap = design === "modern" ? 22 : 36;
  const cardWidth = Math.floor((CONTENT_WIDTH - gap * Math.max(0, codes.length - 1)) / Math.max(1, codes.length));
  const size = codes.some((code) => code.qr)
    ? Math.min(136, Math.max(0, cardWidth - 34))
    : 0;
  const labelLines = Math.max(...codes.map((code) => code.labelLines.length), 1);
  const urlLines = Math.max(...codes.map((code) => code.urlLines.length), 0);
  const textHeight = 10 + 17 + labelLines * 21
    + (urlLines ? 17 + urlLines * 20 : 0);
  return {
    cardWidth,
    size,
    height: 22 + (size ? size + 12 : 0) + textHeight,
  };
}

function prepareBlocks(
  ctx: CanvasRenderingContext2D,
  items: CondolenceContentItem[],
  qrImages: Record<string, QrImage>,
  design: CondolenceDesignId,
  scale: number,
): PreparedBlock[] {
  const prepared: PreparedBlock[] = [];
  const textWidth = design === "modern" ? 820 : CONTENT_WIDTH;
  for (const item of items) {
    if (item.kind === "section") {
      const tone = item.tone ?? "body";
      const font = sectionFont(tone, scale);
      const lines = textLines(ctx, item.text, textWidth, font.size, font.family, font.weight);
      prepared.push({
        kind: "section",
        label: item.label?.trim() || undefined,
        lines,
        tone,
        lineHeight: Math.round((tone === "closing" ? 40 : 33) * scale),
        labelHeight: item.label?.trim() ? Math.round(29 * scale) : 0,
        topOffset: design === "modern" ? 51 : 48,
        gap: item.gap ?? 16,
      });
      continue;
    }
    if (item.kind === "columns") {
      const columnWidth = Math.round((textWidth - 56) / 2);
      const columns = item.columns.map((column) => ({
        label: column.label,
        lines: textLines(ctx, column.text, columnWidth, 20 * scale, FONT_BODY, 500),
      })) as [{ label: string; lines: string[] }, { label: string; lines: string[] }];
      prepared.push({
        kind: "columns",
        label: item.label?.trim() || undefined,
        columns,
        rowCount: Math.max(columns[0].lines.length, columns[1].lines.length),
        lineHeight: Math.round(32 * scale),
        labelHeight: item.label?.trim() ? Math.round(28 * scale) : 0,
        columnLabelHeight: Math.round(29 * scale),
        topOffset: 47,
        gap: item.gap ?? 18,
      });
      continue;
    }

    const codes = item.codes
      .filter((code) => code.key.trim() || code.label.trim() || code.url.trim())
      .map((code) => {
        ctx.font = fontString(600, 17 * scale, FONT_BODY);
        const labelLines = wrapText(ctx, code.label, 250);
        ctx.font = fontString(400, 15 * scale, FONT_BODY);
        const urlLines = code.url.trim() ? wrapText(ctx, code.url, 250, true) : [];
        return {
          key: code.key,
          label: code.label,
          url: code.url,
          labelLines,
          urlLines,
          qr: qrImages[code.key],
        };
      });
    if (!codes.length) continue;
    const metrics = qrRowMetrics(codes, design);
    prepared.push({ kind: "qr-row", codes, ...metrics, gap: item.gap ?? 16 });
  }
  return prepared;
}

function blockHeight(block: PreparedBlock | PageBlock): number {
  if (block.kind === "section") return block.topOffset + block.labelHeight + block.lines.length * block.lineHeight;
  if (block.kind === "columns") {
    return block.topOffset + block.labelHeight + block.columnLabelHeight
      + Math.max(block.columns[0].lines.length, block.columns[1].lines.length) * block.lineHeight;
  }
  return block.height;
}

function appendBlock(page: PageLayout, block: PageBlock, gap: number) {
  block.gap = gap;
  page.blocks.push(block);
  page.used += gap + blockHeight(block);
}

function paginate(blocks: PreparedBlock[], availableHeight: number, design: CondolenceDesignId): PageLayout[] {
  const pages: PageLayout[] = [{ blocks: [], used: 0 }];
  const current = () => pages[pages.length - 1];
  const nextPage = () => pages.push({ blocks: [], used: 0 });
  const room = Math.max(150, availableHeight);

  for (const block of blocks) {
    if (block.kind === "section") {
      let offset = 0;
      let continued = false;
      while (offset < block.lines.length) {
        const page = current();
        const gap = page.blocks.length ? block.gap : 0;
        const labelHeight = block.label ? block.labelHeight : 0;
        let remaining = room - page.used - gap;
        const minimumHeight = block.topOffset + labelHeight + block.lineHeight;
        if (page.blocks.length && remaining < minimumHeight) {
          nextPage();
          continue;
        }
        if (remaining < minimumHeight) remaining = room;
        const linesThatFit = Math.max(1, Math.floor((remaining - block.topOffset - labelHeight) / block.lineHeight));
        const chunkLines = block.lines.slice(offset, offset + linesThatFit);
        const chunk: PageSection = {
          kind: "section",
          label: block.label && continued ? `${block.label} · تابع` : block.label,
          continuation: continued,
          lines: chunkLines,
          tone: block.tone,
          lineHeight: block.lineHeight,
          labelHeight: block.label ? block.labelHeight : 0,
        topOffset: block.topOffset,
          gap: 0,
        };
        appendBlock(page, chunk, gap);
        offset += chunkLines.length;
        if (offset < block.lines.length) {
          continued = true;
          nextPage();
        }
      }
      continue;
    }

    if (block.kind === "columns") {
      let row = 0;
      let continued = false;
      while (row < block.rowCount) {
        const page = current();
        const gap = page.blocks.length ? block.gap : 0;
        const headingHeight = block.topOffset + block.labelHeight + block.columnLabelHeight;
        let remaining = room - page.used - gap;
        if (page.blocks.length && remaining < headingHeight + block.lineHeight) {
          nextPage();
          continue;
        }
        if (remaining < headingHeight + block.lineHeight) remaining = room;
        const rowsThatFit = Math.max(1, Math.floor((remaining - headingHeight) / block.lineHeight));
        const columns = block.columns.map((column) => ({
          label: column.label,
          lines: column.lines.slice(row, row + rowsThatFit),
        })) as [{ label: string; lines: string[] }, { label: string; lines: string[] }];
        const chunk: PageColumns = {
          kind: "columns",
          label: block.label && continued ? `${block.label} · تابع` : block.label,
          continuation: continued,
          columns,
          lineHeight: block.lineHeight,
          labelHeight: block.label ? block.labelHeight : 0,
          columnLabelHeight: block.columnLabelHeight,
          topOffset: block.topOffset,
          gap: 0,
        };
        appendBlock(page, chunk, gap);
        row += rowsThatFit;
        if (row < block.rowCount) {
          continued = true;
          nextPage();
        }
      }
      continue;
    }

    const queue = [...block.codes];
    while (queue.length) {
      const page = current();
      const gap = page.blocks.length ? block.gap : 0;
      let remaining = room - page.used - gap;
      const smallest = qrRowMetrics([queue[0]], design).height;
      if (page.blocks.length && remaining < smallest) {
        nextPage();
        continue;
      }
      let count = queue.length;
      while (count > 1) {
        const candidate = queue.slice(0, count);
        const metrics = qrRowMetrics(candidate, design);
        if (metrics.height <= remaining) break;
        count -= 1;
      }
      let codes = queue.slice(0, Math.max(1, count));
      let metrics = qrRowMetrics(codes, design);
      if (codes.length === 1 && metrics.height > remaining && queue[0].urlLines.length > 1) {
        const source = queue[0];
        let lineCount = source.urlLines.length;
        while (lineCount > 1) {
          const candidate: PreparedQrCode = {
            ...source,
            urlLines: source.urlLines.slice(0, lineCount),
          };
          if (qrRowMetrics([candidate], design).height <= remaining) break;
          lineCount -= 1;
        }
        codes = [{
          ...source,
          urlLines: source.urlLines.slice(0, lineCount),
        }];
        metrics = qrRowMetrics(codes, design);
        const remainder = source.urlLines.slice(lineCount);
        queue.shift();
        if (remainder.length) {
          queue.unshift({
            ...source,
            qr: undefined,
            continuation: true,
            urlLines: remainder,
            labelLines: source.labelLines,
          });
        }
      } else {
        queue.splice(0, codes.length);
      }
      const chunk: PageQrRow = {
        kind: "qr-row",
        codes,
        ...metrics,
        gap: 0,
        continuation: codes[0]?.continuation,
      };
      appendBlock(page, chunk, gap);
      if (queue.length) {
        nextPage();
      }
    }
  }
  return pages.filter((page) => page.blocks.length);
}

function headerLayout(
  ctx: CanvasRenderingContext2D,
  opening: string,
  statement: string,
  names: string,
  design: CondolenceDesignId,
  scale: number,
): HeaderLayout {
  const widths = {
    official: CONTENT_WIDTH,
    modern: 820,
    editorial: 920,
  };
  const width = widths[design];
  const openingSize = (design === "editorial" ? 34 : 30) * scale;
  const statementSize = (design === "modern" ? 19 : 18) * scale;
  const baseNameSize = (design === "editorial" ? 63 : design === "modern" ? 56 : 58) * scale;
  ctx.font = fontString(600, openingSize, FONT_DISPLAY);
  const openingLines = wrapText(ctx, opening, width);
  ctx.font = fontString(500, statementSize, FONT_BODY);
  const statementLines = wrapText(ctx, statement, width);
  const openingLineHeight = Math.round((design === "editorial" ? 46 : 42) * scale);
  const statementLineHeight = Math.round(27 * scale);
  const openingY = design === "modern" ? 102 : 98;
  const statementY = openingY + openingLines.length * openingLineHeight + (design === "editorial" ? 19 : 14);
  const nameY = statementY + statementLines.length * statementLineHeight + (design === "editorial" ? 29 : 23);
  const nameTrailing = design === "editorial" ? 40 : 32;
  const safeHeaderBottom = 680;
  let nameSize = baseNameSize;
  let nameLineHeight = Math.round((design === "editorial" ? 70 : 64) * scale);
  let nameLines: string[] = [];

  // Names are often the most variable field. Keep intentional newlines
  // compact (one visual line per supplied name) and reduce only the display
  // scale when a long list would crowd out the body. No name line is removed.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    ctx.font = fontString(700, nameSize, FONT_DISPLAY);
    nameLines = wrapText(ctx, names, width, false, true);
    nameLineHeight = Math.max(24, Math.round(nameSize * (design === "editorial" ? 1.1 : 1.1)));
    const projectedBottom = nameY + nameLines.length * nameLineHeight + nameTrailing;
    if (projectedBottom <= safeHeaderBottom || nameSize <= 22) break;
    const availableNameHeight = Math.max(72, safeHeaderBottom - nameY - nameTrailing);
    const projectedNameHeight = Math.max(1, nameLines.length * nameLineHeight);
    nameSize = Math.max(22, nameSize * Math.min(0.92, availableNameHeight / projectedNameHeight));
  }
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
    bodyTop: nameY + nameLines.length * nameLineHeight + (design === "editorial" ? 40 : 32),
  };
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

function drawBrand(ctx: CanvasRenderingContext2D, design: CondolenceDesignId) {
  const colors = designColors(design);
  setRtl(ctx);
  ctx.fillStyle = colors.accent;
  if (design === "official") {
    ctx.fillRect(90, 32, 900, 2);
    fitText(ctx, "دولة قطر · إعلان وفاة", IMAGE_WIDTH / 2, 59, 400, 14, FONT_BODY, 500, "center", colors.muted);
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(90, 72, 70, 3);
  } else if (design === "modern") {
    ctx.fillRect(86, 31, 9, 58);
    fitText(ctx, "إعلان وفاة", 950, 54, 300, 16, FONT_BODY, 600, "right", colors.ink);
    fitText(ctx, "دولة قطر", 950, 78, 300, 13, FONT_BODY, 500, "right", colors.muted);
  } else {
    fitText(ctx, "دولة قطر / إعلان وفاة", 990, 47, 360, 14, FONT_BODY, 500, "right", colors.muted);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(90, 59, 120, 2);
  }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  header: HeaderLayout,
  opening: string,
  statement: string,
  names: string,
  design: CondolenceDesignId,
) {
  const colors = designColors(design);
  setRtl(ctx);
  if (design === "official") {
    drawLines(ctx, header.openingLines, IMAGE_WIDTH / 2, header.openingY, CONTENT_WIDTH, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "center", colors.ink);
    drawLines(ctx, header.statementLines, IMAGE_WIDTH / 2, header.statementY, CONTENT_WIDTH, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "center", colors.accent);
    drawLines(ctx, header.nameLines, IMAGE_WIDTH / 2, header.nameY, CONTENT_WIDTH, header.nameLineHeight, header.nameSize, FONT_DISPLAY, 700, "center", colors.ink);
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(430, header.bodyTop - 15, 220, 2);
    return;
  }
  if (design === "modern") {
    const right = 950;
    drawLines(ctx, header.openingLines, right, header.openingY, 820, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "right", colors.ink);
    drawLines(ctx, header.statementLines, right, header.statementY, 820, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "right", colors.secondary);
    drawLines(ctx, header.nameLines, right, header.nameY, 820, header.nameLineHeight, header.nameSize, FONT_DISPLAY, 700, "right", colors.ink);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(86, header.bodyTop - 19, 210, 4);
    return;
  }
  drawLines(ctx, header.openingLines, 950, header.openingY, 900, header.openingLineHeight, header.openingSize, FONT_DISPLAY, 600, "right", colors.accent);
  drawLines(ctx, header.statementLines, 950, header.statementY, 900, header.statementLineHeight, header.statementSize, FONT_BODY, 500, "right", colors.muted);
  drawLines(ctx, header.nameLines, 950, header.nameY, 900, header.nameLineHeight, header.nameSize, FONT_DISPLAY, 700, "right", colors.ink);
  // Keep these arguments explicit: it makes it clear that the exact supplied
  // header strings, not a transformed summary, are rendered.
  void opening;
  void statement;
  void names;
}

function drawOfficialSection(
  ctx: CanvasRenderingContext2D,
  block: PageSection,
  y: number,
  design: CondolenceDesignId,
) {
  const colors = designColors(design);
  const x = 90;
  const width = 900;
  ctx.fillStyle = colors.card;
  ctx.fillRect(x, y, width, blockHeight(block));
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, blockHeight(block));
  ctx.fillStyle = colors.accent;
  ctx.fillRect(x + width - 5, y, 5, blockHeight(block));
  let cursor = y + 26;
  if (block.label) {
    fitText(ctx, block.label, x + width - 28, cursor, width - 60, 18, FONT_BODY, 600, "right", colors.accent);
    cursor += block.labelHeight;
  }
  drawLines(ctx, block.lines, IMAGE_WIDTH / 2, cursor + 22, width - 62, block.lineHeight, sectionFont(block.tone, 1).size, sectionFont(block.tone, 1).family, sectionFont(block.tone, 1).weight, "center", colors.ink);
}

function drawModernSection(
  ctx: CanvasRenderingContext2D,
  block: PageSection,
  y: number,
  index: number,
  design: CondolenceDesignId,
) {
  const colors = designColors(design);
  const x = index % 2 === 0 ? 145 : 92;
  const width = index % 2 === 0 ? 790 : 862;
  const right = x + width - 28;
  ctx.fillStyle = colors.card;
  ctx.fillRect(x, y, width, blockHeight(block));
  ctx.fillStyle = index % 2 === 0 ? colors.secondary : colors.accent;
  ctx.fillRect(x, y, 7, blockHeight(block));
  let cursor = y + 29;
  if (block.label) {
    fitText(ctx, block.label, right, cursor, width - 48, 18, FONT_BODY, 600, "right", colors.secondary);
    cursor += block.labelHeight;
  }
  const font = sectionFont(block.tone, 1);
  drawLines(ctx, block.lines, right, cursor + 22, width - 48, block.lineHeight, font.size, font.family, font.weight, "right", colors.ink);
}

function drawEditorialSection(
  ctx: CanvasRenderingContext2D,
  block: PageSection,
  y: number,
  design: CondolenceDesignId,
) {
  const colors = designColors(design);
  const right = 946;
  let cursor = y + 26;
  if (block.label) {
    fitText(ctx, block.label, right, cursor, 840, 17, FONT_BODY, 600, "right", colors.accent);
    ctx.fillStyle = colors.secondary;
    ctx.fillRect(135, cursor - 8, 52, 2);
    cursor += block.labelHeight;
  }
  const font = sectionFont(block.tone, 1);
  drawLines(ctx, block.lines, right, cursor + 22, 820, block.lineHeight, font.size, font.family, font.weight, "right", colors.ink);
  ctx.strokeStyle = colors.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(135, y + blockHeight(block) - 4);
  ctx.lineTo(945, y + blockHeight(block) - 4);
  ctx.stroke();
}

function drawColumns(
  ctx: CanvasRenderingContext2D,
  block: PageColumns,
  y: number,
  design: CondolenceDesignId,
) {
  const colors = designColors(design);
  const center = IMAGE_WIDTH / 2;
  const columnCenters = design === "modern"
    ? [center + 220, center - 220]
    : [center + 215, center - 215];
  if (design === "official") {
    ctx.fillStyle = colors.card;
    ctx.fillRect(90, y, 900, blockHeight(block));
    ctx.strokeStyle = colors.hairline;
    ctx.strokeRect(90, y, 900, blockHeight(block));
    ctx.fillStyle = colors.accent;
    ctx.fillRect(center - 1, y + 16, 2, blockHeight(block) - 32);
  } else if (design === "modern") {
    ctx.fillStyle = colors.card;
    ctx.fillRect(105, y, 870, blockHeight(block));
    ctx.fillStyle = colors.accent;
    ctx.fillRect(105, y, 870, 4);
  }
  let cursor = y + 24;
  if (block.label) {
    fitText(ctx, block.label, design === "editorial" ? 945 : center, cursor, 840, 18, FONT_BODY, 600, design === "editorial" ? "right" : "center", colors.accent);
    cursor += block.labelHeight;
  }
  block.columns.forEach((column, index) => {
    fitText(ctx, column.label, columnCenters[index], cursor + 23, 360, 19, FONT_BODY, 600, "center", colors.secondary);
  });
  cursor += block.columnLabelHeight;
  block.columns.forEach((column, index) => {
    const font = sectionFont("body", 0.98);
    drawLines(ctx, column.lines, columnCenters[index], cursor + 23, 370, block.lineHeight, font.size, font.family, font.weight, "center", colors.ink);
  });
}

function drawQrRow(ctx: CanvasRenderingContext2D, block: PageQrRow, y: number, design: CondolenceDesignId) {
  const colors = designColors(design);
  const gap = design === "modern" ? 22 : 36;
  block.codes.forEach((code, index) => {
    const x = 90 + index * (block.cardWidth + gap);
    const center = x + block.cardWidth / 2;
    if (design === "official") {
      ctx.fillStyle = colors.card;
      ctx.fillRect(x, y, block.cardWidth, block.height);
      ctx.strokeStyle = colors.hairline;
      ctx.strokeRect(x, y, block.cardWidth, block.height);
    } else if (design === "modern") {
      ctx.fillStyle = colors.card;
      ctx.fillRect(x, y, block.cardWidth, block.height);
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(x, y, 4, block.height);
    }
    let cursor = y + 22;
    if (code.qr && block.size > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(center - block.size / 2 - 5, cursor - 5, block.size + 10, block.size + 10);
      ctx.drawImage(code.qr.image, center - block.size / 2, cursor, block.size, block.size);
      cursor += block.size + 12;
    }
    const labelLines = code.continuation
      ? [`${code.label} · تابع`, ...code.labelLines.slice(1)]
      : code.labelLines;
    drawLines(ctx, labelLines, center, cursor + 17, block.cardWidth - 24, 21, 16, FONT_BODY, 600, "center", colors.accent);
    cursor += labelLines.length * 21;
    if (code.urlLines.length) {
      ctx.save();
      ctx.direction = "ltr";
      drawLines(ctx, code.urlLines, center, cursor + 17, block.cardWidth - 24, 20, 14, FONT_BODY, 400, "center", colors.muted);
      ctx.restore();
    }
  });
}

function drawPage(
  canvas: HTMLCanvasElement,
  blocks: PageBlock[],
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
  const colors = designColors(design);
  ctx.clearRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  setRtl(ctx);
  drawBrand(ctx, design);
  const header = headerLayout(ctx, opening, statement, names, design, scale);
  drawHeader(ctx, header, opening, statement, names, design);

  const bodyCapacity = Math.max(150, CONTENT_BOTTOM - header.bodyTop);
  const usedHeight = blocks.reduce((sum, block) => sum + block.gap + blockHeight(block), 0);
  let y = header.bodyTop + Math.max(0, (bodyCapacity - usedHeight) / 2);
  blocks.forEach((block, index) => {
    y += block.gap;
    if (block.kind === "section") {
      if (design === "official") drawOfficialSection(ctx, block, y, design);
      else if (design === "modern") drawModernSection(ctx, block, y, index, design);
      else drawEditorialSection(ctx, block, y, design);
    } else if (block.kind === "columns") {
      drawColumns(ctx, block, y, design);
    } else {
      drawQrRow(ctx, block, y, design);
    }
    y += blockHeight(block);
  });

  ctx.fillStyle = colors.muted;
  const footer = pageCount > 1 ? `دولة قطر · ${pageIndex + 1} / ${pageCount}` : "دولة قطر";
  fitText(ctx, footer, IMAGE_WIDTH / 2, 1322, 400, 14, FONT_BODY, 400, "center", colors.muted);
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
  let scale = 1;
  let blocks = prepareBlocks(ctx, options.items, options.qrImages, design, scale);
  let header = headerLayout(ctx, options.opening, options.statement, options.names, design, scale);
  let capacity = CONTENT_BOTTOM - header.bodyTop;
  const total = blocks.reduce((sum, block) => sum + block.gap + blockHeight(block), 0);
  if (total < capacity * 0.58) {
    scale = 1.05;
    blocks = prepareBlocks(ctx, options.items, options.qrImages, design, scale);
    header = headerLayout(ctx, options.opening, options.statement, options.names, design, scale);
    capacity = CONTENT_BOTTOM - header.bodyTop;
  }
  // The public renderer remains synchronous because callers immediately turn
  // its canvases into PNGs. Callers await loadCondolenceFonts() before calling
  // here, ensuring the supplied Arabic fonts are the fonts being measured.
  const pages = paginate(blocks, capacity, design);
  return pages.map((page, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    drawPage(
      canvas,
      page.blocks,
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