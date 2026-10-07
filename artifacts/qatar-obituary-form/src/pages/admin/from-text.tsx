// «طلب من نص»: يلصق المسؤول نص إعلان وصله دون تعبئة النموذج، فيستخرج الذكاء الاصطناعي البيانات ويُصاغ الإعلان،
// ثم يراجع المسؤول النتيجة — ويصحّح ما شاء من «تعديل سريع» — ويحفظها طلباً جديداً، أو يحدّث بها طلباً سابقاً للمتوفى نفسه.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getGetObituaryRequestQueryKey,
  getListObituaryRequestsQueryKey,
  useCreateObituaryRequest,
  useListObituaryRequests,
  useParseObituaryText,
  useUpdateObituaryRequest,
  type ObituaryRequest,
  type ObituaryRequestInput,
  type ParseTextResult,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, ChevronRight, Copy, ExternalLink, Loader2, Pencil, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAnnouncement, describeRequestDeceased } from "@/lib/announcement";
import { DUPLICATE_WINDOW_HOURS, findRecentDuplicates } from "@/lib/duplicate-requests";

const MAX_LENGTH = 8000;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return fallback;
}

function errorDebug(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { debug?: string } | null;
    return data?.debug ?? "";
  }
  return "";
}

/** ردّ النموذج الخام عند الفشل: يراه المسؤول ليرسله لمن يتابع التطبيق بدل أن يضيع في السجلات. */
function DebugDetails({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-semibold">تفاصيل تقنية (ردّ النموذج)</summary>
      <pre dir="ltr" className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-left">{text}</pre>
    </details>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-9 text-sm" />
    </div>
  );
}

const AUDIENCE_LABELS = { men: "عزاء الرجال", women: "عزاء النساء" } as const;

/**
 * تعديل سريع لما يخطئ فيه الذكاء الاصطناعي غالباً (المقبرة، موعد الدفن، مقرات العزاء وأوقاتها، الملاحظات)
 * قبل الحفظ، فلا يضطر المسؤول إلى حفظ الطلب ثم فتحه للتعديل. ما عدا ذلك يُعدَّل من صفحة الطلب.
 */
function QuickEdit({ request, onChange }: { request: ObituaryRequestInput; onChange: (next: ObituaryRequestInput) => void }) {
  const burial = request.burial;
  const patchBurial = (patch: Partial<typeof burial>) => onChange({ ...request, burial: { ...burial, ...patch } });
  const patchCard = (index: number, patch: Record<string, string>) =>
    onChange({ ...request, condolences: request.condolences.map((card, at) => (at === index ? { ...card, ...patch } : card)) });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
      <div className="space-y-2">
        <div className="text-xs font-bold text-foreground">الدفن</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field id="quick-burial-day" label="يوم الدفن" value={burial.day ?? ""} placeholder="اليوم، غداً، أو التاريخ" onChange={(day) => patchBurial({ day })} />
          <Field id="quick-burial-time" label="وقت الدفن" value={burial.time ?? ""} placeholder="بعد صلاة العصر" onChange={(time) => patchBurial({ time })} />
          {burial.outsideQatar ? (
            <Field id="quick-burial-place" label="مكان الدفن" value={burial.outsideLocation ?? ""} placeholder="لندن" onChange={(outsideLocation) => patchBurial({ outsideLocation })} />
          ) : (
            <Field id="quick-burial-cemetery" label="المقبرة" value={burial.cemetery ?? ""} placeholder="مقبرة مسيمير" onChange={(cemetery) => patchBurial({ cemetery })} />
          )}
        </div>
      </div>

      {request.condolences.map((card, index) => (
        <div key={index} className="space-y-2">
          <div className="text-xs font-bold text-foreground">
            {AUDIENCE_LABELS[card.audience]}
            {request.condolences.filter((other) => other.audience === card.audience).length > 1 && ` (${index + 1})`}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field id={`quick-venue-${index}-location`} label={`مقر ${AUDIENCE_LABELS[card.audience]}`} value={card.location ?? ""} placeholder="مجلس العائلة" onChange={(location) => patchCard(index, { location })} />
            <Field id={`quick-venue-${index}-area`} label="المنطقة" value={card.area ?? ""} placeholder="الوكرة" onChange={(area) => patchCard(index, { area })} />
            <Field id={`quick-venue-${index}-time`} label={`وقت ${AUDIENCE_LABELS[card.audience]}`} value={card.time ?? ""} placeholder="من 4:00 مساءً إلى 9:00 مساءً" onChange={(time) => patchCard(index, { time })} />
          </div>
        </div>
      ))}

      <Field id="quick-notes" label="ملاحظة على الإعلان" value={request.notes ?? ""} placeholder="تُكتب في آخر الإعلان" onChange={(notes) => onChange({ ...request, notes })} />
    </div>
  );
}

