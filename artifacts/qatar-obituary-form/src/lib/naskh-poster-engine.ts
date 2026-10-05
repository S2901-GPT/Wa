// محرك رسم صورة التعزية على Canvas بخط النسخ: يحمّل الأصول (الخلفية، مخطوطة «إنا لله»، الشعار)،
// ويقيس النص، ويستدعي المخطّط النقي (naskh-poster-plan.ts) بالتخطيط المختار، ثم يرسم العناصر.
import bgPatternUrl from "../assets/poster/bg-pattern.jpg";
import openingCalligraphyUrl from "../assets/poster/opening-calligraphy.png";
import defaultLogoUrl from "../assets/poster/logo-default.png";
import type { NormalizedContent } from "./presentation-normalizer";
import { normalizeArabic } from "./presentation-normalizer";
import type { QrCodeMap } from "./qr-images";
import { trimTransparent } from "./logo-image";
import { DEFAULT_OPENING, NASKH_COLORS, NASKH_METRICS, naskhTypeScale, planNaskhLayout, toArabicIndicDigits, type MeasureFn, type NaskhLayoutId, type NaskhPlan, type NaskhQrKey, type NaskhTypeScaleId, type PlanItem } from "./naskh-poster-plan";

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

/** شعار «وفيات قطر» المدمج: يظهر في كل صورة ما لم يرفع المسؤول شعاراً آخر من «الإعدادات». */
export const DEFAULT_LOGO_URL: string = defaultLogoUrl;

/** هوية الإعلان: الشعار كبيراً في وسط أسفل الصورة، والحد الأقصى لطول الصورة. */
export type PosterBranding = {
  /** صورة الشعار المرفوع كـ data URL، أو فارغ فيُستخدم الشعار المدمج. */
  logoDataUrl?: string;
  /** الصورة تبدأ 1350 وتطول عند الحاجة حتى هذا الحد (1350–1800). */
  maxHeight?: number;
};

export type PosterOptions = { layout: NaskhLayoutId; typeScale?: NaskhTypeScaleId; branding?: PosterBranding };

export type ValidationIssue = { severity: "error" | "warning"; code: string; message: string };
export type RenderValidationReport = {
  isValid: boolean;
  isCompactMode: boolean;
  totalUsedHeight: number;
  maxAllowedHeight: number;
  issues: ValidationIssue[];
};

export const DEFAULT_NASKH_BRANDING: Required<Pick<PosterBranding, "maxHeight">> = {
  maxHeight: NASKH_METRICS.maxHeight,
};

/** إعدادات الهوية مع القيم الافتراضية. */
export function resolveNaskhBranding(branding: PosterBranding | null | undefined): PosterBranding & typeof DEFAULT_NASKH_BRANDING {
  const given = branding ?? {};
  const maxHeight = Number(given.maxHeight) || DEFAULT_NASKH_BRANDING.maxHeight;
  return {
    ...DEFAULT_NASKH_BRANDING,
    ...given,
    maxHeight: Math.min(NASKH_METRICS.maxHeight, Math.max(NASKH_METRICS.minHeight, maxHeight)),
  };
}

export type NaskhAssets = {
  background: HTMLImageElement | null;
  opening: HTMLImageElement | null;
  /** الشعار بعد قصّ الفراغ الشفاف حوله. */
  logo: HTMLImageElement | HTMLCanvasElement | null;
};

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
const trimmedLogos = new WeakMap<HTMLImageElement, HTMLImageElement | HTMLCanvasElement>();

