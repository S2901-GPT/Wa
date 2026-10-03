// تجهيز ملف الشعار المرفوع: تصغيره إلى 256 بكسل كحد أقصى وتحويله PNG بخلفية شفافة، حتى تبقى الإعدادات صغيرة.
export const LOGO_MAX_SIDE = 256;
/** الحد الأقصى لطول نص الشعار المشفّر (data URL)، ويوافق حد الخادم فيما يُقبل. */
export const LOGO_MAX_LENGTH = 200 * 1024;

export class LogoError extends Error {
  constructor(readonly reason: "decode" | "too-large") {
    super(reason);
  }
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
    const width = image.naturalWidth || LOGO_MAX_SIDE;
    const height = image.naturalHeight || LOGO_MAX_SIDE;
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new LogoError("decode");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > LOGO_MAX_LENGTH) throw new LogoError("too-large");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}
