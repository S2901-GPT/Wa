// مركز التجارب (/admin/lab): يُفتح بالعنوان فقط. منه تجربة الصورة، ولوحة المسؤول المعزولة على مجموعة
// التجارب، وصفحة السلوك. وفيه حالة قواعد Firestore لمجموعات التجارب، ونسخ الطلبات الحية إليها، وتفريغها.
import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getGetLabStatusQueryKey,
  getImportLabRequestsMutationOptions,
  getListLabObituaryRequestsQueryKey,
  getResetLabRequestsMutationOptions,
  useGetLabStatus,
  type LabStoreState,
} from "@workspace/api-client-react";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Copy, FlaskConical, ImageIcon, LayoutDashboard, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATE_LABEL: Record<LabStoreState, { text: string; ok: boolean }> = {
  ok: { text: "القواعد منشورة ✓", ok: true },
  "rules-missing": { text: "قواعد Firestore غير منشورة بعد", ok: false },
  offline: { text: "لا اتصال بقاعدة البيانات (نسخة محلية؟)", ok: false },
};

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return fallback;
}

function StoreState({ label, state }: { label: string; state: LabStoreState }) {
  const info = STATE_LABEL[state];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${info.ok ? "border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-300" : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
      {info.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span className="font-bold">{label}:</span>
      <span>{info.text}</span>
    </div>
  );
}

function Tile({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="mt-0.5 text-primary">{icon}</span>
          <span>
            <span className="block font-bold">{title}</span>
            <span className="block text-sm text-muted-foreground">{text}</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AdminLabHubPage() {
  const queryClient = useQueryClient();
  const status = useGetLabStatus({ query: { queryKey: getGetLabStatusQueryKey(), retry: false } });
  const [resetOpen, setResetOpen] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetLabStatusQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListLabObituaryRequestsQueryKey() });
  };
  const importAll = useMutation({
    ...getImportLabRequestsMutationOptions(),
    onSuccess: (result) => {
      toast.success(`نُسخ ${result.count} طلباً إلى التجارب`);
      refresh();
    },
    onError: (error) => toast.error(errorText(error, "تعذر النسخ")),
  });
  const reset = useMutation({
    ...getResetLabRequestsMutationOptions(),
    onSuccess: (result) => {
      toast.success(`حُذف ${result.count} طلباً من التجارب`);
      setResetOpen(false);
      refresh();
    },
    onError: (error) => toast.error(errorText(error, "تعذر التفريغ")),
  });

  const rulesReady = status.data?.labRequests === "ok";

  return (
    <div className="container max-w-3xl mx-auto py-10 px-4" dir="rtl">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronRight className="h-4 w-4" />
        عودة للطلبات
      </Link>

      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-primary">
        <FlaskConical className="h-6 w-6" />
        التجارب
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">كل ما هنا منفصل عن الموقع: لوحة التجارب تعمل على مجموعة طلبات مستقلة، ولا يراها الجمهور.</p>

      <div className="mb-6 space-y-2">
        {status.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />جارٍ فحص الحالة…</p>
        )}
        {status.error && <p className="text-sm text-destructive">{errorText(status.error, "تعذر فحص الحالة")}</p>}
        {status.data && (
          <>
            <StoreState label="طلبات التجارب" state={status.data.labRequests} />
            <StoreState label="زيارات النموذج" state={status.data.formVisits} />
            <p className="text-sm text-muted-foreground">
              طلبات التجارب الحالية: <span className="font-mono font-bold text-foreground">{status.data.count}</span>
            </p>
          </>
        )}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Tile href="/admin/lab/poster" icon={<ImageIcon className="h-5 w-5" />} title="تجربة الصورة" text="مقاس المنصات والتصدير JPEG" />
        <Tile href="/admin/lab/admin" icon={<LayoutDashboard className="h-5 w-5" />} title="لوحة التجارب" text="لوحة المسؤول كاملة على طلبات التجارب" />
        <Tile href="/admin/lab/behaviour" icon={<Activity className="h-5 w-5" />} title="السلوك" text="مصدر كل طلب وتعديلاته وما تغيّر فيها" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => importAll.mutate()} disabled={!rulesReady || importAll.isPending} className="gap-2">
          {importAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          نسخ الطلبات الحالية إلى التجارب
        </Button>
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" disabled={!rulesReady} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
              تفريغ التجارب
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تفريغ طلبات التجارب؟</AlertDialogTitle>
              <AlertDialogDescription>تُحذف كل طلبات التجارب. الطلبات الحية في الموقع لا تتأثر.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  reset.mutate();
                }}
                disabled={reset.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "تفريغ"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {!rulesReady && status.data && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">النسخ والتفريغ معطّلان حتى تُنشر قواعد Firestore لمجموعة التجارب.</p>
      )}
    </div>
  );
}
