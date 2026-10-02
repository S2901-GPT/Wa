// واجهة موحّدة لرسم صورة التعزية: قالب النسخ بمحركه الانسيابي، وبقية القوالب بمحرك الكتل.
import type { CondolenceTemplate } from "./template-schema";
import { loadCondolenceFonts } from "./template-schema";
import type { NormalizedContent } from "./presentation-normalizer";
import { compileAndRenderSinglePage, type QrCodeMap, type RenderValidationReport } from "./single-page-engine";
import { isNaskhTemplate, loadNaskhAssets, renderNaskhPoster } from "./naskh-poster-engine";

export type PosterRenderResult = { canvas: HTMLCanvasElement; report: RenderValidationReport };

export async function renderPoster(template: CondolenceTemplate, content: NormalizedContent, qrImages: QrCodeMap): Promise<PosterRenderResult> {
  await loadCondolenceFonts();
  if (isNaskhTemplate(template)) {
    const assets = await loadNaskhAssets(template);
    const { canvas, report } = renderNaskhPoster(template, content, qrImages, assets);
    return { canvas, report };
  }
  const { canvas, report } = compileAndRenderSinglePage(template, content, qrImages);
  return { canvas, report };
}
