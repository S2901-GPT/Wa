import { Link } from "wouter";
import { useListObituaryRequests } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { MESSAGE_TYPE_LABELS, describeRequestDeceased } from "@/lib/announcement";

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
                  <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors rtl:rotate-180" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
