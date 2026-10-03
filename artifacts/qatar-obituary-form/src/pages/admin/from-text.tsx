// «طلب من نص»: يلصق المسؤول نص إعلان وصله دون تعبئة النموذج، فيستخرج الذكاء الاصطناعي البيانات ويُصاغ الإعلان،
// ثم يراجع المسؤول النتيجة ويحفظها كطلب عادي (يُعدَّل وتُنشأ صورته من صفحة الطلب).
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getListObituaryRequestsQueryKey,
  useCreateObituaryRequest,
  useParseObituaryText,
  type ParseTextResult,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, ChevronRight, Copy, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { buildAnnouncement } from "@/lib/announcement";

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

export default function AdminFromTextPage() {
  const [source, setSource] = useState("");
  const [result, setResult] = useState<ParseTextResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [failureDebug, setFailureDebug] = useState("");
  const parse = useParseObituaryText();
  const create = useCreateObituaryRequest();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const announcement = useMemo(() => (result ? buildAnnouncement(result.request).text : ""), [result]);
  const busy = parse.isPending || create.isPending;

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
    if (!result) return;
    create.mutate(
      { data: result.request },
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

      {result && (
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
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 bg-muted/40 border rounded-lg p-4" aria-label="نص الإعلان المصاغ">
              {announcement}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={save} disabled={busy} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ كطلب جديد
              </Button>
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
