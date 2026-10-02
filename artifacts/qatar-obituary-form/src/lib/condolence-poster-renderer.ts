export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

export type CondolenceDesignId = "official" | "modern" | "cards";

export type QrImage = { dataUrl: string; image: HTMLImageElement };

export type CondolenceContentItem = {
  kind: "section";
  id: string;
  label?: string;
  text: string;
  tone?: "body" | "identity" | "closing";
  qr?: { key: string; label: string; url: string };
};

export type RenderPageInput = {
  opening: string;
  statement: string;
  names: string;
  deceasedPeople?: Array<{
    fullName: string;
    title?: string;
    identity: string;
    details: string[];
  }>;
  prayer?: {
    day?: string;
    time?: string;
    place?: string;
    text?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  burial?: {
    statusText?: string;
    day?: string;
    time?: string;
    cemetery?: string;
    text?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  menCondolence?: {
    start?: string;
    duration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  womenCondolence?: {
    start?: string;
    duration?: string;
    time?: string;
    location?: string;
    address?: string;
    qrKey?: string;
    qrLabel?: string;
    qrUrl?: string;
  } | null;
  phoneContacts?: Array<{ name: string; phone: string }>;
  relatives?: Array<{
    heading: string;
    members: string[];
  }>;
  notes?: string | null;
  closing: string;
  designId?: CondolenceDesignId;
  qrImages?: Record<string, QrImage>;
  items?: CondolenceContentItem[];
};

export async function loadCondolenceFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.allSettled([
    document.fonts.load('700 48px "Noto Naskh Arabic"'),
    document.fonts.load('600 24px "Noto Naskh Arabic"'),
    document.fonts.load('700 48px "IBM Plex Sans Arabic"'),
    document.fonts.load('500 24px "IBM Plex Sans Arabic"'),
    document.fonts.load('800 48px "Tajawal"'),
    document.fonts.load('700 48px "Tajawal"'),
    document.fonts.load('500 24px "Tajawal"'),
  ]);
  await document.fonts.ready;
}

const FONT_NASKH = '"Noto Naskh Arabic", "Amiri", serif';
const FONT_PLEX = '"IBM Plex Sans Arabic", -apple-system, sans-serif';
const FONT_TAJAWAL = '"Tajawal", "IBM Plex Sans Arabic", sans-serif';

function font(weight: number, size: number, family: string) {
  return `${weight} ${Math.max(8, Math.round(size))}px ${family}`;
}

function setRtl(ctx: CanvasRenderingContext2D) {
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/u);
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        line = testLine;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type CardBlock = {
  id: string;
  type: "pair" | "full" | "closing";
  height: number;
  draw: (ctx: CanvasRenderingContext2D, y: number, design: CondolenceDesignId) => void;
};

export function renderCondolencePages(input: RenderPageInput): HTMLCanvasElement[] {
  const rawDesign = (input.designId as string) || "official";
  const design: CondolenceDesignId = rawDesign === "editorial" ? "cards" : (rawDesign as CondolenceDesignId);
  const qrImages = input.qrImages || {};

  const dummyCanvas = document.createElement("canvas");
  dummyCanvas.width = IMAGE_WIDTH;
  dummyCanvas.height = IMAGE_HEIGHT;
  const ctx = dummyCanvas.getContext("2d")!;
  setRtl(ctx);

  const PAGE_MARGIN_X = design === "official" ? 64 : 56;
  const CARD_WIDTH = IMAGE_WIDTH - PAGE_MARGIN_X * 2;
  const HALF_GAP = 18;
  const HALF_WIDTH = (CARD_WIDTH - HALF_GAP) / 2;

  // 1. Process Deceased Names (Title + Name inline)
  const deceasedList = input.deceasedPeople && input.deceasedPeople.length > 0
    ? input.deceasedPeople
    : [{ fullName: input.names, title: "", identity: input.names, details: [] }];

  const headerDeceased = deceasedList.map((d) => d.identity).join("، ");
  const headerDetails = deceasedList.flatMap((d) => d.details);

  ctx.font = font(700, design === "official" ? 44 : 40, design === "official" ? FONT_NASKH : FONT_TAJAWAL);
  const nameLines: string[] = [];
  for (const d of deceasedList) {
    nameLines.push(...wrapText(ctx, d.identity, CARD_WIDTH - 50));
  }

  const headerHeight = design === "official"
    ? 220 + (nameLines.length - 1) * 56 + (headerDetails.length ? 36 : 0)
    : design === "modern"
    ? 195 + (nameLines.length - 1) * 50 + (headerDetails.length ? 34 : 0)
    : 230 + (nameLines.length - 1) * 52 + (headerDetails.length ? 36 : 0);

  // 2. Prepare Structured Content Blocks in strict order
  const blocks: CardBlock[] = [];

  // A. PRAYER & BURIAL
  const hasPrayer = Boolean(input.prayer && (input.prayer.place || input.prayer.day || input.prayer.time || input.prayer.text || input.prayer.qrUrl));
  const hasBurial = Boolean(input.burial && (input.burial.cemetery || input.burial.day || input.burial.time || input.burial.text || input.burial.qrUrl));

  if (hasPrayer && hasBurial) {
    const prayerQr = input.prayer?.qrKey ? qrImages[input.prayer.qrKey] : undefined;
    const burialQr = input.burial?.qrKey ? qrImages[input.burial.qrKey] : undefined;

    const prayerRows = [
      input.prayer?.day ? `اليوم: ${input.prayer.day}` : "",
      input.prayer?.time ? `الوقت: ${input.prayer.time}` : "",
      input.prayer?.place ? `المسجد: ${input.prayer.place}` : "",
    ].filter(Boolean);

    const burialRows = [
      input.burial?.statusText || "سيتم الدفن",
      input.burial?.day ? `اليوم: ${input.burial.day}` : "",
      input.burial?.time ? `الوقت: ${input.burial.time}` : "",
      input.burial?.cemetery ? `المقبرة: ${input.burial.cemetery}` : "",
    ].filter(Boolean);

    ctx.font = font(500, 19, FONT_PLEX);
    const prayerTextW = HALF_WIDTH - 40 - (prayerQr ? 126 : 0);
    const burialTextW = HALF_WIDTH - 40 - (burialQr ? 126 : 0);

    let prayerLinesCount = 0;
    for (const r of prayerRows) prayerLinesCount += wrapText(ctx, r, prayerTextW).length;
    let burialLinesCount = 0;
    for (const r of burialRows) burialLinesCount += wrapText(ctx, r, burialTextW).length;

    const baseOffset = design === "cards" ? 72 : 64;
    const calcPrayerH = baseOffset + prayerLinesCount * 28 + 20;
    const calcBurialH = baseOffset + burialLinesCount * 28 + 20;
    const minQrBoxH = 146 + (design === "cards" ? 52 : 46);

    const height = Math.max(
      calcPrayerH,
      calcBurialH,
      prayerQr ? minQrBoxH : 185,
      burialQr ? minQrBoxH : 185,
      205,
    );

    blocks.push({
      id: "prayer-burial-pair",
      type: "pair",
      height,
      draw: (drawCtx, y) => {
        // Right: Prayer
        drawHalfCard(drawCtx, {
          x: PAGE_MARGIN_X + HALF_WIDTH + HALF_GAP,
          y,
          width: HALF_WIDTH,
          height,
          title: "صلاة الجنازة",
          accentColor: design === "official" ? "#671426" : design === "modern" ? "#0F172A" : "#1E3A8A",
          rows: prayerRows,
          qr: prayerQr,
          qrLabel: "موقع الصلاة",
          design,
        });

        // Left: Burial
        drawHalfCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: HALF_WIDTH,
          height,
          title: "الدفن",
          accentColor: design === "official" ? "#671426" : design === "modern" ? "#0F172A" : "#0F766E",
          rows: burialRows,
          qr: burialQr,
          qrLabel: "موقع الدفن",
          design,
        });
      },
    });
  } else if (hasPrayer || hasBurial) {
    const isPrayer = hasPrayer;
    const item = isPrayer ? input.prayer! : input.burial!;
    const itemQr = item.qrKey ? qrImages[item.qrKey] : undefined;
    const title = isPrayer ? "صلاة الجنازة" : "الدفن";
    const rows = isPrayer
      ? [
          item.day ? `اليوم: ${item.day}` : "",
          item.time ? `الوقت: ${item.time}` : "",
          item.place ? `المسجد / المكان: ${item.place}` : "",
        ].filter(Boolean)
      : [
          (item as any).statusText || "سيتم الدفن",
          item.day ? `اليوم: ${item.day}` : "",
          item.time ? `الوقت: ${item.time}` : "",
          (item as any).cemetery ? `المقبرة: ${(item as any).cemetery}` : "",
        ].filter(Boolean);

    ctx.font = font(500, 20, FONT_PLEX);
    const textMaxWidth = CARD_WIDTH - 50 - (itemQr ? 150 : 0);
    let totalLines = 0;
    for (const r of rows) totalLines += wrapText(ctx, r, textMaxWidth).length;

    const baseOffset = design === "cards" ? 72 : 64;
    const height = Math.max(baseOffset + totalLines * 30 + 20, itemQr ? 200 : 160);

    blocks.push({
      id: isPrayer ? "prayer-card" : "burial-card",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawFullCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          title,
          accentColor: design === "official" ? "#671426" : design === "modern" ? "#0F172A" : isPrayer ? "#1E3A8A" : "#0F766E",
          rows,
          qr: itemQr,
          qrLabel: isPrayer ? "موقع الصلاة" : "موقع الدفن",
          design,
        });
      },
    });
  }

  // B. MEN'S CONDOLENCE
  const hasMen = Boolean(
    input.menCondolence && (
      input.menCondolence.location
      || input.menCondolence.time
      || input.menCondolence.start
      || input.menCondolence.address
      || input.menCondolence.qrUrl
    ),
  );

  if (hasMen) {
    const men = input.menCondolence!;
    const menQr = men.qrKey ? qrImages[men.qrKey] : undefined;
    const rows = [
      men.start ? `البداية: ${men.start}${men.duration ? ` (${men.duration})` : ""}` : "",
      men.time ? `الوقت: ${men.time}` : "",
      men.location ? `المجلس: ${men.location}` : "",
      men.address ? `العنوان: ${men.address}` : "",
    ].filter(Boolean);

    ctx.font = font(500, 20, FONT_PLEX);
    const paddingX = design === "official" ? 28 : 24;
    const qrSize = menQr ? 120 : 0;
    const qrTotalWidth = menQr ? qrSize + 36 : 0;
    const textMaxWidth = CARD_WIDTH - paddingX * 2 - qrTotalWidth;

    let totalLines = 0;
    for (const r of rows) totalLines += wrapText(ctx, r, textMaxWidth).length;

    const baseOffset = design === "cards" ? 72 : 64;
    const calcTextH = baseOffset + totalLines * 30 + 20;
    const minQrBoxH = menQr ? baseOffset + 120 + 26 + 18 : 0;
    const height = Math.max(calcTextH, minQrBoxH, 180);

    blocks.push({
      id: "men-condolence",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawFullCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          title: "عزاء الرجال",
          accentColor: design === "official" ? "#671426" : design === "modern" ? "#1E3A8A" : "#1E293B",
          rows,
          qr: menQr,
          qrLabel: "موقع المجلس",
          design,
        });
      },
    });
  }

  // C. WOMEN'S CONDOLENCE
  const hasWomen = Boolean(
    input.womenCondolence && (
      input.womenCondolence.location
      || input.womenCondolence.time
      || input.womenCondolence.start
      || input.womenCondolence.address
      || input.womenCondolence.qrUrl
    ),
  );

  if (hasWomen) {
    const women = input.womenCondolence!;
    const womenQr = women.qrKey ? qrImages[women.qrKey] : undefined;
    const rows = [
      women.start ? `البداية: ${women.start}${women.duration ? ` (${women.duration})` : ""}` : "",
      women.time ? `الوقت: ${women.time}` : "",
      women.location ? `المكان: ${women.location}` : "",
      women.address ? `العنوان: ${women.address}` : "",
    ].filter(Boolean);

    ctx.font = font(500, 20, FONT_PLEX);
    const paddingX = design === "official" ? 28 : 24;
    const qrSize = womenQr ? 120 : 0;
    const qrTotalWidth = womenQr ? qrSize + 36 : 0;
    const textMaxWidth = CARD_WIDTH - paddingX * 2 - qrTotalWidth;

    let totalLines = 0;
    for (const r of rows) totalLines += wrapText(ctx, r, textMaxWidth).length;

    const baseOffset = design === "cards" ? 72 : 64;
    const calcTextH = baseOffset + totalLines * 30 + 20;
    const minQrBoxH = womenQr ? baseOffset + 120 + 26 + 18 : 0;
    const height = Math.max(calcTextH, minQrBoxH, 180);

    blocks.push({
      id: "women-condolence",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawFullCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          title: "عزاء النساء",
          accentColor: design === "official" ? "#7A2838" : design === "modern" ? "#581C87" : "#6B21A8",
          rows,
          qr: womenQr,
          qrLabel: "موقع العزاء",
          design,
        });
      },
    });
  }

  // D. PHONE CONTACTS (Placed right after condolences as per Qatar customs)
  const hasPhone = Boolean(input.phoneContacts && input.phoneContacts.length > 0);
  if (hasPhone) {
    const contacts = input.phoneContacts!;
    const rowPairs = Math.ceil(contacts.length / 2);
    const baseOffset = design === "cards" ? 70 : 62;
    const height = baseOffset + rowPairs * 36 + 14;

    blocks.push({
      id: "phone-contacts",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawPhoneCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          contacts,
          design,
        });
      },
    });
  }

  // E. RELATIVES & FAMILY
  const hasRelatives = Boolean(input.relatives && input.relatives.length > 0);
  if (hasRelatives) {
    const rels = input.relatives!;
    const paddingX = design === "official" ? 28 : 24;
    let totalLinesCount = 0;

    for (const group of rels) {
      ctx.font = font(700, 19, FONT_PLEX);
      const label = `${group.heading}: `;
      const labelWidth = ctx.measureText(label).width;

      ctx.font = font(500, 19, FONT_PLEX);
      const membersText = group.members.join("، ");
      const firstLineWidth = CARD_WIDTH - paddingX * 2 - labelWidth - 6;
      const wrapped = wrapText(ctx, membersText, firstLineWidth);
      totalLinesCount += Math.max(1, wrapped.length);
    }

    const baseOffset = design === "cards" ? 72 : 62;
    const height = Math.max(140, baseOffset + totalLinesCount * 30 + rels.length * 8 + 14);

    blocks.push({
      id: "relatives",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawRelativesCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          relatives: rels,
          design,
        });
      },
    });
  }

  // F. NOTES
  const hasNotes = Boolean(input.notes && input.notes.trim());
  if (hasNotes) {
    ctx.font = font(500, 19, FONT_PLEX);
    const wrapped = wrapText(ctx, input.notes!.trim(), CARD_WIDTH - 60);
    const baseOffset = design === "cards" ? 70 : 62;
    const height = Math.max(105, baseOffset + wrapped.length * 28 + 16);

    blocks.push({
      id: "notes",
      type: "full",
      height,
      draw: (drawCtx, y) => {
        drawNotesCard(drawCtx, {
          x: PAGE_MARGIN_X,
          y,
          width: CARD_WIDTH,
          height,
          lines: wrapped,
          design,
        });
      },
    });
  }

  // G. CLOSING DU'A PRAYER
  const closingText = input.closing || "رحمه الله وغفر له وأسكنه فسيح جناته.";
  ctx.font = font(600, 22, design === "official" ? FONT_NASKH : FONT_TAJAWAL);
  const closingLines = wrapText(ctx, closingText, CARD_WIDTH - 50);
  const closingHeight = 52 + closingLines.length * 32;

  const closingBlock: CardBlock = {
    id: "closing",
    type: "closing",
    height: closingHeight,
    draw: (drawCtx, y) => {
      drawClosingCard(drawCtx, {
        x: PAGE_MARGIN_X,
        y,
        width: CARD_WIDTH,
        height: closingHeight,
        lines: closingLines,
        design,
      });
    },
  };

  // 3. PAGINATION ALGORITHM (Dynamic Height Budgeting)
  const BOTTOM_PADDING = 65;
  const BLOCK_GAP = 14;
  const maxPageHeight = IMAGE_HEIGHT - BOTTOM_PADDING;

  const pages: Array<{
    pageNumber: number;
    isContinuation: boolean;
    headerHeight: number;
    blocks: CardBlock[];
  }> = [];

  let currentPageBlocks: CardBlock[] = [];
  let currentUsedHeight = headerHeight;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isLastBlock = i === blocks.length - 1;
    const spaceNeeded = (currentPageBlocks.length ? BLOCK_GAP : 0) + block.height + (isLastBlock ? BLOCK_GAP + closingBlock.height : 0);

    if (currentUsedHeight + spaceNeeded <= maxPageHeight) {
      currentPageBlocks.push(block);
      currentUsedHeight += (currentPageBlocks.length > 1 ? BLOCK_GAP : 0) + block.height;
    } else {
      // Split into Page 2
      pages.push({
        pageNumber: pages.length + 1,
        isContinuation: pages.length > 0,
        headerHeight,
        blocks: currentPageBlocks,
      });

      const continuationHeaderHeight = design === "official" ? 140 : 120;
      currentPageBlocks = [block];
      currentUsedHeight = continuationHeaderHeight + block.height;
    }
  }

  // Push closing block on last page
  currentPageBlocks.push(closingBlock);
  pages.push({
    pageNumber: pages.length + 1,
    isContinuation: pages.length > 0,
    headerHeight: pages.length > 0 ? (design === "official" ? 140 : 120) : headerHeight,
    blocks: currentPageBlocks,
  });

  const totalPages = pages.length;

  // 4. DRAW PAGES TO CANVASES
  return pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    canvas.height = IMAGE_HEIGHT;
    const pageCtx = canvas.getContext("2d")!;
    setRtl(pageCtx);

    // Background & Outer Framings
    drawPageBackground(pageCtx, design, page.pageNumber, totalPages);

    // Header (Hero on page 1, Continuation on subsequent pages)
    let currentY = 0;
    if (page.isContinuation) {
      currentY = drawContinuationHeader(pageCtx, {
        deceasedName: headerDeceased,
        design,
        pageNumber: page.pageNumber,
        totalPages,
      });
    } else {
      currentY = drawHeroHeader(pageCtx, {
        opening: input.opening,
        statement: input.statement,
        nameLines,
        details: headerDetails,
        design,
      });
    }

    // Render Blocks
    for (const b of page.blocks) {
      b.draw(pageCtx, currentY, design);
      currentY += b.height + BLOCK_GAP;
    }

    // Footer page count if multi-page
    if (totalPages > 1) {
      pageCtx.save();
      pageCtx.font = font(500, 15, FONT_PLEX);
      pageCtx.textAlign = "center";
      pageCtx.fillStyle = design === "official" ? "#9C896B" : "#8A94A0";
      pageCtx.fillText(`صفحة ${page.pageNumber} من ${totalPages}`, IMAGE_WIDTH / 2, IMAGE_HEIGHT - 26);
      pageCtx.restore();
    }

    return canvas;
  });
}