/** الشعار بلا فراغه الشفاف (مرة واحدة لكل صورة)، فيملأ مكانه في التذييل حتى لو رُفع قبل القصّ التلقائي. */
function trimmedLogo(image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  let trimmed = trimmedLogos.get(image);
  if (!trimmed) {
    trimmed = trimTransparent(image);
    trimmedLogos.set(image, trimmed);
  }
  return trimmed;
}

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
  const customLogo = resolved.logoDataUrl && resolved.logoDataUrl.startsWith("data:image/") ? resolved.logoDataUrl : "";
  const [background, opening, uploaded] = await Promise.all([
    loadImageOnce(bgPatternUrl),
    loadImageOnce(openingCalligraphyUrl),
    customLogo ? loadImageOnce(customLogo) : Promise.resolve(null),
  ]);
  // الشعار المدمج عند عدم الرفع أو تعذّر قراءة المرفوع، فلا تخرج صورة بلا شعار
  const logo = uploaded ?? (await loadImageOnce(DEFAULT_LOGO_URL));
  return { background, opening, logo: logo ? trimmedLogo(logo) : null };
}

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

function drawImageContain(ctx: CanvasRenderingContext2D, image: HTMLImageElement | HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const naturalW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const naturalH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const scale = Math.min(w / naturalW, h / naturalH);
  const drawW = naturalW * scale;
  const drawH = naturalH * scale;
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
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

/** تذييل الشعار أسفل الصورة: خط رفيع ثم الشعار كبيراً في الوسط؛ أو ترويسة أعلاها تتوسطها مخطوطة «إنا لله». */
function drawBand(ctx: CanvasRenderingContext2D, item: Extract<PlanItem, { kind: "band" }>, assets: NaskhAssets) {
  if (item.position === "top") {
    if (!assets.opening) return;
    const h = NASKH_METRICS.letterheadOpening;
    const drawW = assets.opening.naturalWidth * (h / assets.opening.naturalHeight);
    ctx.drawImage(assets.opening, (NASKH_METRICS.width - drawW) / 2, item.y + (item.h - h) / 2, drawW, h);
    return;
  }
  ctx.fillStyle = NASKH_COLORS.line;
  ctx.fillRect(item.x, item.y, item.width, 1);
  if (!assets.logo) return;
  // ارتفاع الشعار ما بقي من التذييل (يصغر عند الامتلاء)، والعرض الأقصى يصغر معه بالنسبة نفسها
  const logoH = item.h - NASKH_METRICS.footerPad;
  const boxW = Math.min(item.width, Math.round((NASKH_METRICS.footerLogoMaxWidth * logoH) / NASKH_METRICS.footerLogo));
  drawImageContain(ctx, assets.logo, (NASKH_METRICS.width - boxW) / 2, item.y + NASKH_METRICS.footerPad, boxW, logoH);
}

export function drawNaskhPlan(ctx: CanvasRenderingContext2D, plan: NaskhPlan, assets: NaskhAssets, qrImages: QrCodeMap) {
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
        drawBand(ctx, item, assets);
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
  const plan = planNaskhLayout(content, measure, { layout: options.layout, typeScale: options.typeScale, openingIsImage, qrAvailable, maxHeight: branding.maxHeight, logo: !!assets.logo });

  canvas.height = plan.height;
  drawNaskhPlan(ctx, plan, assets, qrImages);

  const issues: ValidationIssue[] = [];
  if (plan.overflow) issues.push({ severity: "error", code: "naskh-overflow", message: "المحتوى أطول من الحد الأقصى لطول الصورة؛ اختصر النص أو جرّب تخطيطاً آخر." });
  if (!assets.background) issues.push({ severity: "warning", code: "naskh-background-missing", message: "تعذر تحميل صورة الخلفية، فاستُخدم لون سادة." });
  if (!assets.opening) issues.push({ severity: "warning", code: "naskh-opening-missing", message: "تعذر تحميل مخطوطة «إنا لله»، فكُتبت نصاً." });
  const report: RenderValidationReport = {
    isValid: !plan.overflow,
    isCompactMode: plan.scale < 1 || plan.namePx < naskhTypeScale(plan.typeScale).namePx || plan.height > NASKH_METRICS.minHeight,
    totalUsedHeight: plan.height,
    maxAllowedHeight: branding.maxHeight,
    issues,
  };
  if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __naskhPlan?: NaskhPlan }).__naskhPlan = plan;
  return { canvas, report, plan };
}
