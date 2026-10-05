// واجهة رسم صورة التعزية: تحميل الخطوط والأصول ثم الرسم بالتخطيط المختار.
import type { NormalizedContent } from "./presentation-normalizer";
import type { QrCodeMap } from "./qr-images";
import type { NaskhLayoutId, NaskhTypeScaleId } from "./naskh-poster-plan";
import { loadCondolenceFonts, loadNaskhAssets, renderNaskhPoster, type PosterBranding, type RenderValidationReport } from "./naskh-poster-engine";

export type PosterRenderResult = { canvas: HTMLCanvasElement; report: RenderValidationReport };

export async function renderPoster(
  layout: NaskhLayoutId,
  content: NormalizedContent,
  qrImages: QrCodeMap,
  branding?: PosterBranding,
  typeScale?: NaskhTypeScaleId,
): Promise<PosterRenderResult> {
  await loadCondolenceFonts();
  const assets = await loadNaskhAssets(branding);
  const { canvas, report } = renderNaskhPoster({ layout, typeScale, branding }, content, qrImages, assets);
  return { canvas, report };
}
