import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Save,
  X,
  Check,
  Copy,
  ImageDown,
  Sparkles,
  Type,
  AlertTriangle,
} from "lucide-react";
import {
  getGetPosterSettingsQueryKey,
  useGetPosterSettings,
  type ObituaryRequest,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useRequestKeys, useUpdateRequest } from "@/lib/requests-api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  createCondolenceImageDraft,
  type Audience,
  type EditableCard,
  type ImageDraft,
} from "@/lib/condolence-copy";
import { IMAGE_HEIGHT, IMAGE_WIDTH, type PosterBranding, type RenderValidationReport } from "@/lib/naskh-poster-engine";
import { NASKH_LAYOUTS, NASKH_TYPE_SCALES, posterQrUrls, type NaskhLayoutId, type NaskhTypeScaleId } from "@/lib/naskh-poster-plan";
import { readStoredLayout, readStoredTypeScale, storeLayout, storeTypeScale } from "@/lib/poster-preferences";
import { normalizeObituaryPresentation } from "@/lib/presentation-normalizer";
import { buildAnnouncement } from "@/lib/announcement";
import { generateQrImages, type QrCodeMap } from "@/lib/qr-images";
import { renderPoster } from "@/lib/poster-render";

function parseAddressDraft(address: string) {
  type AddressField = "area" | "street" | "houseNumber" | "buildingNumber" | "floor" | "apartmentNumber";
  const fieldByLabel: Record<string, AddressField> = {
    "المنطقة": "area",
    "الشارع": "street",
    "رقم المنزل": "houseNumber",
    "رقم المبنى": "buildingNumber",
    "الطابق": "floor",
    "رقم الشقة": "apartmentNumber",
  };
  const fields: Partial<Record<AddressField, string>> = {};
  const notes: string[] = [];
  for (const part of address.split(/،\s*/u).map((value) => value.trim()).filter(Boolean)) {
    const separator = part.indexOf(":");
    const label = separator >= 0 ? part.slice(0, separator).trim() : "";
    const key = fieldByLabel[label];
    if (key) {
      fields[key] = part.slice(separator + 1).trim() || undefined;
    } else {
      notes.push(part);
    }
  }
  return {
    area: fields.area,
    street: fields.street,
    houseNumber: fields.houseNumber,
    buildingNumber: fields.buildingNumber,
    floor: fields.floor,
    apartmentNumber: fields.apartmentNumber,
    locationNotes: notes.join("، ") || undefined,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function CardEditor({
  audience,
  card,
  onChange,
}: {
  audience: Audience;
  card: EditableCard;
  onChange: (key: keyof EditableCard, value: string) => void;
}) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3 bg-muted/20">
        <CardTitle className="text-base text-primary font-bold">
          {audience === "men" ? "عزاء الرجال" : "عزاء النساء"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 pt-4">
        <Field label="بداية العزاء">
          <Input value={card.start} onChange={(event) => onChange("start", event.target.value)} placeholder="مثال: الأحد 28 سبتمبر" />
        </Field>
        <Field label="المدة بالأيام">
          <Input value={card.durationDays} onChange={(event) => onChange("durationDays", event.target.value)} inputMode="numeric" placeholder="مثال: 3" />
        </Field>
        <Field label="الفترة / الوقت">
          <Input value={card.time} onChange={(event) => onChange("time", event.target.value)} placeholder="مثال: بعد صلاة العصر حتى العشاء" />
        </Field>
        <Field label="المجلس / المكان">
          <Input value={card.location} onChange={(event) => onChange("location", event.target.value)} placeholder="مثال: مجلس العائلة" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="العنوان والتفاصيل">
            <Textarea rows={2} value={card.address} onChange={(event) => onChange("address", event.target.value)} placeholder="الدفنة، شارع 850، مبنى 14" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="رابط خرائط جوجل (ينشئ QR Code حقيقي عالي التباين)">
            <Input value={card.mapLink} onChange={(event) => onChange("mapLink", event.target.value)} dir="ltr" className="text-left font-mono text-xs" placeholder="https://maps.google.com/..." />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

export function CondolenceImageStudio({
  request,
  onClose,
}: {
  request: ObituaryRequest;
  onClose: () => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<NaskhLayoutId>(readStoredLayout);
  const [typeScale, setTypeScale] = useState<NaskhTypeScaleId>(readStoredTypeScale);
  const [previewSize, setPreviewSize] = useState({ width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
  const [draft, setDraft] = useState<ImageDraft>(() => createCondolenceImageDraft(request));
  const [qrImages, setQrImages] = useState<QrCodeMap>({});
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // مشاركة الملفات متاحة على الجوال غالباً؛ نفحصها بملف وهمي لأن canShare تتطلب ملفاً فعلياً
  const canShareImage = useMemo(() => {
    if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
    try {
      return navigator.canShare({ files: [new File([new Blob([""], { type: "image/png" })], "a.png", { type: "image/png" })] });
    } catch {
      return false;
    }
  }, []);
  const [validationReport, setValidationReport] = useState<RenderValidationReport | null>(null);

  const queryClient = useQueryClient();
  const updateMutation = useUpdateRequest();
  const keys = useRequestKeys();

  // هوية الصورة (الشعار والطول الأقصى) من «الإعدادات»؛ ننتظر وصولها حتى لا يظهر رسم بلا شعار ثم يتبدل
  const posterSettings = useGetPosterSettings({ query: { queryKey: getGetPosterSettingsQueryKey(), retry: false } });
  const settingsReady = !posterSettings.isLoading;
  const branding = useMemo<PosterBranding | undefined>(() => {
    const data = posterSettings.data;
    return data ? { logoDataUrl: data.logoDataUrl || undefined, maxHeight: data.maxHeight } : undefined;
  }, [posterSettings.data]);

  // Normalized content via Presentation Normalizer
  const normalizedContent = useMemo(() => {
    return normalizeObituaryPresentation(request, {
      deceasedNames: draft.deceasedNames,
      deceasedTitles: draft.deceasedTitles,
      opening: draft.opening,
      prayerMapLink: draft.prayerMapLink,
      burialMapLink: draft.burialMapLink,
      menMapLink: draft.men?.mapLink,
      womenMapLink: draft.women?.mapLink,
      notes: draft.notes,
      closing: draft.closing,
    });
  }, [request, draft]);

  // Generate Real High-Contrast QR Images with suppression for known landmarks
  useEffect(() => {
    let cancelled = false;
    // لكل موقع رابطه ورمزه، ومنها المواقع الإضافية «women-2»…
    const urls = posterQrUrls(normalizedContent);

    void generateQrImages(urls).then((imgs) => {
      if (!cancelled) setQrImages(imgs);
    });
    return () => {
      cancelled = true;
    };
  }, [normalizedContent]);

  // رسم الصورة بالتخطيط المختار: 1080 × 1350 وتطول تلقائياً عند كثرة الأسماء
  useEffect(() => {
    let cancelled = false;
    if (!settingsReady) return;

    setRendering(true);
    void (async () => {
      try {
        const { canvas: compiled, report } = await renderPoster(layout, normalizedContent, qrImages, branding, typeScale);
        if (cancelled) return;

        setValidationReport(report);
        setPreviewSize({ width: compiled.width, height: compiled.height });

        const target = previewRef.current;
        if (target) {
          target.width = compiled.width;
          target.height = compiled.height;
          const ctx = target.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, compiled.width, compiled.height);
            ctx.drawImage(compiled, 0, 0);
          }
        }
      } catch (err) {
        console.error("Poster render error:", err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [layout, typeScale, normalizedContent, qrImages, branding, settingsReady]);

  const updateCard = (audience: Audience, key: keyof EditableCard, value: string) => {
    setDraft((current) => ({
      ...current,
      [audience]: current[audience] ? { ...current[audience], [key]: value } : undefined,
    }));
  };

  /** ملف PNG من المعاينة، باسم الطلب وتخطيطه. */
  const posterFile = (): Promise<File | null> =>
    new Promise((resolve) => {
      const canvas = previewRef.current;
      if (!canvas || rendering) return resolve(null);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], `${request.requestNumber}-${layout}.png`, { type: "image/png" }) : null),
        "image/png",
      );
    });

  /**
   * «حفظ في الصور»: على الجوال يفتح ورقة المشاركة، وفيها «حفظ الصورة» الذي يضعها في ألبوم الصور مباشرة،
   * ومنها المشاركة إلى واتساب. زر «تنزيل» وحده يضعها في «الملفات» على iOS لا في الصور.
   */
  const shareImage = async () => {
    const file = await posterFile();
    if (!file) {
      toast.error("تعذر إنشاء ملف PNG");
      return;
    }
    try {
      await navigator.share({ files: [file], title: `إعلان ${request.requestNumber}` });
    } catch (error) {
      // إلغاء المستخدم ليس خطأ
      if ((error as { name?: string })?.name === "AbortError") return;
      toast.error("تعذّرت المشاركة، استخدم «تنزيل» ثم احفظ الصورة.");
    }
  };

  const downloadSinglePage = () => {
    const canvas = previewRef.current;
    if (!canvas || rendering) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("تعذر إنشاء ملف PNG");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${request.requestNumber}-${layout}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success(`تم تنزيل صورة التعزية بصيغة PNG عالية الدقة (${previewSize.width} × ${previewSize.height})`);
    }, "image/png");
  };

  const copyImageToClipboard = async () => {
    const canvas = previewRef.current;
    if (!canvas || rendering) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopied(true);
          toast.success("تم نسخ صورة التعزية للحافظة بنجاح للصق في واتساب");
          setTimeout(() => setCopied(false), 2500);
        } else {
          downloadSinglePage();
        }
      }, "image/png");
    } catch {
      downloadSinglePage();
    }
  };

  const saveToRequest = () => {
    const updatedPeople = request.deceasedPeople.map((person, index) => ({
      ...person,
      // الاسم قد يكون فارغاً عمداً (أرملة فلان، الكنية…)؛ المولّد يتحقق من وجود تعريف بديل.
      fullName: draft.deceasedNames[index]?.trim() || undefined,
      title: draft.deceasedTitles[index]?.trim() || undefined,
    }));
    const identityProblem = buildAnnouncement({ ...request, deceasedPeople: updatedPeople }).warnings
      .find((warning) => warning.startsWith("تعذر التعريف"));
    if (identityProblem) {
      toast.error(identityProblem);
      return;
    }
    setSaving(true);
    const editedAudiences = new Set<string>();
    const updatedCondolences = request.condolences.map((card) => {
      // المحرر يعرض أول موقع لكل جمهور فقط؛ المواقع الإضافية تبقى كما هي.
      if (editedAudiences.has(card.audience)) return card;
      editedAudiences.add(card.audience);
      const edited = draft[card.audience];
      if (!edited) return card;
      const days = Number(edited.durationDays);
      return {
        ...card,
        location: edited.location.trim() || undefined,
        start: edited.start.trim() || undefined,
        time: edited.time.trim() || undefined,
        durationDays: edited.durationDays.trim() && Number.isFinite(days) ? days : null,
        ...parseAddressDraft(edited.address.trim()),
        mapLink: edited.mapLink.trim() || undefined,
      };
    });

    updateMutation.mutate(
      {
        requestNumber: request.requestNumber,
        data: {
          ...request,
          audit: { channel: "admin_edit" },
          deceasedPeople: updatedPeople,
          condolences: updatedCondolences,
          prayer: { ...request.prayer, mapLink: draft.prayerMapLink.trim() || undefined },
          burial: { ...request.burial, mapLink: draft.burialMapLink.trim() || undefined },
          // لا تُنشر أرقام الهواتف (قرار جديد): الحفظ يحذف أرقام طلب قديم
          condolencePhoneContacts: [],
          notes: draft.notes.trim() || undefined,
          status: request.status,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: keys.get(request.requestNumber) });
          queryClient.invalidateQueries({ queryKey: keys.list() });
          toast.success("تم حفظ بيانات الطلب المعدّلة");
        },
        onError: () => toast.error("تعذر حفظ التعديلات في الطلب"),
        onSettled: () => setSaving(false),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-2 sm:p-5 backdrop-blur-sm" dir="rtl">
      <div className="mx-auto min-h-full max-w-7xl rounded-2xl bg-background shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {request.requestNumber}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-green-700 dark:text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded">
                {previewSize.height > IMAGE_HEIGHT ? `طول ديناميكي (1080 × ${previewSize.height} px)` : "صفحة واحدة فقط (1080 × 1350 px)"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground sm:text-xl mt-0.5">
              استوديو إنشاء صورة التعزية الذكي
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={saveToRequest}
              disabled={saving}
              className="gap-1.5 border-primary/20 hover:bg-primary/10 text-xs"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-primary" />}
              حفظ التعديلات للطلب
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="gap-1 text-muted-foreground">
              <X className="h-4 w-4" />
              إغلاق
            </Button>
          </div>
        </header>

        {/* MAIN STUDIO GRID */}
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_440px]">
          {/* PREVIEW & TEMPLATE SWITCHER COLUMN */}
          <section className="order-1 flex flex-col items-center rounded-xl border bg-muted/20 p-4 sm:p-6 lg:order-1">
            {/* LAYOUT SWITCHER */}
            <div className="w-full max-w-[560px] mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  تخطيط الصورة:
                </span>
                <Link href="/settings" className="text-xs text-primary hover:underline">
                  الشعار من الإعدادات
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="تخطيط الصورة">
                {NASKH_LAYOUTS.map((option) => {
                  const isSelected = layout === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setLayout(option.id);
                        storeLayout(option.id);
                      }}
                      className={`relative flex flex-col text-right p-3 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-foreground">{option.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <span className="text-[11px] leading-4 opacity-80 line-clamp-2">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TYPE SCALE SWITCHER: توزيع أحجام المخطوطة والاسم والنص */}
            <div className="w-full max-w-[560px] mb-4">
              <span className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Type className="w-4 h-4 text-primary" />
                حجم الخط:
              </span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="حجم الخط">
                {NASKH_TYPE_SCALES.map((option) => {
                  const isSelected = typeScale === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setTypeScale(option.id);
                        storeTypeScale(option.id);
                      }}
                      className={`relative flex flex-col text-right p-3 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm font-semibold"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-foreground">{option.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <span className="text-[11px] leading-4 opacity-80 line-clamp-2">{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PREVIEW STATUS BAR */}
            <div className="mb-3 flex w-full max-w-[560px] items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                معاينة الصورة النهائية (صفحة واحدة فقط)
              </span>

              {validationReport?.isCompactMode && (
                <span className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  وضع الضغط التلقائي نشط
                </span>
              )}
            </div>

            {/* HIGH-RES CANVAS PREVIEW */}
            <div className="relative w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-2xl border border-border/80">
              <canvas
                ref={previewRef}
                className="block h-auto w-full transition-opacity duration-200"
                style={{ aspectRatio: `${previewSize.width} / ${previewSize.height}` }}
                aria-label="معاينة صورة التعزية"
              />
              {rendering && (
                <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" />
                    <p className="text-sm font-medium text-foreground">تجهيز الرسم الذكي والـQR Codes...</p>
                  </div>
                </div>
              )}
            </div>

            {/* DOWNLOAD ACTION BUTTONS */}
            <div className="mt-5 flex w-full max-w-[560px] flex-col sm:flex-row items-center gap-2.5">
              {canShareImage && (
                <Button
                  type="button"
                  onClick={() => void shareImage()}
                  disabled={rendering}
                  className="w-full sm:flex-1 gap-2 h-11 bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90"
                >
                  <ImageDown className="h-4 w-4" />
                  حفظ في الصور
                </Button>
              )}

              <Button
                type="button"
                onClick={downloadSinglePage}
                disabled={rendering}
                variant={canShareImage ? "outline" : "default"}
                className={`w-full gap-2 h-11 font-semibold ${canShareImage ? "sm:w-auto border-border" : "sm:flex-1 bg-primary text-primary-foreground shadow hover:bg-primary/90"}`}
              >
                <Download className="h-4 w-4" />
                {canShareImage ? "تنزيل" : "تنزيل صورة التعزية (PNG عالية الدقة)"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={copyImageToClipboard}
                disabled={rendering}
                className="w-full sm:w-auto gap-2 h-11 border-border"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "تم النسخ" : "نسخ للحافظة"}
              </Button>
            </div>

            {/* QR Status & Known Landmarks suppression notice */}
            <div className="mt-4 w-full max-w-[560px] rounded-lg border bg-card/60 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-foreground">حالة رموز الـQR Codes:</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      normalizedContent.hasCombinedPrayerBurial
                        ? normalizedContent.prayerBurialCombined?.qrUrl
                          ? "bg-green-500"
                          : "bg-muted"
                        : normalizedContent.prayer?.qrUrl
                        ? "bg-green-500"
                        : "bg-muted"
                    }`}
                  />
                  {normalizedContent.hasCombinedPrayerBurial
                    ? normalizedContent.prayerBurialCombined?.qrUrl
                      ? "صلاة ودَفن: QR نشط"
                      : "صلاة ودَفن: معالم معروفة (بدون QR)"
                    : normalizedContent.prayer?.qrUrl
                    ? "صلاة الجنازة: QR نشط"
                    : "صلاة الجنازة: بدون QR"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      normalizedContent.burial?.qrUrl ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                  {normalizedContent.burial?.qrUrl ? "الدفن: QR نشط" : "الدفن: بدون QR"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      normalizedContent.men?.qrUrl ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                  عزاء الرجال: {normalizedContent.men?.qrUrl ? "QR نشط" : "بدون QR"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      normalizedContent.women?.qrUrl ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                  عزاء النساء: {normalizedContent.women?.qrUrl ? "QR نشط" : "بدون QR"}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT SIDEBAR: EDIT DRAFT & CONTENT */}
          <section className="order-2 space-y-4 lg:order-2 overflow-y-auto max-h-[820px] pr-1">
            {/* Identity Card */}
            <Card className="border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base text-primary font-bold">بيانات المتوفى والاستهلال</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Field label="عبارة الاستهلال">
                  <Input value={draft.opening} onChange={(event) => setDraft((c) => ({ ...c, opening: event.target.value }))} />
                </Field>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">صياغة الوفاة التلقائية:</span>
                  <p className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-foreground font-medium">
                    {normalizedContent.statement}
                  </p>
                </div>
                <div className="space-y-3 pt-1">
                  {draft.deceasedNames.map((name, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border bg-muted/10">
                      <Field label={draft.deceasedNames.length > 1 ? `الاسم ${index + 1}` : "الاسم الكامل"}>
                        <Input
                          value={name}
                          onChange={(e) =>
                            setDraft((c) => ({
                              ...c,
                              deceasedNames: c.deceasedNames.map((n, i) => (i === index ? e.target.value : n)),
                            }))
                          }
                        />
                      </Field>
                      <Field label="اللقب أو الصفة (يندمج مع الاسم)">
                        <Input
                          value={draft.deceasedTitles[index] || ""}
                          placeholder="مثال: الوالد"
                          onChange={(e) =>
                            setDraft((c) => ({
                              ...c,
                              deceasedTitles: c.deceasedTitles.map((t, i) => (i === index ? e.target.value : t)),
                            }))
                          }
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prayer & Burial Maps */}
            <Card className="border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base text-primary font-bold">الصلاة والدفن</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {normalizedContent.hasCombinedPrayerBurial && (
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300">
                    تم دمج الصلاة والدفن تلقائيًا في بطاقة واحدة لأن المكان متطابق (
                    {normalizedContent.prayerBurialCombined?.place}).
                  </div>
                )}
                <Field label="رابط خريطة صلاة الجنازة">
                  <Input
                    value={draft.prayerMapLink}
                    onChange={(e) => setDraft((c) => ({ ...c, prayerMapLink: e.target.value }))}
                    dir="ltr"
                    className="font-mono text-xs text-left"
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field label="رابط خريطة الدفن">
                  <Input
                    value={draft.burialMapLink}
                    onChange={(e) => setDraft((c) => ({ ...c, burialMapLink: e.target.value }))}
                    dir="ltr"
                    className="font-mono text-xs text-left"
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
              </CardContent>
            </Card>

            {/* Men Condolence */}
            {draft.men && (
              <CardEditor
                audience="men"
                card={draft.men}
                onChange={(key, val) => updateCard("men", key, val)}
              />
            )}

            {/* Women Condolence */}
            {draft.women && (
              <CardEditor
                audience="women"
                card={draft.women}
                onChange={(key, val) => updateCard("women", key, val)}
              />
            )}

            {/* Notes */}
            <Card className="border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base text-primary font-bold">الملاحظات ودعاء الختام</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <Field label="الملاحظات">
                  <Textarea
                    rows={2}
                    value={draft.notes}
                    onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value }))}
                  />
                </Field>
                <Field label="دعاء الختام">
                  <Input
                    value={draft.closing}
                    onChange={(e) => setDraft((c) => ({ ...c, closing: e.target.value }))}
                  />
                </Field>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

    </div>
  );
}
