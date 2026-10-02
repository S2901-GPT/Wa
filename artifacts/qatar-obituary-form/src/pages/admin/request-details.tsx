import { useRoute, Link, useLocation } from "wouter";
import { getGetObituaryRequestQueryKey, getListObituaryRequestsQueryKey, useGetObituaryRequest, useUpdateObituaryRequest } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ChevronRight, Loader2, Check, AlertCircle, AlertTriangle, Edit } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CondolenceImageStudio } from "@/components/condolence-image-studio-v2";
import {
  MESSAGE_TYPE_LABELS,
  RELATION_OPTIONS,
  buildAnnouncement,
  describeDeceased,
  describeRequestDeceased,
  formatAge,
  formatDurationDays,
  relationKeyOf,
} from "@/lib/announcement";

const genderLabels = {
  man: "رجل",
  woman: "امرأة",
  boy: "طفل",
  girl: "طفلة",
  other: "غير محدد",
} as const;

const identifyLabels = {
  name: "بالاسم",
  kunya: "بالكنية",
  spouse: "عبر الزوج",
  father: "عبر الأب",
  children: "عبر الأبناء",
} as const;

const burialStatusLabels = {
  upcoming: "سيتم الدفن",
  completed: "تم الدفن",
  postponed: "مؤجل حتى إشعار آخر",
} as const;

const optionLabels = {
  men: "عزاء الرجال",
  men_cemetery: "عزاء الرجال في المقبرة فقط",
  women: "عزاء النساء",
  phone: "عبر الهاتف",
  tbd: "سيُحدَّد لاحقاً",
} as const;

