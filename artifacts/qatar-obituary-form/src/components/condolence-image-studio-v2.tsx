import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ImageDown, Loader2, Save, X } from "lucide-react";
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
import { NASKH_LAYOUTS, NASKH_POSTER_SIZES, NASKH_TYPE_SCALES, posterQrUrls, type NaskhLayoutId, type NaskhPosterSizeId, type NaskhTypeScaleId } from "@/lib/naskh-poster-plan";
import { readStoredLayout, readStoredPosterSize, readStoredTypeScale, storeLayout, storePosterSize, storeTypeScale } from "@/lib/poster-preferences";
import { canShareImageFiles, canvasToPosterFile, downloadFile, posterFileName } from "@/lib/poster-export";
import { PosterChips } from "@/components/poster-chips";
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
  const [posterSize, setPosterSize] = useState<NaskhPosterSizeId>(readStoredPosterSize);
  const [previewSize, setPreviewSize] = useState({ width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
  const [draft, setDraft] = useState<ImageDraft>(() => createCondolenceImageDraft(request));
  const [qrImages, setQrImages] = useState<QrCodeMap>({});
  const [rendering, setRendering] = useState(true);
  const [saving, setSaving] = useState(false);
  // مشاركة الملفات متاحة على الجوال غالباً («حفظ في الصور»)
  const canShareImage = useMemo(canShareImageFiles, []);
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

  // رسم الصورة بالتخطيط ومقاس المنصة المختارين (منشور 1080 × 1350 أو ستوري 1080 × 1920)
  useEffect(() => {
    let cancelled = false;
    if (!settingsReady) return;

    setRendering(true);
    void (async () => {
      try {
        const { canvas: compiled, report } = await renderPoster(layout, normalizedContent, qrImages, branding, typeScale, posterSize);
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
  }, [layout, typeScale, posterSize, normalizedContent, qrImages, branding, settingsReady]);

  const updateCard = (audience: Audience, key: keyof EditableCard, value: string) => {
    setDraft((current) => ({
      ...current,
      [audience]: current[audience] ? { ...current[audience], [key]: value } : undefined,
    }));
  };

  /** ملف JPEG من المعاينة، باسم الطلب وتخطيطه ومقاسه. */
  const posterFile = (): Promise<File | null> =>
    rendering ? Promise.resolve(null) : canvasToPosterFile(previewRef.current, posterFileName(request.requestNumber, layout, posterSize));

  /**
   * «حفظ في الصور»: على الجوال يفتح ورقة المشاركة، وفيها «حفظ الصورة» الذي يضعها في ألبوم الصور مباشرة،
   * ومنها المشاركة إلى واتساب. زر «تنزيل» وحده يضعها في «الملفات» على iOS لا في الصور.
   */
  const shareImage = async () => {
    const file = await posterFile();
    if (!file) {
      toast.error("تعذر إنشاء ملف JPEG");
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

  const download = async () => {
    const file = await posterFile();
    if (!file) {
      toast.error("تعذر إنشاء ملف JPEG");
      return;
    }
    downloadFile(file);
    toast.success(`تم تنزيل JPEG (${previewSize.width} × ${previewSize.height}، ${Math.round(file.size / 1024)} KB)`);
  };

  const renderErrors = validationReport?.issues.filter((issue) => issue.severity === "error") ?? [];

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
              <span className="text-xs text-green-700 dark:text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded" dir="ltr">
                {`${previewSize.width} × ${previewSize.height}`}
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
          <section className="order-1 lg:order-1">
            {/* المعاينة ثابتة أعلى الشاشة تحت الترويسة، فتتغير أمام العين مع كل اختيار؛ الارتفاع يحكم والعرض يتبع نسبة الصورة */}
            <div className="sticky top-[4.5rem] z-10 bg-background pb-2 mb-2">
              <div className="relative mx-auto w-fit overflow-hidden rounded-xl bg-white shadow-lg border border-border/80">
                <canvas ref={previewRef} aria-label="معاينة صورة التعزية" className="block h-auto max-h-[52vh] w-auto max-w-full" />
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white" dir="ltr">{`${previewSize.width} × ${previewSize.height}`}</span>
              </div>
            </div>

            <PosterChips label="المقاس" options={NASKH_POSTER_SIZES} value={posterSize} columns={2} onChange={(id) => { setPosterSize(id); storePosterSize(id); }} />
            <PosterChips label="التخطيط" options={NASKH_LAYOUTS} value={layout} columns={4} onChange={(id) => { setLayout(id); storeLayout(id); }} />
            <PosterChips label="الخط" options={NASKH_TYPE_SCALES} value={typeScale} columns={4} onChange={(id) => { setTypeScale(id); storeTypeScale(id); }} />

            {renderErrors.map((issue) => (
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
            <p className="mt-2 text-center text-xs text-muted-foreground">
              <Link href="/settings" className="text-primary hover:underline">الشعار من الإعدادات</Link>
            </p>
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
