/**
 * إضافات النموذج المأخوذة من قواعد أرشيف «وفيات قطر»: نوع الرسالة، صيغ تعدد المتوفين،
 * طرق التعريف بالمتوفى، صلات القرابة من منظور المتوفى، المواقع الإضافية للعزاء، ومعاينة النص النهائي.
 * مفصولة عن form-steps.tsx حتى تبقى تعديلات الواجهة الأصلية في أضيق نطاق.
 */
import React, { useMemo, useState } from "react";
import { useFieldArray, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { AlertTriangle, Mail, MapPin, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REFERENCE_LABELS, RELATION_OPTIONS, buildAnnouncement, relationTakesReference } from "@/lib/announcement";
import { mapFormToPayload } from "@/lib/mapper";
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

export function MessageTypeCard() {
  const form = useFormContext<ObituaryFormValues>();
  const messageType = useWatch({ control: form.control, name: "messageType" });
  return (
    <Card className="border-border bg-muted/20 shadow-xs w-full box-border">
      <CardContent className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 sm:col-span-2 text-xs sm:text-sm font-semibold text-foreground">
          <Mail className="w-4 h-4 text-primary shrink-0" />
          نوع الرسالة
        </div>
        <SelectInput name="messageType" label="الرسالة" options={MESSAGE_TYPES} />
        {messageType && messageType !== "announcement" && (
          <TextInput name="relatedRequestNumber" label="رقم طلب الإعلان الأصلي (اختياري)" placeholder="QTR-20260101-1234" ltr />
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

const IDENTIFY_OPTIONS = [
  { value: "auto", label: "تلقائي (الاسم، أو الزوج إن لم يُذكر الاسم)" },
  { value: "name", label: "بالاسم" },
  { value: "kunya", label: "بالكنية (أم فلان / أبو فلان)" },
  { value: "spouse", label: "عبر الزوج: «أرملة / حرم فلان»" },
  { value: "father", label: "عبر الأب: «ابنة / ابن فلان»" },
  { value: "children", label: "عبر الأبناء: «والدة / والد كل من»" },
] as const;

/** حقول التعريف الإضافية لكل متوفى: طريقة التعريف، الكنية، الأب، وحدة العمر، «ليس له أبناء»، سطر إضافي. */
export function DeceasedIdentityExtras({ index }: { index: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const person = useWatch({ control: form.control, name: `deceasedList.${index}` });
  const [showFather, setShowFather] = useState(() => !!person?.father?.name);
  const isFemale = person?.gender === "أنثى";
  const fatherVisible = showFather || person?.identifyBy === "father";
  const options = isFemale ? IDENTIFY_OPTIONS : IDENTIFY_OPTIONS.filter((option) => option.value !== "spouse");

  return (
    <div className="space-y-3 w-full box-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <SelectInput name={`deceasedList.${index}.identifyBy`} label="التعريف بالمتوفى في رأس الإعلان" options={options} />
        <TextInput name={`deceasedList.${index}.kunya`} label="الكنية (اختياري)" placeholder="مثال: أم هشام، أو: أم باسل المومني" />
      </div>
      {fatherVisible ? (
        <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-2">
          <p className="text-xs font-semibold text-foreground">الأب <span className="font-normal text-muted-foreground">(يظهر مع الإخوة «أبناء الوالد /» أو في سطر «ابن/ابنة»)</span></p>
          <LinkedPersonFields prefix={`deceasedList.${index}.father`} nameLabel="اسم الأب" />
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-primary gap-1 px-2" onClick={() => setShowFather(true)}>
          <UserPlus className="w-3.5 h-3.5" /> إضافة الأب (اختياري)
        </Button>
      )}
    </div>
  );
}

export function DeceasedDetailsExtras({ index }: { index: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const gender = useWatch({ control: form.control, name: `deceasedList.${index}.gender` });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full box-border">
      <SelectInput
        name={`deceasedList.${index}.ageUnit`}
        label="وحدة العمر"
        options={[{ value: "years", label: "سنوات" }, { value: "months", label: "أشهر (للرضّع)" }, { value: "days", label: "أيام" }]}
      />
      <SwitchInput name={`deceasedList.${index}.noChildren`} label={gender === "أنثى" ? "ليس لها أبناء" : "ليس له أبناء"} />
      <TextInput name={`deceasedList.${index}.notes`} label="سطر إضافي (اختياري)" placeholder="مثال: ( أم زوجة ) الشيخ / فلان" />
    </div>
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

/** اختيار صلة القرابة من منظور الأقارب؛ يعرض العنوان الذي سيُكتب في الإعلان. */
export function RelationKeySelect({ groupIndex }: { groupIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const group = useWatch({ control: form.control, name: `relatives.${groupIndex}` });
  const key = group?.relationKey;
  const option = RELATION_OPTIONS.find((item) => item.key === key);
  return (
    <div className="space-y-2 w-full">
      <Select
        value={key ?? ""}
        onValueChange={(value) => {
          const selected = RELATION_OPTIONS.find((item) => item.key === value);
          form.setValue(`relatives.${groupIndex}.relationKey`, value as NonNullable<typeof key>, { shouldDirty: true });
          form.setValue(`relatives.${groupIndex}.relationType`, value === "other" ? "" : selected?.label ?? "", { shouldDirty: true });
        }}
      >
        <SelectTrigger className="h-9 text-sm font-semibold bg-background w-full sm:w-60">
          <SelectValue placeholder="صلة الأشخاص بالمتوفى" />
        </SelectTrigger>
        <SelectContent>
          {RELATION_OPTIONS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {option && option.key !== "other" && (
        <p className="text-[11px] text-muted-foreground">يظهر في الإعلان: «{option.hint}»</p>
      )}
      {key === "other" && (
        <TextInput name={`relatives.${groupIndex}.relationType`} label="العنوان كما يُكتب" placeholder="مثال: حفيدة الوالد" />
      )}
    </div>
  );
}

/** «يخص»، موضع «رحمه الله»، وسطر «أبناء /» لكل مجموعة أقارب. */
export function RelativeGroupExtras({ groupIndex }: { groupIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const key = useWatch({ control: form.control, name: `relatives.${groupIndex}.relationKey` });
  return (
    <div className="space-y-3 pt-3 border-t border-border/50 w-full box-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DeceasedTargetSelect name={`relatives.${groupIndex}.deceasedTarget`} label="يخص" />
        <SelectInput
          name={`relatives.${groupIndex}.deceasedPlacement`}
          label="موضع «رحمه الله» للمتوفين منهم"
          options={[
            { value: "auto", label: "تلقائي (يُجمَّع إن كانوا اثنين فأكثر)" },
            { value: "inline", label: "بجانب كل اسم" },
            { value: "grouped", label: "مجمّعة في آخر القائمة" },
          ]}
        />
      </div>
      {relationTakesReference(key) && (
        <div className="p-3 rounded-lg border border-border/60 bg-muted/10 space-y-1">
          <p className="text-xs font-semibold">سطر «أبناء /» — {REFERENCE_LABELS[key!]} <span className="font-normal text-muted-foreground">(اختياري)</span></p>
          <LinkedPersonFields prefix={`relatives.${groupIndex}.reference`} nameLabel="الاسم" />
          {(key === "siblings" || key === "full_siblings") && (
            <p className="text-[11px] text-muted-foreground">إن تُرك فارغاً يُستعمل الأب المسجل في بيانات المتوفى.</p>
          )}
        </div>
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

/** «عزاء لـ» و«حتى» لبطاقة العزاء الرئيسية. */
export function VenueExtras({ audience }: { audience: "men" | "women" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full box-border">
      <DeceasedTargetSelect name={`condolences.${audience}.deceasedTarget`} label="عزاء لـ" />
      <TextInput name={`condolences.${audience}.until`} label="حتى (اختياري)" placeholder="مثال: يوم الاثنين 29 يونيو" />
    </div>
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

/** النص النهائي كما سيُنشر، من المولّد نفسه الذي تستخدمه لوحة الإدارة والقوالب. */
export function AnnouncementPreview() {
  const form = useFormContext<ObituaryFormValues>();
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
  );
}
