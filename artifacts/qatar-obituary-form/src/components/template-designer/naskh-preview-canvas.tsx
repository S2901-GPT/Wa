import { useEffect, useRef, useState } from "react";
import type { CondolenceTemplate } from "@/lib/template-schema";
import type { NormalizedContent } from "@/lib/presentation-normalizer";
import type { QrCodeMap, RenderValidationReport } from "@/lib/single-page-engine";
import { renderPoster } from "@/lib/poster-render";

/** معاينة قالب النسخ في المصمّم: لوحة بارتفاع ديناميكي بلا طبقات أو سحب. */
export function NaskhPreviewCanvas({
  template,
  content,
  qrImages,
  zoom,
  onValidationChange,
}: {
  template: CondolenceTemplate;
  content: NormalizedContent;
  qrImages: QrCodeMap;
  zoom: number;
  onValidationChange?: (report: RenderValidationReport) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 1080, height: 1350 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { canvas: compiled, report } = await renderPoster(template, content, qrImages);
        if (cancelled) return;
        const target = canvasRef.current;
        if (target) {
          target.width = compiled.width;
          target.height = compiled.height;
          target.getContext("2d")?.drawImage(compiled, 0, 0);
        }
        setSize({ width: compiled.width, height: compiled.height });
        onValidationChange?.(report);
      } catch (error) {
        console.error("Naskh preview render error:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template, content, qrImages, onValidationChange]);

  return (
    <div className="relative flex items-center justify-center overflow-auto p-4 select-none min-h-[500px]">
      <div className="relative shadow-2xl bg-white" style={{ width: `${Math.round(size.width * zoom)}px`, height: `${Math.round(size.height * zoom)}px` }}>
        <canvas ref={canvasRef} width={size.width} height={size.height} className="block w-full h-full" aria-label="معاينة قالب النسخ" />
      </div>
    </div>
  );
}