// ==========================================
// BACKGROUND DRAWING (3 Truly Distinct Styles)
// ==========================================
function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  design: CondolenceDesignId,
  pageNumber: number,
  totalPages: number,
) {
  if (design === "official") {
    // Warm Ivory Parchment
    const grad = ctx.createLinearGradient(0, 0, 0, IMAGE_HEIGHT);
    grad.addColorStop(0, "#FCFBF7");
    grad.addColorStop(1, "#F5EFE3");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    // Double Elegant Rule Borders
    ctx.save();
    // Outer Maroon Rule
    ctx.strokeStyle = "#671426";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(36, 36, IMAGE_WIDTH - 72, IMAGE_HEIGHT - 72);

    // Inner Antique Gold Rule
    ctx.strokeStyle = "#B38E46";
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, IMAGE_WIDTH - 88, IMAGE_HEIGHT - 88);

    // Corner Geometric Accents
    const corners = [
      [40, 40],
      [IMAGE_WIDTH - 40, 40],
      [40, IMAGE_HEIGHT - 40],
      [IMAGE_WIDTH - 40, IMAGE_HEIGHT - 40],
    ];
    ctx.fillStyle = "#B38E46";
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }
    ctx.restore();
    return;
  }

  if (design === "modern") {
    // Architectural Clean Snow White
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    // Architectural Minimal Slate Accent (Top-Right)
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(IMAGE_WIDTH - 120, 36, 64, 4);

    ctx.save();
    ctx.font = font(700, 13, FONT_PLEX);
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748B";
    ctx.fillText("إعلان وفاة", 56, 42);
    ctx.restore();
    return;
  }

  // "cards" - Executive Cool Slate Grey
  ctx.fillStyle = "#EDF2F7";
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  // Modern subtle top brand indicator
  ctx.save();
  ctx.font = font(700, 13, FONT_PLEX);
  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.fillText("دولة قطر · إعلان وفاة", IMAGE_WIDTH / 2, 36);
  ctx.restore();
}

