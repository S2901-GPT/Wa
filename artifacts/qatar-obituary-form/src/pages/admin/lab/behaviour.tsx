// سلوك الطلبات (/admin/lab/behaviour): لكل طلب من أين جاء (نموذج الجمهور، طلب من نص، المسؤول)، والنص الأصلي
// مقابل الإعلان الناتج، وتحذيرات الذكاء الاصطناعي وردّه، وكل تعديل وما تغيّر فيه، والطلبات المكررة للمتوفى نفسه.
// قراءة فقط. الطلبات الأقدم من هذه الميزة ليس لها سجل. وبعد 48 ساعة يُحذف محتوى الطلب ولا يبقى منه إلا إحصاء
// مجهَّل (القناة، وعدد التعديلات، وأسماء الحقول التي تغيّرت) يُعرض في قسم مستقل أسفل القائمة.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { ExpiredRequestStat, HistoryEntry, ObituaryRequest } from "@workspace/api-client-react";
import { Activity, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buildAnnouncement, describeRequestDeceased } from "@/lib/announcement";
import { DUPLICATE_WINDOW_HOURS, findRecentDuplicates } from "@/lib/duplicate-requests";
import { RequestsScopeProvider, useExpiredRequests, useRequestsList, type RequestsScope } from "@/lib/requests-api";
import { RETENTION_HOURS } from "@/components/privacy-notice";

