// محرك رسم صورة التعزية على Canvas بخط النسخ: يحمّل الأصول (الخلفية، مخطوطة «إنا لله»، الشعار)،
// ويقيس النص، ويستدعي المخطّط النقي (naskh-poster-plan.ts) بالتخطيط المختار، ثم يرسم العناصر.
import bgPostUrl from "../assets/poster/bg-1350.jpg";
import bgStoryUrl from "../assets/poster/bg-1920.jpg";
import openingCalligraphyUrl from "../assets/poster/opening-calligraphy.png";
import defaultLogoUrl from "../assets/poster/logo-default.png";
import type { NormalizedContent } from "./presentation-normalizer";
import { normalizeArabic } from "./presentation-normalizer";
import type { QrCodeMap } from "./qr-images";
import { trimTransparent } from "./logo-image";
import { DEFAULT_OPENING, NASKH_COLORS, NASKH_METRICS, naskhPosterSize, naskhTypeScale, planNaskhLayout, toArabicIndicDigits, type MeasureFn, type NaskhLayoutId, type NaskhPlan, type NaskhPosterSizeId, type NaskhQrKey, type NaskhTypeScaleId, type PlanItem } from "./naskh-poster-plan";

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

export type PosterOptions = { layout: NaskhLayoutId; typeScale?: NaskhTypeScaleId; size?: NaskhPosterSizeId; branding?: PosterBranding };

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
  /** نقش الخلفية بمقاس المنشور 1080 × 1350 بالضبط. */
  background: HTMLImageElement | null;
  /** النقش نفسه بمقاس الستوري 1080 × 1920 بالضبط (يُقصّ من أسفله لأي طول أقل). */
  backgroundTall: HTMLImageElement | null;
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
    // لا تُسلَّم الصورة إلا بعد فك ترميزها: Safari على iOS يرسم الصورة التي وصلت ولم تُفكّ بعد فارغة،
    // فكان النقش ومخطوطة «إنا لله» يختفيان في أول رسم ويظهران بعد تغيير التخطيط.
    image.onload = () => {
      if (typeof image.decode === "function") image.decode().then(() => resolve(image), () => resolve(image));
      else resolve(image);
    };
    image.onerror = () => {
      // فشل لحظي (شبكة الجوال مثلاً) لا يُخزَّن: وإلا بقيت كل الصور بلا نقش حتى تُعاد الصفحة
      imageCache.delete(src);
      resolve(null);
    };
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

