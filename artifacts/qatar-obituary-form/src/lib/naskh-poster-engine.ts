// محرك رسم صورة التعزية على Canvas بخط النسخ: يحمّل الأصول (الخلفية، مخطوطة «إنا لله»، الشعار)،
// ويقيس النص، ويستدعي المخطّط النقي (naskh-poster-plan.ts) بالتخطيط المختار، ثم يرسم العناصر.
import bgPatternUrl from "../assets/poster/bg-pattern.jpg";
import openingCalligraphyUrl from "../assets/poster/opening-calligraphy.png";
import type { NormalizedContent } from "./presentation-normalizer";
import { normalizeArabic } from "./presentation-normalizer";
import type { QrCodeMap } from "./qr-images";
import { DEFAULT_OPENING, NASKH_COLORS, NASKH_METRICS, planNaskhLayout, toArabicIndicDigits, type MeasureFn, type NaskhLayoutId, type NaskhPlan, type NaskhQrKey, type PlanItem } from "./naskh-poster-plan";

export const IMAGE_WIDTH: number = NASKH_METRICS.width;
export const IMAGE_HEIGHT: number = NASKH_METRICS.minHeight;
export const NASKH_FONT_FAMILY = '"Noto Naskh Arabic", "Noto Naskh Arabic UI", serif';
const NASKH_FONT_SAMPLE = "إنا لله وإنا إليه راجعون توفي الوالد 0123456789";

/** خطوط Google مقسّمة بنطاقات Unicode، فيلزم نص عربي حتى يُحمَّل النطاق العربي قبل القياس على Canvas. */
export async function loadCondolenceFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.allSettled([
    document.fonts.load('400 36px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
    document.fonts.load('700 36px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
    document.fonts.load('700 62px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
  ]);
  await document.fonts.ready;
}

export type SocialNetwork = "instagram" | "snapchat" | "x";

/** هوية الإعلان: الشعار يميناً وحسابات التواصل يساراً، والحد الأقصى لطول الصورة. */
export type PosterBranding = {
  /** صورة الشعار كـ data URL، أو فارغ فلا يُرسم شيء مكانه. */
  logoDataUrl?: string;
  handle?: string;
  socials?: SocialNetwork[];
  /** الصورة تبدأ 1350 وتطول عند الحاجة حتى هذا الحد (1350–1800). */
  maxHeight?: number;
};

export type PosterOptions = { layout: NaskhLayoutId; branding?: PosterBranding };

export type ValidationIssue = { severity: "error" | "warning"; code: string; message: string };
export type RenderValidationReport = {
  isValid: boolean;
  isCompactMode: boolean;
  totalUsedHeight: number;
  maxAllowedHeight: number;
  issues: ValidationIssue[];
};

export const DEFAULT_NASKH_BRANDING: Required<Pick<PosterBranding, "handle" | "socials" | "maxHeight">> = {
  handle: "qatarde",
  socials: ["instagram", "snapchat", "x"],
  maxHeight: NASKH_METRICS.maxHeight,
};

/** إعدادات الهوية مع القيم الافتراضية. */
export function resolveNaskhBranding(branding: PosterBranding | null | undefined): PosterBranding & typeof DEFAULT_NASKH_BRANDING {
  const given = branding ?? {};
  const maxHeight = Number(given.maxHeight) || DEFAULT_NASKH_BRANDING.maxHeight;
  return {
    ...DEFAULT_NASKH_BRANDING,
    ...given,
    handle: (given.handle ?? DEFAULT_NASKH_BRANDING.handle).trim(),
    socials: given.socials ?? DEFAULT_NASKH_BRANDING.socials,
    maxHeight: Math.min(NASKH_METRICS.maxHeight, Math.max(NASKH_METRICS.minHeight, maxHeight)),
  };
}

export type NaskhAssets = {
  background: HTMLImageElement | null;
  opening: HTMLImageElement | null;
  logo: HTMLImageElement | null;
};

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

/** يحمّل صورة مرة واحدة ويعيد null عند الفشل بدل رمي خطأ، حتى لا تتوقف الصورة كلها بسبب أصل مفقود. */
export function loadImageOnce(src: string): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined" || !src) return Promise.resolve(null);
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
    if (typeof image.decode === "function") {
      image.decode().then(() => resolve(image)).catch(() => {
        /* onload/onerror يحسمان النتيجة */
      });
    }
  });
  imageCache.set(src, promise);
  return promise;
}

export async function loadNaskhAssets(branding: PosterBranding | null | undefined): Promise<NaskhAssets> {
  const resolved = resolveNaskhBranding(branding);
  const logoSrc = resolved.logoDataUrl && resolved.logoDataUrl.startsWith("data:image/") ? resolved.logoDataUrl : "";
  const [background, opening, logo] = await Promise.all([
    loadImageOnce(bgPatternUrl),
    loadImageOnce(openingCalligraphyUrl),
    logoSrc ? loadImageOnce(logoSrc) : Promise.resolve(null),
  ]);
  return { background, opening, logo };
}

