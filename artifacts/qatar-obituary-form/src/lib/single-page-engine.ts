import {
  type CondolenceTemplate,
  type BlockConfig,
  type SmartBlockId,
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  loadCondolenceFonts,
} from "./template-schema";
import { type NormalizedContent } from "./presentation-normalizer";
import QRCode from "qrcode";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type RenderValidationReport = {
  isValid: boolean;
  isCompactMode: boolean;
  totalUsedHeight: number;
  maxAllowedHeight: number;
  issues: ValidationIssue[];
};

export type QrCodeMap = Record<string, { dataUrl: string; image: HTMLImageElement }>;

// Helper to set RTL text rendering
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

export function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// Generate Real High-Contrast QR Images
export async function generateQrImages(urls: Record<string, string | undefined>): Promise<QrCodeMap> {
  const entries = Object.entries(urls).filter(([, url]) => !!url && (url.startsWith("http://") || url.startsWith("https://")));
  const results = await Promise.allSettled(
    entries.map(async ([key, url]) => {
      const dataUrl = await QRCode.toDataURL(url!, {
        width: 360,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      const image = new Image();
      image.src = dataUrl;
      if (typeof image.decode === "function") await image.decode();
      else await new Promise<void>((res, rej) => {
        image.onload = () => res();
        image.onerror = () => rej(new Error("QR load error"));
      });
      return [key, { dataUrl, image }] as const;
    })
  );

  const map: QrCodeMap = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      map[r.value[0]] = r.value[1];
    }
  }
  return map;
}

// Draw Background Frame based on template canvas settings
export function renderCanvasBackground(
  ctx: CanvasRenderingContext2D,
  template: CondolenceTemplate,
) {
  const { canvas } = template;

  if (canvas.backgroundGradient) {
    const grad = ctx.createLinearGradient(0, 0, 0, IMAGE_HEIGHT);
    grad.addColorStop(0, canvas.backgroundGradient.from);
    grad.addColorStop(1, canvas.backgroundGradient.to);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = canvas.backgroundColor || "#FFFFFF";
  }
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  // Outer Border
  if (canvas.outerBorder) {
    ctx.save();
    ctx.strokeStyle = canvas.outerBorder.color;
    ctx.lineWidth = canvas.outerBorder.width;
    const inset = canvas.outerBorder.inset;
    ctx.strokeRect(inset, inset, IMAGE_WIDTH - inset * 2, IMAGE_HEIGHT - inset * 2);
    ctx.restore();
  }

  // Inner Border
  if (canvas.innerBorder) {
    ctx.save();
    ctx.strokeStyle = canvas.innerBorder.color;
    ctx.lineWidth = canvas.innerBorder.width;
    const inset = canvas.innerBorder.inset;
    ctx.strokeRect(inset, inset, IMAGE_WIDTH - inset * 2, IMAGE_HEIGHT - inset * 2);
    ctx.restore();
  }

  // Corner Ornaments
  if (canvas.cornerDecorations) {
    ctx.save();
    const inset = canvas.outerBorder ? canvas.outerBorder.inset + 4 : 40;
    const corners = [
      [inset, inset],
      [IMAGE_WIDTH - inset, inset],
      [inset, IMAGE_HEIGHT - inset],
      [IMAGE_WIDTH - inset, IMAGE_HEIGHT - inset],
    ];
    ctx.fillStyle = canvas.innerBorder?.color || "#B38E46";
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }
    ctx.restore();
  }
}

// Measure and render a single block on canvas
export function drawBlockSurface(
  ctx: CanvasRenderingContext2D,
  config: BlockConfig,
  templateStyle: string,
) {
  const { x, y, width, height, borderRadius, backgroundColor, borderColor, borderWidth, opacity, accentColor, headerRibbonHeight } = config;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Background Fill
  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.fill();
  }

  // Border Stroke
  if (borderWidth > 0 && borderColor && borderColor !== "transparent") {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    roundRect(ctx, x, y, width, height, borderRadius);
    ctx.stroke();
  }

  // Header Ribbon for "cards" style
  if (headerRibbonHeight && headerRibbonHeight > 0) {
    ctx.save();
    ctx.fillStyle = accentColor || "#1E293B";
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + width - borderRadius, y);
    ctx.arcTo(x + width, y, x + width, y + borderRadius, borderRadius);
    ctx.lineTo(x + width, y + headerRibbonHeight);
    ctx.lineTo(x, y + headerRibbonHeight);
    ctx.lineTo(x, y + borderRadius);
    ctx.arcTo(x, y, x + borderRadius, y, borderRadius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Top Accent Line for "official" style
  if (templateStyle === "official" && config.backgroundColor === "#FFFFFF" && !headerRibbonHeight) {
    ctx.fillStyle = "#B38E46";
    ctx.fillRect(x + 24, y, width - 48, 3.5);
  }

  ctx.restore();
}

