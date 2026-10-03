import { useRoute, Link } from "wouter";
import { CheckCircle2, ChevronRight, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** رقم واتساب «وفيات قطر» بصيغة دولية بلا علامة + */
const WAFIYAT_QATAR_WHATSAPP = "97470228822";

export default function SuccessPage() {
  const [, params] = useRoute("/success/:requestNumber");
  const requestNumber = params?.requestNumber;

  const handleCopy = () => {
    if (requestNumber) {
      navigator.clipboard.writeText(requestNumber);
    }
  };

  // إرسال رقم الطلب إلى حساب «وفيات قطر» على واتساب برسالة جاهزة
  const whatsappUrl = `https://wa.me/${WAFIYAT_QATAR_WHATSAPP}?text=${encodeURIComponent(`السلام عليكم، سجّلت طلب إعلان وفاة برقم ${requestNumber ?? ""}، أرجو نشره.`)}`;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 py-20">
      <Card className="max-w-md w-full border-none shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden text-center">
        <div className="bg-green-600 p-8 flex justify-center">
          <div className="bg-white rounded-full p-4 shadow-inner">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
        </div>
        <CardContent className="pt-8 pb-10 px-8">
          <h1 className="text-2xl font-bold mb-4">تم إرسال الطلب بنجاح</h1>
          <p className="text-muted-foreground mb-8">
            تم استلام طلب إعلان الوفاة الخاص بك بنجاح. أرسل رقم الطلب إلى «وفيات قطر» على واتساب ليُراجع ويُنشر.
          </p>

          <div className="bg-muted p-6 rounded-lg mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-2">رقم الطلب الخاص بك</p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-3xl font-bold font-mono tracking-wider">{requestNumber}</span>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">يرجى الاحتفاظ بهذا الرقم لمتابعة حالة الطلب.</p>
          </div>

          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block mb-3">
            <Button type="button" className="w-full h-12 text-base sm:text-lg gap-2 bg-green-600 hover:bg-green-700 text-white font-bold">
              <MessageCircle className="w-5 h-5" />
              إرسال رقم الطلب إلى وفيات قطر عبر واتساب
            </Button>
          </a>

          <Link href="/">
            <Button variant="outline" className="w-full h-12 text-lg">
              العودة للرئيسية
              <ChevronRight className="w-5 h-5 ml-2 rtl:rotate-180" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