const CHANNEL_LABEL: Record<string, string> = { form: "نموذج الجمهور", from_text: "طلب من نص", admin_edit: "المسؤول" };
const CHANNEL_STYLE: Record<string, string> = {
  form: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
  from_text: "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/30",
  admin_edit: "bg-muted text-foreground border-border",
};
const STATUS_LABEL: Record<string, string> = { new: "جديد", reviewing: "قيد المراجعة", ready: "جاهز", completed: "مكتمل" };

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("ar-QA", { timeZone: "Asia/Qatar", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

function ChannelBadge({ channel, inferred = false }: { channel?: string; inferred?: boolean }) {
  const known = channel && CHANNEL_LABEL[channel];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${known ? CHANNEL_STYLE[channel!] : "border-border text-muted-foreground"} ${inferred ? "border-dashed" : ""}`}>
      {known ? `${known}${inferred ? " (مستنتج)" : ""}` : "بلا سجل (قديم)"}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** الطلبات للمتوفى نفسه خلال ٤٨ ساعة قبل الطلب أو بعده. */
function nearDuplicates(request: ObituaryRequest, all: ObituaryRequest[]): ObituaryRequest[] {
  const created = Date.parse(request.createdAt);
  if (!Number.isFinite(created)) return [];
  const until = new Date(created + DUPLICATE_WINDOW_HOURS * 3600 * 1000);
  return findRecentDuplicates(request, all, until, { windowHours: DUPLICATE_WINDOW_HOURS * 2, excludeRequestNumber: request.requestNumber })
    .map((match) => match.request)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function Details({ request, all, base }: { request: ObituaryRequest; all: ObituaryRequest[]; base: string }) {
  const audit = request.audit;
  const history: HistoryEntry[] = request.history ?? [];
  const announcement = useMemo(() => buildAnnouncement(request).text, [request]);
  const duplicates = useMemo(() => nearDuplicates(request, all), [request, all]);

  return (
    <div className="border-t bg-muted/30 px-3 py-4 text-sm">
      {!audit && !history.length && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
          هذا الطلب أقدم من تسجيل السلوك، فليس له مصدر ولا سجل تعديلات.
        </p>
      )}
      {audit?.inferred && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
          سُجّل هذا الطلب قبل تفعيل السجل. المصدر ومواعيد التعديلات مستنتجة من سجلات الخادم؛ النص الأصلي وتفاصيل التعديلات غير متوفرة.
        </p>
      )}

      <Section title="الجدول الزمني">
        <ol className="space-y-3 border-r-2 border-border pr-3">
          {history.length === 0 && (
            <li>
              <span className="font-bold">{when(request.createdAt)}</span> — أُنشئ الطلب
              {request.updatedAt !== request.createdAt && <span className="text-muted-foreground"> · آخر تعديل {when(request.updatedAt)} (بلا تفاصيل)</span>}
            </li>
          )}
          {history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-bold">{when(entry.at)}</span>
                <ChannelBadge channel={entry.channel} inferred={!!audit?.inferred} />
              </div>
              <ul className="list-disc space-y-0.5 pr-5 text-foreground/90">
                {entry.changes.map((change, i) => <li key={i}>{change}</li>)}
              </ul>
              {entry.sourceText && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-primary">النص الذي حُدِّث منه</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-2 font-sans text-xs leading-5">{entry.sourceText}</pre>
                </details>
              )}
              {entry.aiWarnings && entry.aiWarnings.length > 0 && (
                <ul className="mt-1 list-disc pr-5 text-xs text-amber-700 dark:text-amber-300">
                  {entry.aiWarnings.map((warning, i) => <li key={i}>{warning}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {audit?.sourceText && (
        <Section title="النص الأصلي مقابل الإعلان الناتج">
          <div className="grid gap-2 sm:grid-cols-2">
            <pre className="whitespace-pre-wrap rounded-md border bg-background p-2 font-sans text-xs leading-5">{audit.sourceText}</pre>
            <pre className="whitespace-pre-wrap rounded-md border bg-background p-2 font-sans text-xs leading-5">{announcement}</pre>
          </div>
        </Section>
      )}

      {audit?.aiWarnings && audit.aiWarnings.length > 0 && (
        <Section title="تحذيرات الذكاء الاصطناعي عند الإنشاء">
          <ul className="list-disc space-y-0.5 pr-5 text-amber-800 dark:text-amber-300">
            {audit.aiWarnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        </Section>
      )}

      {audit?.aiReply && (
        <Section title={`ردّ الذكاء الاصطناعي الخام${audit.model ? ` (${audit.model})` : ""}`}>
          <details>
            <summary className="cursor-pointer text-xs text-primary">إظهار</summary>
            <pre dir="ltr" className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-2 text-left text-[11px] leading-4">{audit.aiReply}</pre>
          </details>
        </Section>
      )}

      <Section title={`طلبات للمتوفى نفسه خلال ${DUPLICATE_WINDOW_HOURS} ساعة`}>
        {duplicates.length === 0 ? (
          <p className="text-muted-foreground">لا يوجد.</p>
        ) : (
          <ul className="space-y-1">
            {duplicates.map((other) => (
              <li key={other.requestNumber} className="flex flex-wrap items-center gap-2">
                <Link href={`${base}/${other.requestNumber}`} className="font-mono text-primary hover:underline">{other.requestNumber}</Link>
                <span>{when(other.createdAt)}</span>
                <ChannelBadge channel={other.audit?.channel ?? other.history?.[0]?.channel} inferred={!!other.audit?.inferred} />
                <span className="text-muted-foreground">{STATUS_LABEL[other.status] ?? other.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Link href={`${base}/${request.requestNumber}`} className="text-primary hover:underline">فتح الطلب ←</Link>
    </div>
  );
}

/** الطلبات التي انتهت مدة الاحتفاظ بها: لا اسم ولا نص، فقط ما يفيد في تحسين النموذج. */
function ExpiredList() {
  const { data, isLoading, error } = useExpiredRequests();
  const [open, setOpen] = useState<string | null>(null);
  const stats = data ?? [];
  if (isLoading) return null;
  if (error) return <p className="mt-6 text-sm text-destructive">تعذّر تحميل الطلبات المجهَّلة.</p>;
  return (
    <section className="mt-8" aria-label="طلبات مجهَّلة">
      <h2 className="mb-1 text-base font-bold">طلبات انتهت مدة الاحتفاظ بها ({stats.length})</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        بعد {RETENTION_HOURS} ساعة من الإرسال يُحذف محتوى الطلب نهائياً، ولا يبقى إلا مصدره وعدد تعديلاته وأسماء الحقول التي تغيّرت وتحذيرات الذكاء الاصطناعي.
      </p>
      {stats.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد بعد.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {stats.map((stat) => {
            const expanded = open === stat.requestNumber;
            return (
              <div key={stat.requestNumber} className="border-b last:border-b-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : stat.requestNumber)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-right hover:bg-muted/50"
                >
                  {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-muted-foreground">{stat.requestNumber}</span>
                      <span className="font-bold text-muted-foreground">مجهَّل</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ChannelBadge channel={stat.channel} inferred={!!stat.inferred} />
                      <span>{when(stat.createdAt)}</span>
                      {stat.edits > 0 && <span>· {stat.edits} تعديل</span>}
                      <span>· {STATUS_LABEL[stat.status] ?? stat.status}</span>
                    </span>
                  </span>
                </button>
                {expanded && (
                  <div className="border-t bg-muted/30 px-3 py-4 text-sm">
                    <Section title="الحقول التي تغيّرت">
                      <ol className="space-y-3 border-r-2 border-border pr-3">
                        {stat.history.map((entry, index) => (
                          <li key={`${entry.at}-${index}`}>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="font-bold">{when(entry.at)}</span>
                              <ChannelBadge channel={entry.channel} inferred={!!stat.inferred} />
                            </div>
                            <ul className="list-disc space-y-0.5 pr-5 text-foreground/90">
                              {entry.fields.map((field, i) => <li key={i}>{field}</li>)}
                            </ul>
                          </li>
                        ))}
                        {stat.history.length === 0 && <li className="text-muted-foreground">بلا سجل (طلب قديم).</li>}
                      </ol>
                    </Section>
                    {stat.aiWarnings && stat.aiWarnings.length > 0 && (
                      <Section title="تحذيرات الذكاء الاصطناعي عند الإنشاء">
                        <ul className="list-disc space-y-0.5 pr-5 text-amber-800 dark:text-amber-300">
                          {stat.aiWarnings.map((warning, i) => <li key={i}>{warning}</li>)}
                        </ul>
                      </Section>
                    )}
                    <p className="text-xs text-muted-foreground">حُذف المحتوى في {when(stat.expiredAt)}{stat.model ? ` · ${stat.model}` : ""}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BehaviourList({ scope }: { scope: RequestsScope }) {
  const { data, isLoading, error } = useRequestsList();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const base = scope === "lab" ? "/admin/lab/admin" : "/admin";

  const rows = useMemo(() => {
    const all = [...(data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const q = query.trim();
    return {
      all,
      shown: q ? all.filter((r) => r.requestNumber.includes(q) || describeRequestDeceased(r).includes(q)) : all,
    };
  }, [data, query]);

  if (isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">تعذّر تحميل الطلبات{scope === "lab" ? " (هل نُشرت قواعد التجارب؟)" : ""}.</p>;

  return (
    <>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو رقم الطلب" className="mb-3" aria-label="بحث" />
      <p className="mb-2 text-xs text-muted-foreground">{rows.shown.length} طلباً</p>
      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.shown.map((request) => {
          const expanded = open === request.requestNumber;
          const channel = request.audit?.channel ?? request.history?.[0]?.channel;
          const edits = Math.max(0, (request.history?.length ?? 0) - 1);
          const dupes = nearDuplicates(request, rows.all).length;
          return (
            <div key={request.requestNumber} className="border-b last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : request.requestNumber)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-right hover:bg-muted/50"
              >
                {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs text-muted-foreground">{request.requestNumber}</span>
                    <span className="font-bold">{describeRequestDeceased(request) || "بلا اسم"}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ChannelBadge channel={channel} inferred={!!request.audit?.inferred} />
                    <span>{when(request.createdAt)}</span>
                    {edits > 0 && <span>· {edits} تعديل</span>}
                    {dupes > 0 && <span className="font-bold text-amber-700 dark:text-amber-300">· مكرر ({dupes + 1} طلبات)</span>}
                  </span>
                </span>
              </button>
              {expanded && <Details request={request} all={rows.all} base={base} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function AdminLabBehaviourPage() {
  const [scope, setScope] = useState<RequestsScope>("live");
  return (
    <div className="container max-w-3xl mx-auto py-10 px-4" dir="rtl">
      <Link href="/admin/lab" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-4 w-4" />
        عودة إلى التجارب
      </Link>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-primary">
        <Activity className="h-6 w-6" />
        سلوك الطلبات
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">لكل طلب خلال {RETENTION_HOURS} ساعة من إرساله: مصدره، والنص الأصلي، وتحذيرات الذكاء الاصطناعي، وكل تعديل وما تغيّر فيه. قراءة فقط.</p>
      <div className="mb-4 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="المصدر">
        {(["live", "lab"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={scope === option}
            onClick={() => setScope(option)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${scope === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}
          >
            {option === "live" ? "طلبات الموقع" : "طلبات التجارب"}
          </button>
        ))}
      </div>
      <RequestsScopeProvider scope={scope}>
        <BehaviourList key={scope} scope={scope} />
        <ExpiredList key={`expired-${scope}`} />
      </RequestsScopeProvider>
    </div>
  );
}