// Render QR Box inside card
export function drawBlockQr(
  ctx: CanvasRenderingContext2D,
  qr: { image: HTMLImageElement },
  label: string | undefined,
  x: number,
  y: number,
  size: number,
  accentColor: string,
) {
  const quietZone = 8;
  const boxW = size + quietZone * 2;
  const boxH = size + quietZone * 2 + (label ? 24 : 0);

  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, boxW, boxH, 8);
  ctx.fill();

  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, boxW, boxH, 8);
  ctx.stroke();

  ctx.drawImage(qr.image, x + quietZone, y + quietZone, size, size);

  if (label) {
    ctx.font = `700 12px "IBM Plex Sans Arabic", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = accentColor || "#0F172A";
    ctx.fillText(label, x + boxW / 2, y + boxH - 7);
  }
  ctx.restore();
}

// Smart Single-Page Layout Compiler & Renderer
export function compileAndRenderSinglePage(
  template: CondolenceTemplate,
  content: NormalizedContent,
  qrImages: QrCodeMap,
): {
  canvas: HTMLCanvasElement;
  report: RenderValidationReport;
  renderedBlocks: Array<BlockConfig & { calculatedHeight: number }>;
} {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  setRtl(ctx);

  const issues: ValidationIssue[] = [];

  // 1. Determine active blocks according to content availability & deduplication rules
  const activeBlockIds: SmartBlockId[] = [];

  activeBlockIds.push("header");
  activeBlockIds.push("opening");
  activeBlockIds.push("deceased");
  if (content.deceasedList.some((d) => d.details.length > 0)) activeBlockIds.push("details");

  if (content.hasCombinedPrayerBurial && content.prayerBurialCombined) {
    activeBlockIds.push("prayerBurialCombined");
  } else {
    if (content.prayer) activeBlockIds.push("prayer");
    if (content.burial) activeBlockIds.push("burial");
  }

  if (content.men) activeBlockIds.push("men");
  if (content.women) activeBlockIds.push("women");
  if (content.phoneContacts.length > 0) activeBlockIds.push("phone");
  if (content.relatives.length > 0) activeBlockIds.push("relatives");
  if (content.notes) activeBlockIds.push("notes");
  activeBlockIds.push("closing");

  // 2. Initial Height Measurement pass in Normal Mode
  const blocks = { ...template.blocks };
  const styleId = template.canvas.styleId;

  const measureBlock = (id: SmartBlockId, scaleFactor = 1.0, isCompact = false): number => {
    const config = blocks[id];
    if (!config) return 0;

    const padding = Math.max(12, Math.round(config.padding * (isCompact ? 0.75 : 1.0)));
    const fontSize = Math.max(config.minFontSize || 14, Math.round(config.fontSize * scaleFactor));
    const lineHeight = Math.max(fontSize + 6, Math.round(config.lineHeight * scaleFactor));

    ctx.font = `${config.fontWeight} ${fontSize}px "${config.fontFamily}", sans-serif`;

    switch (id) {
      case "header":
        return config.height;

      case "opening": {
        const lines = wrapTextLines(ctx, content.opening, config.width - 40);
        return Math.max(38, lines.length * (lineHeight + 4) + (isCompact ? 8 : 14));
      }

      case "deceased": {
        let linesCount = 0;
        for (const d of content.deceasedList) {
          linesCount += wrapTextLines(ctx, d.identity, config.width - 40).length;
        }
        return Math.max(50, linesCount * (lineHeight + 6) + (isCompact ? 8 : 14));
      }

      case "details": {
        const allDetails = content.deceasedList.flatMap((d) => d.details);
        if (!allDetails.length) return 0;
        const line = allDetails.join("   ·   ");
        const lines = wrapTextLines(ctx, line, config.width - 40);
        return lines.length * (lineHeight + 4) + (isCompact ? 6 : 10);
      }

      case "prayerBurialCombined": {
        const item = content.prayerBurialCombined!;
        const qr = item.qrUrl ? qrImages["prayerBurialCombined"] || qrImages["burial"] || qrImages["prayer"] : undefined;
        const qrSpace = qr ? 140 : 0;
        const textWidth = config.width - padding * 2 - qrSpace;
        const rows = [item.dayTime, item.place].filter(Boolean);
        let lines = 0;
        for (const r of rows) lines += wrapTextLines(ctx, r, textWidth).length;
        const textH = (config.headerRibbonHeight || 38) + lines * (lineHeight + 2) + padding;
        const qrH = qr ? (config.headerRibbonHeight || 38) + 114 + 20 : 0;
        return Math.max(textH, qrH, isCompact ? 115 : 135);
      }

      case "prayer": {
        const item = content.prayer!;
        const qr = item.qrUrl ? qrImages["prayer"] : undefined;
        const qrSpace = qr ? 126 : 0;
        const textWidth = config.width - padding * 2 - qrSpace;
        const rows = [item.day, item.time, item.place].filter(Boolean);
        let lines = 0;
        for (const r of rows as string[]) lines += wrapTextLines(ctx, r, textWidth).length;
        const textH = (config.headerRibbonHeight || 38) + lines * (lineHeight + 2) + padding;
        const qrH = qr ? (config.headerRibbonHeight || 38) + 104 + 18 : 0;
        return Math.max(textH, qrH, isCompact ? 135 : 155);
      }

      case "burial": {
        const item = content.burial!;
        const qr = item.qrUrl ? qrImages["burial"] : undefined;
        const qrSpace = qr ? 126 : 0;
        const textWidth = config.width - padding * 2 - qrSpace;
        const rows = [item.statusText, item.day, item.time, item.place].filter(Boolean);
        let lines = 0;
        for (const r of rows as string[]) lines += wrapTextLines(ctx, r, textWidth).length;
        const textH = (config.headerRibbonHeight || 38) + lines * (lineHeight + 2) + padding;
        const qrH = qr ? (config.headerRibbonHeight || 38) + 104 + 18 : 0;
        return Math.max(textH, qrH, isCompact ? 135 : 155);
      }

      case "men": {
        const item = content.men!;
        const qr = item.qrUrl ? qrImages["men"] : undefined;
        const qrSpace = qr ? 144 : 0;
        const textWidth = config.width - padding * 2 - qrSpace;
        const rows = [item.startAndDuration, item.time, item.location, item.address].filter(Boolean);
        let lines = 0;
        for (const r of rows as string[]) lines += wrapTextLines(ctx, r, textWidth).length;
        const textH = (config.headerRibbonHeight || 40) + lines * (lineHeight + 2) + padding;
        const qrH = qr ? (config.headerRibbonHeight || 40) + 114 + 20 : 0;
        return Math.max(textH, qrH, isCompact ? 140 : 160);
      }

      case "women": {
        const item = content.women!;
        const qr = item.qrUrl ? qrImages["women"] : undefined;
        const qrSpace = qr ? 144 : 0;
        const textWidth = config.width - padding * 2 - qrSpace;
        const rows = [item.startAndDuration, item.time, item.location, item.address].filter(Boolean);
        let lines = 0;
        for (const r of rows as string[]) lines += wrapTextLines(ctx, r, textWidth).length;
        const textH = (config.headerRibbonHeight || 40) + lines * (lineHeight + 2) + padding;
        const qrH = qr ? (config.headerRibbonHeight || 40) + 114 + 20 : 0;
        return Math.max(textH, qrH, isCompact ? 140 : 160);
      }

      case "phone": {
        const pairs = Math.ceil(content.phoneContacts.length / 2);
        return (config.headerRibbonHeight || 40) + pairs * (lineHeight + 6) + (isCompact ? 12 : 20);
      }

      case "relatives": {
        let totalLines = 0;
        for (const group of content.relatives) {
          const labelW = ctx.measureText(`${group.heading}: `).width;
          const firstLineW = config.width - padding * 2 - labelW - 6;
          const lines = wrapTextLines(ctx, group.membersText, firstLineW);
          totalLines += Math.max(1, lines.length);
        }
        return (config.headerRibbonHeight || 40) + totalLines * (lineHeight + 4) + (isCompact ? 14 : 22);
      }

      case "notes": {
        const lines = wrapTextLines(ctx, content.notes || "", config.width - padding * 2);
        return (config.headerRibbonHeight || 38) + lines.length * (lineHeight + 2) + (isCompact ? 10 : 18);
      }

      case "closing": {
        const lines = wrapTextLines(ctx, content.closing, config.width - 40);
        return lines.length * (lineHeight + 4) + (isCompact ? 16 : 24);
      }

      default:
        return config.height;
    }
  };

  // 3. Test Total Height in Normal Mode
  const MAX_CANVAS_CONTENT_HEIGHT = 1310;
  const START_TOP_Y = 56;
  let cardGap = template.layout.cardGap || 14;

  let totalHeight = START_TOP_Y;
  const blockHeights: Record<string, number> = {};

  // Check if prayer and burial are side-by-side or separate
  const isPrayerBurialPair = activeBlockIds.includes("prayer") && activeBlockIds.includes("burial");

  for (const id of activeBlockIds) {
    if (isPrayerBurialPair && id === "burial") continue; // calculated with prayer
    const h = measureBlock(id, 1.0, false);
    blockHeights[id] = h;
    totalHeight += h + cardGap;
  }

  // 4. Auto-Compact Mode Trigger if totalHeight exceeds 1310px
  let isCompact = totalHeight > MAX_CANVAS_CONTENT_HEIGHT;
  let fontScale = 1.0;

  if (isCompact) {
    cardGap = 10;
    fontScale = 0.92;
    totalHeight = START_TOP_Y;

    for (const id of activeBlockIds) {
      if (isPrayerBurialPair && id === "burial") continue;
      const h = measureBlock(id, fontScale, true);
      blockHeights[id] = h;
      totalHeight += h + cardGap;
    }

    // If still tight, gently scale font to 0.86 and cardGap to 8
    if (totalHeight > MAX_CANVAS_CONTENT_HEIGHT) {
      cardGap = 8;
      fontScale = 0.86;
      totalHeight = START_TOP_Y;
      for (const id of activeBlockIds) {
        if (isPrayerBurialPair && id === "burial") continue;
        const h = measureBlock(id, fontScale, true);
        blockHeights[id] = h;
        totalHeight += h + cardGap;
      }
    }
  }

  // 5. Layout Calculation (Y-coordinate stacking)
  let currentY = START_TOP_Y;
  const positionedBlocks: Array<BlockConfig & { calculatedHeight: number }> = [];

  for (const id of activeBlockIds) {
    const rawConfig = blocks[id];
    if (!rawConfig) continue;

    if (isPrayerBurialPair && (id === "prayer" || id === "burial")) {
      if (id === "prayer") {
        const prayerH = measureBlock("prayer", fontScale, isCompact);
        const burialH = measureBlock("burial", fontScale, isCompact);
        const pairH = Math.max(prayerH, burialH);

        const halfGap = 16;
        const pageMarginX = template.layout.pageMarginX || 56;
        const totalW = IMAGE_WIDTH - pageMarginX * 2;
        const halfW = (totalW - halfGap) / 2;

        const prayerBlock = {
          ...rawConfig,
          x: pageMarginX + halfW + halfGap,
          y: currentY,
          width: halfW,
          height: pairH,
          calculatedHeight: pairH,
        };
        const burialConfig = blocks["burial"]!;
        const burialBlock = {
          ...burialConfig,
          x: pageMarginX,
          y: currentY,
          width: halfW,
          height: pairH,
          calculatedHeight: pairH,
        };

        positionedBlocks.push(prayerBlock);
        positionedBlocks.push(burialBlock);
        currentY += pairH + cardGap;
      }
      continue;
    }

    const calcH = blockHeights[id] || rawConfig.height;
    const positionedBlock = {
      ...rawConfig,
      y: template.layout.autoArrange ? currentY : rawConfig.y,
      height: calcH,
      calculatedHeight: calcH,
    };
    positionedBlocks.push(positionedBlock);

    if (template.layout.autoArrange) {
      currentY += calcH + cardGap;
    }
  }

  // 6. Strict Validation Audit
  if (currentY > IMAGE_HEIGHT - 20) {
    issues.push({
      severity: "error",
      code: "CANVAS_OVERFLOW",
      message: `المحتوى يتجاوز حدود الصفحة الواحدة بـ ${Math.round(currentY - IMAGE_HEIGHT)} بكسل.`,
    });
  }

  // 7. Paint Elements to Canvas
  renderCanvasBackground(ctx, template);

  for (const block of positionedBlocks) {
    drawBlockSurface(ctx, block, styleId);

    const padding = Math.max(12, Math.round(block.padding * (isCompact ? 0.75 : 1.0)));
    const fontSize = Math.max(block.minFontSize || 14, Math.round(block.fontSize * fontScale));
    const lineHeight = Math.max(fontSize + 6, Math.round(block.lineHeight * fontScale));
    const ribbonH = block.headerRibbonHeight || 0;

    // A. Header text inside ribbon or title
    if (ribbonH > 0) {
      ctx.save();
      ctx.font = `700 ${Math.max(15, fontSize - 1)}px "${block.fontFamily}", sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(block.label, block.x + block.width - 20, block.y + Math.round(ribbonH / 2) + 6);
      ctx.restore();
    } else if (styleId === "official" && block.id !== "opening" && block.id !== "deceased" && block.id !== "details" && block.id !== "closing" && block.id !== "header") {
      ctx.save();
      ctx.font = `700 21px "Noto Naskh Arabic", serif`;
      ctx.fillStyle = block.accentColor || "#671426";
      ctx.textAlign = "right";
      ctx.fillText(`◆  ${block.label}`, block.x + block.width - 24, block.y + 36);
      ctx.restore();
    } else if (styleId === "modern" && block.id !== "opening" && block.id !== "deceased" && block.id !== "details" && block.id !== "closing" && block.id !== "header") {
      ctx.save();
      ctx.font = `800 20px "Tajawal", sans-serif`;
      ctx.fillStyle = block.accentColor || "#0F172A";
      ctx.textAlign = "right";
      ctx.fillText(block.label, block.x + block.width - 22, block.y + 34);

      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(block.x + 20, block.y + 44);
      ctx.lineTo(block.x + block.width - 20, block.y + 44);
      ctx.stroke();
      ctx.restore();
    }

    // B. Block Body Content
    const contentTopY = block.y + (ribbonH > 0 ? ribbonH + 26 : styleId === "official" && block.id !== "opening" && block.id !== "deceased" && block.id !== "details" && block.id !== "closing" ? 68 : styleId === "modern" && block.id !== "opening" && block.id !== "deceased" && block.id !== "details" && block.id !== "closing" ? 64 : 26);

    ctx.save();
    ctx.font = `${block.fontWeight} ${fontSize}px "${block.fontFamily}", sans-serif`;
    ctx.fillStyle = block.textColor || "#0F172A";
    ctx.textAlign = block.textAlign || "right";

    switch (block.id) {
      case "header": {
        if (styleId === "modern") {
          ctx.fillStyle = "#0F172A";
          ctx.fillRect(block.x + block.width - 64, block.y, 64, 4);
          ctx.font = `700 13px "IBM Plex Sans Arabic", sans-serif`;
          ctx.fillStyle = "#64748B";
          ctx.textAlign = "left";
          ctx.fillText("إعلان وفاة", block.x, block.y + 16);
        } else if (styleId === "cards") {
          ctx.font = `700 13px "IBM Plex Sans Arabic", sans-serif`;
          ctx.fillStyle = "#475569";
          ctx.textAlign = "center";
          ctx.fillText("دولة قطر · إعلان وفاة", IMAGE_WIDTH / 2, block.y + 14);
        }
        break;
      }

      case "opening": {
        ctx.font = `700 ${fontSize}px "${block.fontFamily}", sans-serif`;
        ctx.fillStyle = block.textColor;
        ctx.textAlign = block.textAlign;
        const textX = block.textAlign === "center" ? block.x + block.width / 2 : block.x + block.width;
        ctx.fillText(content.opening, textX, block.y + fontSize + 4);

        if (styleId === "official") {
          ctx.strokeStyle = "#B38E46";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(IMAGE_WIDTH / 2 - 120, block.y + fontSize + 16);
          ctx.lineTo(IMAGE_WIDTH / 2 + 120, block.y + fontSize + 16);
          ctx.stroke();
          ctx.fillStyle = "#B38E46";
          ctx.fillRect(IMAGE_WIDTH / 2 - 4, block.y + fontSize + 12, 8, 8);
        }
        break;
      }

      case "deceased": {
        ctx.font = `500 ${Math.max(16, fontSize - 20)}px "IBM Plex Sans Arabic", sans-serif`;
        ctx.fillStyle = styleId === "official" ? "#4A4644" : "#4B5563";
        ctx.textAlign = block.textAlign;
        const textX = block.textAlign === "center" ? block.x + block.width / 2 : block.x + block.width;
        ctx.fillText(content.statement, textX, block.y + 24);

        ctx.font = `${block.fontWeight} ${fontSize}px "${block.fontFamily}", sans-serif`;
        ctx.fillStyle = block.textColor;
        let lineY = block.y + 30 + fontSize;
        for (const d of content.deceasedList) {
          const lines = wrapTextLines(ctx, d.identity, block.width - 40);
          for (const line of lines) {
            ctx.fillText(line, textX, lineY);
            lineY += fontSize + 8;
          }
        }
        break;
      }

      case "details": {
        const allDetails = content.deceasedList.flatMap((d) => d.details);
        if (allDetails.length) {
          const line = allDetails.join("   ·   ");
          const textX = block.textAlign === "center" ? block.x + block.width / 2 : block.x + block.width;
          ctx.fillText(line, textX, block.y + fontSize);
        }
        break;
      }

      case "prayerBurialCombined": {
        const item = content.prayerBurialCombined!;
        const qr = item.qrUrl ? qrImages["prayerBurialCombined"] || qrImages["burial"] || qrImages["prayer"] : undefined;
        const qrSpace = qr ? 140 : 0;
        const textW = block.width - padding * 2 - qrSpace;
        const textX = block.x + block.width - padding;

        let curY = contentTopY;
        const rows = [item.dayTime, item.place].filter(Boolean);
        for (const row of rows) {
          const lines = wrapTextLines(ctx, row, textW);
          for (const l of lines) {
            ctx.fillText(l, textX, curY);
            curY += lineHeight;
          }
        }

        if (qr) {
          const qrX = block.x + padding;
          const qrY = block.y + (block.height - 114) / 2;
          drawBlockQr(ctx, qr, item.qrLabel || "الموقع", qrX, qrY, 114, block.accentColor);
        }
        break;
      }

      case "prayer": {
        const item = content.prayer!;
        const qr = item.qrUrl ? qrImages["prayer"] : undefined;
        const qrSpace = qr ? 126 : 0;
        const textW = block.width - padding * 2 - qrSpace;
        const textX = block.x + block.width - padding;

        let curY = contentTopY;
        const rows = [item.day, item.time, item.place].filter(Boolean) as string[];
        for (const row of rows) {
          const lines = wrapTextLines(ctx, row, textW);
          for (const l of lines) {
            ctx.fillText(l, textX, curY);
            curY += lineHeight;
          }
        }

        if (qr) {
          const qrX = block.x + padding;
          const qrY = block.y + (block.height - 104) / 2;
          drawBlockQr(ctx, qr, item.qrLabel || "موقع الصلاة", qrX, qrY, 104, block.accentColor);
        }
        break;
      }

      case "burial": {
        const item = content.burial!;
        const qr = item.qrUrl ? qrImages["burial"] : undefined;
        const qrSpace = qr ? 126 : 0;
        const textW = block.width - padding * 2 - qrSpace;
        const textX = block.x + block.width - padding;

        let curY = contentTopY;
        const rows = [item.statusText, item.day, item.time, item.place].filter(Boolean) as string[];
        for (const row of rows) {
          const lines = wrapTextLines(ctx, row, textW);
          for (const l of lines) {
            ctx.fillText(l, textX, curY);
            curY += lineHeight;
          }
        }

        if (qr) {
          const qrX = block.x + padding;
          const qrY = block.y + (block.height - 104) / 2;
          drawBlockQr(ctx, qr, item.qrLabel || "موقع الدفن", qrX, qrY, 104, block.accentColor);
        }
        break;
      }

      case "men": {
        const item = content.men!;
        const qr = item.qrUrl ? qrImages["men"] : undefined;
        const qrSpace = qr ? 144 : 0;
        const textW = block.width - padding * 2 - qrSpace;
        const textX = block.x + block.width - padding;

        let curY = contentTopY;
        const rows = [item.startAndDuration, item.time, item.location, item.address].filter(Boolean) as string[];
        for (const row of rows) {
          const lines = wrapTextLines(ctx, row, textW);
          for (const l of lines) {
            ctx.fillText(l, textX, curY);
            curY += lineHeight;
          }
        }

        if (qr) {
          const qrX = block.x + padding;
          const qrY = block.y + (block.height - 114) / 2;
          drawBlockQr(ctx, qr, item.qrLabel || "موقع المجلس", qrX, qrY, 114, block.accentColor);
        }
        break;
      }

      case "women": {
        const item = content.women!;
        const qr = item.qrUrl ? qrImages["women"] : undefined;
        const qrSpace = qr ? 144 : 0;
        const textW = block.width - padding * 2 - qrSpace;
        const textX = block.x + block.width - padding;

        let curY = contentTopY;
        const rows = [item.startAndDuration, item.time, item.location, item.address].filter(Boolean) as string[];
        for (const row of rows) {
          const lines = wrapTextLines(ctx, row, textW);
          for (const l of lines) {
            ctx.fillText(l, textX, curY);
            curY += lineHeight;
          }
        }

        if (qr) {
          const qrX = block.x + padding;
          const qrY = block.y + (block.height - 114) / 2;
          drawBlockQr(ctx, qr, item.qrLabel || "موقع العزاء", qrX, qrY, 114, block.accentColor);
        }
        break;
      }

      case "phone": {
        const textX = block.x + block.width - padding;
        let curY = contentTopY;
        const colWidth = (block.width - padding * 2 - 20) / 2;

        for (let i = 0; i < content.phoneContacts.length; i += 2) {
          const c1 = content.phoneContacts[i];
          const c2 = content.phoneContacts[i + 1];

          if (c1) {
            ctx.fillText(c1.formatted, textX, curY);
          }
          if (c2) {
            ctx.fillText(c2.formatted, textX - colWidth - 20, curY);
          }
          curY += lineHeight;
        }
        break;
      }

      case "relatives": {
        const textX = block.x + block.width - padding;
        let curY = contentTopY;

        for (const group of content.relatives) {
          ctx.font = `700 ${fontSize}px "${block.fontFamily}", sans-serif`;
          ctx.fillStyle = block.accentColor || "#0F172A";
          const label = `${group.heading}: `;
          const labelW = ctx.measureText(label).width;
          ctx.fillText(label, textX, curY);

          ctx.font = `${block.fontWeight} ${fontSize}px "${block.fontFamily}", sans-serif`;
          ctx.fillStyle = block.textColor;
          const firstLineW = block.width - padding * 2 - labelW - 6;
          const lines = wrapTextLines(ctx, group.membersText, firstLineW);

          if (lines.length > 0) {
            ctx.fillText(lines[0], textX - labelW, curY);
            for (let k = 1; k < lines.length; k++) {
              curY += lineHeight;
              ctx.fillText(lines[k], textX, curY);
            }
          }
          curY += lineHeight + 4;
        }
        break;
      }

      case "notes": {
        const textX = block.x + block.width - padding;
        let curY = contentTopY;
        const lines = wrapTextLines(ctx, content.notes || "", block.width - padding * 2);
        for (const l of lines) {
          ctx.fillText(l, textX, curY);
          curY += lineHeight;
        }
        break;
      }

      case "closing": {
        ctx.font = `600 ${fontSize}px "${block.fontFamily}", sans-serif`;
        ctx.textAlign = "center";
        let curY = block.y + Math.round((block.height - (lineHeight * wrapTextLines(ctx, content.closing, block.width - 40).length)) / 2) + fontSize;
        const lines = wrapTextLines(ctx, content.closing, block.width - 40);
        for (const l of lines) {
          ctx.fillText(l, block.x + block.width / 2, curY);
          curY += lineHeight;
        }
        break;
      }
    }

    ctx.restore();
  }

  const report: RenderValidationReport = {
    isValid: issues.filter((i) => i.severity === "error").length === 0,
    isCompactMode: isCompact,
    totalUsedHeight: Math.round(currentY),
    maxAllowedHeight: IMAGE_HEIGHT,
    issues,
  };

  return { canvas, report, renderedBlocks: positionedBlocks };
}
