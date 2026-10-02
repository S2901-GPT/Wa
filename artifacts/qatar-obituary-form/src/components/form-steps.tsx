import React, { useMemo, useState } from "react";
import { useFormContext, useFieldArray, useWatch, type FieldPath } from "react-hook-form";
import {
  burialScheduleRequired,
  emptyCondolenceCard,
  emptyDeceased,
  type ObituaryFormValues,
} from "@/lib/schema";
import { CEMETERIES, CONDOLENCE_STARTS, RELATIVE_DAYS, TIMES, WEEKDAYS, mapFormToPayload } from "@/lib/mapper";
import { REFERENCE_LABELS, RELATION_OPTIONS, buildAnnouncement, relationTakesReference } from "@/lib/announcement";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, User, Users, Calendar, Heart, FileText, CheckCircle2, AlertTriangle, Mail } from "lucide-react";

type FormPath = FieldPath<ObituaryFormValues>;

const DAY_OPTIONS = [...RELATIVE_DAYS, ...WEEKDAYS, "أخرى"];
const TIME_OPTIONS = [...TIMES, "وقت محدد", "أخرى"];
const CEMETERY_OPTIONS = [...CEMETERIES, "أخرى"];
/** ألقاب الأرشيف قبل اسم المتوفى (تتراكم: «الوالد اللواء متقاعد»). */
const TITLE_SUGGESTIONS = [
  "الوالد", "الوالدة", "الشيخ", "الشيخة", "الدكتور", "الدكتورة", "الأستاذ", "الأستاذة", "المحامي", "القاضي",
  "سعادة", "فضيلة الشيخ", "الوالد اللواء متقاعد", "العميد ركن", "الشاب", "الشابة", "الطفل", "الطفلة",
  "الرضيع", "الرضيعة", "شهيد الوطن",
];
const SPOUSE_TITLE_SUGGESTIONS = ["الوالد", "الشيخ", "الدكتور", "سعادة", "سعادة اللواء ركن", "الأستاذ"];

const GENDER_OPTIONS = [
  { label: "رجل", value: "man" },
  { label: "امرأة", value: "woman" },
  { label: "طفل", value: "boy" },
  { label: "طفلة", value: "girl" },
] as const;

const IDENTIFY_OPTIONS = [
  { value: "name", label: "بالاسم" },
  { value: "kunya", label: "بالكنية (أم فلان / أبو فلان)" },
  { value: "spouse", label: "عبر الزوج: «حرم / أرملة فلان»" },
  { value: "father", label: "عبر الأب: «ابنة / ابن فلان»" },
  { value: "children", label: "عبر الأبناء: «والدة / والد كل من»" },
] as const;

const MESSAGE_TYPES = [
  { value: "announcement", label: "إعلان وفاة" },
  { value: "postponement", label: "تأجيل الدفن حتى إشعار آخر" },
  { value: "amendment", label: "تعديل إعلان سابق" },
  { value: "condolence_cancellation", label: "إلغاء عزاء" },
] as const;

const ANNOUNCEMENT_MODES = [
  { value: "unrelated", label: "متوفون بلا نسب مشترك", hint: "«توفي كل من» ثم كل اسم كامل وتحته عمره" },
  { value: "siblings", label: "إخوة بنسب مشترك", hint: "«توفي كل من / سعود / جاسم / أبناء / فهد …» والأقارب بضمير الجمع" },
  { value: "father_first", label: "الأب أولاً", hint: "«توفي أبناء الوالد / فلان / سعد وغانم وإيمان»" },
  { value: "mother_child", label: "أم (أو أب) مع أبنائها", hint: "«توفيت حرم / فلان / وابنتها الطفلة / آمنة»" },
] as const;

function Required({ show = true }: { show?: boolean }) {
  return show ? <span className="text-destructive">*</span> : null;
}

function TextField({
  name, label, placeholder, ltr, description, required, textarea,
}: {
  name: FormPath;
  label: React.ReactNode;
  placeholder?: string;
  ltr?: boolean;
  description?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label} <Required show={!!required} /></FormLabel>
          <FormControl>
            {textarea ? (
              <Textarea rows={2} placeholder={placeholder} className="bg-background" {...field} value={(field.value as string) ?? ""} />
            ) : (
              <Input
                placeholder={placeholder}
                className={`bg-background ${ltr ? "text-left" : ""}`}
                dir={ltr ? "ltr" : undefined}
                {...field}
                value={(field.value as string | number | null) ?? ""}
              />
            )}
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField({
  name, label, options, placeholder, required, description,
}: {
  name: FormPath;
  label: React.ReactNode;
  options: ReadonlyArray<string | { value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  description?: string;
}) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label} <Required show={!!required} /></FormLabel>
          <Select onValueChange={field.onChange} value={(field.value as string) || ""}>
            <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder={placeholder ?? "اختر"} /></SelectTrigger></FormControl>
            <SelectContent>
              {options.map((option) => {
                const value = typeof option === "string" ? option : option.value;
                const text = typeof option === "string" ? option : option.label;
                return <SelectItem key={value} value={value}>{text}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SwitchField({ name, label, description }: { name: FormPath; label: string; description?: string }) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-input bg-background px-3 py-2">
          <div>
            <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
            {description && <FormDescription className="text-xs">{description}</FormDescription>}
          </div>
          <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
        </FormItem>
      )}
    />
  );
}

