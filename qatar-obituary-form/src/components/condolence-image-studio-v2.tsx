import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight, Download, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import {
  getGetObituaryRequestQueryKey,
  getListObituaryRequestsQueryKey,
  useUpdateObituaryRequest,
  type ObituaryRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  buildCondolencePosterContent,
  createCondolenceImageDraft,
  formatRelativeGroups,
  type Audience,
  type EditableCard,
  type EditableContact,
  type ImageDraft,
} from "@/lib/condolence-copy";
import {
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  loadCondolenceFonts,
  renderCondolencePages,
  type QrImage,
} from "@/lib/condolence-poster-renderer";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-primary">{audience === "men" ? "عزاء الرجال" : "عزاء النساء"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="بداية العزاء"><Input value={card.start} onChange={(event) => onChange("start", event.target.value)} /></Field>
        <Field label="المدة بالأيام"><Input value={card.durationDays} onChange={(event) => onChange("durationDays", event.target.value)} inputMode="numeric" /></Field>
        <Field label="الفترة / الوقت"><Input value={card.time} onChange={(event) => onChange("time", event.target.value)} /></Field>
        <Field label="المجلس / المكان"><Input value={card.location} onChange={(event) => onChange("location", event.target.value)} /></Field>
        <Field label="العنوان والتفاصيل"><Textarea rows={3} value={card.address} onChange={(event) => onChange("address", event.target.value)} /></Field>
        <Field label="رابط موقع المجلس لإنشاء QR"><Input value={card.mapLink} onChange={(event) => onChange("mapLink", event.target.value)} dir="ltr" className="text-left" placeholder="https://maps.google.com/..." /></Field>
      </CardContent>
    </Card>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch {
    return false;
  }
}