// ==========================================
// HERO HEADERS (3 Truly Distinct Styles)
// ==========================================
function drawHeroHeader(
  ctx: CanvasRenderingContext2D,
  data: {
    opening: string;
    statement: string;
    nameLines: string[];
    details: string[];
    design: CondolenceDesignId;
  },
): number {
  const { opening, statement, nameLines, details, design } = data;
  setRtl(ctx);

  if (design === "official") {
    // Classical Cartouche Header
    let y = 82;

    // "إنا لله وإنا إليه راجعون"
    ctx.save();
    ctx.font = font(700, 26, FONT_NASKH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#671426";
    ctx.fillText(opening, IMAGE_WIDTH / 2, y);

    // Decorative Gold divider
    y += 18;
    ctx.strokeStyle = "#B38E46";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(IMAGE_WIDTH / 2 - 120, y);
    ctx.lineTo(IMAGE_WIDTH / 2 + 120, y);
    ctx.stroke();

    ctx.fillStyle = "#B38E46";
    ctx.fillRect(IMAGE_WIDTH / 2 - 4, y - 4, 8, 8);
    ctx.restore();

    // Death statement
    y += 38;
    ctx.save();
    ctx.font = font(500, 21, FONT_PLEX);
    ctx.textAlign = "center";
    ctx.fillStyle = "#4A4644";
    ctx.fillText(statement, IMAGE_WIDTH / 2, y);
    ctx.restore();

    // Deceased Name(s) with Title inline
    y += 48;
    ctx.save();
    ctx.font = font(700, 44, FONT_NASKH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#671426";
    for (const line of nameLines) {
      ctx.fillText(line, IMAGE_WIDTH / 2, y);
      y += 56;
    }
    ctx.restore();

    // Details inline
    if (details.length) {
      y -= 6;
      ctx.save();
      ctx.font = font(500, 18, FONT_PLEX);
      ctx.textAlign = "center";
      ctx.fillStyle = "#6E6963";
      ctx.fillText(details.join("   ◆   "), IMAGE_WIDTH / 2, y);
      y += 32;
      ctx.restore();
    } else {
      y += 10;
    }

    return y;
  }

  if (design === "modern") {
    // Sharp Architectural Minimal Header
    let y = 88;

    // Opening
    ctx.save();
    ctx.font = font(700, 24, FONT_TAJAWAL);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(opening, IMAGE_WIDTH - 56, y);
    ctx.restore();

    // Statement
    y += 34;
    ctx.save();
    ctx.font = font(500, 20, FONT_PLEX);
    ctx.textAlign = "right";
    ctx.fillStyle = "#4B5563";
    ctx.fillText(statement, IMAGE_WIDTH - 56, y);
    ctx.restore();

    // Name(s)
    y += 48;
    ctx.save();
    ctx.font = font(800, 42, FONT_TAJAWAL);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    for (const line of nameLines) {
      ctx.fillText(line, IMAGE_WIDTH - 56, y);
      y += 50;
    }
    ctx.restore();

    // Details chips
    if (details.length) {
      ctx.save();
      ctx.font = font(500, 17, FONT_PLEX);
      ctx.textAlign = "right";
      ctx.fillStyle = "#4B5563";
      ctx.fillText(details.join("   ·   "), IMAGE_WIDTH - 56, y);
      y += 34;
      ctx.restore();
    } else {
      y += 12;
    }

    return y;
  }

  // "cards" - Premium Info-Cards Header
  const cardX = 56;
  const cardW = IMAGE_WIDTH - 112;
  const cardH = 175 + (nameLines.length - 1) * 52 + (details.length ? 36 : 0);
  const startY = 56;

  // Header Floating White Card
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, startY, cardW, cardH, 18);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, startY, cardW, cardH, 18);
  ctx.stroke();

  // Top Dark Ribbon inside card
  ctx.save();
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.moveTo(cardX + 18, startY);
  ctx.lineTo(cardX + cardW - 18, startY);
  ctx.arcTo(cardX + cardW, startY, cardX + cardW, startY + 18, 18);
  ctx.lineTo(cardX + cardW, startY + 44);
  ctx.lineTo(cardX, startY + 44);
  ctx.lineTo(cardX, startY + 18);
  ctx.arcTo(cardX, startY, cardX + 18, startY, 18);
  ctx.closePath();
  ctx.fill();

  ctx.font = font(700, 18, FONT_PLEX);
  ctx.textAlign = "center";
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(opening, IMAGE_WIDTH / 2, startY + 29);
  ctx.restore();

  let textY = startY + 84;
  ctx.save();
  ctx.font = font(500, 19, FONT_PLEX);
  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.fillText(statement, IMAGE_WIDTH / 2, textY);

  textY += 46;
  ctx.font = font(800, 40, FONT_PLEX);
  ctx.fillStyle = "#0F172A";
  for (const line of nameLines) {
    ctx.fillText(line, IMAGE_WIDTH / 2, textY);
    textY += 50;
  }

  if (details.length) {
    textY -= 4;
    ctx.font = font(500, 17, FONT_PLEX);
    ctx.fillStyle = "#475569";
    ctx.fillText(details.join("   ·   "), IMAGE_WIDTH / 2, textY);
  }
  ctx.restore();

  return startY + cardH + 16;
}

