import { useLocation } from "wouter";
import { TemplateDesignerModal } from "@/components/template-designer/template-designer-modal";

export default function AdminTemplatesPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <TemplateDesignerModal onClose={() => setLocation("/admin")} />
    </div>
  );
}