const SOCIAL_ICON_PATHS: Record<SocialNetwork, string[]> = {
  instagram: [
    "M8.5 3.5h7a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5z",
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  ],
  snapchat: [
    "M12 3.4c3 0 5 2.2 5 5.1v2.3l1.7-.4c.6-.1 1 .6.5 1l-1.9 1.3c.7 1.8 2 3 3.6 3.5-.4.9-1.6 1.2-2.7 1.4-.2.6-.3 1.1-.5 1.4-1-.2-2.2-.1-3.2.6-.8.5-1.6.9-2.5.9s-1.7-.4-2.5-.9c-1-.7-2.2-.8-3.2-.6-.2-.3-.3-.8-.5-1.4-1.1-.2-2.3-.5-2.7-1.4 1.6-.5 2.9-1.7 3.6-3.5L4.8 11.4c-.5-.4-.1-1.1.5-1l1.7.4V8.5c0-2.9 2-5.1 5-5.1z",
  ],
  x: ["M4 4h4.6l11.4 16h-4.6z", "M19.6 4 13.4 11M10.6 13 4.4 20"],
};

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function fontString(weight: 400 | 700, px: number): string {
  return `${weight} ${px}px ${NASKH_FONT_FAMILY}`;
}

function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

function drawSocialIcon(ctx: CanvasRenderingContext2D, network: SocialNetwork, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = NASKH_COLORS.text;
  ctx.fillStyle = NASKH_COLORS.text;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of SOCIAL_ICON_PATHS[network]) ctx.stroke(new Path2D(d));
  if (network === "instagram") {
    ctx.beginPath();
    ctx.arc(17.2, 6.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** المخطّط يحسب الحافة اليمنى للسطر (موسّطاً أو من اليمين)، فالرسم دائماً من اليمين إلى اليسار من xRight. */
function drawLine(ctx: CanvasRenderingContext2D, item: Extract<PlanItem, { kind: "line" }>) {
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  const midY = item.y + item.h / 2;
  ctx.textAlign = "right";
  let x = item.xRight;
  item.runs.forEach((run, index) => {
    if (!run.text) return;
    const shown = toArabicIndicDigits(run.text);
    ctx.font = fontString(run.weight, item.px);
    ctx.fillStyle = run.color;
    if (index > 0) {
      // مسافة بين العنوان العريض والنص بحجم الخط العادي
      ctx.font = fontString(400, item.px);
      const space = ctx.measureText(" ").width;
      ctx.font = fontString(run.weight, item.px);
      x -= space;
    }
    ctx.fillText(shown, x, midY);
    x -= ctx.measureText(shown).width;
  });
}

/** الشريط: الشعار يميناً وحسابات التواصل يساراً؛ أسفل الصورة فوق خط رفيع، أو ترويسة أعلاها تتوسطها مخطوطة «إنا لله». */
function drawBand(ctx: CanvasRenderingContext2D, item: Extract<PlanItem, { kind: "band" }>, branding: ReturnType<typeof resolveNaskhBranding>, assets: NaskhAssets) {
  const inset = item.x;
  const width = item.x + item.width;
  if (item.position === "bottom") {
    ctx.fillStyle = NASKH_COLORS.line;
    ctx.fillRect(inset, item.y, item.width, 1);
  } else if (assets.opening) {
    const h = NASKH_METRICS.letterheadOpening;
    const drawW = assets.opening.naturalWidth * (h / assets.opening.naturalHeight);
    ctx.drawImage(assets.opening, (NASKH_METRICS.width - drawW) / 2, item.y + (item.h - h) / 2, drawW, h);
  }

  // الشعار يميناً (لا يُرسم مكان محجوز عند غيابه)
  const logoSize = 72;
  if (assets.logo) drawImageContain(ctx, assets.logo, width - logoSize, item.y + (item.h - logoSize) / 2, logoSize, logoSize);

  // حسابات التواصل يساراً: الأيقونات في صف واسم الحساب تحتها
  const socials = branding.socials.filter((network) => SOCIAL_ICON_PATHS[network]);
  const handle = branding.handle;
  if (!socials.length && !handle) return;
  const iconSize = 30;
  const iconGap = 14;
  const iconsW = socials.length ? socials.length * iconSize + (socials.length - 1) * iconGap : 0;
  ctx.font = fontString(700, 24);
  const handleW = handle ? ctx.measureText(handle).width : 0;
  const groupW = Math.max(iconsW, handleW);
  const handleH = handle ? 24 * 1.4 : 0;
  const groupH = (socials.length ? iconSize : 0) + (socials.length && handle ? 4 : 0) + handleH;
  const groupX = inset;
  let cursorY = item.y + (item.h - groupH) / 2;
  if (socials.length) {
    let iconX = groupX + (groupW - iconsW) / 2;
    for (const network of socials) {
      drawSocialIcon(ctx, network, iconX, cursorY, iconSize);
      iconX += iconSize + iconGap;
    }
    cursorY += iconSize + (handle ? 4 : 0);
  }
  if (handle) {
    ctx.font = fontString(700, 24);
    ctx.fillStyle = NASKH_COLORS.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    ctx.fillText(handle, groupX + groupW / 2, cursorY + handleH / 2);
  }
}

export function drawNaskhPlan(ctx: CanvasRenderingContext2D, plan: NaskhPlan, assets: NaskhAssets, qrImages: QrCodeMap, branding: ReturnType<typeof resolveNaskhBranding>) {
  ctx.fillStyle = NASKH_COLORS.background;
  ctx.fillRect(0, 0, plan.width, plan.height);
  if (assets.background) drawImageCover(ctx, assets.background, plan.width, plan.height);

  for (const item of plan.items) {
    switch (item.kind) {
      case "opening": {
        if (!item.text && assets.opening) {
          const drawW = assets.opening.naturalWidth * (item.h / assets.opening.naturalHeight);
          ctx.drawImage(assets.opening, (plan.width - drawW) / 2, item.y, drawW, item.h);
        } else {
          ctx.font = fontString(700, item.px);
          ctx.fillStyle = NASKH_COLORS.ink;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.direction = "rtl";
          ctx.fillText(item.text || DEFAULT_OPENING, plan.width / 2, item.y + item.h / 2);
        }
        break;
      }
      case "line":
        drawLine(ctx, item);
        break;
      case "separator":
        ctx.fillStyle = NASKH_COLORS.line;
        ctx.fillRect(item.x, item.y, item.width, 1);
        break;
      case "vline":
        ctx.fillStyle = NASKH_COLORS.line;
        ctx.fillRect(item.x, item.y, 1, item.h);
        break;
      case "frame":
        ctx.strokeStyle = NASKH_COLORS.frame;
        ctx.lineWidth = 1;
        ctx.strokeRect(item.x + 0.5, item.y + 0.5, item.width - 1, item.height - 1);
        break;
      case "qr": {
        const qr = qrImages[item.key];
        if (!qr) break;
        ctx.save();
        roundedRectPath(ctx, item.x, item.y, item.size, item.size, 10);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#D9D2C6";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        const pad = 6;
        ctx.drawImage(qr.image, item.x + pad, item.y + pad, item.size - pad * 2, item.size - pad * 2);
        break;
      }
      case "band":
        drawBand(ctx, item, branding, assets);
        break;
    }
  }
}

export type NaskhRenderResult = { canvas: HTMLCanvasElement; report: RenderValidationReport; plan: NaskhPlan };

/** يرسم الإعلان كاملاً بالتخطيط المختار ويعيد لوحة بارتفاع ديناميكي (1350 حتى الحد الأقصى). */
export function renderNaskhPoster(options: PosterOptions, content: NormalizedContent, qrImages: QrCodeMap, assets: NaskhAssets): NaskhRenderResult {
  const branding = resolveNaskhBranding(options.branding);
  const canvas = document.createElement("canvas");
  canvas.width = NASKH_METRICS.width;
  canvas.height = NASKH_METRICS.minHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // القياس بالأرقام المشرقية نفسها التي تُرسم، فتتطابق الأعراض.
  const measure: MeasureFn = (text, font) => {
    ctx.font = fontString(font.weight, font.px);
    return ctx.measureText(toArabicIndicDigits(text)).width;
  };
  const openingIsImage = !!assets.opening && normalizeArabic(content.opening) === normalizeArabic(DEFAULT_OPENING);
  // كل رمز توفرت صورته (الصلاة، الدفن، وكل موقع عزاء بمفتاحه)
  const qrAvailable: Partial<Record<NaskhQrKey, boolean>> = Object.fromEntries(Object.entries(qrImages).map(([key, image]) => [key, !!image]));
  const plan = planNaskhLayout(content, measure, { layout: options.layout, openingIsImage, qrAvailable, maxHeight: branding.maxHeight });

  canvas.height = plan.height;
  drawNaskhPlan(ctx, plan, assets, qrImages, branding);

  const issues: ValidationIssue[] = [];
  if (plan.overflow) issues.push({ severity: "error", code: "naskh-overflow", message: "المحتوى أطول من الحد الأقصى لطول الصورة؛ اختصر النص أو جرّب تخطيطاً آخر." });
  if (!assets.background) issues.push({ severity: "warning", code: "naskh-background-missing", message: "تعذر تحميل صورة الخلفية، فاستُخدم لون سادة." });
  if (!assets.opening) issues.push({ severity: "warning", code: "naskh-opening-missing", message: "تعذر تحميل مخطوطة «إنا لله»، فكُتبت نصاً." });
  const report: RenderValidationReport = {
    isValid: !plan.overflow,
    isCompactMode: plan.scale < 1 || plan.namePx < NASKH_METRICS.namePx || plan.height > NASKH_METRICS.minHeight,
    totalUsedHeight: plan.height,
    maxAllowedHeight: branding.maxHeight,
    issues,
  };
  if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __naskhPlan?: NaskhPlan }).__naskhPlan = plan;
  return { canvas, report, plan };
}
