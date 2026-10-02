import { useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { useListObituaryRequests, type ObituaryRequest } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, Loader2, AlertCircle, Sliders, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_TYPE_LABELS, buildAnnouncement, describeRequestDeceased } from "@/lib/announcement";

/** نسخ سريع لنص الإعلان من القائمة دون فتح الطلب. */
function QuickCopyButton({ request }: { request: ObituaryRequest }) {
  const [copied, setCopied] = useState(false);
  const copy = async (event: MouseEvent) => {
    // الزر داخل رابط البطاقة: لا ننتقل لصفحة الطلب عند النسخ.
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(buildAnnouncement(request).text);
      setCopied(true);
      toast.success("تم نسخ نص الإعلان");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("فشل في نسخ النص");
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5 shrink-0" aria-label="نسخ نص الإعلان">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "تم النسخ" : "نسخ"}
    </Button>
  );
}

export default function AdminPage() {
  const { data: requests, isLoading, error } = useListObituaryRequests();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <Badge variant="default" className="bg-blue-600">جديد</Badge>;
      case 'reviewing': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">قيد المراجعة</Badge>;
      case 'ready': return <Badge variant="outline" className="border-green-500 text-green-700">جاهز</Badge>;
      case 'completed': return <Badge className="bg-green-600">مكتمل</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">لوحة الإدارة</h1>
          <p className="text-muted-foreground">عرض وإدارة طلبات إعلان الوفاة</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/templates">
            <Button variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
              <Sliders className="h-4 w-4" />
              محرر القوالب البصري
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-4 py-8 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <p>حدث خطأ أثناء تحميل الطلبات. يرجى المحاولة مرة أخرى.</p>
          </CardContent>
        </Card>
      ) : requests?.length === 0 ? (
        <Card className="bg-muted/30 border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
            <FileText className="h-12 w-12 opacity-20" />
            <p>لا توجد طلبات حالية.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests?.map((req) => (
            <Link key={req.id} href={`/admin/${req.requestNumber}`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                        {describeRequestDeceased(req)}
                      </h3>
                      {getStatusBadge(req.status)}
                      {req.messageType && req.messageType !== "announcement" && (
                        <Badge variant="outline">{MESSAGE_TYPE_LABELS[req.messageType]}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-4 divide-x divide-x-reverse divide-border">
                      <span>رقم: <span className="font-mono">{req.requestNumber}</span></span>
                      <span className="pr-4">تحديث: {new Date(req.updatedAt).toLocaleDateString('ar-QA')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <QuickCopyButton request={req} />
                    <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors rtl:rotate-180" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
