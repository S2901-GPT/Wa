// تصدير الصورة: إنستقرام وسناب يعيدان ترميز كل صورة إلى JPEG، ومن ملف PNG يكون تحويلهما أقسى.
// جودة ٩٥ بلا فرق تراه العين (PSNR ≈ 50) وبربع حجم PNG. يستخدمه الاستوديو وصفحة التجربة معاً.
import type { NaskhLayoutId, NaskhPosterSizeId } from "@/lib/naskh-poster-plan";

export const EXPORT_IMAGE = { type: "image/jpeg", quality: 0.95, ext: "jpg" } as const;

export const posterFileName = (requestNumber: string, layout: NaskhLayoutId, size: NaskhPosterSizeId) =>
  `${requestNumber}-${layout}-${size}.${EXPORT_IMAGE.ext}`;

/** هل يستطيع هذا المتصفح مشاركة ملف صورة (ورقة المشاركة على الجوال)؟ `canShare` تتطلب ملفاً فعلياً فنفحص بملف وهمي. */
export function canShareImageFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
  try {
    return navigator.canShare({ files: [new File([new Blob([""], { type: EXPORT_IMAGE.type })], `a.${EXPORT_IMAGE.ext}`, { type: EXPORT_IMAGE.type })] });
  } catch {
    return false;
  }
}

/** ملف JPEG من لوحة المعاينة، أو null إن لم تكن جاهزة. */
export const canvasToPosterFile = (canvas: HTMLCanvasElement | null, name: string): Promise<File | null> =>
  new Promise((resolve) => {
    if (!canvas) return resolve(null);
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: EXPORT_IMAGE.type }) : null), EXPORT_IMAGE.type, EXPORT_IMAGE.quality);
  });

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
