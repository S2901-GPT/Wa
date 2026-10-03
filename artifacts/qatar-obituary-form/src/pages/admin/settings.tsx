// إعدادات لوحة الإدارة: هوية صورة التعزية (الشعار، اسم الحساب، أيقونات التواصل، الطول الأقصى).
// تُحفظ في الخادم فتظهر في كل صور التعزية ومن أي جهاز.
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPosterSettingsQueryKey,
  useGetPosterSettings,
  useSavePosterSettings,
  type PosterSettings,
} from "@workspace/api-client-react";
import { AlertCircle, ChevronRight, ImageUp, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LogoError, fileToLogoDataUrl } from "@/lib/logo-image";

type Social = PosterSettings["socials"][number];

const SOCIAL_OPTIONS: Array<{ id: Social; label: string }> = [
  { id: "instagram", label: "إنستغرام" },
  { id: "snapchat", label: "سناب شات" },
  { id: "x", label: "إكس" },
];
const HEIGHT_OPTIONS = [1350, 1620, 1800];

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useGetPosterSettings();
  const save = useSavePosterSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PosterSettings | null>(null);
  const [busy, setBusy] = useState(false);

  // نبدأ من المحفوظ مرة واحدة؛ ما يكتبه المسؤول بعدها لا يُستبدل عند تحديث الاستعلام
  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data);
  }, [settings.data, draft]);

  const dirty = !!draft && !!settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data);
  const update = (partial: Partial<PosterSettings>) => setDraft((current) => (current ? { ...current, ...partial } : current));

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      update({ logoDataUrl: await fileToLogoDataUrl(file) });
      toast.success("تم اختيار الشعار، اضغط «حفظ الإعدادات» لتطبيقه");
    } catch (error) {
      toast.error(error instanceof LogoError && error.reason === "too-large" ? "الشعار كبير جداً بعد التصغير؛ استخدم صورة أبسط أو أصغر" : "تعذر قراءة ملف الشعار");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleSocial = (id: Social, enabled: boolean) => {
    if (!draft) return;
    update({ socials: SOCIAL_OPTIONS.map((option) => option.id).filter((option) => (option === id ? enabled : draft.socials.includes(option))) });
  };

  const submit = () => {
    if (!draft) return;
    save.mutate(
      { data: draft },
      {
        onSuccess: (saved) => {
          queryClient.setQueryData(getGetPosterSettingsQueryKey(), saved);
          setDraft(saved);
          toast.success("تم حفظ الإعدادات");
        },
        onError: () => toast.error("تعذر حفظ الإعدادات، حاول مرة أخرى"),
      },
    );
  };

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4 pb-24">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/admin">
          <Button variant="ghost" className="gap-2 -mr-4 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            عودة للطلبات
          </Button>
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-primary mb-1">الإعدادات</h1>
      <p className="text-muted-foreground mb-8">هوية صورة التعزية: تظهر في أسفل كل صورة تنشئها من أي طلب.</p>

      {settings.isLoading || (settings.data && !draft) ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : settings.isError || !draft ? (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-4 py-8 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <p>تعذر تحميل الإعدادات.</p>
            <Button variant="outline" size="sm" onClick={() => void settings.refetch()}>إعادة المحاولة</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">الشعار</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 shrink-0 rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center overflow-hidden">
                  {draft.logoDataUrl ? (
                    <img src={draft.logoDataUrl} alt="الشعار" className="max-h-full max-w-full object-contain" data-testid="logo-preview" />
                  ) : (
                    <span className="text-xs text-muted-foreground">بلا شعار</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(event) => void pickLogo(event.target.files?.[0])}
                    data-testid="logo-input"
                  />
                  <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => fileRef.current?.click()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                    رفع الشعار
                  </Button>
                  {draft.logoDataUrl && (
                    <Button type="button" variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={() => update({ logoDataUrl: "" })}>
                      <Trash2 className="h-4 w-4" />
                      إزالة الشعار
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                يظهر يمين الشريط السفلي من الصورة (وفي أعلاها مع تخطيط «الترويسة»). يفضَّل PNG بخلفية شفافة، ويُصغَّر تلقائياً إلى 256 بكسل.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">التواصل الاجتماعي</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="poster-handle">اسم الحساب (يسار الشريط، تحت الأيقونات)</Label>
                <Input id="poster-handle" dir="ltr" className="text-left font-mono" placeholder="qatarde" value={draft.handle} onChange={(event) => update({ handle: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الأيقونات الظاهرة</Label>
                {SOCIAL_OPTIONS.map((option) => (
                  <label key={option.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer">
                    <span>{option.label}</span>
                    <Switch checked={draft.socials.includes(option.id)} onCheckedChange={(checked) => toggleSocial(option.id, checked)} aria-label={option.label} />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">الحد الأقصى لطول الصورة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {HEIGHT_OPTIONS.map((height) => (
                  <button
                    key={height}
                    type="button"
                    onClick={() => update({ maxHeight: height })}
                    className={`rounded-lg border px-2 py-2.5 font-mono ${draft.maxHeight === height ? "border-primary bg-primary/10 text-primary font-bold" : "border-border hover:bg-muted/50"}`}
                  >
                    {height}
                  </button>
                ))}
              </div>
              <p className="text-xs leading-6 text-muted-foreground">تبدأ الصورة بطول 1350 وتطول عند كثرة الأسماء حتى هذا الحد، ولا يقل النص عن 32 بكسل.</p>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
            <span className="text-sm text-muted-foreground">{dirty ? "توجد تغييرات غير محفوظة" : "كل التغييرات محفوظة"}</span>
            <Button type="button" onClick={submit} disabled={!dirty || save.isPending} className="gap-2 px-6">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الإعدادات
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
