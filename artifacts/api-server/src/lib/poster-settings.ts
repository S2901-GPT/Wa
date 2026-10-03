// تنظيف إعدادات هوية صورة التعزية (الشعار، اسم الحساب، أيقونات التواصل، الطول الأقصى) قبل حفظها وعند قراءتها.
// المخزَّن قد يكون إعدادات حديثة، أو «branding» قديماً محفوظاً داخل مستند قالب النسخ بالمفاتيح نفسها، فتُنظَّف الحالتان بالدالة نفسها.

export type SocialNetwork = "instagram" | "snapchat" | "x";
export type PosterSettings = { logoDataUrl: string; handle: string; socials: SocialNetwork[]; maxHeight: number };

export const SOCIAL_NETWORKS: readonly SocialNetwork[] = ["instagram", "snapchat", "x"];
export const DEFAULT_POSTER_SETTINGS: PosterSettings = { logoDataUrl: "", handle: "qatarde", socials: [...SOCIAL_NETWORKS], maxHeight: 1800 };

export const MIN_MAX_HEIGHT = 1350;
export const MAX_MAX_HEIGHT = 1800;
export const MAX_LOGO_LENGTH = 300_000;

/** الشعار صورة PNG/JPEG/WebP مشفّرة base64 فقط وبحجم معقول (لا SVG ولا روابط خارجية ولا نصوص أخرى). */
export function isValidLogoDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_LOGO_LENGTH && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function normalizePosterSettings(raw: unknown): PosterSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const handle = typeof source.handle === "string" ? source.handle.trim().slice(0, 60) : DEFAULT_POSTER_SETTINGS.handle;
  const socials = Array.isArray(source.socials)
    ? SOCIAL_NETWORKS.filter((network) => (source.socials as unknown[]).includes(network))
    : [...DEFAULT_POSTER_SETTINGS.socials];
  const height = Number(source.maxHeight);
  const maxHeight = Number.isFinite(height) ? Math.min(MAX_MAX_HEIGHT, Math.max(MIN_MAX_HEIGHT, Math.round(height))) : DEFAULT_POSTER_SETTINGS.maxHeight;
  return { logoDataUrl: isValidLogoDataUrl(source.logoDataUrl) ? source.logoDataUrl : "", handle, socials, maxHeight };
}
