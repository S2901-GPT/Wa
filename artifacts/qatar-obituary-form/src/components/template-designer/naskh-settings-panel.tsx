import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CondolenceTemplate, SocialNetwork, TemplateBranding } from "@/lib/template-schema";
import { resolveNaskhBranding } from "@/lib/naskh-poster-engine";

const SOCIAL_OPTIONS: Array<{ id: SocialNetwork; label: string }> = [
  { id: "instagram", label: "إنستغرام" },
  { id: "snapchat", label: "سناب شات" },
  { id: "x", label: "إكس" },
];
const HEIGHT_OPTIONS = [1350, 1620, 1800];
const LOGO_MAX_SIDE = 256;
const LOGO_MAX_BYTES = 150 * 1024;

/** يقرأ ملف الشعار ويصغّره إلى 256 بكسل PNG بخلفية شفافة حتى يبقى مستند القالب صغيراً. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode"));
      image.src = url;
    });
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function NaskhSettingsPanel({
  template,
  onUpdateTemplate,
}: {
  template: CondolenceTemplate;
  onUpdateTemplate: (partial: Partial<CondolenceTemplate>) => void;
}) {
  const branding = resolveNaskhBranding(template);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const update = (partial: Partial<TemplateBranding>) => onUpdateTemplate({ branding: { ...template.branding, ...partial } });

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      if (dataUrl.length > LOGO_MAX_BYTES) {
        toast.error("الشعار كبير جداً بعد التصغير؛ استخدم صورة أبسط أو أصغر");
        return;
      }
      update({ logoDataUrl: dataUrl });
      toast.success("تم وضع الشعار في الصورة");
    } catch {
      toast.error("تعذر قراءة ملف الشعار");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleSocial = (id: SocialNetwork, enabled: boolean) => {
    const current = branding.socials;
    const next = enabled ? [...SOCIAL_OPTIONS.map((option) => option.id).filter((option) => option === id || current.includes(option))] : current.filter((option) => option !== id);
    update({ socials: next });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs" data-testid="naskh-settings-panel">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        هذا القالب انسيابي: الأقسام تظهر حسب البيانات، وتطول الصورة تلقائياً عند كثرة الأسماء. تُضبط هنا هوية الإعلان فقط وتظهر في كل الصور.
      </p>

      <section className="space-y-2">
        <Label className="text-xs font-bold">الشعار (يمين الشريط السفلي)</Label>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center overflow-hidden">
            {branding.logoDataUrl ? (
              <img src={branding.logoDataUrl} alt="الشعار" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">بلا شعار</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(event) => void handleLogoFile(event.target.files?.[0])}
              data-testid="naskh-logo-input"
            />
            <Button type="button" size="sm" variant="outline" className="gap-1.5 h-8" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImageUp className="h-3.5 w-3.5" />
              رفع الشعار
            </Button>
            {branding.logoDataUrl && (
              <Button type="button" size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive" onClick={() => update({ logoDataUrl: undefined })}>
                <Trash2 className="h-3.5 w-3.5" />
                إزالة الشعار
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">يفضَّل PNG بخلفية شفافة. يُصغَّر تلقائياً إلى 256 بكسل.</p>
      </section>

      <section className="space-y-2">
        <Label htmlFor="naskh-handle" className="text-xs font-bold">اسم الحساب (يسار الشريط السفلي)</Label>
        <Input
          id="naskh-handle"
          dir="ltr"
          className="h-9 text-left font-mono"
          value={branding.handle}
          placeholder="qatarde"
          onChange={(event) => update({ handle: event.target.value })}
        />
      </section>

      <section className="space-y-2">
        <Label className="text-xs font-bold">حسابات التواصل الاجتماعي</Label>
        <div className="space-y-2">
          {SOCIAL_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>{option.label}</span>
              <Switch checked={branding.socials.includes(option.id)} onCheckedChange={(checked) => toggleSocial(option.id, checked)} />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs font-bold">الحد الأقصى لطول الصورة</Label>
        <div className="grid grid-cols-3 gap-2">
          {HEIGHT_OPTIONS.map((height) => (
            <button
              key={height}
              type="button"
              onClick={() => update({ maxHeight: height })}
              className={`rounded-lg border px-2 py-2 font-mono ${branding.maxHeight === height ? "border-primary bg-primary/10 text-primary font-bold" : "border-border hover:bg-muted/50"}`}
            >
              {height}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">تبدأ الصورة بطول 1350 وتطول عند الحاجة حتى هذا الحد، ولا يقل النص عن 32 بكسل.</p>
      </section>
    </div>
  );
}