/** طلبات سابقة للمتوفى نفسه خلال 48 ساعة: تنبيه قبل إنشاء نسخة ثانية منه. */
function DuplicateNotice({ matches }: { matches: ReturnType<typeof findRecentDuplicates> }) {
  if (!matches.length) return null;
  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {matches.length > 1 ? `توجد ${matches.length} طلبات سابقة بالاسم نفسه` : "يوجد طلب سابق بالاسم نفسه"}
      </div>
      <ul className="space-y-1 pr-1">
        {matches.map(({ request, name }) => (
          <li key={request.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {`طلب باسم «${name}» برقم `}
              <span className="font-mono font-semibold">{request.requestNumber}</span>
            </span>
            <Link
              href={`/admin/${request.requestNumber}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              معاينة
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] opacity-90">
        {`تُفحص الطلبات المسجّلة خلال ${DUPLICATE_WINDOW_HOURS} ساعة. حدّث الطلب القائم بدل حفظ نسخة ثانية منه، إن كان المتوفى نفسه.`}
      </p>
    </div>
  );
}

export default function AdminFromTextPage() {
  const [source, setSource] = useState("");
  const [result, setResult] = useState<ParseTextResult | null>(null);
  const [draft, setDraft] = useState<ObituaryRequestInput | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failureDebug, setFailureDebug] = useState("");
  const parse = useParseObituaryText();
  const create = useCreateObituaryRequest();
  const update = useUpdateObituaryRequest();
  const { data: requests } = useListObituaryRequests();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // النتيجة تُنسخ إلى مسوّدة قابلة للتعديل، فيبقى ردّ النموذج كما هو للمقارنة في «تفاصيل تقنية».
  useEffect(() => {
    setDraft(result ? result.request : null);
    setEditing(false);
  }, [result]);

  const announcement = useMemo(() => (draft ? buildAnnouncement(draft).text : ""), [draft]);
  const duplicates = useMemo(
    () => (draft ? findRecentDuplicates(draft, requests ?? []) : []),
    [draft, requests],
  );
  const busy = parse.isPending || create.isPending || update.isPending;

  const run = () => {
    const text = source.trim();
    if (!text) return;
    setResult(null);
    setFailureDebug("");
    parse.mutate(
      { data: { text } },
      {
        onSuccess: (data) => setResult(data),
        onError: (error) => {
          setFailureDebug(errorDebug(error));
          toast.error(errorMessage(error, "تعذّرت الصياغة، حاول مرة أخرى."));
        },
      },
    );
  };

  const save = () => {
    if (!draft) return;
    create.mutate(
      { data: draft },
      {
        onSuccess: async (row) => {
          await queryClient.invalidateQueries({ queryKey: getListObituaryRequestsQueryKey() });
          toast.success(`تم حفظ الطلب ${row.requestNumber}`);
          navigate(`/admin/${row.requestNumber}`);
        },
        onError: (error) => toast.error(errorMessage(error, "تعذّر حفظ الطلب، حاول مرة أخرى.")),
      },
    );
  };

  // الطلب القائم يبقى بحالته (جديد، جاهز…)؛ التحديث يبدّل بياناته فقط
  const updateExisting = (existing: ObituaryRequest) => {
    if (!draft) return;
    const requestNumber = existing.requestNumber;
    update.mutate(
      { requestNumber, data: { ...draft, status: existing.status } },
      {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetObituaryRequestQueryKey(requestNumber) }),
            queryClient.invalidateQueries({ queryKey: getListObituaryRequestsQueryKey() }),
          ]);
          toast.success(`تم تحديث الطلب ${requestNumber}`);
          navigate(`/admin/${requestNumber}`);
        },
        onError: (error) => toast.error(errorMessage(error, "تعذّر تحديث الطلب، حاول مرة أخرى.")),
      },
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(announcement);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("تم نسخ النص");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronRight className="h-4 w-4" />
        عودة للطلبات
      </Link>

      <h1 className="text-3xl font-bold text-primary mb-2">طلب من نص</h1>
      <p className="text-muted-foreground mb-6">
        الصق النص كما وصلك (من واتساب أو غيره)، وسيستخرج الذكاء الاصطناعي البيانات ويصوغ الإعلان. راجع النتيجة ثم احفظها كطلب.
      </p>

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <Textarea
            value={source}
            onChange={(event) => setSource(event.target.value.slice(0, MAX_LENGTH))}
            placeholder="مثال: انتقل إلى رحمة الله تعالى الوالد / فلان بن فلان، والدفن اليوم بعد صلاة العصر في مقبرة مسيمير، والعزاء للرجال في مجلس العائلة…"
            className="min-h-48 text-base leading-7"
            aria-label="نص الإعلان"
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono" dir="ltr">{source.length}/{MAX_LENGTH}</span>
            <Button type="button" onClick={run} disabled={!source.trim() || busy} className="gap-2">
              {parse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {parse.isPending ? "جارٍ الصياغة…" : "صياغة بالذكاء الاصطناعي"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result && failureDebug && (
        <div className="mb-6">
          <DebugDetails text={failureDebug} />
        </div>
      )}

      {result && draft && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-primary">النتيجة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  راجع قبل الحفظ
                </div>
                <ul className="list-disc pr-5 space-y-0.5">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <DuplicateNotice matches={duplicates} />

            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 bg-muted/40 border rounded-lg p-4" aria-label="نص الإعلان المصاغ">
              {announcement}
            </pre>

            <div>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-primary" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "إخفاء التعديل السريع" : "تعديل سريع"}
              </Button>
              {editing && (
                <div className="mt-2">
                  <QuickEdit request={draft} onChange={setDraft} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={save} disabled={busy} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ كطلب جديد
              </Button>
              {duplicates.map(({ request }) => (
                <Button
                  key={request.id}
                  type="button"
                  variant="outline"
                  onClick={() => updateExisting(request)}
                  disabled={busy}
                  className="gap-2 border-orange-300 text-orange-900 hover:bg-orange-50 dark:text-orange-200"
                  title={describeRequestDeceased(request)}
                >
                  {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {`تحديث الطلب ${request.requestNumber}`}
                </Button>
              ))}
              <Button type="button" variant="outline" onClick={copy} disabled={busy} className="gap-2">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "تم النسخ" : "نسخ النص"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">بعد الحفظ تستطيع تعديل الطلب وإنشاء صورته من صفحة الطلب.</p>
            {result.debug && <DebugDetails text={result.debug} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
