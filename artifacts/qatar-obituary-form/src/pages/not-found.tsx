import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">الصفحة غير موجودة</h2>
      <p className="text-muted-foreground mb-8">
        عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
      </p>
      <Link href="/">
        <Button>العودة للصفحة الرئيسية</Button>
      </Link>
    </div>
  );
}
