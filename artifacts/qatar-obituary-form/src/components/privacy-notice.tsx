// إشعار الخصوصية: رابط صغير أسفل النموذج يفتح نافذة بالنص. الموقع لا يجمع شيئاً عن المرسل، وكل ما يُدخل يُحذف
// بعد مدة الاحتفاظ (الرقم نفسه في `lib/db/src/retention.ts`).
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const RETENTION_HOURS = 48;

export const PRIVACY_NOTICE = [
  "البيانات التي تُدخلها في هذا النموذج (اسم المتوفى، وأسماء ذويه، ومواعيد الدفن والعزاء ومقرّاته) تُقدَّم بموافقتك لغرض وحيد هو نشر إعلان الوفاة، وتُعالَج وفق قانون حماية خصوصية البيانات الشخصية رقم (13) لسنة 2016.",
  "لا يجمع هذا الموقع أي بيانات عنك أنت: لا اسمك ولا رقم هاتفك ولا موقعك ولا بيانات جهازك، ولا يستخدم أدوات تتبّع أو تحليل، ولا يحمّل شيئاً من جهات خارجية عند تصفّحه.",
  `تُحذف جميع البيانات التي أدخلتها تلقائياً خلال ${RETENTION_HOURS} ساعة من إرسال الطلب، ولا يبقى بعدها أي اسم أو نص. وخلال هذه المدة يمكنك تعديل الإعلان بإدخال رقم طلبك في هذا النموذج.`,
];

export function PrivacyNotice() {
  return (
    <div className="mt-4 text-center">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            الخصوصية
          </button>
        </DialogTrigger>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pe-8 text-right">إشعار الخصوصية</DialogTitle>
            <DialogDescription className="sr-only">ما يُحفظ من بيانات النموذج وما لا يُجمع عن المرسل</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-7 text-foreground">
            {PRIVACY_NOTICE.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