export function CondolenceImageStudio({
  request,
  onClose,
}: {
  request: ObituaryRequest;
  onClose: () => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pageCanvases = useRef<HTMLCanvasElement[]>([]);
  const [draft, setDraft] = useState<ImageDraft>(() => createCondolenceImageDraft(request));
  const [qrImages, setQrImages] = useState<Record<string, QrImage>>({});
  const [qrLoading, setQrLoading] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [pagesReady, setPagesReady] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const updateMutation = useUpdateObituaryRequest();

  const qrLinks = useMemo(() => ({
    men: draft.men?.mapLink.trim() || "",
    women: draft.women?.mapLink.trim() || "",
    prayer: draft.prayerMapLink.trim(),
    burial: draft.burialMapLink.trim(),
  }), [draft.men?.mapLink, draft.women?.mapLink, draft.prayerMapLink, draft.burialMapLink]);
  const posterCopy = useMemo(
    () => buildCondolencePosterContent(request, draft, qrLinks),
    [request, draft, qrLinks],
  );
  const invalidQrKeys = useMemo(
    () => Object.entries(qrLinks)
      .filter(([, link]) => !!link && !isValidHttpUrl(link))
      .map(([key]) => key),
    [qrLinks],
  );
  const visiblePhoneContacts = useMemo(
    () => draft.phoneContacts.filter((contact) => contact.name.trim() || contact.phone.trim()),
    [draft.phoneContacts],
  );

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(qrLinks).filter(([, link]) => !!link && isValidHttpUrl(link));
    setQrLoading(entries.length > 0);
    setQrError(false);
    setQrImages({});
    if (!entries.length) {
      setQrLoading(false);
      return () => { cancelled = true; };
    }
    Promise.allSettled(entries.map(async ([key, link]) => {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 360,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      const image = new Image();
      image.src = dataUrl;
      if (typeof image.decode === "function") await image.decode();
      else await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("تعذر تحميل QR"));
      });
      return [key, { dataUrl, image }] as const;
    })).then((results) => {
      if (!cancelled) {
        const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        const failed = results.some((result) => result.status === "rejected");
        setQrImages(Object.fromEntries(fulfilled));
        setQrError(failed);
        if (failed) toast.error("تعذر إنشاء أحد رموز QR؛ تحقق من رابط الموقع");
      }
    }).finally(() => {
      if (!cancelled) setQrLoading(false);
    });
    return () => { cancelled = true; };
  }, [qrLinks]);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    pageCanvases.current = [];
    setPagesReady(false);
    setPageCount(0);
    setPageIndex(0);
    setApproved(false);
    void (async () => {
      try {
        await loadCondolenceFonts();
        if (cancelled || qrLoading) return;
        const generatedPages = renderCondolencePages({
          ...posterCopy,
          designId: "official",
          qrImages,
        });
        if (cancelled) return;
        pageCanvases.current = generatedPages;
        setPagesReady(generatedPages.length > 0);
      } catch (error) {
        if (!cancelled) {
          console.error("Condolence image rendering failed", error);
          toast.error("تعذر تجهيز معاينة الصورة");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [posterCopy, qrImages, qrLoading]);

  useEffect(() => {
    const pages = pageCanvases.current;
    setPageCount(pages.length);
    if (!pages.length) return;
    const safeIndex = Math.min(pageIndex, pages.length - 1);
    if (safeIndex !== pageIndex) setPageIndex(safeIndex);
    const canvas = previewRef.current;
    const context = canvas?.getContext("2d");
    const page = pages[safeIndex];
    if (canvas && context && page) {
      canvas.width = IMAGE_WIDTH;
      canvas.height = IMAGE_HEIGHT;
      context.clearRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      context.drawImage(page, 0, 0);
    }
  }, [pageIndex, pagesReady]);

  const updateCard = (audience: Audience, key: keyof EditableCard, value: string) => {
    setDraft((current) => ({
      ...current,
      [audience]: current[audience] ? { ...current[audience], [key]: value } : undefined,
    }));
  };
  const updateContact = (index: number, key: keyof EditableContact, value: string) => {
    setDraft((current) => ({
      ...current,
      phoneContacts: current.phoneContacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [key]: value } : contact),
    }));
  };

  const downloadPage = (index: number) => {
    const pages = pageCanvases.current;
    const canvas = pages[index];
    if (
      !canvas
      || rendering
      || qrLoading
      || qrError
      || invalidQrKeys.length > 0
      || !approved
    ) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("تعذر إنشاء ملف PNG");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${request.requestNumber}-بطاقة-تعزية-${index + 1}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success(`تم تنزيل الصورة ${index + 1} من ${pages.length}`);
    }, "image/png");
  };

  const saveToRequest = () => {
    if (draft.deceasedNames.some((name) => name.trim().length < 2)) {
      toast.error("أدخل اسم كل متوفى قبل الحفظ");
      return;
    }
    setSaving(true);
    const updatedPeople = request.deceasedPeople.map((person, index) => ({
      ...person,
      fullName: draft.deceasedNames[index]?.trim() ?? person.fullName,
      title: draft.deceasedTitles[index]?.trim() || undefined,
    }));
    const updatedCondolences = request.condolences.map((card) => {
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
    updateMutation.mutate({
      requestNumber: request.requestNumber,
      data: {
        ...request,
        deceasedPeople: updatedPeople,
        condolences: updatedCondolences,
        prayer: { ...request.prayer, mapLink: draft.prayerMapLink.trim() || undefined },
        burial: { ...request.burial, mapLink: draft.burialMapLink.trim() || undefined },
        condolencePhoneContacts: request.condolenceOptions.includes("phone") || request.condolencePhoneContacts.length > 0
          ? visiblePhoneContacts.map((contact) => ({
              ...(contact.name.trim() ? { name: contact.name.trim() } : {}),
              ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
            }))
          : request.condolencePhoneContacts,
        notes: draft.notes.trim() || undefined,
        status: request.status,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetObituaryRequestQueryKey(request.requestNumber) });
        queryClient.invalidateQueries({ queryKey: getListObituaryRequestsQueryKey() });
        toast.success("تم حفظ بيانات الطلب المعدّلة");
      },
      onError: () => toast.error("تعذر حفظ التعديلات في الطلب"),
      onSettled: () => setSaving(false),
    });
  };

  const familyText = formatRelativeGroups(request);
  const selectedPages = pageCanvases.current;
  const hasInvalidName = draft.deceasedNames.some((name) => name.trim().length < 2);
  const exportReady = !rendering
    && !qrLoading
    && !qrError
    && !hasInvalidName
    && invalidQrKeys.length === 0
    && approved
    && selectedPages.length > 0;
  const pageCountLabel = rendering
    ? "جارٍ تجهيز المعاينة"
    : pageCount === 1
      ? "صورة واحدة"
      : pageCount === 2
        ? "صورتان"
        : `${pageCount} صور`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#24171c]/70 p-2 sm:p-6" dir="rtl">
      <div className="mx-auto min-h-full max-w-7xl rounded-2xl bg-background shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs text-muted-foreground">لوحة الإدارة · {request.requestNumber}</p>
            <h2 className="text-lg font-bold text-primary sm:text-xl">إنشاء صورة التعزية</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="gap-2"><X className="h-4 w-4" />رجوع / إلغاء</Button>
        </header>
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_430px]">
          <section className="order-1 flex flex-col items-center rounded-xl border bg-muted/20 p-3 sm:p-6 lg:order-2">
            <div className="mb-3 flex w-full items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-primary">بطاقة التعزية · قالب ثابت</span>
              <span className="text-muted-foreground"><span dir="ltr" className="inline-block">1080 × 1350 px</span></span>
            </div>
            <div className="w-full max-w-[540px] rounded-lg border bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
              ترتيب البطاقة ثابت: بيانات المتوفى، الصلاة والدفن، عزاء الرجال، عزاء النساء، الأقارب والاتصال، الملاحظات، ثم الدعاء.
            </div>
            <div className="mb-3 mt-5 flex w-full max-w-[540px] items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-primary">معاينة الصورة النهائية</span>
              <span className="text-muted-foreground">{pageCountLabel}</span>
            </div>
            <div className="relative w-full max-w-[540px] overflow-hidden rounded-lg bg-white shadow-xl">
              <canvas ref={previewRef} className="block h-auto w-full" aria-label="معاينة صورة التعزية" />
              {(rendering || qrLoading) && <div className="absolute inset-0 grid place-items-center bg-background/75"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            </div>
            {qrError && <p role="alert" className="mt-3 text-sm text-destructive">تعذر إنشاء QR لبعض الروابط. راجع روابط المواقع قبل التنزيل.</p>}
            {invalidQrKeys.length > 0 && (
              <p role="alert" className="mt-3 w-full max-w-[540px] text-sm text-destructive">
                توجد روابط غير صالحة في: {invalidQrKeys.map((key) => ({
                  men: "موقع الرجال",
                  women: "موقع النساء",
                  prayer: "موقع الصلاة",
                  burial: "موقع الدفن",
                }[key] || key)).join("، ")}. صححها أو احذفها قبل اعتماد الصورة.
              </p>
            )}
            {hasInvalidName && (
              <p role="alert" className="mt-3 w-full max-w-[540px] text-sm text-destructive">
                أدخل اسم كل متوفى بطول حرفين على الأقل قبل اعتماد الصورة.
              </p>
            )}
            {pageCount > 1 && (
              <div className="mt-4 flex w-full max-w-[540px] flex-wrap justify-center gap-2">
                {selectedPages.map((_, index) => (
                  <div key={index} className="flex overflow-hidden rounded-md border">
                    <Button type="button" variant={pageIndex === index ? "secondary" : "ghost"} size="sm" onClick={() => setPageIndex(index)}>
                      معاينة {index + 1}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`تنزيل الصورة ${index + 1}`} title={`تنزيل الصورة ${index + 1}`} disabled={!exportReady} onClick={() => downloadPage(index)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {pageCount > 1 && (
              <p className="mt-2 w-full max-w-[540px] text-center text-xs leading-5 text-muted-foreground">
                قُسّمت البيانات على صور متعددة للحفاظ على وضوحها بعد ضبط الخط والمسافات.
              </p>
            )}
            <Button
              type="button"
              variant={approved ? "secondary" : "default"}
              onClick={() => setApproved(true)}
              disabled={rendering || qrLoading || !pagesReady || hasInvalidName}
              className="mt-4 w-full max-w-[540px] gap-2 sm:w-auto"
            >
              {approved ? "تم اعتماد البطاقة" : "اعتماد بطاقة التعزية"}
            </Button>
            <Button type="button" onClick={() => downloadPage(pageIndex)} disabled={!exportReady} className="mt-2 w-full max-w-[540px] gap-2 sm:w-auto">
              <Download className="h-4 w-4" />
              {pageCount > 1 ? `تنزيل PNG للصورة ${pageIndex + 1}` : "تنزيل صورة التعزية PNG"}
            </Button>
          </section>

          <section className="order-2 space-y-4 lg:order-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-primary">النصوص الأساسية</CardTitle>
                <p className="text-xs leading-5 text-muted-foreground">التعديلات تبقى خاصة بالصورة حتى تختار الحفظ. الحفظ يحدّث حقول الطلب المقابلة؛ عبارات البطاقة تبقى خاصة بالصورة.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="عبارة الاستهلال"><Input value={draft.opening} onChange={(event) => setDraft((current) => ({ ...current, opening: event.target.value }))} /></Field>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">صياغة الوفاة المولّدة</p>
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm leading-6">{posterCopy.statement}</p>
                </div>
                <Field label="أسماء المتوفين">
                  <div className="space-y-2">
                    {draft.deceasedNames.map((name, index) => (
                      <div key={index} className="space-y-2">
                        <Field label={draft.deceasedNames.length > 1 ? `الاسم ${index + 1}` : "الاسم"}>
                          <Input value={name} onChange={(event) => setDraft((current) => ({ ...current, deceasedNames: current.deceasedNames.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                        </Field>
                        <Field label="اللقب أو التعريف">
                          <Input value={draft.deceasedTitles[index] || ""} onChange={(event) => setDraft((current) => ({ ...current, deceasedTitles: current.deceasedTitles.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
                        </Field>
                        {(() => {
                          const person = request.deceasedPeople[index];
                          if (!person) return null;
                          const details = [
                            person.age != null ? `العمر: ${person.age}` : "",
                            person.nationality && `الجنسية: ${person.nationality}`,
                            person.deathPlace && `مكان الوفاة: ${person.deathPlace}`,
                            person.occupation && `الجهة / الصفة: ${person.occupation}`,
                            person.note && `ملاحظة: ${person.note}`,
                          ].filter(Boolean).join("\n");
                          return details ? <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{details}</p> : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </Field>
                <Field label="الدعاء الختامي"><Textarea value={draft.closing} onChange={(event) => setDraft((current) => ({ ...current, closing: event.target.value }))} rows={2} /></Field>
              </CardContent>
            </Card>

            {!!familyText.trim() && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-base text-primary">الأقارب</CardTitle></CardHeader>
                <CardContent><p className="whitespace-pre-wrap text-sm leading-6">{familyText}</p></CardContent>
              </Card>
            )}
            {!!(draft.prayerText || draft.prayerMapLink) && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-base text-primary">صلاة الجنازة</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="whitespace-pre-wrap text-sm leading-6">{draft.prayerText}</p>
                  <Field label="رابط موقع الصلاة"><Input value={draft.prayerMapLink} onChange={(event) => setDraft((current) => ({ ...current, prayerMapLink: event.target.value }))} dir="ltr" className="text-left" /></Field>
                </CardContent>
              </Card>
            )}
            {!!(draft.burialText || draft.burialMapLink) && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-base text-primary">الدفن</CardTitle></CardHeader>
                <CardContent className="space-y-2"><p className="whitespace-pre-wrap text-sm leading-6">{draft.burialText}</p>
                  <Field label="رابط موقع الدفن"><Input value={draft.burialMapLink} onChange={(event) => setDraft((current) => ({ ...current, burialMapLink: event.target.value }))} dir="ltr" className="text-left" /></Field>
                </CardContent>
              </Card>
            )}

            {draft.men && <CardEditor audience="men" card={draft.men} onChange={(key, value) => updateCard("men", key, value)} />}
            {draft.women && <CardEditor audience="women" card={draft.women} onChange={(key, value) => updateCard("women", key, value)} />}
            {(request.condolenceOptions.includes("phone") || request.condolencePhoneContacts.length > 0) && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base text-primary">التعزية عبر الهاتف</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {draft.phoneContacts.map((contact, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <Field label="الاسم"><Input value={contact.name} onChange={(event) => updateContact(index, "name", event.target.value)} /></Field>
                      <Field label="رقم الهاتف"><Input value={contact.phone} onChange={(event) => updateContact(index, "phone", event.target.value)} dir="ltr" className="text-left" /></Field>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDraft((current) => ({ ...current, phoneContacts: current.phoneContacts.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="حذف الرقم"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setDraft((current) => ({ ...current, phoneContacts: [...current.phoneContacts, { name: "", phone: "" }] }))}><Plus className="h-4 w-4" />إضافة رقم</Button>
                </CardContent>
              </Card>
            )}

            <Card><CardContent className="pt-6"><Field label="الملاحظات الإضافية"><Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} /></Field></CardContent></Card>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={saveToRequest} disabled={saving || hasInvalidName} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ تعديلات الصورة في الطلب</Button>
              <Button type="button" variant="ghost" onClick={onClose} className="gap-2"><ArrowRight className="h-4 w-4" />العودة دون حفظ</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}