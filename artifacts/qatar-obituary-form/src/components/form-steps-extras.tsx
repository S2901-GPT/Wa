/**
 * إضافات النموذج المأخوذة من قواعد أرشيف «وفيات قطر»: نوع الرسالة، صيغ تعدد المتوفين،
 * طرق التعريف بالمتوفى، صلات القرابة من منظور المتوفى، المواقع الإضافية للعزاء، ومعاينة النص النهائي.
 * مفصولة عن form-steps.tsx حتى تبقى تعديلات الواجهة الأصلية في أضيق نطاق.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { get, useFieldArray, useFormContext, useFormState, useWatch, type FieldPath } from "react-hook-form";
import { AlertTriangle, ChevronDown, Download, Loader2, Mail, MapPin, Plus, Trash2, Users } from "lucide-react";
import { getObituaryRequest } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildAnnouncement, relationKeyOf } from "@/lib/announcement";
import { OTHER_RELATION, mapFormToPayload, mapPayloadToForm, relationSelectValue } from "@/lib/mapper";
import { emptyCondolenceDetails, type ObituaryFormValues } from "@/lib/schema";

type FormPath = FieldPath<ObituaryFormValues>;

const labelClass = "text-xs text-muted-foreground";
const inputClass = "h-9 text-sm bg-background w-full box-border";

function TextInput({ name, label, placeholder, ltr }: { name: FormPath; label: string; placeholder?: string; ltr?: boolean }) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full min-w-0">
          <FormLabel className={labelClass}>{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              className={`${inputClass} ${ltr ? "text-left" : ""}`}
              dir={ltr ? "ltr" : undefined}
              {...field}
              value={(field.value as string | undefined) ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectInput({ name, label, options, placeholder }: {
  name: FormPath;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full min-w-0">
          <FormLabel className={labelClass}>{label}</FormLabel>
          <Select value={(field.value as string | undefined) || ""} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className={inputClass}><SelectValue placeholder={placeholder ?? "اختر"} /></SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SwitchInput({ name, label }: { name: FormPath; label: string }) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border border-input bg-background px-3 h-9 text-xs">
          <Switch checked={!!field.value} onCheckedChange={field.onChange} className="scale-90" />
          <span>{label}</span>
        </label>
      )}
    />
  );
}

/** حقول شخص مرجعي (الأب، الأب المشترك، مرجع «أبناء /»). */
function LinkedPersonFields({ prefix, nameLabel }: { prefix: string; nameLabel: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end w-full">
      <TextInput name={`${prefix}.title` as FormPath} label="اللقب" placeholder="الوالد، الشيخ…" />
      <TextInput name={`${prefix}.name` as FormPath} label={nameLabel} placeholder="الاسم الكامل" />
      <SwitchInput name={`${prefix}.isDeceased` as FormPath} label="متوفى (رحمه الله)" />
    </div>
  );
}

// ───────────────────────── «خيارات إضافية» ─────────────────────────

/**
 * نموذج المستخدم يبقى بشكله الأصلي، والخانات المضافة من الأرشيف تُطوى تحت «خيارات إضافية».
 * اجعلها true لإعادة الشكل الموسّع (كل الخيارات ظاهرة دائماً).
 */
export const EXTRA_OPTIONS_OPEN_BY_DEFAULT = false;

/** صفحة المسؤول (تعديل الطلب) تمرّر true فتظهر الخيارات كلها مفتوحة. */
export const ExtrasOpenContext = createContext<boolean>(EXTRA_OPTIONS_OPEN_BY_DEFAULT);

/** القيم الافتراضية لا تُعد تعبئة («تلقائي»، «سنوات»، «الجميع»…). */
const DEFAULT_TOKENS = new Set(["announcement", "auto", "years", "all", "men"]);

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "" && !DEFAULT_TOKENS.has(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(isFilled);
  return false;
}

/**
 * قسم مطوي: يبقى مركّباً (القيم والتحقق لا تضيع)، ويُفتح تلقائياً إن كان فيه قيمة
 * مُدخلة سابقاً (العودة لخطوة سابقة، أو تعديل طلب) أو خطأ تحقق.
 */