export async function loadNaskhAssets(branding: PosterBranding | null | undefined): Promise<NaskhAssets> {
  const resolved = resolveNaskhBranding(branding);
  const customLogo = resolved.logoDataUrl && resolved.logoDataUrl.startsWith("data:image/") ? resolved.logoDataUrl : "";
  const [background, backgroundTall, opening, uploaded] = await Promise.all([
    loadImageOnce(bgPostUrl),
    loadImageOnce(bgStoryUrl),
    loadImageOnce(openingCalligraphyUrl),
    customLogo ? loadImageOnce(customLogo) : Promise.resolve(null),
  ]);
  // الشعار المدمج عند عدم الرفع أو تعذّر قراءة المرفوع، فلا تخرج صورة بلا شعار
  const logo = uploaded ?? (await loadImageOnce(DEFAULT_LOGO_URL));
  return { background, backgroundTall, opening, logo: logo ? trimmedLogo(logo) : null };
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

/** النقش بمقاس الصورة بالضبط بلا تكبير ولا قصّ للحواف: منشور 1350 له صورته، وما سواه يُرسم من أعلى صورة الستوري. */
function drawBackground(ctx: CanvasRenderingContext2D, assets: NaskhAssets, width: number, height: number) {
  const exact = height === assets.background?.naturalHeight && width === assets.background?.naturalWidth ? assets.background : null;
  const image = exact ?? assets.backgroundTall ?? assets.background;
  if (!image) return;
  ctx.drawImage(image, 0, 0, Math.min(width, image.naturalWidth), Math.min(height, image.naturalHeight), 0, 0, Math.min(width, image.naturalWidth), Math.min(height, image.naturalHeight));
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
  // سطر فيه حروف لاتينية أو أرقام داخل العربي (مثل «عمارة M-4») يرسمه Safari بعرض يخالف measureText فيبرز عن الهامش؛
  // يُرسم أولاً على لوحة جانبية ثم يُثبَّت على حافة حبره الفعلية.
  if (item.runs.some((run) => /[A-Za-z0-9]/u.test(run.text))) {
    drawLineByInk(ctx, item);
    return;
  }
  drawRuns(ctx, item, item.xRight, item.y);
}

function drawRuns(ctx: CanvasRenderingContext2D, item: Extract<PlanItem, { kind: "line" }>, xRight: number, y: number) {
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  const midY = y + item.h / 2;
  ctx.textAlign = "right";
  let x = xRight;
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

let inkCanvas: HTMLCanvasElement | null = null;

/** يرسم السطر على لوحة شفافة، يقيس أقصى يمين حبره، ثم ينقله بحيث تقع تلك الحافة على xRight بالضبط. */
function drawLineByInk(ctx: CanvasRenderingContext2D, item: Extract<PlanItem, { kind: "line" }>) {
  const pad = Math.ceil(item.px);
  const width = ctx.canvas.width;
  const height = Math.ceil(item.h) + pad * 2;
  inkCanvas ??= document.createElement("canvas");
  if (inkCanvas.width !== width) inkCanvas.width = width;
  if (inkCanvas.height !== height) inkCanvas.height = height;
  const side = inkCanvas.getContext("2d");
  if (!side) {
    drawRuns(ctx, item, item.xRight, item.y);
    return;
  }
  side.clearRect(0, 0, width, height);
  // يُرسم بعيداً عن الحافة اليمنى حتى لا يُقصّ ما يبرز
  const drawnRight = width - pad;
  drawRuns(side, item, drawnRight, pad);
  const data = side.getImageData(0, 0, width, height).data;
  let inkRight = -1;
  for (let x = width - 1; x >= 0 && inkRight < 0; x -= 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        inkRight = x;
        break;
      }
    }
  }
  if (inkRight < 0) return;
  // الحافة الفعلية على xRight (+1 لأن inkRight آخر عمود مرسوم)
  const dx = item.xRight - (inkRight + 1);
  ctx.drawImage(inkCanvas, 0, 0, width, height, dx, item.y - pad, width, height);
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
  drawBackground(ctx, assets, plan.width, plan.height);

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
      case "badge": {
        // شريط مائل في الزاوية العليا اليسرى: يُرى فوراً ولا يزاحم النص
        const { ribbonThickness: thickness, ribbonOffset: offset } = NASKH_METRICS;
        const reach = offset * Math.SQRT2 * 2 + thickness * 2;
        ctx.save();
        ctx.translate(offset, offset);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = NASKH_COLORS.ink;
        ctx.fillRect(-reach / 2, -thickness / 2, reach, thickness);
        ctx.font = fontString(700, item.px);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = "rtl";
        ctx.fillText(toArabicIndicDigits(item.text), 0, 0);
        ctx.restore();
        break;
      }
      case "separator":
        ctx.fillStyle = NASKH_COLORS.rule;
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
  // المقاس الثابت يُلزم الطول من الطرفين؛ والتلقائي يبدأ من أدناه ويطول حتى حد الإعدادات.
  const size = naskhPosterSize(options.size);
  const fixedHeight = size.minHeight === size.maxHeight;
  const maxHeight = fixedHeight ? size.maxHeight : Math.max(size.minHeight, branding.maxHeight);
  const plan = planNaskhLayout(content, measure, { layout: options.layout, typeScale: options.typeScale, openingIsImage, qrAvailable, minHeight: size.minHeight, maxHeight, logo: !!assets.logo });

  canvas.height = plan.height;
  drawNaskhPlan(ctx, plan, assets, qrImages);

  const issues: ValidationIssue[] = [];
  // فيض بضعة بكسلات لا يُرى في الصورة، فلا يُعرض كخطأ
  if (plan.overflow && plan.overflowBy > NASKH_METRICS.overflowTolerance) {
    issues.push({
      severity: "error",
      code: "naskh-overflow",
      // المقاس الثابت لا يطول، فالمخرج هو مقاس آخر؛ والتلقائي بلغ حده فالمخرج هو اختصار النص
      message: fixedHeight
        ? `هذا الإعلان أطول من مقاس «${size.name}»؛ جرّب «ستوري سناب وإنستغرام» (الأطول) أو اختصر النص.`
        : "المحتوى أطول من الحد الأقصى لطول الصورة؛ اختصر النص أو جرّب تخطيطاً آخر.",
    });
  }
  // صورة بلا نقش تبدو مختلفة عن بقية الصور، فيُنبَّه المسؤول بوضوح قبل أن يصدّرها
  if (!assets.background && !assets.backgroundTall) issues.push({ severity: "error", code: "naskh-background-missing", message: "تعذر تحميل نقش الخلفية، فستخرج الصورة بلا نقش. أعد فتح الاستوديو أو حدّث الصفحة قبل التصدير." });
  if (!assets.opening) issues.push({ severity: "warning", code: "naskh-opening-missing", message: "تعذر تحميل مخطوطة «إنا لله»، فكُتبت نصاً." });
  const report: RenderValidationReport = {
    isValid: !plan.overflow,
    isCompactMode: plan.scale < 1 || plan.namePx < naskhTypeScale(plan.typeScale).namePx || plan.height > NASKH_METRICS.minHeight,
    totalUsedHeight: plan.height,
    maxAllowedHeight: maxHeight,
    issues,
  };
  if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __naskhPlan?: NaskhPlan }).__naskhPlan = plan;
  return { canvas, report, plan };
}