export default function AdminRequestDetailsPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/:requestNumber");
  const requestNumber = params?.requestNumber;
  const queryClient = useQueryClient();
  
  const { data: req, isLoading, error } = useGetObituaryRequest(requestNumber || "", {
    query: {
      enabled: !!requestNumber,
      queryKey: getGetObituaryRequestQueryKey(requestNumber || ""),
    }
  });

  const updateMutation = useUpdateObituaryRequest();
  const [copied, setCopied] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);

  // النص المنسوخ يأتي من المولّد الموحّد نفسه الذي تستخدمه صورة التعزية ومعاينة النموذج.
  const announcement = useMemo(() => (req ? buildAnnouncement(req) : null), [req]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(announcement?.text ?? "");
      setCopied(true);
      toast.success("تم نسخ النص بنجاح");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("فشل في نسخ النص");
    }
  };

  const handleStatusChange = (newStatus: any) => {
    if (!req || !requestNumber) return;
    setStatusUpdating(true);
    updateMutation.mutate({
      requestNumber,
      data: { ...req, status: newStatus }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetObituaryRequestQueryKey(requestNumber) });
        queryClient.invalidateQueries({ queryKey: getListObituaryRequestsQueryKey() });
        toast.success("تم تحديث الحالة بنجاح");
      },
      onError: () => {
        toast.error("حدث خطأ أثناء تحديث الحالة");
      },
      onSettled: () => setStatusUpdating(false)
    });
  };

  if (isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  if (error || !req) return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <Card className="border-destructive bg-destructive/5"><CardContent className="flex items-center gap-4 py-8 text-destructive"><AlertCircle className="h-6 w-6" /><p>تعذر تحميل تفاصيل الطلب.</p></CardContent></Card>
    </div>
  );

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4 pb-24">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Link href="/admin">
          <Button variant="ghost" className="gap-2 -ml-4 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />عودة للطلبات
          </Button>
        </Link>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button onClick={() => setLocation(`/admin/${requestNumber}/edit`)} variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
            <Edit className="h-4 w-4" /> تعديل الطلب
          </Button>
          <Button onClick={copyToClipboard} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم النسخ" : "نسخ كنص للعرض"}
          </Button>
          <Button onClick={() => setImageStudioOpen(true)} variant="secondary" className="w-full gap-2 border border-primary/20 sm:w-auto">
            <span className="text-base">صورة</span>
            إنشاء صورة التعزية
          </Button>
        </div>
      </div>

      <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden mb-6">
        <CardHeader className="bg-muted/20 border-b pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">{describeRequestDeceased(req)}</h2>
              {req.messageType && req.messageType !== "announcement" && (
                <div className="mb-2 text-sm font-medium">
                  {MESSAGE_TYPE_LABELS[req.messageType]}
                  {req.relatedRequestNumber && <span className="text-muted-foreground"> — للطلب <span className="font-mono">{req.relatedRequestNumber}</span></span>}
                </div>
              )}
              <div className="text-sm font-mono text-muted-foreground">رقم الطلب: {req.requestNumber}</div>
              <div className="text-xs text-muted-foreground mt-2">
                آخر تعديل: {new Date(req.updatedAt).toLocaleString("ar-QA")}
              </div>
            </div>
            <div className="flex items-center gap-3 bg-card p-2 rounded-lg border shadow-sm w-full sm:w-auto">
              <span className="text-sm font-medium pr-2">الحالة:</span>
              <Select value={req.status} onValueChange={handleStatusChange} disabled={statusUpdating}>
                <SelectTrigger className="w-[140px] h-9 border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">جديد</SelectItem>
                  <SelectItem value="reviewing">قيد المراجعة</SelectItem>
                  <SelectItem value="ready">جاهز</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                </SelectContent>
              </Select>
              {statusUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="grid gap-8 pt-8">
          {/* النص النهائي */}
          {announcement && (
            <section>
              <div className="flex items-center justify-between gap-2 mb-4 border-b pb-2">
                <h4 className="text-lg font-bold text-primary">نص الإعلان</h4>
                <Button type="button" variant="ghost" size="sm" onClick={copyToClipboard} className="gap-1.5 text-primary h-8">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "تم النسخ" : "نسخ"}
                </Button>
              </div>
              {announcement.warnings.length > 0 && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> تنبيهات قبل النشر</p>
                  <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
                    {announcement.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              )}
              <pre dir="rtl" className="whitespace-pre-wrap break-words rounded-md border bg-background p-4 font-sans text-base leading-8">{announcement.text}</pre>
            </section>
          )}

          {/* المتوفون */}
          <section>
            <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">بيانات المتوفين</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              {req.deceasedPeople.map((d, i) => (
                <div key={i} className="bg-muted/10 p-4 rounded-md border">
                  <p className="font-bold text-lg mb-2">{describeDeceased(d, req.relatives)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p>الجنس: <span className="font-medium text-foreground">{genderLabels[d.gender]}</span></p>
                    <p>التعريف: <span className="font-medium text-foreground">{identifyLabels[d.identifyBy ?? "name"]}</span></p>
                    {d.fullName && <p className="col-span-2">الاسم: <span className="font-medium text-foreground">{d.title ? `${d.title} ` : ""}{d.fullName}</span></p>}
                    {d.kunya && <p>الكنية: <span className="font-medium text-foreground">{d.kunya}</span></p>}
                    {d.spouse?.name && (
                      <div className="col-span-2">
                        {d.spouse.kind === "widow" ? "أرملة" : "حرم"}: <span className="font-medium text-foreground">{[d.spouse.title, d.spouse.name].filter(Boolean).join(" ")}</span>
                        {(d.spouse.deceased || d.spouse.kind === "widow") && <Badge variant="outline" className="mx-2 text-[10px] h-4">رحمه الله</Badge>}
                      </div>
                    )}
                    {d.father?.name && (
                      <div className="col-span-2">
                        الأب: <span className="font-medium text-foreground">{[d.father.title, d.father.name].filter(Boolean).join(" ")}</span>
                        {d.father.deceased && <Badge variant="outline" className="mx-2 text-[10px] h-4">رحمه الله</Badge>}
                      </div>
                    )}
                    {!!d.age && <p>العمر: <span className="font-medium text-foreground">{formatAge(d.age, d.ageUnit)}</span></p>}
                    {d.nationality && <p>الجنسية: <span className="font-medium text-foreground">{d.nationality}</span></p>}
                    {d.occupation && <p>الصفة: <span className="font-medium text-foreground">{d.occupation}</span></p>}
                    {d.noChildren && <p>ليس له/لها أبناء</p>}
                    {d.deathPlace && <p className="col-span-2">مكان الوفاة: <span className="font-medium text-foreground">{d.deathPlace}</span></p>}
                    {d.note && <p className="col-span-2">ملاحظة: <span className="font-medium text-foreground">{d.note}</span></p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* الأقارب */}
          {req.relatives?.length > 0 && (
            <section>
              <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">الأقارب</h4>
              <div className="grid gap-4">
                {req.relatives.map((rel, idx) => (
                  <div key={idx} className="bg-muted/10 p-4 rounded-md border">
                    <p className="font-bold text-primary mb-2">
                      {(() => {
                        const key = relationKeyOf(rel);
                        return key === "other" ? rel.relation : RELATION_OPTIONS.find((option) => option.key === key)?.label;
                      })()}
                      {req.deceasedPeople.length > 1 && rel.deceasedIndex != null && (
                        <span className="text-muted-foreground font-normal"> — لـ{describeDeceased(req.deceasedPeople[rel.deceasedIndex] ?? req.deceasedPeople[0])}</span>
                      )}
                      {rel.familyReference && <span className="text-muted-foreground font-normal"> ({rel.familyReference})</span>}
                    </p>
                    {rel.reference?.name && (
                      <p className="text-sm text-muted-foreground mb-2">أبناء {[rel.reference.title, rel.reference.name].filter(Boolean).join(" ")}{rel.reference.deceased ? " رحمه الله" : ""}</p>
                    )}
                    <ul className="space-y-1">
                      {rel.people.map((p, i) => (
                        <li key={i} className="text-sm">
                          • {p.name}
                          {p.deceased && <Badge variant="outline" className="mx-2 text-[10px] h-4">رحمه الله</Badge>}
                          {p.occupation && <span className="text-muted-foreground mx-1">({p.occupation})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* الدفن والصلاة */}
          <section>
            <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">الدفن والصلاة</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-muted/10 p-4 rounded-md border">
                <div className="font-bold mb-3 flex items-center gap-2"><Badge className={req.burial.status === "completed" ? "bg-green-600" : req.burial.status === "postponed" ? "bg-amber-600" : "bg-blue-600"}>{burialStatusLabels[req.burial.status]}</Badge></div>
                <div className="space-y-2 text-sm">
                  {req.burial.day && <p><span className="text-muted-foreground">يوم الدفن:</span> {[req.burial.day, req.burial.weekday].filter(Boolean).join(" ")}</p>}
                  {req.burial.note && <p><span className="text-muted-foreground">ملاحظة الدفن:</span> {req.burial.note}</p>}
                  {req.burial.time && <p><span className="text-muted-foreground">الوقت:</span> {req.burial.time}</p>}
                  {req.burial.outsideQatar ? (
                    <p><span className="text-muted-foreground">مكان الدفن:</span> خارج قطر - {req.burial.outsideLocation}</p>
                  ) : req.burial.cemetery && (
                    <p><span className="text-muted-foreground">المقبرة:</span> {req.burial.cemetery}</p>
                  )}
                  {req.burial.mapLink && <a href={req.burial.mapLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block truncate" dir="ltr">{req.burial.mapLink}</a>}
                </div>
              </div>
              
              {req.prayer.enabled && (
                <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                  <p className="font-bold text-primary mb-3">صلاة الجنازة</p>
                  <div className="space-y-2 text-sm">
                    {req.prayer.day && <p><span className="text-muted-foreground">اليوم:</span> {[req.prayer.day, req.prayer.weekday].filter(Boolean).join(" ")}</p>}
                    {req.prayer.time && <p><span className="text-muted-foreground">الوقت:</span> {req.prayer.time}</p>}
                    {req.prayer.place && <p><span className="text-muted-foreground">المكان:</span> {req.prayer.place}</p>}
                    {req.prayer.mapLink && <a href={req.prayer.mapLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block truncate" dir="ltr">{req.prayer.mapLink}</a>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* العزاء */}
          <section>
            <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">العزاء</h4>
            <p className="text-sm mb-3">
              {req.condolenceOptions.length
                ? req.condolenceOptions.map((option) => optionLabels[option]).join("، ")
                : "لا يوجد عزاء"}
              {req.condolenceOptions.includes("phone") && req.phoneAudience && req.phoneAudience !== "all" && ` (${req.phoneAudience === "women" ? "للنساء" : "للرجال"})`}
              {req.condolenceNote && <span className="text-muted-foreground"> — {req.condolenceNote}</span>}
            </p>
            {req.condolences.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {req.condolences.map((c, i) => (
                  <div key={i} className="bg-muted/10 p-4 rounded-md border">
                    <p className="font-bold text-primary mb-3">
                      عزاء {c.audience === "men" ? "الرجال" : "النساء"}
                      {req.deceasedPeople.length > 1 && c.deceasedIndex != null && req.deceasedPeople[c.deceasedIndex] && (
                        <span className="text-muted-foreground font-normal"> — لـ{describeDeceased(req.deceasedPeople[c.deceasedIndex])}</span>
                      )}
                    </p>
                    <div className="space-y-2 text-sm">
                      {c.start && <p><span className="text-muted-foreground">البداية:</span> {c.start}</p>}
                      {!!c.durationDays && <p><span className="text-muted-foreground">المدة:</span> {formatDurationDays(c.durationDays)}</p>}
                      {c.time && <p><span className="text-muted-foreground">الوقت:</span> {c.time}</p>}
                      {c.until && <p><span className="text-muted-foreground">حتى:</span> {c.until}</p>}
                      {c.schedule?.map((entry, entryIndex) => (
                        <p key={entryIndex}><span className="text-muted-foreground">الجدول:</span> {[entry.days, entry.time].filter(Boolean).join(" ")}</p>
                      ))}
                      {c.location && <p><span className="text-muted-foreground">الموقع:</span> {c.location}</p>}
                      {(c.area || c.street || c.houseNumber || c.buildingNumber || c.floor || c.apartmentNumber) && (
                        <p>
                          <span className="text-muted-foreground">العنوان:</span>{" "}
                          {[
                            c.area && `المنطقة ${c.area}`,
                            c.street && `الشارع ${c.street}`,
                            c.houseNumber && `المنزل ${c.houseNumber}`,
                            c.buildingNumber && `المبنى ${c.buildingNumber}`,
                            c.floor && `الطابق ${c.floor}`,
                            c.apartmentNumber && `الشقة ${c.apartmentNumber}`,
                          ].filter(Boolean).join("، ")}
                        </p>
                      )}
                      {c.locationNotes && <p><span className="text-muted-foreground">ملاحظات المكان:</span> {c.locationNotes}</p>}
                      {c.mapLink && <a href={c.mapLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline block truncate" dir="ltr">{c.mapLink}</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* أرقام التعزية عبر الهاتف */}
          {req.condolenceOptions.includes("phone") && req.condolencePhoneContacts.length > 0 && (
            <section>
              <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">التعزية عبر الهاتف</h4>
              <div className="grid sm:grid-cols-3 gap-4">
                {req.condolencePhoneContacts.map((c, i) => (
                  <div key={i} className="bg-muted/5 p-3 rounded-md border flex justify-between items-center">
                    <div>
                      {c.name && <p className="font-semibold text-sm">{c.name}</p>}
                    </div>
                    {c.phone && <p className="font-mono text-sm" dir="ltr">{c.phone}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ملاحظات */}
          {req.notes && (
            <section>
              <h4 className="text-lg font-bold text-primary mb-4 border-b pb-2">ملاحظات إضافية</h4>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-amber-900">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{req.notes}</p>
              </div>
            </section>
          )}
        </CardContent>
      </Card>
      {imageStudioOpen && <CondolenceImageStudio request={req} onClose={() => setImageStudioOpen(false)} />}
    </div>
  );
}
