// صفحة تجربة مستقلة: مقاس الصورة حسب المنصة (إنستقرام ٤:٥، ستوري وسناب ٩:١٦) والتصدير JPEG.
// تُفتح من مركز التجارب (/admin/lab/poster)، ولا تمسّ استوديو الصورة ولا أي صفحة أخرى؛ ما يثبت هنا يُنقل إليه لاحقاً.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { getGetPosterSettingsQueryKey, useGetPosterSettings, useListObituaryRequests, type ObituaryRequest } from "@workspace/api-client-react";
import { AlertTriangle, ChevronRight, Download, ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { describeRequestDeceased } from "@/lib/announcement";
import { IMAGE_HEIGHT, IMAGE_WIDTH, type PosterBranding, type RenderValidationReport } from "@/lib/naskh-poster-engine";
import { NASKH_LAYOUTS, NASKH_POSTER_SIZES, NASKH_TYPE_SCALES, posterQrUrls, type NaskhLayoutId, type NaskhPosterSizeId, type NaskhTypeScaleId } from "@/lib/naskh-poster-plan";
import { readStoredLayout, readStoredPosterSize, readStoredTypeScale, storeLayout, storePosterSize, storeTypeScale } from "@/lib/poster-preferences";
import { renderPoster } from "@/lib/poster-render";
import { normalizeObituaryPresentation } from "@/lib/presentation-normalizer";
import { generateQrImages, type QrCodeMap } from "@/lib/qr-images";
import { canShareImageFiles, canvasToPosterFile, downloadFile, posterFileName } from "@/lib/poster-export";
import { PosterChips as Chips } from "@/components/poster-chips";

export default function AdminLabPosterPage() {
  const { data: requests, isLoading, error } = useListObituaryRequests();
  const [requestNumber, setRequestNumber] = useState("");
  const [layout, setLayout] = useState<NaskhLayoutId>(readStoredLayout);
  const [typeScale, setTypeScale] = useState<NaskhTypeScaleId>(readStoredTypeScale);
  const [posterSize, setPosterSize] = useState<NaskhPosterSizeId>(readStoredPosterSize);
  const [qrImages, setQrImages] = useState<QrCodeMap>({});
  const [rendering, setRendering] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
  const [report, setReport] = useState<RenderValidationReport | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // الأحدث أولاً، والأول يُختار تلقائياً
  const sorted = useMemo(() => [...(requests ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [requests]);
  const request: ObituaryRequest | undefined = sorted.find((item) => item.requestNumber === requestNumber) ?? sorted[0];
  useEffect(() => {
    if (!requestNumber && sorted[0]) setRequestNumber(sorted[0].requestNumber);
  }, [requestNumber, sorted]);

  // هوية الصورة من «الإعدادات»، كما في الاستوديو
  const posterSettings = useGetPosterSettings({ query: { queryKey: getGetPosterSettingsQueryKey(), retry: false } });
  const settingsReady = !posterSettings.isLoading;
  const branding = useMemo<PosterBranding | undefined>(() => {
    const data = posterSettings.data;
    return data ? { logoDataUrl: data.logoDataUrl || undefined, maxHeight: data.maxHeight } : undefined;
  }, [posterSettings.data]);

  const content = useMemo(() => (request ? normalizeObituaryPresentation(request) : null), [request]);

  useEffect(() => {
    if (!content) return;
    let cancelled = false;
    void generateQrImages(posterQrUrls(content)).then((images) => {
      if (!cancelled) setQrImages(images);
    });
    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    if (!content || !settingsReady) return;
    let cancelled = false;
    setRendering(true);
    void (async () => {
      try {
        const { canvas, report: result } = await renderPoster(layout, content, qrImages, branding, typeScale, posterSize);
        if (cancelled) return;
        setReport(result);
        setPreviewSize({ width: canvas.width, height: canvas.height });
        const target = previewRef.current;
        if (target) {
          target.width = canvas.width;
          target.height = canvas.height;
          target.getContext("2d")?.drawImage(canvas, 0, 0);
        }
      } catch (err) {
        console.error("Poster render error:", err);
        toast.error("تعذّر رسم الصورة");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content, qrImages, branding, settingsReady, layout, typeScale, posterSize]);

  const canShareImage = useMemo(canShareImageFiles, []);

  /** ملف JPEG من المعاينة، باسم الطلب وتخطيطه ومقاسه. */
  const posterFile = (): Promise<File | null> =>
    !request || rendering ? Promise.resolve(null) : canvasToPosterFile(previewRef.current, posterFileName(request.requestNumber, layout, posterSize));

  const shareImage = async () => {
    const file = await posterFile();
    if (!file || !request) {
      toast.error("تعذر إنشاء ملف JPEG");
      return;
    }
    try {
      await navigator.share({ files: [file], title: `إعلان ${request.requestNumber}` });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      toast.error("تعذّرت المشاركة، استخدم «تنزيل» ثم احفظ الصورة.");
    }
  };

  const download = async () => {
    const file = await posterFile();
    if (!file) {
      toast.error("تعذر إنشاء ملف JPEG");
      return;
    }
    downloadFile(file);
    toast.success(`تم تنزيل JPEG (${previewSize.width} × ${previewSize.height}، ${Math.round(file.size / 1024)} KB)`);
  };

  const errors = report?.issues.filter((issue) => issue.severity === "error") ?? [];

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4" dir="rtl">
      <Link href="/admin/lab" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronRight className="h-4 w-4" />
        عودة إلى التجارب
      </Link>

      <h1 className="text-2xl font-bold text-primary mb-4">تجربة المقاس وJPEG</h1>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ تحميل الطلبات…</p>}
      {error && <p className="text-sm text-destructive">تعذّر تحميل الطلبات</p>}
      {!isLoading && !sorted.length && <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>}

      {request && (
        <>
          <div className="w-full mb-3">
            <Label htmlFor="lab-request" className="sr-only">الطلب</Label>
            <select
              id="lab-request"
              value={request.requestNumber}
              onChange={(event) => setRequestNumber(event.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {sorted.map((item) => (
                <option key={item.requestNumber} value={item.requestNumber}>
                  {item.requestNumber} — {describeRequestDeceased(item) || "بلا اسم"}
                </option>
              ))}
            </select>
          </div>

          {/* المعاينة ثابتة أعلى الشاشة، فتتغير أمام العين مع كل اختيار؛ الارتفاع يحكم والعرض يتبع نسبة الصورة */}
          <div className="sticky top-0 z-10 bg-background pb-2 mb-2">
            <div className="relative mx-auto w-fit overflow-hidden rounded-xl bg-white shadow-lg border border-border/80">
              <canvas ref={previewRef} aria-label="معاينة صورة التجربة" className="block h-auto max-h-[52vh] w-auto max-w-full" />
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white" dir="ltr">{`${previewSize.width} × ${previewSize.height}`}</span>
            </div>
          </div>

          <Chips label="المقاس" options={NASKH_POSTER_SIZES} value={posterSize} columns={2} onChange={(id) => { setPosterSize(id); storePosterSize(id); }} />
          <Chips label="التخطيط" options={NASKH_LAYOUTS} value={layout} columns={4} onChange={(id) => { setLayout(id); storeLayout(id); }} />
          <Chips label="الخط" options={NASKH_TYPE_SCALES} value={typeScale} columns={4} onChange={(id) => { setTypeScale(id); storeTypeScale(id); }} />

          {errors.map((issue) => (
            <div key={issue.code} role="alert" className="my-3 flex w-full items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs font-semibold leading-5 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}

          <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
            {canShareImage && (
              <Button type="button" onClick={() => void shareImage()} disabled={rendering} className="w-full gap-2 h-11 font-semibold sm:flex-1">
                <ImageDown className="h-4 w-4" />
                حفظ في الصور
              </Button>
            )}
            <Button type="button" variant={canShareImage ? "outline" : "default"} onClick={() => void download()} disabled={rendering} className="w-full gap-2 h-11 font-semibold sm:flex-1">
              <Download className="h-4 w-4" />
              تنزيل JPEG
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
