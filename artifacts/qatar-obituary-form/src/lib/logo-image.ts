// تجهيز ملف الشعار المرفوع: قصّ الفراغ الشفاف حوله، ثم تصغيره إلى 512 بكسل كحد أقصى (أو أقل إن كبر الملف)
// وتحويله PNG بخلفية شفافة، حتى يظهر كبيراً واضحاً في تذييل الصورة وتبقى الإعدادات صغيرة.
export const LOGO_MAX_SIDE = 512;
const LOGO_SIDES = [LOGO_MAX_SIDE, 384, 256];
/** أقصى ضلع تُفحص عنده الحواف الشفافة قبل التصغير النهائي (الصور الكبيرة جداً تُصغَّر أولاً). */
const SCAN_MAX_SIDE = 1024;
/** الحد الأقصى لطول نص الشعار المشفّر (data URL)، ويوافق حد الخادم فيما يُقبل. */
export const LOGO_MAX_LENGTH = 200 * 1024;

export class LogoError extends Error {
  constructor(readonly reason: "decode" | "too-large") {
    super(reason);
  }
}

export type Bounds = { x: number; y: number; width: number; height: number };

/** حدود الجزء المرئي من بكسلات RGBA (شفافيته فوق الحد)، أو null إن كانت الصورة كلها شفافة. */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold = 8): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function imageSize(image: HTMLImageElement | HTMLCanvasElement): { width: number; height: number } {
  return image instanceof HTMLImageElement ? { width: image.naturalWidth, height: image.naturalHeight } : { width: image.width, height: image.height };
}

/**
 * نسخة من الصورة بلا حواف شفافة، مصغّرة إلى maxSide عند الحاجة. الشعار كثيراً ما يأتي في مربع واسع حول الخط،
 * فيصغر في الصورة بلا سبب. تعيد الصورة كما هي إن لم يكن حولها فراغ (أو تعذّرت قراءة بكسلاتها).
 */
export function trimTransparent(image: HTMLImageElement | HTMLCanvasElement, maxSide = SCAN_MAX_SIDE): HTMLImageElement | HTMLCanvasElement {
  const { width, height } = imageSize(image);
  if (!width || !height) return image;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  let bounds: Bounds | null;
  try {
    bounds = alphaBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } catch {
    return image;
  }
  if (!bounds) return image;
  if (scale === 1 && bounds.width === canvas.width && bounds.height === canvas.height) return image;
  const trimmed = document.createElement("canvas");
  trimmed.width = bounds.width;
  trimmed.height = bounds.height;
  trimmed.getContext("2d")?.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  return trimmed;
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new LogoError("decode"));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new LogoError("decode");
    const source = trimTransparent(image);
    const { width, height } = imageSize(source);
    // أكبر حجم يبقى ضمن حد الخادم؛ الشعارات المعقدة (صور فوتوغرافية) تنزل إلى 384 ثم 256
    for (const side of LOGO_SIDES) {
      const scale = Math.min(1, side / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new LogoError("decode");
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/png");
      if (dataUrl.length <= LOGO_MAX_LENGTH) return dataUrl;
    }
    throw new LogoError("too-large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