// Continuation Header on Page 2
function drawContinuationHeader(
  ctx: CanvasRenderingContext2D,
  data: {
    deceasedName: string;
    design: CondolenceDesignId;
    pageNumber: number;
    totalPages: number;
  },
): number {
  const { deceasedName, design, pageNumber, totalPages } = data;
  setRtl(ctx);

  if (design === "official") {
    let y = 84;
    ctx.save();
    ctx.font = font(700, 22, FONT_NASKH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#671426";
    ctx.fillText(`إعلان وفاة · ${deceasedName}`, IMAGE_WIDTH / 2, y);

    y += 14;
    ctx.strokeStyle = "#B38E46";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(IMAGE_WIDTH / 2 - 90, y);
    ctx.lineTo(IMAGE_WIDTH / 2 + 90, y);
    ctx.stroke();

    y += 28;
    ctx.font = font(500, 16, FONT_PLEX);
    ctx.fillStyle = "#7A726A";
    ctx.fillText(`متابعة البيانات (صفحة ${pageNumber} من ${totalPages})`, IMAGE_WIDTH / 2, y);
    ctx.restore();
    return y + 26;
  }

  if (design === "modern") {
    let y = 78;
    ctx.save();
    ctx.font = font(800, 24, FONT_TAJAWAL);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(`تابع إعلان وفاة: ${deceasedName}`, IMAGE_WIDTH - 56, y);

    y += 26;
    ctx.font = font(500, 16, FONT_PLEX);
    ctx.fillStyle = "#6B7280";
    ctx.fillText(`صفحة ${pageNumber} من ${totalPages}`, IMAGE_WIDTH - 56, y);
    ctx.restore();
    return y + 24;
  }

  // Cards continuation
  const startY = 54;
  const cardX = 56;
  const cardW = IMAGE_WIDTH - 112;
  const cardH = 74;

  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cardX, startY, cardW, cardH, 14);
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, startY, cardW, cardH, 14);
  ctx.stroke();

  ctx.font = font(700, 20, FONT_PLEX);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0F172A";
  ctx.fillText(`تابع إعلان وفاة: ${deceasedName}`, IMAGE_WIDTH / 2, startY + 44);
  ctx.restore();

  return startY + cardH + 16;
}

