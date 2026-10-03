// توليد صور رموز QR لروابط المواقع (الصلاة، الدفن، العزاء) لرسمها داخل صورة التعزية.
import QRCode from "qrcode";

export type QrCodeMap = Record<string, { dataUrl: string; image: HTMLImageElement }>;

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
    }),
  );

  const map: QrCodeMap = {};
  for (const r of results) {
    if (r.status === "fulfilled") map[r.value[0]] = r.value[1];
  }
  return map;
}