export function MoreOptions({ label = "خيارات إضافية", hint, paths, children }: {
  label?: string;
  hint?: string;
  paths: string[];
  children: React.ReactNode;
}) {
  const form = useFormContext<ObituaryFormValues>();
  const openByDefault = useContext(ExtrasOpenContext);
  const values = useWatch({ control: form.control, name: paths as FormPath[] }) as unknown[];
  const { errors } = useFormState({ control: form.control });
  const hasError = paths.some((path) => !!get(errors, path));
  const [open, setOpen] = useState(() => openByDefault || values.some(isFilled));
  useEffect(() => {
    if (hasError) setOpen(true);
  }, [hasError]);

  return <Disclosure label={label} hint={hint} open={open} onOpenChange={setOpen}>{children}</Disclosure>;
}

function Disclosure({ label, hint, open, onOpenChange, children }: {
  label: string;
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full box-border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
        >
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="font-medium">{label}</span>
          {hint && !open && <span className="opacity-70 truncate">({hint})</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden pt-2 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function deceasedOptionLabel(person: ObituaryFormValues["deceasedList"][number] | undefined, index: number): string {
  const name = person?.fullName?.trim() || person?.kunya?.trim() || person?.femaleRelations?.[0]?.relatedName?.trim();
  return name ? `${index + 1}. ${name}` : `المتوفى ${index + 1}`;
}

/** «يخص»: الجميع أو متوفى بعينه (يظهر عند تعدد المتوفين فقط). */
export function DeceasedTargetSelect({ name, label }: { name: FormPath; label: string }) {
  const form = useFormContext<ObituaryFormValues>();
  const people = useWatch({ control: form.control, name: "deceasedList" }) ?? [];
  if (people.length < 2) return null;
  return (
    <SelectInput
      name={name}
      label={label}
      options={[{ value: "all", label: "الجميع" }, ...people.map((person, index) => ({ value: String(index), label: deceasedOptionLabel(person, index) }))]}
    />
  );
}

// ───────────────────────── الخطوة ١ ─────────────────────────

const MESSAGE_TYPES = [
  { value: "announcement", label: "إعلان وفاة" },
  { value: "postponement", label: "تأجيل الدفن حتى إشعار آخر" },
  { value: "amendment", label: "تعديل إعلان سابق" },
  { value: "condolence_cancellation", label: "إلغاء عزاء" },
] as const;

/**
 * نوع الرسالة ظاهر دائماً في أول الخطوة الأولى. عند التعديل أو التأجيل أو إلغاء العزاء يكتب المستخدم رقم طلبه
 * الأصلي ويضغط «تحميل بيانات الطلب» فتُملأ الخطوات كلها ببياناته ليعدّل ما يريد ويرسل طلباً جديداً مرتبطاً به.
 */
export function MessageTypeCard() {
  const form = useFormContext<ObituaryFormValues>();
  const messageType = useWatch({ control: form.control, name: "messageType" });
  const relatedRequestNumber = useWatch({ control: form.control, name: "relatedRequestNumber" });
  const [loading, setLoading] = useState(false);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const needsOriginal = !!messageType && messageType !== "announcement";

  const loadOriginal = async () => {
    const number = (relatedRequestNumber ?? "").trim();
    if (!number) {
      toast.error("اكتب رقم الطلب الأصلي أولاً");
      return;
    }
    setLoading(true);
    try {
      const original = await getObituaryRequest(number);
      form.reset({
        ...mapPayloadToForm(original),
        messageType: messageType ?? "amendment",
        relatedRequestNumber: number,
      });
      setLoadedFrom(number);
      toast.success(`تم تحميل بيانات الطلب ${number}`);
    } catch {
      toast.error("لم يُعثر على طلب بهذا الرقم، تأكد منه وحاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-xs w-full box-border">
      <CardContent className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 sm:col-span-2 text-sm sm:text-base font-bold text-foreground">
          <Mail className="w-4 h-4 text-primary shrink-0" />
          نوع الرسالة
        </div>
        <SelectInput name="messageType" label="اختر نوع الرسالة" options={MESSAGE_TYPES} />
        {needsOriginal && (
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end w-full min-w-0">
            <TextInput name="relatedRequestNumber" label="رقم الطلب الأصلي" placeholder="261234" ltr />
            <Button type="button" variant="outline" className="h-9 text-xs gap-1.5 shrink-0" onClick={loadOriginal} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              تحميل بيانات الطلب
            </Button>
          </div>
        )}
        {needsOriginal && (
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">
            {loadedFrom
              ? `تم تحميل بيانات الطلب ${loadedFrom}؛ عدّل ما تريد في الخطوات ثم أرسل الطلب.`
              : "اكتب رقم الطلب الذي وصلك عند التسجيل، ثم اضغط «تحميل بيانات الطلب» لتعبئة الخطوات ببياناته."}
          </p>
        )}
        {messageType === "condolence_cancellation" && (
          <>
            <SelectInput
              name="cancellation.audience"
              label="العزاء الملغى"
              options={[{ value: "men", label: "عزاء الرجال" }, { value: "women", label: "عزاء النساء" }, { value: "all", label: "العزاء كله" }]}
            />
            <TextInput name="cancellation.from" label="نطاق الإلغاء (اختياري)" placeholder="مثال: لليوم الثالث" />
            <TextInput name="cancellation.reason" label="السبب (اختياري)" placeholder="مثال: بسبب الأحوال الجوية، أو: وفقاً لقرار وزارة الداخلية" />
            <SwitchInput name="cancellation.phoneOnly" label="يُكتفى بتلقي العزاء عبر الهاتف" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * خانة المتوفى الإضافية الوحيدة: سطر يُكتب في الإعلان كما هو (مثل جهة العمل السابقة).
 * مطوية تحت «خيارات إضافية» حتى تبقى البطاقة بشكلها الأصلي.
 */
export function DeceasedExtras({ index }: { index: number }) {
  return (
    <MoreOptions hint="سطر إضافي في الإعلان" paths={[`deceasedList.${index}.notes`]}>
      <TextInput
        name={`deceasedList.${index}.notes`}
        label="سطر إضافي (اختياري)"
        placeholder="مثال: الموظف السابق في وزارة التعليم"
      />
    </MoreOptions>
  );
}

const ANNOUNCEMENT_MODES = [
  { value: "unrelated", label: "متوفون بلا نسب مشترك", hint: "«توفي كل من» ثم كل اسم كامل وتحته عمره" },
  { value: "siblings", label: "إخوة بنسب مشترك", hint: "«توفي كل من / سعود / جاسم / أبناء / فهد …» والأقارب بضمير الجمع" },
  { value: "father_first", label: "الأب أولاً", hint: "«توفي أبناء الوالد / فلان / سعد وغانم وإيمان»" },
  { value: "mother_child", label: "أم (أو أب) مع أبنائها", hint: "«توفيت حرم / فلان / وابنتها الطفلة / آمنة»" },
] as const;

/** صيغة الإعلان عند تعدد المتوفين، مع الأب المشترك. */
export function MultipleDeceasedCard() {
  const form = useFormContext<ObituaryFormValues>();
  const people = useWatch({ control: form.control, name: "deceasedList" }) ?? [];
  const mode = useWatch({ control: form.control, name: "announcementMode" });
  if (people.length < 2) return null;
  const hint = ANNOUNCEMENT_MODES.find((option) => option.value === mode)?.hint;
  return (
    <Card className="border-primary/30 bg-primary/5 shadow-xs w-full box-border">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
          <Users className="w-4 h-4 text-primary shrink-0" />
          صيغة الإعلان عند تعدد المتوفين
        </div>
        <SelectInput name="announcementMode" label="الصيغة" options={ANNOUNCEMENT_MODES.map(({ value, label }) => ({ value, label }))} />
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        {(mode === "siblings" || mode === "father_first") && (
          <div className="space-y-1">
            <p className="text-xs font-semibold">الأب المشترك <span className="text-destructive">*</span></p>
            <LinkedPersonFields prefix="sharedParent" nameLabel="اسم الأب" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── الخطوة ٢ ─────────────────────────

/**
 * قائمة الصلة بشكلها الأصلية («أبناؤه، أخوانه، أعمامه…»). يُحفظ معها مفتاح الصلة في الخلفية
 * حتى يكتب المولّد صيغة الأرشيف («والدة كل من»). «أخرى» تفتح خانة لكتابة الصلة.
 */
export function RelationSelect({ groupIndex, options }: { groupIndex: number; options: readonly string[] }) {
  const form = useFormContext<ObituaryFormValues>();
  const relationType = useWatch({ control: form.control, name: `relatives.${groupIndex}.relationType` });
  const relationKey = useWatch({ control: form.control, name: `relatives.${groupIndex}.relationKey` });
  const value = relationSelectValue(relationType, relationKey, options);
  const setRelation = (text: string) => {
    form.setValue(`relatives.${groupIndex}.relationType`, text, { shouldDirty: true });
    form.setValue(`relatives.${groupIndex}.relationKey`, relationKeyOf({ relation: text }), { shouldDirty: true });
  };
  return (
    <>
      <Select value={value} onValueChange={(next) => setRelation(next === OTHER_RELATION ? "" : next)}>
        <SelectTrigger className="h-9 bg-background font-semibold text-xs sm:text-sm w-full">
          <SelectValue placeholder="صلة القرابة" />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === OTHER_RELATION && (
        <Input
          placeholder="اكتب الصلة"
          className="h-9 bg-background text-xs sm:text-sm w-full"
          value={relationType ?? ""}
          onChange={(event) => setRelation(event.target.value)}
        />
      )}
    </>
  );
}

/** «يخص»: عند تعدد المتوفين فقط، لتحديد المتوفى الذي تخصه مجموعة الأقارب. */
export function RelativeGroupExtras({ groupIndex }: { groupIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const people = useWatch({ control: form.control, name: "deceasedList" }) ?? [];
  const relationKey = useWatch({ control: form.control, name: `relatives.${groupIndex}.relationKey` as FormPath }) as string | undefined;
  // الأبناء يُعرَّفون بأبيهم حين تكون المتوفاة أمّهم: «أبناء الوالد / فلان رحمه الله» سطراً تحت الأسماء.
  const showReference = relationKey === "children";
  if (people.length < 2 && !showReference) return null;
  return (
    <div className="pt-3 mt-3 border-t border-border/50 w-full box-border space-y-3">
      {people.length >= 2 && (
        <div className="sm:max-w-xs">
          <DeceasedTargetSelect name={`relatives.${groupIndex}.deceasedTarget`} label="يخص" />
        </div>
      )}
      {showReference && (
        <MoreOptions
          label="أبناء الوالد / … (اختياري)"
          hint="يُكتب تحت الأسماء: «أبناء الوالد / فلان رحمه الله»"
          paths={[`relatives.${groupIndex}.reference.name`, `relatives.${groupIndex}.reference.title`, `relatives.${groupIndex}.reference.isDeceased`]}
        >
          <LinkedPersonFields prefix={`relatives.${groupIndex}.reference`} nameLabel="اسم الأب" />
        </MoreOptions>
      )}
    </div>
  );
}

// ───────────────────────── الخطوة ٤ ─────────────────────────

/** مواقع عزاء إضافية: «عزاء النساء الأول / الثاني» أو عزاء منفصل لكل متوفى. */
export function ExtraVenuesSection({ audiences }: { audiences: Array<"men" | "women"> }) {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "condolences.extraVenues" });
  const venues = useWatch({ control: form.control, name: "condolences.extraVenues" }) ?? [];
  const label = (audience: "men" | "women") => (audience === "men" ? "عزاء الرجال" : "عزاء النساء");
  return (
    <div className="space-y-3 w-full box-border">
      {fields.map((field, index) => {
        const audience = venues[index]?.audience ?? "women";
        if (!audiences.includes(audience)) return null;
        return (
          <Card key={field.id} className="border-border shadow-xs w-full box-border">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-semibold text-primary flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0" /> {label(audience)} — موقع إضافي
                </p>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(index)} aria-label="حذف الموقع">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput name={`condolences.extraVenues.${index}.locationName`} label="اسم ووصف المقر *" placeholder="مثال: منزل ابنها ناصر في الوكرة" />
                <TextInput name={`condolences.extraVenues.${index}.mapsLink`} label="رابط خرائط Google (اختياري)" placeholder="https://maps.google.com/..." ltr />
                <DeceasedTargetSelect name={`condolences.extraVenues.${index}.deceasedTarget`} label="عزاء لـ" />
                <TextInput name={`condolences.extraVenues.${index}.until`} label="حتى (اختياري)" placeholder="مثال: يوم الاثنين" />
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {audiences.map((audience) => (
          <Button
            key={audience}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => append({ ...emptyCondolenceDetails(), audience })}
          >
            <Plus className="w-3.5 h-3.5" /> موقع آخر لـ{label(audience)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** «عزاء لـ» و«حتى» لبطاقة العزاء الرئيسية (مطوية). */
export function VenueExtras({ audience }: { audience: "men" | "women" }) {
  return (
    <MoreOptions hint="حتى يوم معيّن" paths={[`condolences.${audience}.deceasedTarget`, `condolences.${audience}.until`]}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full box-border">
        <DeceasedTargetSelect name={`condolences.${audience}.deceasedTarget`} label="عزاء لـ" />
        <TextInput name={`condolences.${audience}.until`} label="حتى (اختياري)" placeholder="مثال: يوم الاثنين 29 يونيو" />
      </div>
    </MoreOptions>
  );
}

/** سبب أو ملاحظة على العزاء، وأرقام التعزية مع المقرات. */
export function CondolenceExtras({ type }: { type: string }) {
  const form = useFormContext<ObituaryFormValues>();
  const withPhones = useWatch({ control: form.control, name: "condolences.withPhones" });
  return (
    <div className="space-y-3 w-full box-border">
      <TextInput
        name="condolences.cancellationOrRestrictionReason"
        label="سبب أو ملاحظة على العزاء (اختياري)"
        placeholder="مثال: اتباعاً للسنة، أو: تنفيذاً لوصية المتوفى"
      />
      {type !== "phone_only" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SwitchInput name="condolences.withPhones" label="إضافة أرقام للتعزية عبر الهاتف" />
          {withPhones && (
            <SelectInput
              name="condolences.phoneAudience"
              label="التعزية عبر الهاتف لـ"
              options={[{ value: "all", label: "الجميع" }, { value: "women", label: "النساء" }, { value: "men", label: "الرجال" }]}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── الخطوة ٦ ─────────────────────────

/** النص النهائي كما سيُنشر (مطوي)، من المولّد نفسه الذي تستخدمه لوحة الإدارة والقوالب. */
export function AnnouncementPreview() {
  const form = useFormContext<ObituaryFormValues>();
  const [open, setOpen] = useState(useContext(ExtrasOpenContext));
  const values = form.getValues();
  const announcement = useMemo(() => {
    try {
      return buildAnnouncement(mapFormToPayload(values));
    } catch (error) {
      console.error("Announcement preview failed", error);
      return null;
    }
  }, [values]);
  if (!announcement) return null;
  return (
    <Disclosure
      label="معاينة نص الإعلان"
      hint={announcement.warnings.length ? "فيه تنبيهات" : undefined}
      open={open}
      onOpenChange={setOpen}
    >
    <Card className="border-primary/30 shadow-sm w-full box-border">
      <CardContent className="p-3 sm:p-5 space-y-3">
        <h3 className="text-sm sm:text-base font-bold text-primary">نص الإعلان كما سيُنشر</h3>
        {announcement.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 text-xs sm:text-sm font-bold"><AlertTriangle className="w-4 h-4 shrink-0" /> تنبيهات قبل النشر</p>
            <ul className="mt-1.5 list-disc pr-5 text-xs space-y-1">
              {announcement.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}
        <pre dir="rtl" className="whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 font-sans text-sm sm:text-base leading-8">
          {announcement.text}
        </pre>
      </CardContent>
    </Card>
    </Disclosure>
  );
}