// ==========================================
// CARD RENDERERS (Full, Half, Relatives, Phone)
// ==========================================
function drawFullCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    accentColor: string;
    rows: string[];
    qr?: QrImage;
    qrLabel?: string;
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, title, accentColor, rows, qr, qrLabel, design } = params;
  setRtl(ctx);

  // Background Panel
  drawCardSurface(ctx, x, y, width, height, title, accentColor, design);

  // Content Area
  const paddingX = design === "official" ? 28 : 24;
  const qrSize = qr ? 120 : 0;
  const qrTotalWidth = qr ? qrSize + 36 : 0;
  const textMaxWidth = width - paddingX * 2 - qrTotalWidth;

  const contentStartY = design === "cards" ? y + 72 : y + 64;

  // Draw Text Rows
  ctx.save();
  ctx.font = font(500, 20, FONT_PLEX);
  ctx.fillStyle = design === "official" ? "#2B2625" : "#1F2937";

  let textY = contentStartY;
  for (const row of rows) {
    const wrapped = wrapText(ctx, row, textMaxWidth);
    for (const line of wrapped) {
      ctx.fillText(line, x + width - paddingX, textY);
      textY += 30;
    }
  }
  ctx.restore();

  // Draw Real QR Code on Left Side
  if (qr) {
    const qrX = x + paddingX;
    const qrY = y + (height - qrSize - (qrLabel ? 26 : 0)) / 2 + 4;
    drawQrBox(ctx, qr, qrLabel, qrX, qrY, qrSize, design);
  }
}

function drawHalfCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    accentColor: string;
    rows: string[];
    qr?: QrImage;
    qrLabel?: string;
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, title, accentColor, rows, qr, qrLabel, design } = params;
  setRtl(ctx);

  // Background Panel
  drawCardSurface(ctx, x, y, width, height, title, accentColor, design);

  const paddingX = 20;
  const qrSize = qr ? 104 : 0;
  const qrTotalWidth = qr ? qrSize + 22 : 0;
  const textMaxWidth = width - paddingX * 2 - qrTotalWidth;

  const contentStartY = design === "cards" ? y + 70 : y + 62;

  ctx.save();
  ctx.font = font(500, 19, FONT_PLEX);
  ctx.fillStyle = design === "official" ? "#2B2625" : "#1F2937";

  let textY = contentStartY;
  for (const row of rows) {
    const wrapped = wrapText(ctx, row, textMaxWidth);
    for (const line of wrapped) {
      ctx.fillText(line, x + width - paddingX, textY);
      textY += 28;
    }
  }
  ctx.restore();

  // Draw Real QR Code on Left Side
  if (qr) {
    const qrX = x + paddingX;
    const qrY = y + (height - qrSize - (qrLabel ? 24 : 0)) / 2 + 4;
    drawQrBox(ctx, qr, qrLabel, qrX, qrY, qrSize, design);
  }
}

function drawRelativesCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    relatives: Array<{ heading: string; members: string[] }>;
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, relatives, design } = params;
  setRtl(ctx);

  const accentColor = design === "official" ? "#671426" : design === "modern" ? "#0F766E" : "#334155";
  drawCardSurface(ctx, x, y, width, height, "الأقارب وصلات القرابة", accentColor, design);

  const paddingX = design === "official" ? 28 : 24;
  let textY = design === "cards" ? y + 72 : y + 62;

  ctx.save();
  for (const group of relatives) {
    // Bold Relation Label
    ctx.font = font(700, 19, FONT_PLEX);
    ctx.fillStyle = accentColor;
    const label = `${group.heading}: `;
    const labelWidth = ctx.measureText(label).width;
    ctx.fillText(label, x + width - paddingX, textY);

    // Members
    ctx.font = font(500, 19, FONT_PLEX);
    ctx.fillStyle = design === "official" ? "#2B2625" : "#1F2937";
    const membersText = group.members.join("، ");
    const availableWidth = width - paddingX * 2 - labelWidth - 6;

    const wrapped = wrapText(ctx, membersText, availableWidth);
    if (wrapped.length > 0) {
      ctx.fillText(wrapped[0], x + width - paddingX - labelWidth, textY);
      for (let k = 1; k < wrapped.length; k++) {
        textY += 28;
        ctx.fillText(wrapped[k], x + width - paddingX, textY);
      }
    }
    textY += 32;
  }
  ctx.restore();
}

function drawPhoneCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    contacts: Array<{ name: string; phone: string }>;
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, contacts, design } = params;
  setRtl(ctx);

  const accentColor = design === "official" ? "#671426" : design === "modern" ? "#1F2937" : "#475569";
  drawCardSurface(ctx, x, y, width, height, "التعزية عبر الهاتف", accentColor, design);

  const paddingX = design === "official" ? 28 : 24;
  let textY = design === "cards" ? y + 72 : y + 64;
  const colWidth = (width - paddingX * 2 - 20) / 2;

  ctx.save();
  ctx.font = font(500, 18, FONT_PLEX);
  ctx.fillStyle = design === "official" ? "#2B2625" : "#1F2937";

  for (let i = 0; i < contacts.length; i += 2) {
    const c1 = contacts[i];
    const c2 = contacts[i + 1];

    if (c1) {
      const line = `${c1.name ? `${c1.name}: ` : ""}${c1.phone}`;
      ctx.fillText(line, x + width - paddingX, textY);
    }
    if (c2) {
      const line = `${c2.name ? `${c2.name}: ` : ""}${c2.phone}`;
      ctx.fillText(line, x + width - paddingX - colWidth - 20, textY);
    }
    textY += 32;
  }
  ctx.restore();
}

function drawNotesCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    lines: string[];
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, lines, design } = params;
  setRtl(ctx);

  const accentColor = design === "official" ? "#671426" : design === "modern" ? "#4B5563" : "#64748B";
  drawCardSurface(ctx, x, y, width, height, "ملاحظات", accentColor, design);

  const paddingX = design === "official" ? 28 : 24;
  let textY = design === "cards" ? y + 70 : y + 62;

  ctx.save();
  ctx.font = font(500, 19, FONT_PLEX);
  ctx.fillStyle = design === "official" ? "#2B2625" : "#1F2937";
  for (const line of lines) {
    ctx.fillText(line, x + width - paddingX, textY);
    textY += 28;
  }
  ctx.restore();
}

function drawClosingCard(
  ctx: CanvasRenderingContext2D,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    lines: string[];
    design: CondolenceDesignId;
  },
) {
  const { x, y, width, height, lines, design } = params;
  setRtl(ctx);

  if (design === "official") {
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = "#DFD5C2";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, height, 14);
    ctx.stroke();

    ctx.font = font(600, 22, FONT_NASKH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#671426";
    let textY = y + 36;
    for (const line of lines) {
      ctx.fillText(line, x + width / 2, textY);
      textY += 34;
    }
    ctx.restore();
    return;
  }

  if (design === "modern") {
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, width, height, 10);
    ctx.fill();
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, height, 10);
    ctx.stroke();

    ctx.font = font(700, 21, FONT_TAJAWAL);
    ctx.textAlign = "center";
    ctx.fillStyle = "#0F172A";
    let textY = y + 34;
    for (const line of lines) {
      ctx.fillText(line, x + width / 2, textY);
      textY += 32;
    }
    ctx.restore();
    return;
  }

  // Cards
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 16);
  ctx.stroke();

  ctx.font = font(700, 21, FONT_PLEX);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0F172A";
  let textY = y + 36;
  for (const line of lines) {
    ctx.fillText(line, x + width / 2, textY);
    textY += 32;
  }
  ctx.restore();
}

// Draw the container and header ribbon for a card
function drawCardSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  accentColor: string,
  design: CondolenceDesignId,
) {
  if (design === "official") {
    // Luxury White Card with Gold top-accent
    ctx.save();
    ctx.shadowColor = "rgba(40, 30, 20, 0.05)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "#E2D9C8";
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y, width, height, 14);
    ctx.stroke();

    // Top Gold Accent Line
    ctx.fillStyle = "#B38E46";
    ctx.fillRect(x + 24, y, width - 48, 3.5);

    // Title
    ctx.save();
    ctx.font = font(700, 21, FONT_NASKH);
    ctx.fillStyle = accentColor || "#671426";
    ctx.fillText(`◆  ${title}`, x + width - 24, y + 36);
    ctx.restore();
    return;
  }

  if (design === "modern") {
    // Sharp Flat White Card with crisp 1px border
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, height, 10);
    ctx.stroke();

    // Small Clean Title
    ctx.save();
    ctx.font = font(800, 20, FONT_TAJAWAL);
    ctx.fillStyle = accentColor;
    ctx.fillText(title, x + width - 22, y + 36);

    // Thin divider line under title
    ctx.strokeStyle = "#F1F5F9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 46);
    ctx.lineTo(x + width - 20, y + 46);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // "cards" - Premium Info-Cards with top colored header ribbon
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.06)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 16);
  ctx.stroke();

  // Top Colored Ribbon
  const ribbonH = 42;
  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + width - 16, y);
  ctx.arcTo(x + width, y, x + width, y + 16, 16);
  ctx.lineTo(x + width, y + ribbonH);
  ctx.lineTo(x, y + ribbonH);
  ctx.lineTo(x, y + 16);
  ctx.arcTo(x, y, x + 16, y, 16);
  ctx.closePath();
  ctx.fill();

  ctx.font = font(700, 18, FONT_PLEX);
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(title, x + width - 20, y + 27);
  ctx.restore();
}

// Draw a Real, High-Contrast Scannable QR Box
function drawQrBox(
  ctx: CanvasRenderingContext2D,
  qr: QrImage,
  qrLabel: string | undefined,
  x: number,
  y: number,
  size: number,
  design: CondolenceDesignId,
) {
  const quietZone = 8;
  const boxW = size + quietZone * 2;
  const boxH = size + quietZone * 2 + (qrLabel ? 26 : 0);

  ctx.save();
  // White high-contrast background with crisp quiet zone
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, boxW, boxH, 8);
  ctx.fill();

  // Subtle border matching design
  ctx.strokeStyle = design === "official" ? "#C5A869" : design === "modern" ? "#E5E7EB" : "#CBD5E1";
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, boxW, boxH, 8);
  ctx.stroke();

  // Draw the real QR Code Image (Black on White)
  ctx.drawImage(qr.image, x + quietZone, y + quietZone, size, size);

  // Label below QR
  if (qrLabel) {
    ctx.font = font(700, 13, design === "official" ? FONT_NASKH : FONT_PLEX);
    ctx.textAlign = "center";
    ctx.fillStyle = design === "official" ? "#671426" : design === "modern" ? "#1F2937" : "#1E293B";
    ctx.fillText(qrLabel, x + boxW / 2, y + boxH - 8);
  }
  ctx.restore();
}