function TitleSuggestions({ id, values }: { id: string; values: string[] }) {
  return <datalist id={id}>{values.map((value) => <option key={value} value={value} />)}</datalist>;
}

function TitleField({ name, label, listId, suggestions, placeholder }: {
  name: FormPath;
  label: string;
  listId: string;
  suggestions: string[];
  placeholder?: string;
}) {
  const form = useFormContext<ObituaryFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input list={listId} placeholder={placeholder} className="bg-background" {...field} value={(field.value as string) ?? ""} />
          </FormControl>
          <TitleSuggestions id={listId} values={suggestions} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function deceasedLabel(person: ObituaryFormValues["deceasedPeople"][number] | undefined, index: number): string {
  const name = person?.fullName?.trim() || person?.kunya?.trim() || person?.spouse?.name?.trim();
  return name ? `${index + 1}. ${name}` : `المتوفى ${index + 1}`;
}

function DeceasedTargetSelect({ name, label }: { name: FormPath; label: string }) {
  const form = useFormContext<ObituaryFormValues>();
  const people = useWatch({ control: form.control, name: "deceasedPeople" });
  if ((people?.length ?? 0) < 2) return null;
  return (
    <SelectField
      name={name}
      label={label}
      options={[
        { value: "all", label: "الجميع" },
        ...people.map((person, index) => ({ value: String(index), label: deceasedLabel(person, index) })),
      ]}
    />
  );
}

// ───────────────────────── الخطوة ١: نوع الرسالة والمتوفون ─────────────────────────

function MessageTypeCard() {
  const form = useFormContext<ObituaryFormValues>();
  const messageType = useWatch({ control: form.control, name: "messageType" });
  return (
    <Card className="border-border bg-muted/10 shadow-sm">
      <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
        <SelectField name="messageType" label={<span className="flex items-center gap-2"><Mail className="w-4 h-4" />نوع الرسالة</span>} options={MESSAGE_TYPES} />
        {messageType !== "announcement" && (
          <TextField name="relatedRequestNumber" label="رقم طلب الإعلان الأصلي (اختياري)" placeholder="QTR-20260101-1234" ltr />
        )}
        {messageType === "condolence_cancellation" && (
          <>
            <SelectField
              name="cancellation.audience"
              label="العزاء الملغى"
              options={[{ value: "men", label: "عزاء الرجال" }, { value: "women", label: "عزاء النساء" }, { value: "all", label: "العزاء كله" }]}
            />
            <TextField name="cancellation.from" label="نطاق الإلغاء (اختياري)" placeholder="مثال: لليوم الثالث" />
            <TextField name="cancellation.reason" label="السبب (اختياري)" placeholder="مثال: بسبب الأحوال الجوية، أو: وفقاً لقرار وزارة الداخلية" />
            <SwitchField name="cancellation.phoneOnly" label="يُكتفى بتلقي العزاء عبر الهاتف" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LinkedPersonFields({ prefix, nameLabel, titleSuggestions, listId, showDeceased = true }: {
  prefix: "sharedParent" | `deceasedPeople.${number}.father` | `deceasedPeople.${number}.spouse` | `relatives.${number}.reference`;
  nameLabel: React.ReactNode;
  titleSuggestions: string[];
  listId: string;
  showDeceased?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <TitleField name={`${prefix}.title` as FormPath} label="اللقب" listId={listId} suggestions={titleSuggestions} placeholder="الوالد" />
      <TextField name={`${prefix}.name` as FormPath} label={nameLabel} placeholder="الاسم الكامل" />
      {showDeceased && <SwitchField name={`${prefix}.deceased` as FormPath} label="متوفى (رحمه الله)" />}
    </div>
  );
}

function DeceasedCard({ index, count, onRemove }: { index: number; count: number; onRemove: () => void }) {
  const form = useFormContext<ObituaryFormValues>();
  const person = useWatch({ control: form.control, name: `deceasedPeople.${index}` });
  const [showFather, setShowFather] = useState(() => !!person?.father?.name);
  const gender = person?.gender;
  const identifyBy = person?.identifyBy ?? "name";
  const spouseKind = person?.spouse?.kind ?? "harem";
  const showSpouse = gender === "woman" || identifyBy === "spouse";
  const fatherVisible = showFather || identifyBy === "father";

  return (
    <Card className="relative overflow-hidden border-border bg-background shadow-sm">
      {count > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 left-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
      <CardContent className="pt-8">
        <div className="grid gap-6">
          {count > 1 && <p className="font-bold text-primary">المتوفى {index + 1}</p>}
          <FormField
            control={form.control}
            name={`deceasedPeople.${index}.gender`}
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-base">الجنس <Required /></FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value ?? ""} className="flex flex-wrap gap-2">
                    {GENDER_OPTIONS.map((option) => (
                      <FormItem key={option.value} className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-3 py-2 bg-background flex-1 min-w-[80px]">
                        <FormControl><RadioGroupItem value={option.value} /></FormControl>
                        <FormLabel className="font-normal cursor-pointer w-full text-center text-sm">{option.label}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormDescription>اختيار صريح؛ تُبنى عليه صيغة «توفي / توفيت» والدعاء.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectField
              name={`deceasedPeople.${index}.identifyBy`}
              label="التعريف بالمتوفى في رأس الإعلان"
              options={IDENTIFY_OPTIONS}
              description="كثير من إعلانات النساء لا تذكر اسم المتوفاة؛ اختر الطريقة المناسبة."
            />
            <TitleField
              name={`deceasedPeople.${index}.title`}
              label="اللقب قبل الاسم (اختياري)"
              listId={`titles-${index}`}
              suggestions={TITLE_SUGGESTIONS}
              placeholder="الوالد، الوالدة، الشيخ، الدكتور…"
            />
            <TextField
              name={`deceasedPeople.${index}.fullName`}
              label={identifyBy === "name" ? "الاسم الكامل" : "الاسم الكامل (اختياري)"}
              required={identifyBy === "name"}
              placeholder="مثال: مريم بنت عبدالله العطية"
            />
            <TextField
              name={`deceasedPeople.${index}.kunya`}
              label={identifyBy === "kunya" ? "الكنية" : "الكنية (اختياري)"}
              required={identifyBy === "kunya"}
              placeholder="مثال: أم هشام، أو: أم باسل المومني"
              description={identifyBy === "name" ? "تظهر بين قوسين بعد الاسم." : undefined}
            />
          </div>

          {showSpouse && (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">الزوج {identifyBy === "spouse" ? <Required /> : <span className="text-muted-foreground text-sm">(اختياري)</span>}</p>
                <FormField
                  control={form.control}
                  name={`deceasedPeople.${index}.spouse.kind`}
                  render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-2">
                      {[{ value: "harem", label: "حرم" }, { value: "widow", label: "أرملة (الزوج متوفى)" }].map((option) => (
                        <label key={option.value} className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer">
                          <RadioGroupItem value={option.value} />
                          {option.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
              </div>
              <LinkedPersonFields
                prefix={`deceasedPeople.${index}.spouse`}
                nameLabel="اسم الزوج"
                titleSuggestions={SPOUSE_TITLE_SUGGESTIONS}
                listId={`spouse-titles-${index}`}
                showDeceased={spouseKind === "harem"}
              />
              <p className="text-xs text-muted-foreground">
                {spouseKind === "widow"
                  ? "سيُكتب «أرملة … رحمهم الله» بالجمع الذي يشمل المتوفاة وزوجها."
                  : "إن كان الزوج متوفى فعّل «متوفى» ليُكتب «حرم … رحمه الله»."}
              </p>
            </div>
          )}

          {fatherVisible ? (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
              <p className="font-medium">الأب {identifyBy === "father" ? <Required /> : <span className="text-muted-foreground text-sm">(اختياري — يظهر مع الإخوة «أبناء الوالد /» أو في سطر «ابن/ابنة»)</span>}</p>
              <LinkedPersonFields
                prefix={`deceasedPeople.${index}.father`}
                nameLabel="اسم الأب"
                titleSuggestions={SPOUSE_TITLE_SUGGESTIONS}
                listId={`father-titles-${index}`}
              />
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="justify-start text-primary w-fit gap-1" onClick={() => setShowFather(true)}>
              <Plus className="w-3 h-3" /> إضافة الأب
            </Button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TextField name={`deceasedPeople.${index}.age`} label="العمر (اختياري)" placeholder="مثال: 65" />
            <SelectField
              name={`deceasedPeople.${index}.ageUnit`}
              label="وحدة العمر"
              options={[{ value: "years", label: "سنوات" }, { value: "months", label: "أشهر" }, { value: "days", label: "أيام" }]}
            />
            <TextField name={`deceasedPeople.${index}.nationality`} label="الجنسية (اختياري)" placeholder="مثال: مصري" description="تُذكر لغير القطريين فقط." />
            <TextField name={`deceasedPeople.${index}.deathPlace`} label="مكان الوفاة (اختياري)" placeholder="مثال: لندن" description="يُكتب «توفي … في لندن»." />
            <TextField name={`deceasedPeople.${index}.occupation`} label="الصفة / الجهة (اختياري)" placeholder="مثال: سفير سابق" />
            <SwitchField name={`deceasedPeople.${index}.noChildren`} label={gender === "woman" || gender === "girl" ? "ليس لها أبناء" : "ليس له أبناء"} />
          </div>
          <TextField name={`deceasedPeople.${index}.note`} label="سطر إضافي (اختياري)" placeholder="مثال: ( أم زوجة ) الشيخ / فلان" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DeceasedStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "deceasedPeople" });
  const mode = useWatch({ control: form.control, name: "announcementMode" });

  const add = () => {
    append(emptyDeceased());
    if (form.getValues("announcementMode") === "single") form.setValue("announcementMode", "unrelated");
  };
  const removeAt = (index: number) => {
    remove(index);
    if (fields.length - 1 <= 1) form.setValue("announcementMode", "single");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <User className="w-6 h-6 text-primary/70" />
          بيانات المتوفين
        </h2>
        <p className="text-muted-foreground mt-1">يرجى إدخال بيانات المتوفى بدقة وعناية.</p>
      </div>

      <MessageTypeCard />

      <div className="space-y-8">
        {fields.map((field, index) => (
          <DeceasedCard key={field.id} index={index} count={fields.length} onRemove={() => removeAt(index)} />
        ))}

        {fields.length > 1 && (
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <SelectField
                name="announcementMode"
                label="صيغة الإعلان عند تعدد المتوفين"
                options={ANNOUNCEMENT_MODES.map(({ value, label }) => ({ value, label }))}
                description={ANNOUNCEMENT_MODES.find((option) => option.value === mode)?.hint}
              />
              {(mode === "siblings" || mode === "father_first") && (
                <div className="space-y-2">
                  <p className="font-medium">الأب المشترك <Required /></p>
                  <LinkedPersonFields prefix="sharedParent" nameLabel="اسم الأب" titleSuggestions={SPOUSE_TITLE_SUGGESTIONS} listId="shared-parent-titles" />
                </div>
              )}
              {mode === "mother_child" && (
                <p className="text-sm text-muted-foreground">المتوفى الأول هو الأم (أو الأب)، والبقية أبناؤها؛ يُكتب «وابنتها الطفلة / …».</p>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-2 h-14 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          onClick={add}
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة متوفى آخر
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── الخطوة ٢: الأقارب ─────────────────────────

export function RelativesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "relatives" });
  const rootError = form.formState.errors.relatives?.message ?? form.formState.errors.relatives?.root?.message;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Users className="w-6 h-6 text-primary/70" />
          بيانات الأقارب
        </h2>
        <p className="text-muted-foreground mt-1">
          اختر صلة الأشخاص بالمتوفى، ويكتب التطبيق العنوان بصيغة الأرشيف (مثل «والدة كل من»). تُذكر أسماء الأقارب الذكور حسب العرف.
        </p>
      </div>
      {rootError && <p className="text-sm font-medium text-destructive">{rootError}</p>}

      <div className="space-y-8">
        {fields.map((field, index) => (
          <RelativeGroupCard key={field.id} index={index} onRemove={() => remove(index)} />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-2 h-14 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          onClick={() => append({
            relationKey: undefined as unknown as ObituaryFormValues["relatives"][number]["relationKey"],
            relationOther: "",
            familyReference: "",
            reference: { title: "", name: "", deceased: false },
            deceasedPlacement: "auto",
            deceasedTarget: "all",
            people: [{ name: "", occupation: "", deceased: false }],
          })}
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة مجموعة قرابة جديدة
        </Button>
      </div>
    </div>
  );
}

function RelativeGroupCard({ index, onRemove }: { index: number; onRemove: () => void }) {
  const form = useFormContext<ObituaryFormValues>();
  const group = useWatch({ control: form.control, name: `relatives.${index}` });
  const key = group?.relationKey;
  const option = RELATION_OPTIONS.find((item) => item.key === key);

  return (
    <Card className="relative overflow-hidden border-border bg-background shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 left-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <CardContent className="pt-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-4">
            <DeceasedTargetSelect name={`relatives.${index}.deceasedTarget`} label="يخص" />
            <SelectField
              name={`relatives.${index}.relationKey`}
              label="صلة الأشخاص بالمتوفى"
              placeholder="اختر صلة القرابة"
              options={RELATION_OPTIONS.map((item) => ({ value: item.key, label: item.label }))}
              description={option && option.key !== "other" ? `يظهر في الإعلان: «${option.hint}»` : undefined}
            />
            {key === "other" && (
              <TextField name={`relatives.${index}.relationOther`} label="العنوان كما يُكتب" placeholder="مثال: حفيدة الوالد" />
            )}
            <SelectField
              name={`relatives.${index}.deceasedPlacement`}
              label="موضع «رحمه الله» للمتوفين منهم"
              options={[
                { value: "auto", label: "تلقائي (يُجمَّع إن كانوا اثنين فأكثر)" },
                { value: "inline", label: "بجانب كل اسم" },
                { value: "grouped", label: "مجمّعة في آخر القائمة" },
              ]}
            />
          </div>
          <div className="md:col-span-3 border-r pr-6 border-border/50 space-y-4">
            <RelativePeopleArray relativeIndex={index} />
            {relationTakesReference(key) && (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-2">
                <p className="font-medium text-sm">
                  سطر «أبناء /» — {REFERENCE_LABELS[key!]} <span className="text-muted-foreground">(اختياري)</span>
                </p>
                <LinkedPersonFields
                  prefix={`relatives.${index}.reference`}
                  nameLabel="الاسم"
                  titleSuggestions={SPOUSE_TITLE_SUGGESTIONS}
                  listId={`reference-titles-${index}`}
                />
                {(key === "siblings" || key === "full_siblings") && (
                  <p className="text-xs text-muted-foreground">إن تُرك فارغاً يُستعمل الأب المسجل في بيانات المتوفى.</p>
                )}
              </div>
            )}
            <TextField name={`relatives.${index}.familyReference`} label="سطر إضافي بعد القائمة (اختياري)" placeholder="مثال: آل عبدالله" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RelativePeopleArray({ relativeIndex }: { relativeIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `relatives.${relativeIndex}.people`,
  });

  return (
    <div className="space-y-3">
      <FormLabel>الأشخاص</FormLabel>
      {fields.map((field, personIndex) => (
        <div key={field.id} className="flex items-start gap-2 bg-muted/20 p-3 rounded-md border border-border/50 relative">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name={`relatives.${relativeIndex}.people.${personIndex}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormControl><Input placeholder="الاسم" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`relatives.${relativeIndex}.people.${personIndex}.occupation`}
              render={({ field }) => (
                <FormItem>
                  <FormControl><Input placeholder="الجهة / الصفة (تُكتب بين قوسين)" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-4">
              <FormField
                control={form.control}
                name={`relatives.${relativeIndex}.people.${personIndex}.deceased`}
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-3 h-10 bg-background flex-1">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm whitespace-nowrap !mt-0">متوفى (رحمه الله)</FormLabel>
                  </FormItem>
                )}
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => remove(personIndex)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 text-primary hover:bg-primary/10 gap-1"
        onClick={() => append({ name: "", occupation: "", deceased: false })}
      >
        <Plus className="w-3 h-3" />
        إضافة شخص آخر
      </Button>
    </div>
  );
}

// ───────────────────────── الخطوة ٣: الدفن والصلاة ─────────────────────────

function DayTimeFields({ prefix, dayRequired, timeRequired, dayLabel, timeLabel }: {
  prefix: "burial" | "prayer";
  dayRequired: boolean;
  timeRequired: boolean;
  dayLabel: string;
  timeLabel: string;
}) {
  const form = useFormContext<ObituaryFormValues>();
  const dayType = useWatch({ control: form.control, name: `${prefix}.dayType` });
  const timeType = useWatch({ control: form.control, name: `${prefix}.timeType` });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/10 rounded-lg border border-border/50">
      <div className="space-y-4">
        <SelectField name={`${prefix}.dayType`} label={dayLabel} required={dayRequired} options={DAY_OPTIONS} placeholder="اختر اليوم" />
        {RELATIVE_DAYS.includes(dayType ?? "") && (
          <SelectField name={`${prefix}.weekday`} label="اسم اليوم (اختياري)" options={WEEKDAYS} placeholder="مثال: السبت" description="يُكتب «اليوم السبت»." />
        )}
        {dayType === "أخرى" && <TextField name={`${prefix}.dayOther`} label="حدد اليوم" placeholder="مثال: الأحد ١٢ مايو" />}
      </div>
      <div className="space-y-4">
        <SelectField name={`${prefix}.timeType`} label={timeLabel} required={timeRequired} options={TIME_OPTIONS} placeholder="اختر الوقت" />
        {["وقت محدد", "أخرى"].includes(timeType ?? "") && (
          <TextField name={`${prefix}.timeOther`} label="حدد الوقت" placeholder="مثال: بعد الساعة ١٢:٣٠" />
        )}
      </div>
    </div>
  );
}

export function BurialPrayerStep() {
  const form = useFormContext<ObituaryFormValues>();
  const burial = useWatch({ control: form.control, name: "burial" });
  const prayer = useWatch({ control: form.control, name: "prayer" });
  const messageType = useWatch({ control: form.control, name: "messageType" });
  const required = burialScheduleRequired({ messageType, burial, prayer });
  const isOutsideQatar = !!burial?.outsideQatar;
  const postponed = burial?.status === "postponed";

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary/70" />
            الدفن
          </h2>
          <p className="text-muted-foreground mt-1">متى وأين سيتم / تم الدفن.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="burial.status"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-base font-bold text-primary">حالة الدفن <Required /></FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-3">
                    {[
                      { value: "upcoming", label: "سيتم الدفن" },
                      { value: "completed", label: "تم الدفن" },
                      { value: "postponed", label: "مؤجل حتى إشعار آخر" },
                    ].map((option) => (
                      <FormItem key={option.value} className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-4 py-3 flex-1 bg-background min-w-[120px]">
                        <FormControl><RadioGroupItem value={option.value} /></FormControl>
                        <FormLabel className="font-normal cursor-pointer w-full text-center text-base">{option.label}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="burial.outsideQatar"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-base font-bold text-primary">مكان الدفن</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={(value) => field.onChange(value === "true")} value={field.value ? "true" : "false"} className="flex gap-4">
                    <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-4 py-3 flex-1 bg-background">
                      <FormControl><RadioGroupItem value="false" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer w-full text-center text-base">داخل قطر</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-4 py-3 flex-1 bg-background">
                      <FormControl><RadioGroupItem value="true" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer w-full text-center text-base">خارج قطر</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {postponed ? (
          <TextField name="burial.postponeNote" label="ملاحظة التأجيل (اختياري)" placeholder="مثال: لحين وصول الجثمان" />
        ) : (
          <>
            <DayTimeFields
              prefix="burial"
              dayLabel="يوم الدفن"
              timeLabel="وقت الدفن"
              dayRequired={required.day}
              timeRequired={required.time}
            />
            {!required.day && !postponed && burial?.status === "upcoming" && !isOutsideQatar && prayer?.enabled && (
              <p className="text-xs text-muted-foreground -mt-3">يمكن ترك موعد الدفن إن كان بعد صلاة الجنازة مباشرة.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!isOutsideQatar ? (
                <div className="space-y-4">
                  <SelectField name="burial.cemeteryType" label="المقبرة" required={required.cemetery} options={CEMETERY_OPTIONS} placeholder="اختر المقبرة" />
                  {burial?.cemeteryType === "أخرى" && <TextField name="burial.cemeteryOther" label="اسم المقبرة" placeholder="اسم المقبرة" />}
                </div>
              ) : (
                <TextField
                  name="burial.outsideLocation"
                  label="مكان الدفن"
                  required={messageType === "announcement" || messageType === "amendment"}
                  placeholder="مثال: مصر، أو: مكة المكرمة، أو: بلده"
                  description="يُكتب «والدفن في مصر»."
                />
              )}
              <TextField name="burial.mapLink" label="رابط خرائط جوجل (اختياري)" placeholder="https://maps.google.com/..." ltr />
            </div>
          </>
        )}
      </section>

      {!postponed && (
        <section className="space-y-6 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">صلاة الجنازة</h2>
              <p className="text-muted-foreground mt-1">إذا كانت الصلاة في مكان أو وقت مختلف عن الدفن: «صلاة الجنازة … في جامع X / والدفن في مقبرة Y».</p>
            </div>
            <FormField
              control={form.control}
              name="prayer.enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 m-0 p-0 border-none bg-transparent">
                  <FormLabel className="m-0 font-medium text-base">صلاة منفصلة</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="scale-110" /></FormControl>
                </FormItem>
              )}
            />
          </div>

          {prayer?.enabled && (
            <div className="space-y-6 p-6 bg-primary/5 rounded-lg border border-primary/20 animate-in fade-in zoom-in-95">
              <DayTimeFields prefix="prayer" dayLabel="يوم الصلاة" timeLabel="وقت الصلاة" dayRequired={false} timeRequired={false} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextField name="prayer.place" label="مكان الصلاة" placeholder="مثال: جامع الإمام محمد بن عبدالوهاب" />
                <TextField name="prayer.mapLink" label="رابط خرائط جوجل للمسجد" placeholder="https://maps.google.com/..." ltr />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ───────────────────────── الخطوة ٤: العزاء ─────────────────────────

function CondolenceCardForm({ index, title, canRemove, onRemove }: {
  index: number;
  title: string;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const form = useFormContext<ObituaryFormValues>();
  const card = useWatch({ control: form.control, name: `condolences.cards.${index}` });
  const schedule = useFieldArray({ control: form.control, name: `condolences.cards.${index}.schedule` });
  const prefix = `condolences.cards.${index}` as const;
  const expanded = !!card?.expanded;

  return (
    <Card className="border border-border shadow-sm">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-3 border-b border-border/50">
        <h3 className="font-bold text-base text-primary">{title}</h3>
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="حذف الموقع" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DeceasedTargetSelect name={`${prefix}.deceasedTarget`} label="عزاء لـ" />
          <SelectField
            name={`${prefix}.startType`}
            label="بداية العزاء"
            options={[...CONDOLENCE_STARTS, { value: "أخرى", label: "يوم محدد" }]}
            placeholder="اختر البداية"
          />
          {card?.startType === "أخرى" && <TextField name={`${prefix}.startOther`} label="حدد اليوم" placeholder="مثال: الأربعاء، أو: يوم الخميس" />}
        </div>
        <TextField
          name={`${prefix}.location`}
          label="المكان / الوصف"
          textarea
          placeholder="مجلس العائلة، منزل ابنتها، بمنزل أختها حرم فلان، خيمة، قاعة…"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField name={`${prefix}.area`} label="المنطقة" placeholder="مثال: الدفنة" />
          <TextField name={`${prefix}.mapLink`} label="رابط الموقع (اختياري)" placeholder="https://maps.google.com/..." ltr />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 text-primary hover:bg-transparent"
          onClick={() => form.setValue(`${prefix}.expanded`, !expanded, { shouldDirty: true })}
        >
          {expanded ? "إخفاء التفاصيل" : "إضافة تفاصيل"} <span className="mr-2 text-xs text-muted-foreground">وقت، مدة، جدول، وعنوان دقيق (تُحفظ حتى لو أُخفيت)</span>
        </Button>
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/10 p-4">
            <TextField name={`${prefix}.time`} label="وقت العزاء" placeholder="الفترة المسائية، أو: من ٤ عصراً إلى ٩ مساءً" />
            <TextField name={`${prefix}.durationDays`} label="مدة العزاء بالأيام" placeholder="مثال: 3" />
            <TextField name={`${prefix}.until`} label="حتى (اختياري)" placeholder="مثال: يوم الاثنين ٢٩ يونيو" />
            <div className="sm:col-span-2 space-y-2">
              <FormLabel>جدول متغير (اختياري)</FormLabel>
              {schedule.fields.map((entry, entryIndex) => (
                <div key={entry.id} className="flex gap-2 items-start">
                  <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
                    <TextField name={`${prefix}.schedule.${entryIndex}.days`} label="الأيام" placeholder="مثال: الجمعة والسبت" />
                    <TextField name={`${prefix}.schedule.${entryIndex}.time`} label="الوقت" placeholder="مثال: من بعد صلاة العصر" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="mt-7" onClick={() => schedule.remove(entryIndex)} aria-label="حذف"><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => schedule.append({ days: "", time: "" })}>
                <Plus className="w-3 h-3" /> إضافة يوم بفترة مختلفة
              </Button>
            </div>
            <TextField name={`${prefix}.street`} label="الشارع" />
            <TextField name={`${prefix}.houseNumber`} label="رقم المنزل" />
            <TextField name={`${prefix}.buildingNumber`} label="البناية / العمارة" />
            <TextField name={`${prefix}.floor`} label="الطابق" />
            <TextField name={`${prefix}.apartmentNumber`} label="الشقة" />
            <TextField name={`${prefix}.locationNotes`} label="ملاحظات إضافية" textarea />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CondolencesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const options = useWatch({ control: form.control, name: "condolences" });
  const cards = useFieldArray({ control: form.control, name: "condolences.cards" });
  const phone = useFieldArray({ control: form.control, name: "condolences.phoneContacts" });

  const ensureCard = (audience: "men" | "women") => {
    if (!form.getValues("condolences.cards").some((card) => card.audience === audience)) {
      cards.append(emptyCondolenceCard(audience));
    }
  };
  const setOption = (name: "none" | "phone" | "men" | "women" | "tbd", checked: boolean) => {
    form.setValue(`condolences.${name}`, checked, { shouldDirty: true });
    if (name === "none" && checked) {
      (["phone", "men", "women", "tbd"] as const).forEach((option) => form.setValue(`condolences.${option}`, false));
    } else if (checked) {
      form.setValue("condolences.none", false);
    }
    if (checked && (name === "men" || name === "women")) ensureCard(name);
  };
  const copyMenToWomen = () => {
    const all = form.getValues("condolences.cards");
    const men = all.find((card) => card.audience === "men");
    if (!men) return;
    const womenIndex = all.findIndex((card) => card.audience === "women");
    const copy = { ...men, audience: "women" as const, schedule: men.schedule.map((entry) => ({ ...entry })) };
    if (womenIndex >= 0) form.setValue(`condolences.cards.${womenIndex}`, copy, { shouldDirty: true });
    else cards.append(copy);
  };

  const renderAudience = (audience: "men" | "women") => {
    const indexes = cards.fields.map((card, index) => ({ card, index })).filter(({ card }) => card.audience === audience);
    const base = audience === "men" ? "عزاء الرجال" : "عزاء النساء";
    return (
      <div className="space-y-3">
        {indexes.map(({ card, index }, position) => (
          <CondolenceCardForm
            key={card.id}
            index={index}
            title={indexes.length > 1 ? `${base} — الموقع ${position + 1}` : base}
            canRemove={indexes.length > 1}
            onRemove={() => cards.remove(index)}
          />
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => cards.append(emptyCondolenceCard(audience))}>
          <Plus className="w-3 h-3" /> إضافة موقع آخر لـ{base}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Heart className="w-6 h-6 text-primary/70" />
          العزاء
        </h2>
        <p className="text-muted-foreground mt-1">فعّل ما ينطبق فقط، وستظهر التفاصيل عند الحاجة.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          ["men", "عزاء الرجال"],
          ["women", "عزاء النساء"],
          ["phone", "تعزية عبر الهاتف"],
          ["tbd", "سيُحدَّد لاحقاً"],
          ["none", "لا يوجد عزاء"],
        ] as const).map(([name, label]) => (
          <FormField key={name} control={form.control} name={`condolences.${name}`} render={({ field }) => (
            <FormItem className="flex items-center justify-between space-y-0 rounded-md border border-input bg-background px-4 py-3">
              <FormLabel className="cursor-pointer text-base">{label}</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={(checked) => setOption(name, checked)} /></FormControl>
            </FormItem>
          )} />
        ))}
      </div>

      <TextField
        name="condolences.note"
        label="سبب أو ملاحظة على العزاء (اختياري)"
        placeholder="مثال: اتباعاً للسنة، أو: تنفيذاً لوصية المتوفى"
      />

      {options?.men && (
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="condolences.menMode"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>عزاء الرجال</FormLabel>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap gap-2">
                  {[{ value: "venue", label: "في مجلس / منزل / خيمة" }, { value: "cemetery", label: "في المقبرة فقط" }].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer">
                      <RadioGroupItem value={option.value} />
                      {option.label}
                    </label>
                  ))}
                </RadioGroup>
              </FormItem>
            )}
          />
          {options.menMode === "venue" && renderAudience("men")}
        </div>
      )}
      {options?.women && (
        <div className="space-y-2">
          {options.men && options.menMode === "venue" && (
            <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={copyMenToWomen}>نفس بيانات عزاء الرجال</Button>
          )}
          {renderAudience("women")}
        </div>
      )}
      {options?.phone && (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <SelectField
              name="condolences.phoneAudience"
              label="العزاء عبر الهاتف لـ"
              options={[{ value: "all", label: "الجميع" }, { value: "women", label: "النساء" }, { value: "men", label: "الرجال" }]}
            />
            <div>
              <h3 className="font-bold text-primary">أرقام التعزية (اختياري)</h3>
              <p className="text-sm text-muted-foreground">مثال: الاسم «والدها» يُكتب «العزاء عن طريق هاتف والدها».</p>
            </div>
            {phone.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <FormField control={form.control} name={`condolences.phoneContacts.${index}.name`} render={({ field }) => (
                  <FormItem className="space-y-0"><FormControl><Input placeholder="اسم الشخص (اختياري)" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`condolences.phoneContacts.${index}.phone`} render={({ field }) => (
                  <FormItem className="space-y-0"><FormControl><Input placeholder="رقم الهاتف (اختياري)" dir="ltr" className="text-left" {...field} /></FormControl></FormItem>
                )} />
                <Button type="button" variant="ghost" size="icon" onClick={() => phone.remove(index)} aria-label="حذف"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => phone.append({ name: "", phone: "" })}>
              <Plus className="w-3 h-3" /> إضافة رقم
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── الخطوة ٥: الملاحظات ─────────────────────────

export function ContactsNotesStep() {
  const form = useFormContext<ObituaryFormValues>();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary/70" />
            ملاحظات عامة
          </h2>
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>أي تفاصيل إضافية ترغب في إدراجها بالإعلان</FormLabel>
              <FormControl>
                <Textarea placeholder="مثال: ليس لديه أحد في قطر" className="min-h-[150px] resize-y" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}

// ───────────────────────── الخطوة ٦: المراجعة ─────────────────────────

/** معاينة النص النهائي كما سيُنشر، من المولّد نفسه الذي يستخدمه المسؤول والصورة. */
export function AnnouncementPreview({ values }: { values: ObituaryFormValues }) {
  const announcement = useMemo(() => buildAnnouncement(mapFormToPayload(values)), [values]);
  return (
    <div className="space-y-4">
      {announcement.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="w-4 h-4" /> تنبيهات قبل النشر</p>
          <ul className="mt-2 list-disc pr-5 text-sm space-y-1">
            {announcement.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      <pre dir="rtl" className="whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-5 font-sans text-base leading-8">
        {announcement.text}
      </pre>
    </div>
  );
}

export function ReviewStep() {
  const form = useFormContext<ObituaryFormValues>();
  const values = form.getValues();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-primary mb-2">مراجعة الإعلان</h2>
        <p className="text-muted-foreground">هذا هو النص الذي سيُنشر. ارجع إلى الخطوات السابقة لتعديل أي جزء.</p>
      </div>
      <AnnouncementPreview values={values} />
    </div>
  );
}
