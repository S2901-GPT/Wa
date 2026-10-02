import React, { useState, useMemo } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { ObituaryFormValues, emptyDeceased } from "@/lib/schema";
import {
  AnnouncementPreview,
  CondolenceExtras,
  DeceasedExtras,
  ExtraVenuesSection,
  MessageTypeCard,
  MoreOptions,
  MultipleDeceasedCard,
  RelationSelect,
  RelativeGroupExtras,
  VenueExtras,
} from "@/components/form-steps-extras";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Trash2, Plus, User, Users, Calendar, Heart, FileText, CheckCircle2, 
  MapPin, Clock, Phone, Sparkles, AlertCircle, Copy, Link as LinkIcon, UserCheck
} from "lucide-react";

const PREFIX_TITLES = [
  { label: "بدون لقب (تلقائي)", value: "none" },
  { label: "الوالد", value: "الوالد" },
  { label: "الوالدة", value: "الوالدة" },
  { label: "الشاب", value: "الشاب" },
  { label: "الشابة", value: "الشابة" },
  { label: "الطفل", value: "الطفل" },
  { label: "الطفلة", value: "الطفلة" },
  { label: "الرضيع", value: "الرضيع" },
  { label: "الرضيعة", value: "الرضيعة" },
  { label: "المولودة", value: "المولودة" },
  { label: "الشيخ", value: "الشيخ" },
  { label: "الشيخة", value: "الشيخة" },
  { label: "فضيلة الشيخ", value: "فضيلة الشيخ" },
  { label: "سعادة الشيخ", value: "سعادة الشيخ" },
  { label: "سعادة", value: "سعادة" },
  { label: "سعادة السفير", value: "سعادة السفير" },
  { label: "الدكتور", value: "الدكتور" },
  { label: "الدكتورة", value: "الدكتورة" },
  { label: "الأستاذ", value: "الأستاذ" },
  { label: "اللواء", value: "اللواء" },
  { label: "العميد", value: "العميد" },
  { label: "النقيب", value: "النقيب" },
  { label: "شهيد الوطن", value: "شهيد الوطن" },
];

// 1. الجنس: ذكر أو أنثى حصرياً
const GENDER_OPTIONS = [
  { label: "ذكر", value: "ذكر" },
  { label: "أنثى", value: "أنثى" },
] as const;

const COMMON_RELATIONS = [
  "أبناؤه", "أخوانه", "أعمامه", "أخواله", "أبناء عمومته", "أصهاره", "أحفاده", "أخرى"
];

// مقابر الأرشيف (مسيمير تُكتب أيضاً مسمير/ميسمير؛ المزروعة افتُتحت ٢٠٢٦)
const QATAR_CEMETERIES = [
  "مقبرة مسيمير", "مقبرة الخور", "مقبرة الوكرة الجنوبية", "مقبرة أم صلال",
  "مقبرة الريان", "مقبرة الرويس", "مقبرة مريخ", "مقبرة المزروعة",
  "مقبرة الوكير", "مقبرة الخريطيات", "مقبرة الكعبان", "مقبرة أبوظلوف", "أخرى"
];

const PRAYER_TIMES_OPTIONS = [
  "بعد صلاة الفجر", 
  "بعد صلاة الظهر", 
  "بعد صلاة العصر", 
  "بعد صلاة المغرب", 
  "بعد صلاة العشاء",
  "بعد صلاة الجمعة",
  "بعد صلاة التراويح",
  "وقت آخر..."
];

const CONDOLENCE_TYPES = [
  { 
    id: "full", 
    title: "عزاء رجال ونساء", 
    desc: "تحديد مقرات وأوقات للرجال والنساء" 
  },
  { 
    id: "men_only", 
    title: "عزاء رجال فقط", 
    desc: "استقبال التعازي في مجلس أو مقر الرجال فقط" 
  },
  { 
    id: "women_only", 
    title: "عزاء نساء فقط", 
    desc: "استقبال التعازي في مقر النساء فقط" 
  },
  { 
    id: "phone_only", 
    title: "هاتف فقط", 
    desc: "التعازي عبر الاتصال الهاتفي ورسائل WhatsApp" 
  },
  { 
    id: "cemetery_only", 
    title: "يقتصر على المقبرة", 
    desc: "«عزاء الرجال في المقبرة فقط» اتباعاً للسنة أو تنفيذاً للوصية" 
  },
  { 
    id: "tbd", 
    title: "سيُحدَّد لاحقاً", 
    desc: "يُعلن مقر العزاء في رسالة لاحقة" 
  },
  { 
    id: "none", 
    title: "لا يوجد عزاء", 
    desc: "يُكتب «لا يوجد عزاء» صراحة في الإعلان" 
  },
] as const;

const TIME_WINDOWS = [
  { value: "evening", label: "الفترة المسائية (من بعد صلاة العصر حتى 9 مساءً)" },
  { value: "morning", label: "الفترة الصباحية (من 9 صباحاً حتى الظهر)" },
  { value: "after_taraweeh", label: "بعد صلاة التراويح" },
  { value: "open", label: "مفتوح طوال اليوم" },
  { value: "exact_time", label: "ساعات محددة يدوياً" },
] as const;

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==========================================
// الخطوة 1: بيانات المتوفين (DeceasedStep)
// ==========================================
export function DeceasedStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "deceasedList"
  });

  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70 shrink-0" />
          بيانات المتوفى / المتوفين
        </h2>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          أدخل بيانات المتوفى بدقة. في حال كانت المتوفاة أنثى، يمكن الاكتفاء بصلة القرابة (أرملة فلان / حرم فلان) بدون نشر الاسم الأول.
        </p>
      </div>

      <MessageTypeCard />

      {/* شريط تعدد المتوفين بالأزرار السريعة (Tabs) مع flex-wrap للجوال */}
      {fields.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 sm:p-2 bg-muted/40 rounded-lg border w-full box-border">
          {fields.map((field, idx) => {
            const currentName = form.watch(`deceasedList.${idx}.fullName`) || `متوفى #${idx + 1}`;
            return (
              <Button
                key={field.id}
                type="button"
                variant={activeTab === idx ? "default" : "outline"}
                size="sm"
                className="gap-1.5 h-8 text-xs shrink-0"
                onClick={() => setActiveTab(idx)}
              >
                <span className="truncate max-w-[120px]">{currentName}</span>
                <span
                  role="button"
                  className="hover:text-destructive p-0.5 rounded font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(idx);
                    if (activeTab >= idx && activeTab > 0) setActiveTab(activeTab - 1);
                  }}
                >
                  ×
                </span>
              </Button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-primary/10 gap-1 text-xs h-8"
            onClick={() => {
              append(emptyDeceased());
              setActiveTab(fields.length);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة متوفى آخر
          </Button>
        </div>
      )}

      {fields.map((field, index) => {
        if (fields.length > 1 && activeTab !== index) return null;

        const currentGender = form.watch(`deceasedList.${index}.gender`);
        const isFemale = currentGender === "أنثى";

        return (
          <Card key={field.id} className="relative overflow-hidden border-border bg-card shadow-sm w-full max-w-full box-border">
            <CardContent className="p-3 sm:p-5 space-y-5 w-full max-w-full box-border">
              
              {/* الجنس: ذكر أو أنثى فقط */}
              <FormField
                control={form.control}
                name={`deceasedList.${index}.gender`}
                render={({ field: genderField }) => (
                  <FormItem className="space-y-1.5 w-full">
                    <FormLabel className="text-xs sm:text-sm font-semibold text-foreground">الجنس <span className="text-destructive">*</span></FormLabel>
                    <div className="grid grid-cols-2 gap-2 w-full max-w-xs box-border">
                      {GENDER_OPTIONS.map((opt) => {
                        const isSelected = genderField.value === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => genderField.onChange(opt.value)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border text-xs sm:text-sm font-semibold transition-all ${
                              isSelected 
                                ? "bg-primary text-primary-foreground border-primary shadow-xs" 
                                : "bg-background hover:bg-muted text-foreground border-input"
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full box-border">
                {/* اللقب الشرفي / الصدارة */}
                <FormField
                  control={form.control}
                  name={`deceasedList.${index}.title`}
                  render={({ field: titleField }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs sm:text-sm font-semibold">اللقب الشرفي / التصدير</FormLabel>
                      <Select 
                        value={titleField.value || "none"} 
                        onValueChange={titleField.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 bg-background w-full text-xs sm:text-sm">
                            <SelectValue placeholder="اختر اللقب إن وجد" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {PREFIX_TITLES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* الاسم الكامل */}
                <div className="md:col-span-2 w-full min-w-0">
                  <FormField
                    control={form.control}
                    name={`deceasedList.${index}.fullName`}
                    render={({ field: nameField }) => (
                      <FormItem className="w-full min-w-0">
                        <FormLabel className="text-xs sm:text-sm font-semibold">
                          الاسم {isFemale ? <span className="text-muted-foreground font-normal">(اختياري في حال تحديد أرملة فلان أو حرم فلان أدناه)</span> : <span className="text-destructive">*</span>}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={isFemale ? "اسم المتوفاة (يمكن تركه فارغاً إذا ذُكرت أرملة فلان)" : "الاسم الثلاثي أو الرباعي"} 
                            className="h-10 bg-background w-full text-xs sm:text-sm" 
                            {...nameField} 
                            value={nameField.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* قسم خاص للإناث: أرملة فلان / حرم فلان */}
              {isFemale && (
                <FemaleRelationsSection deceasedIndex={index} />
              )}

              {/* بيانات إضافية اختيارية */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50 w-full box-border">
                <FormField
                  control={form.control}
                  name={`deceasedList.${index}.age`}
                  render={({ field: ageField }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs text-muted-foreground">العمر (اختياري)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="مثال: 72" 
                          className="h-9 bg-background w-full text-xs sm:text-sm" 
                          value={ageField.value ?? ""} 
                          onChange={(e) => ageField.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`deceasedList.${index}.nationality`}
                  render={({ field: natField }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs text-muted-foreground">الجنسية (اختياري)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="مثال: قطري" 
                          className="h-9 bg-background w-full text-xs sm:text-sm" 
                          {...natField} 
                          value={natField.value || ""} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`deceasedList.${index}.deathLocation`}
                  render={({ field: locField }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs text-muted-foreground">مكان الوفاة بالخارج (إن وجد)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="مثال: في لندن، في تايلاند" 
                          className="h-9 bg-background w-full text-xs sm:text-sm" 
                          {...locField} 
                          value={locField.value || ""} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* الكنية، طريقة التعريف، الأب، وحدة العمر… (مطوية) */}
              <DeceasedExtras index={index} />

              {fields.length === 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed gap-1 text-muted-foreground hover:text-primary mt-2 text-xs h-9"
                  onClick={() => {
                    append(emptyDeceased());
                    if (form.getValues("announcementMode") === "single") form.setValue("announcementMode", "unrelated");
                    setActiveTab(1);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة متوفى آخر في نفس الإعلان (إن وجد)
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}

      <MultipleDeceasedCard />
    </div>
  );
}

// مكون فرعي: معرفات المتوفاة (أرملة / حرم)
function FemaleRelationsSection({ deceasedIndex }: { deceasedIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `deceasedList.${deceasedIndex}.femaleRelations` as any,
  });

  return (
    <div className="p-3 sm:p-4 rounded-lg bg-pink-50/50 dark:bg-pink-950/10 border border-pink-200 dark:border-pink-900/50 space-y-3 w-full box-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
            معرّف القرابة للمتوفاة (أرملة / حرم)
          </h4>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            يتيح التعريف بالزوج (أرملة فلان أو حرم فلان) ويُغني عن كتابة الاسم الأول للمتوفاة.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs border-pink-300 hover:bg-pink-100 dark:hover:bg-pink-950/40 shrink-0"
          onClick={() => append({ relationType: "أرملة", relatedTitle: "", relatedName: "", isHusbandDeceased: true })}
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          إضافة صلة
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="text-xs text-muted-foreground bg-background/60 p-2 rounded border border-dashed text-center">
          لم يتم تحديد صلة (أرملة / حرم). إذا رغبت بالتعريف بالزوج، اضغط زر "إضافة صلة".
        </div>
      )}

      {fields.map((field, rIndex) => {
        const relationType = form.watch(`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.relationType` as any);
        const isArmala = relationType === "أرملة";

        return (
          <div key={field.id} className="flex flex-col sm:flex-row flex-wrap gap-2 bg-background p-2.5 rounded-md border shadow-2xs items-stretch sm:items-center w-full box-border">
            <div className="w-full sm:w-32 shrink-0">
              <FormField
                control={form.control}
                name={`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.relationType` as any}
                render={({ field: relTypeField }) => (
                  <Select 
                    value={relTypeField.value} 
                    onValueChange={(val: "أرملة" | "حرم") => {
                      relTypeField.onChange(val);
                      if (val === "أرملة") {
                        form.setValue(`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.isHusbandDeceased` as any, true);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="أرملة" className="text-xs">أرملة (المرحوم)</SelectItem>
                      <SelectItem value="حرم" className="text-xs">حرم</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="w-full sm:w-28 shrink-0">
              <FormField
                control={form.control}
                name={`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.relatedTitle` as any}
                render={({ field: titleField }) => (
                  <Input 
                    placeholder="اللقب: الوالد، الشيخ" 
                    className="h-9 text-xs w-full" 
                    {...titleField} 
                    value={titleField.value || ""} 
                  />
                )}
              />
            </div>

            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <FormField
                control={form.control}
                name={`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.relatedName` as any}
                render={({ field: nameField }) => (
                  <Input 
                    placeholder="اسم الزوج (مثال: ناصر بن خليفة الكواري)" 
                    className="h-9 text-xs w-full" 
                    {...nameField} 
                  />
                )}
              />
            </div>

            {!isArmala && (
              <div className="flex items-center gap-1.5 shrink-0 px-1 py-1">
                <FormField
                  control={form.control}
                  name={`deceasedList.${deceasedIndex}.femaleRelations.${rIndex}.isHusbandDeceased` as any}
                  render={({ field: deceasedField }) => (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <Switch 
                        checked={deceasedField.value || false} 
                        onCheckedChange={deceasedField.onChange} 
                        className="scale-75" 
                      />
                      <span>متوفى أيضاً</span>
                    </label>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end sm:justify-center shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(rIndex)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// الخطوة 2: الأقارب (RelativesStep)
// ==========================================
export function RelativesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "relatives" as any,
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70 shrink-0" />
          بيانات الأقارب وصلات القرابة
        </h2>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          أدخل مجموعات الأقارب والأشخاص في سطر واحد سريع. هذه الخطوة اختيارية ويمكنك تجاوزها بالضغط على "التالي".
        </p>
      </div>

      {(() => {
        const relativesError = form.formState.errors.relatives as { message?: string; root?: { message?: string } } | undefined;
        const message = relativesError?.message ?? relativesError?.root?.message;
        return message ? <p className="text-xs sm:text-sm font-medium text-destructive">{message}</p> : null;
      })()}

      {fields.length === 0 && (
        <Card className="border-dashed bg-muted/20 text-center p-6 sm:p-8 w-full box-border">
          <p className="text-muted-foreground text-xs sm:text-sm mb-3">لم يتم إضافة مجموعات أقارب بعد.</p>
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-xs sm:text-sm"
            onClick={() => append({ relationType: "أبناؤه", relationKey: "children", deceasedPlacement: "auto", deceasedTarget: "all", persons: [] } as any)}
          >
            <Plus className="w-4 h-4" />
            إضافة مجموعة قرابة أولى (مثل أبناؤه)
          </Button>
        </Card>
      )}

      {fields.map((field, gIndex) => (
        <Card key={field.id} className="relative border shadow-sm w-full max-w-full box-border">
          <CardHeader className="py-2.5 px-3 sm:px-4 bg-muted/30 border-b flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <RelationSelect groupIndex={gIndex} options={COMMON_RELATIONS} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
              onClick={() => remove(gIndex)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 w-full box-border">
            <InlinePersonsManager groupIndex={gIndex} />
            <RelativeGroupExtras groupIndex={gIndex} />
          </CardContent>
        </Card>
      ))}

      {fields.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed h-11 text-muted-foreground hover:text-primary gap-2 text-xs sm:text-sm"
          onClick={() => append({ relationType: "أخوانه", relationKey: "siblings", deceasedPlacement: "auto", deceasedTarget: "all", persons: [] } as any)}
        >
          <Plus className="w-4 h-4" />
          إضافة مجموعة قرابة جديدة (مثل إخوانه، أعمامه...)
        </Button>
      )}
    </div>
  );
}

function InlinePersonsManager({ groupIndex }: { groupIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `relatives.${groupIndex}.persons` as any,
  });

  const [newName, setNewName] = useState("");
  const [newWorkplace, setNewWorkplace] = useState("");
  const [newIsDeceased, setNewIsDeceased] = useState(false);
  const [newJobStatus, setNewJobStatus] = useState<"active" | "retired" | "former" | "none">("none");

  const handleAddPerson = () => {
    if (!newName.trim()) return;
    append({
      name: newName.trim(),
      workplace: newWorkplace.trim() || undefined,
      isDeceased: newIsDeceased,
      jobStatus: newJobStatus,
    } as any);

    setNewName("");
    setNewWorkplace("");
    setNewIsDeceased(false);
    setNewJobStatus("none");
  };

  return (
    <div className="space-y-3 w-full box-border">
      {/* شبكة الإدخال المتجاوبة مع الجوال بالكامل */}
      <div className="p-2.5 sm:p-3 bg-muted/20 rounded-lg border flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center w-full box-border">
        <Input
          placeholder="الاسم (مثال: ناصر)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-9 min-w-0 flex-1 bg-background text-xs sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddPerson();
            }
          }}
        />
        <Input
          placeholder="جهة العمل (اختياري: قطر للطاقة)"
          value={newWorkplace}
          onChange={(e) => setNewWorkplace(e.target.value)}
          className="h-9 min-w-0 flex-1 bg-background text-xs sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddPerson();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select 
            value={newJobStatus} 
            onValueChange={(val: any) => setNewJobStatus(val)}
          >
            <SelectTrigger className="h-9 flex-1 sm:w-28 sm:flex-none bg-background text-xs">
              <SelectValue placeholder="الصفة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">على رأس عمله</SelectItem>
              <SelectItem value="retired">متقاعد</SelectItem>
              <SelectItem value="former">سابقاً</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1 px-2.5 py-1 rounded bg-background border text-xs cursor-pointer select-none shrink-0 h-9">
            <Switch 
              checked={newIsDeceased} 
              onCheckedChange={setNewIsDeceased} 
              className="scale-75" 
            />
            <span className={newIsDeceased ? "font-semibold text-destructive text-[11px]" : "text-muted-foreground text-[11px]"}>متوفى</span>
          </label>

          <Button
            type="button"
            size="sm"
            className="h-9 gap-1 flex-1 sm:flex-none shrink-0 text-xs px-3"
            onClick={handleAddPerson}
            disabled={!newName.trim()}
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة
          </Button>
        </div>
      </div>

      {/* عرض الأقارب المضافين */}
      {fields.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 w-full box-border">
          {fields.map((p: any, pIndex) => (
            <div 
              key={p.id} 
              className="flex items-center justify-between p-2 rounded border bg-background text-xs shadow-2xs group w-full min-w-0 box-border"
            >
              <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                <span className="font-semibold truncate">{p.name}</span>
                {p.isDeceased && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-muted text-destructive font-normal shrink-0">
                    (رحمه الله)
                  </Badge>
                )}
                {p.workplace && (
                  <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
                    • {p.workplace}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => remove(pIndex)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">
          لا يوجد أشخاص مسجلون في هذه المجموعة بعد. أدخل الاسم واضغط زر "إضافة".
        </p>
      )}
    </div>
  );
}

// ==========================================
// الخطوة 3: الصلاة والدفن (BurialPrayerStep)
// ==========================================
export function BurialPrayerStep() {
  const form = useFormContext<ObituaryFormValues>();
  
  const burialStatus = form.watch("burial.status") || "scheduled";
  const isDone = burialStatus === "done";
  const isPostponed = burialStatus === "pending" || burialStatus === "cancelled";
  const isSeparatePrayer = Boolean(form.watch("prayer.enabled"));

  // حالة اختيار مقبرة "أخرى"
  const currentBurialLocation = form.watch("burial.locationName") || "";
  const [isOtherCemetery, setIsOtherCemetery] = useState(() => {
    return Boolean(currentBurialLocation && !QATAR_CEMETERIES.slice(0, -1).includes(currentBurialLocation));
  });

  // حالة اختيار وقت آخر يدوياً
  const currentBurialTime = form.watch("burial.timeDescription") || "";
  const [isCustomBurialTime, setIsCustomBurialTime] = useState(() => {
    return Boolean(currentBurialTime && !PRAYER_TIMES_OPTIONS.slice(0, -1).includes(currentBurialTime));
  });

  const isBurialOutside = form.watch("burial.isOutsideQatar");

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70 shrink-0" />
          الصلاة والدفن
        </h2>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          تحديد موعد ومكان صلاة الجنازة والدفن. في حال كان الدفن قد تم بالفعل، اختر "تم الدفن" لتدوين تفاصيله.
        </p>
      </div>

      <Card className="border shadow-sm overflow-hidden w-full max-w-full box-border">
        <div className="bg-primary/5 px-3 sm:px-6 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full box-border">
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              {isDone ? "بيانات الدفن المنتهي" : (isSeparatePrayer ? "بيانات الدفن" : "الصلاة والدفن (الموحدة)")}
            </h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {isDone 
                ? "تمت إجراءات الدفن مسبقاً، يمكنك تدوين التفاصيل أو مكان الدفن أدناه" 
                : (isSeparatePrayer ? "مكان ووقت الدفن بالمقبرة" : "الصلاة والدفن في نفس الموقع")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {/* حالة الدفن */}
            <FormField
              control={form.control}
              name="burial.status"
              render={({ field }) => (
                <div className="flex items-center gap-1 bg-background p-1 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => field.onChange("scheduled")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      !isDone && !isPostponed ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    سيتم الدفن
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("pending")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      isPostponed ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    مؤجل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      field.onChange("done");
                      form.setValue("prayer.enabled", false);
                      form.setValue("prayer.locationName", "");
                      form.setValue("prayer.dateDescription", "");
                      form.setValue("prayer.timeDescription", "");
                    }}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      isDone ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    تم الدفن
                  </button>
                </div>
              )}
            />

            {/* خارج قطر (يظهر فقط إذا كان الدفن قادماً) */}
            {!isDone && !isPostponed && (
              <FormField
                control={form.control}
                name="burial.isOutsideQatar"
                render={({ field }) => (
                  <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                    <Switch checked={field.value || false} onCheckedChange={field.onChange} className="scale-75" />
                    <span className="text-muted-foreground text-[11px]">خارج قطر</span>
                  </label>
                )}
              />
            )}
          </div>
        </div>

        <CardContent className="p-3 sm:p-5 space-y-4 w-full box-border">
          {/* 3. منطق زر "تم الدفن": طي وإخفاء جميع حقول الدفن والصلاة وإظهار حقل "ملاحظات الدفن" فقط */}
          {isDone ? (
            <div className="p-3.5 sm:p-5 rounded-lg bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in">
              <FormLabel className="text-xs sm:text-sm font-bold text-primary flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                ملاحظات الدفن
              </FormLabel>
              <FormField
                control={form.control}
                name="burial.notes"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input 
                        placeholder="وضح تفاصيل الدفن (مثال: تم الدفن في مكة المكرمة، أو تم الدفن فجر اليوم بمقبرة مسيمير...)" 
                        className="h-10 bg-background text-xs sm:text-sm font-medium w-full" 
                        {...field} 
                        value={field.value || ""} 
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-muted-foreground">
                      بما أنه تم الدفن مسبقاً، سيتم الاكتفاء بهذه الملاحظة في الإعلان دون نشر موعد قادم للصلاة والدفن.
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
          ) : isPostponed ? (
            <div className="p-3.5 sm:p-5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2 animate-in fade-in">
              <FormLabel className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 shrink-0" />
                تأجيل الدفن حتى إشعار آخر
              </FormLabel>
              <FormField
                control={form.control}
                name="burial.notes"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input 
                        placeholder="سبب التأجيل (اختياري، مثال: لحين وصول الجثمان)" 
                        className="h-10 bg-background text-xs sm:text-sm w-full" 
                        {...field} 
                        value={field.value || ""} 
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-muted-foreground">
                      يُكتب «تأجيل الدفن حتى إشعار آخر». عند تحديد الموعد الجديد أرسل «تعديل إعلان سابق».
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
          ) : (
            <>
              {/* اختيار المقبرة مع flex-wrap كامل للجوال */}
              {!isBurialOutside ? (
                <div className="space-y-1.5 w-full">
                  <FormLabel className="text-xs sm:text-sm font-semibold">المقبرة</FormLabel>
                  <FormField
                    control={form.control}
                    name="burial.locationName"
                    render={({ field }) => (
                      <div className="space-y-2 w-full">
                        <div className="flex flex-wrap gap-1.5 w-full box-border">
                          {QATAR_CEMETERIES.map((c) => {
                            const isOther = c === "أخرى";
                            const isSelected = isOther ? isOtherCemetery : (field.value === c && !isOtherCemetery);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  if (isOther) {
                                    setIsOtherCemetery(true);
                                    field.onChange("");
                                  } else {
                                    setIsOtherCemetery(false);
                                    field.onChange(c);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors shrink-0 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                                    : "bg-background hover:bg-muted text-foreground"
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                        {/* حقل نصي لكتابة اسم المقبرة يدوياً عند اختيار "أخرى" */}
                        {isOtherCemetery && (
                          <Input 
                            placeholder="اكتب اسم المقبرة يدوياً (مثال: مقبرة الوسيل)" 
                            className="h-10 bg-background text-xs sm:text-sm animate-in fade-in w-full"
                            value={field.value || ""} 
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  />
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="burial.locationName"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-xs sm:text-sm font-semibold">مكان الدفن خارج الدولة</FormLabel>
                      <FormControl>
                        <Input placeholder="الدولة، المدينة، واسم المقبرة (مثال: القاهرة - مقابر الأسرة)" className="h-10 text-xs sm:text-sm w-full" {...field} value={field.value || ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* يوم ووقت الدفن */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full box-border">
                {/* يوم الدفن: Date Input */}
                <FormField
                  control={form.control}
                  name="burial.dateDescription"
                  render={({ field }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs sm:text-sm font-semibold">تاريخ / يوم الدفن</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          className="h-10 bg-background text-xs sm:text-sm w-full" 
                          value={field.value || ""} 
                          onChange={(e) => field.onChange(e.target.value)} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* وقت الدفن: أزرار لجميع الصلوات + وقت آخر */}
                <FormField
                  control={form.control}
                  name="burial.timeDescription"
                  render={({ field }) => (
                    <FormItem className="w-full min-w-0">
                      <FormLabel className="text-xs sm:text-sm font-semibold">وقت الدفن</FormLabel>
                      <div className="flex flex-wrap gap-1 mb-1.5 w-full box-border">
                        {PRAYER_TIMES_OPTIONS.map((t) => {
                          const isOther = t === "وقت آخر...";
                          const isSelected = isOther ? isCustomBurialTime : (field.value === t && !isCustomBurialTime);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                if (isOther) {
                                  setIsCustomBurialTime(true);
                                  field.onChange("");
                                } else {
                                  setIsCustomBurialTime(false);
                                  field.onChange(t);
                                }
                              }}
                              className={`px-2 py-1 rounded text-[11px] sm:text-xs border font-medium transition-colors shrink-0 ${
                                isSelected ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-background"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      {isCustomBurialTime && (
                        <Input 
                          placeholder="أدخل الوقت الدقيق (مثال: الساعة 9:30 صباحاً)" 
                          className="h-10 bg-background text-xs sm:text-sm animate-in fade-in w-full" 
                          value={field.value || ""} 
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    </FormItem>
                  )}
                />
              </div>

              {/* مفتاح التبديل التدريجي للفصل بين الصلاة والدفن (Default: OFF) */}
              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 w-full">
                <div className="space-y-0.5 max-w-[80%]">
                  <span className="text-xs sm:text-sm font-semibold text-foreground">الصلاة في مكان أو وقت مختلف عن الدفن؟</span>
                  <p className="text-[11px] text-muted-foreground">
                    فعل هذا الخيار فقط إذا كانت الصلاة بجامع منفصل (مثل جامع الإمام محمد بن عبدالوهاب) ثم الانتقال للمقبرة.
                  </p>
                </div>
                <Switch
                  checked={isSeparatePrayer}
                  onCheckedChange={(checked) => {
                    form.setValue("prayer.enabled", checked);
                    if (!checked) {
                      form.setValue("prayer.locationName", "");
                      form.setValue("prayer.dateDescription", "");
                      form.setValue("prayer.timeDescription", "");
                    }
                  }}
                />
              </div>

              {/* تفاصيل صلاة الجنازة المنفصلة (حقل واحد فقط وفارغ للمسجد/الجامع) */}
              {isSeparatePrayer && (
                <div className="mt-3 p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in zoom-in-95 w-full box-border">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
                    <Clock className="w-4 h-4 shrink-0" />
                    صلاة الجنازة (المسجد / الجامع)
                  </div>
                  <FormField
                    control={form.control}
                    name="prayer.locationName"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-xs font-semibold">المسجد / الجامع</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="اكتب اسم المسجد أو الجامع (مثال: جامع الإمام محمد بن عبدالوهاب)" 
                            className="h-10 bg-background text-xs sm:text-sm w-full" 
                            {...field} 
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// الخطوة 4: العزاء الديناميكي (CondolencesStep)
// ==========================================
export function CondolencesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const condType = form.watch("condolences.type") || "full";

  const copyMenToWomen = () => {
    const menData = form.getValues("condolences.men");
    if (menData) {
      form.setValue("condolences.women", {
        ...menData,
      }, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70 shrink-0" />
          العزاء ومقر الاستقبال
        </h2>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          اختر نوع العزاء المناسب. سيتم تلقائياً إخفاء أو إظهار تفاصيل المقرات وفق اختيارك.
        </p>
      </div>

      {/* بطاقات اختيار نوع العزاء */}
      <FormField
        control={form.control}
        name="condolences.type"
        render={({ field }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-full box-border">
            {CONDOLENCE_TYPES.map((t) => {
              const isSelected = (field.value || "full") === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => field.onChange(t.id)}
                  className={`p-2.5 sm:p-3 rounded-lg border text-right transition-all flex flex-col justify-between w-full box-border ${
                    isSelected 
                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary" 
                      : "bg-card hover:bg-muted/50 border-input"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-xs sm:text-sm text-foreground">{t.title}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                </button>
              );
            })}
          </div>
        )}
      />

      {/* تنبيه عند اختيار لا يوجد عزاء أو المقبرة فقط */}
      {(condType === "none" || condType === "cemetery_only" || condType === "tbd") && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-3 sm:p-4 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-center gap-2.5 w-full box-border">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {condType === "none" ? "يُكتب «لا يوجد عزاء»" : condType === "tbd" ? "يُكتب «العزاء: سيُحدَّد لاحقاً»" : "يُكتب «عزاء الرجال في المقبرة فقط»"}
            </p>
            <p className="text-[11px] opacity-90 mt-0.5">يمكن إضافة السبب من «خيارات إضافية» أسفل الصفحة (مثل: اتباعاً للسنة، أو تنفيذاً لوصية المتوفى).</p>
          </div>
        </Card>
      )}

      {/* 2. خانة أرقام الهواتف: مخفية بالكامل ولا تظهر إلا إذا تم تحديد "هاتف فقط" */}
      {condType === "phone_only" && (
        <SmartPhonesSection isPhoneOnly={true} />
      )}

      {/* مقرات العزاء المادية (تظهر فقط عند عزاء رجال أو نساء) */}
      {(condType === "full" || condType === "men_only") && (
        <CondolenceVenueCard audience="men" title="عزاء الرجال" />
      )}

      {(condType === "full" || condType === "women_only") && (
        <div className="space-y-2 w-full box-border">
          {condType === "full" && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-primary gap-1 h-8"
                onClick={copyMenToWomen}
              >
                <Copy className="w-3.5 h-3.5" />
                نسخ نفس موقع عزاء الرجال إلى النساء
              </Button>
            </div>
          )}
          <CondolenceVenueCard audience="women" title="عزاء النساء" />
        </div>
      )}

      {/* سبب العزاء، أرقام الهاتف مع المقرات، والمواقع الإضافية (مطوية) */}
      <MoreOptions
        hint="سبب العزاء، أرقام الهاتف، مواقع إضافية"
        paths={[
          "condolences.cancellationOrRestrictionReason",
          "condolences.withPhones",
          "condolences.extraVenues",
          ...(condType === "phone_only" ? [] : ["condolences.phones"]),
        ]}
      >
        <CondolenceExtras type={condType} />
        {condType !== "phone_only" && form.watch("condolences.withPhones") && (
          <SmartPhonesSection isPhoneOnly={false} />
        )}
        {(condType === "full" || condType === "men_only" || condType === "women_only") && (
          <ExtraVenuesSection
            audiences={condType === "full" ? ["men", "women"] : condType === "men_only" ? ["men"] : ["women"]}
          />
        )}
      </MoreOptions>
    </div>
  );
}

// مكون فرعي: بطاقة مقر العزاء
function CondolenceVenueCard({ audience, title }: { audience: "men" | "women"; title: string }) {
  const form = useFormContext<ObituaryFormValues>();
  const prefix = `condolences.${audience}` as const;
  const isScheduleEnabled = form.watch(`${prefix}.schedule.enabled` as any);

  return (
    <Card className="border shadow-sm w-full max-w-full box-border">
      <CardHeader className="py-2.5 px-3 sm:px-4 bg-muted/30 border-b">
        <CardTitle className="text-xs sm:text-sm font-bold text-primary flex items-center gap-2">
          <MapPin className="w-4 h-4 shrink-0" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-3.5 w-full box-border">
        {/* اسم ووصف مقر العزاء (إجباري *) */}
        <FormField
          control={form.control}
          name={`${prefix}.locationName` as any}
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="text-xs font-semibold flex items-center gap-1 text-foreground">
                <span>اسم ووصف مقر العزاء</span>
                <span className="text-destructive font-bold">*</span>
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder={audience === "men" ? "مثال: مجلس فلان بن فلان في منطقة الدفنة" : "مثال: منزل فلانة في منطقة معيذر"} 
                  className="h-10 bg-background text-xs sm:text-sm w-full" 
                  {...field} 
                  value={field.value || ""} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* رابط الخرائط والمدة */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full box-border">
          <div className="sm:col-span-2 w-full min-w-0">
            <FormField
              control={form.control}
              name={`${prefix}.mapsLink` as any}
              render={({ field }) => (
                <FormItem className="w-full min-w-0">
                  <FormLabel className="text-xs text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    رابط خرائط Google للمقر (اختياري)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://maps.google.com/..." 
                      dir="ltr" 
                      className="h-10 bg-background text-left text-xs w-full" 
                      {...field} 
                      value={field.value || ""} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name={`${prefix}.durationDays` as any}
            render={({ field }) => (
              <FormItem className="w-full min-w-0">
                <FormLabel className="text-xs text-muted-foreground">المدة (أيام - اختياري)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    max="7" 
                    placeholder="3" 
                    className="h-10 bg-background text-xs sm:text-sm w-full" 
                    value={field.value ?? ""} 
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* أوقات وفترات استقبال المعزين (مغلقة ومخفية بشكل افتراضي) */}
        <div className="p-3 bg-muted/20 rounded-lg border space-y-3 w-full box-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-foreground">إضافة أوقات للعزاء</span>
            </div>
            <Switch
              checked={Boolean(isScheduleEnabled)}
              onCheckedChange={(checked) => {
                form.setValue(`${prefix}.schedule.enabled` as any, checked, { shouldDirty: true });
              }}
            />
          </div>

          {isScheduleEnabled && (
            <div className="pt-2 border-t space-y-2.5 animate-in fade-in zoom-in-95">
              <Tabs defaultValue="evening" className="w-full">
                <TabsList className="grid grid-cols-3 w-full h-9 p-0.5 bg-muted">
                  <TabsTrigger value="morning" className="text-xs py-1">
                    صباحي
                  </TabsTrigger>
                  <TabsTrigger value="evening" className="text-xs py-1">
                    مسائي
                  </TabsTrigger>
                  <TabsTrigger value="friday" className="text-xs py-1">
                    الجمعة
                  </TabsTrigger>
                </TabsList>

                {/* تبويب صباحي: من [ خانة وقت ] إلى [ خانة وقت ] */}
                <TabsContent value="morning" className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">من</span>
                    <FormField
                      control={form.control}
                      name={`${prefix}.schedule.morningFrom` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-0">
                          <FormControl>
                            <Input 
                              type="time" 
                              className="h-9 bg-background text-xs sm:text-sm w-full" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">إلى</span>
                    <FormField
                      control={form.control}
                      name={`${prefix}.schedule.morningTo` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-0">
                          <FormControl>
                            <Input 
                              type="time" 
                              className="h-9 bg-background text-xs sm:text-sm w-full" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* تبويب مسائي: من [ خانة وقت ] إلى [ خانة وقت ] */}
                <TabsContent value="evening" className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">من</span>
                    <FormField
                      control={form.control}
                      name={`${prefix}.schedule.eveningFrom` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-0">
                          <FormControl>
                            <Input 
                              type="time" 
                              className="h-9 bg-background text-xs sm:text-sm w-full" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">إلى</span>
                    <FormField
                      control={form.control}
                      name={`${prefix}.schedule.eveningTo` as any}
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-0">
                          <FormControl>
                            <Input 
                              type="time" 
                              className="h-9 bg-background text-xs sm:text-sm w-full" 
                              {...field} 
                              value={field.value || ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* تبويب الجمعة: حقل نصي لإدخال قيم مثل (بعد صلاة العصر) */}
                <TabsContent value="friday" className="pt-2 space-y-2">
                  <FormField
                    control={form.control}
                    name={`${prefix}.schedule.fridayNote` as any}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input 
                            placeholder="مثال: بعد صلاة العصر" 
                            className="h-9 bg-background text-xs sm:text-sm w-full" 
                            {...field} 
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {/* «حتى» و«عزاء لـ» (مطوية) */}
        <VenueExtras audience={audience} />
      </CardContent>
    </Card>
  );
}

// ميزة استدعاء الأقارب التلقائي وهواتف التعزية
function SmartPhonesSection({ isPhoneOnly }: { isPhoneOnly: boolean }) {
  const form = useFormContext<ObituaryFormValues>();
  const phones = form.watch("condolences.phones") || [];
  const relativesGroups = form.watch("relatives") || [];
  const [newManualPhone, setNewManualPhone] = useState("");

  const aliveRelatives = useMemo(() => {
    const list: { name: string; relation: string; key: string }[] = [];
    relativesGroups.forEach((group) => {
      const relationName = group.relationType || "قريب";
      (group.persons || []).forEach((person) => {
        if (person.name && !person.isDeceased) {
          list.push({
            name: person.name,
            relation: relationName,
            key: `${relationName}_${person.name}`,
          });
        }
      });
    });
    return list;
  }, [relativesGroups]);

  const [relativePhoneMap, setRelativePhoneMap] = useState<Record<string, string>>({});

  const handleRelativePhoneChange = (key: string, name: string, relation: string, phone: string) => {
    const updatedMap = { ...relativePhoneMap, [key]: phone };
    setRelativePhoneMap(updatedMap);

    const activeRelativePhones = Object.entries(updatedMap)
      .filter(([_, num]) => num && num.trim().length > 0)
      .map(([k, num]) => {
        const item = aliveRelatives.find(r => r.key === k);
        return item ? `${item.name} (${item.relation}): ${num.trim()}` : num.trim();
      });

    const manualOnly = phones.filter(p => !aliveRelatives.some(r => p.startsWith(r.name)));
    form.setValue("condolences.phones", [...activeRelativePhones, ...manualOnly], { shouldDirty: true });
  };

  const handleAddManualPhone = () => {
    if (!newManualPhone.trim()) return;
    const current = form.getValues("condolences.phones") || [];
    form.setValue("condolences.phones", [...current, newManualPhone.trim()], { shouldDirty: true });
    setNewManualPhone("");
  };

  const handleRemovePhone = (index: number) => {
    const current = form.getValues("condolences.phones") || [];
    form.setValue("condolences.phones", current.filter((_, i) => i !== index), { shouldDirty: true });
  };

  return (
    <Card className="border bg-muted/10 p-3 sm:p-4 space-y-3.5 w-full box-border overflow-hidden">
      <div className="flex items-center justify-between border-b pb-2">
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            أرقام هواتف التعزية
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isPhoneOnly 
              ? "تم استدعاء الأقارب المسجلين لتسهيل إدخال أرقامهم. إدخال الرقم اختياري لكل قريب." 
              : "أدخل أرقام الهواتف المخصصة لاستقبال اتصالات ورسائل التعزية (اختياري)."}
          </p>
        </div>
      </div>

      {isPhoneOnly && aliveRelatives.length > 0 && (
        <div className="space-y-2 w-full box-border">
          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            أقارب الفقيد المسجلون (إدخال الرقم اختياري):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full box-border">
            {aliveRelatives.map((rel) => (
              <div key={rel.key} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-2 bg-background rounded-md border text-xs shadow-2xs w-full min-w-0 box-border">
                <div className="flex-1 truncate">
                  <span className="font-semibold text-foreground">{rel.name}</span>
                  <span className="text-muted-foreground text-[11px] mr-1">({rel.relation})</span>
                </div>
                <Input
                  placeholder="رقم الهاتف"
                  dir="ltr"
                  className="h-8 w-full sm:w-32 text-xs text-left bg-muted/20"
                  value={relativePhoneMap[rel.key] || ""}
                  onChange={(e) => handleRelativePhoneChange(rel.key, rel.name, rel.relation, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 pt-1 w-full box-border">
        {isPhoneOnly && aliveRelatives.length > 0 && (
          <div className="text-xs text-muted-foreground font-medium">أو أضف رقماً إضافياً مباشرة:</div>
        )}
        <div className="flex gap-1.5 w-full box-border">
          <Input
            placeholder="مثال: ناصر: 55123456 أو 66987654"
            dir="ltr"
            value={newManualPhone}
            onChange={(e) => setNewManualPhone(e.target.value)}
            className="h-9 bg-background text-xs sm:text-sm text-left flex-1 min-w-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddManualPhone();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 text-xs px-2.5"
            onClick={handleAddManualPhone}
            disabled={!newManualPhone.trim()}
          >
            <Plus className="w-3.5 h-3.5 ml-1" />
            إضافة
          </Button>
        </div>
      </div>

      {phones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 w-full box-border">
          {phones.map((phone, idx) => (
            <Badge key={idx} variant="outline" className="h-7 px-2 text-xs bg-background gap-1.5 font-normal">
              <span dir="ltr">{phone}</span>
              <button 
                type="button" 
                onClick={() => handleRemovePhone(idx)} 
                className="hover:text-destructive text-muted-foreground font-bold"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

// ==========================================
// دالة مساعدة لتحديد الكلمة المناسبة للتاريخ مقارنةً باليوم
// ==========================================
export function getRelativeDateLabel(dateString: string): string {
  if (!dateString) return "";
  const parts = dateString.split("-").map(Number);
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = selected.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const daysArabic = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayName = daysArabic[selected.getDay()];

  if (diffDays === 0) {
    return `اليوم (${dayName})`;
  } else if (diffDays === 1) {
    return `غداً (${dayName})`;
  } else if (diffDays === -1) {
    return `أمس (${dayName})`;
  } else {
    return `يوم ${dayName} (${dateString})`;
  }
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  if (!timeStr.includes(":")) return timeStr;
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? "مساءً" : "صباحاً";
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${period}`;
}

// ==========================================
// الخطوة 5: ابتداء العزاء والملاحظات (ContactsNotesStep)
// ==========================================
export function ContactsNotesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const startDate = form.watch("condolenceStartDate");
  const relativeDateText = getRelativeDateLabel(startDate || "");

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary/70 shrink-0" />
          ابتداء العزاء والملاحظات
        </h2>
      </div>

      {/* 2. ابتداء العزاء: خانة التاريخ الحقيقي (Date Picker) وخانة ملاحظة الوقت */}
      <div className="p-3.5 sm:p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3 w-full max-w-full box-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <FormLabel className="text-sm sm:text-base font-bold text-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            ابتداء العزاء من:
          </FormLabel>
          {relativeDateText && (
            <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 bg-primary/15 text-primary border-primary/20">
              {relativeDateText}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full box-border">
          {/* خانة التاريخ الحقيقي (Date Picker) */}
          <FormField
            control={form.control}
            name="condolenceStartDate"
            render={({ field }) => (
              <FormItem className="w-full min-w-0">
                <FormLabel className="text-xs font-semibold text-foreground">تاريخ ابتداء العزاء</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    className="h-10 bg-background text-xs sm:text-sm font-medium w-full" 
                    value={field.value || ""} 
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* خانة ملاحظة الوقت (مثل: بعد صلاة العصر) */}
          <FormField
            control={form.control}
            name="condolenceStartTime"
            render={({ field }) => (
              <FormItem className="w-full min-w-0">
                <FormLabel className="text-xs font-semibold text-foreground">ملاحظة الوقت</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="مثال: بعد صلاة العصر" 
                    className="h-10 bg-background text-xs sm:text-sm font-medium w-full" 
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="w-full max-w-full box-border">
            <FormLabel className="text-xs sm:text-sm font-semibold">ملاحظات وتنويهات إضافية (اختياري)</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="مثال: يقتصر العزاء على المقبرة تنفيذاً لوصية المتوفى، وإنا لله وإنا إليه راجعون..." 
                className="min-h-[120px] resize-none bg-background text-xs sm:text-sm leading-relaxed w-full box-border" 
                {...field} 
                value={field.value || ""} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ==========================================
// الخطوة 6: المراجعة النهائية (ReviewStep)
// ==========================================
export function ReviewStep() {
  const form = useFormContext<ObituaryFormValues>();
  const data = form.getValues();

  const deceased = data.deceasedList || [];
  const relatives = data.relatives || [];
  const burial = data.burial;
  const prayer = data.prayer;
  const condolences = data.condolences;
  const startDate = data.condolenceStartDate;

  return (
    <div className="space-y-5 animate-in fade-in duration-300 w-full max-w-full box-border overflow-hidden">
      <div className="text-center pb-3 border-b">
        <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mb-1.5">
          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">مراجعة بيانات إعلان الوفاة</h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">تأكد من صحة وشمولية البيانات قبل الاعتماد والإرسال النهائي.</p>
      </div>

      <AnnouncementPreview />

      <div className="space-y-3.5 text-xs sm:text-sm w-full box-border">
        {/* المتوفون */}
        <Card className="border p-3 sm:p-4 bg-card space-y-2 w-full box-border">
          <h3 className="font-bold text-primary flex items-center gap-1.5 border-b pb-1.5">
            <User className="w-4 h-4 shrink-0" />
            المتوفون ({deceased.length})
          </h3>
          <div className="space-y-2 pt-1">
            {deceased.map((d, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="font-normal">{d.gender}</Badge>
                  {d.title && d.title !== "none" && <Badge variant="secondary">{d.title}</Badge>}
                  <span className="font-semibold">{d.fullName || "متوفاة (بدون ذكر اسم)"}</span>
                  {d.age && <span className="text-muted-foreground text-xs">({d.age} سنة)</span>}
                  {d.nationality && <span className="text-xs text-muted-foreground">• الجنسية: {d.nationality}</span>}
                  {d.deathLocation && <span className="text-xs text-muted-foreground">• توفي في {d.deathLocation}</span>}
                </div>
                {d.femaleRelations && d.femaleRelations.length > 0 && (
                  <div className="text-xs text-muted-foreground pr-2">
                    {d.femaleRelations.map((fr, idx) => (
                      <span key={idx} className="ml-2">
                        {fr.relationType}: <span className="font-medium text-foreground">{fr.relatedName}</span> {fr.isHusbandDeceased ? "(رحمه الله)" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* الأقارب */}
        {relatives.length > 0 && (
          <Card className="border p-3 sm:p-4 bg-card space-y-2 w-full box-border">
            <h3 className="font-bold text-primary flex items-center gap-1.5 border-b pb-1.5">
              <Users className="w-4 h-4 shrink-0" />
              الأقارب
            </h3>
            <div className="space-y-1.5 pt-1">
              {relatives.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className="font-bold text-foreground">{r.relationType}: </span>
                  <span className="text-muted-foreground">
                    {r.persons?.map(p => `${p.name}${p.isDeceased ? " (رحمه الله)" : ""}${p.workplace ? ` - ${p.workplace}` : ""}`).join("، ")}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* الصلاة والدفن */}
        <Card className="border p-3 sm:p-4 bg-card space-y-2 w-full box-border">
          <h3 className="font-bold text-primary flex items-center gap-1.5 border-b pb-1.5">
            <Calendar className="w-4 h-4 shrink-0" />
            الصلاة والدفن
          </h3>
          {burial?.status === "done" ? (
            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="default" className="bg-primary text-primary-foreground font-semibold">
                  تم الدفن
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">ملاحظات الدفن:</span>{" "}
                <span className="font-medium text-foreground">{burial?.notes || "تمت إجراءات الدفن مسبقاً"}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground">الحالة:</span>{" "}
                <span className="font-medium text-foreground">سيتم الدفن</span>
              </div>
              <div>
                <span className="text-muted-foreground">المقبرة:</span>{" "}
                <span className="font-medium text-foreground">{burial?.locationName || "غير محدد"}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">الموعد:</span>{" "}
                <span className="font-medium text-foreground">
                  {[burial?.dateDescription, burial?.timeDescription].filter(Boolean).join(" - ") || "غير محدد"}
                </span>
              </div>
              {prayer?.enabled && prayer?.locationName && prayer.locationName.trim() && (
                <div className="sm:col-span-2 border-t pt-1.5 mt-1 space-y-0.5">
                  <span className="text-muted-foreground font-semibold">جامع صلاة الجنازة (منفصل):</span>{" "}
                  <span className="font-semibold text-foreground">{prayer.locationName.trim()}</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* العزاء */}
        <Card className="border p-3 sm:p-4 bg-card space-y-2.5 w-full box-border">
          <h3 className="font-bold text-primary flex items-center gap-1.5 border-b pb-1.5">
            <Heart className="w-4 h-4 shrink-0" />
            العزاء ومقر الاستقبال
          </h3>
          <div className="text-xs space-y-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">نوع العزاء:</span>{" "}
              <Badge variant="outline" className="font-medium">
                {condolences?.type === "full" ? "رجال ونساء" :
                 condolences?.type === "men_only" ? "رجال فقط" :
                 condolences?.type === "women_only" ? "نساء فقط" :
                 condolences?.type === "phone_only" ? "هاتف فقط" : "يقتصر على المقبرة"}
              </Badge>
            </div>

            {condolences?.type === "none" && (
              <p className="text-muted-foreground text-xs">يقتصر العزاء على المقبرة تنفيذاً للوصية أو الظروف.</p>
            )}

            {(startDate || data.condolenceStartTime) && (
              <div>
                <span className="text-muted-foreground">ابتداء العزاء:</span>{" "}
                <span className="font-semibold text-primary">
                  {[getRelativeDateLabel(startDate || ""), data.condolenceStartTime].filter(Boolean).join(" - ")}
                </span>
              </div>
            )}

            {/* عزاء الرجال */}
            {(condolences?.type === "full" || condolences?.type === "men_only") && (
              <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                <div className="font-bold text-primary text-xs flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  مقر عزاء الرجال
                </div>
                {(() => {
                  const card = condolences?.men;
                  const venue = card?.locationName?.trim() || "";
                  const duration = card?.durationDays ? `${card.durationDays} أيام` : "";
                  const mapsLink = card?.mapsLink?.trim() || "";
                  const schedule = card?.schedule;
                  const hasSchedule = schedule?.enabled;
                  
                  const morningTime = (schedule?.morningFrom || schedule?.morningTo)
                    ? `من ${formatTime12h(schedule?.morningFrom || "")} إلى ${formatTime12h(schedule?.morningTo || "")}`
                    : "";
                  const eveningTime = (schedule?.eveningFrom || schedule?.eveningTo)
                    ? `من ${formatTime12h(schedule?.eveningFrom || "")} إلى ${formatTime12h(schedule?.eveningTo || "")}`
                    : "";
                  const fridayTime = schedule?.fridayNote?.trim() || "";

                  if (!venue && !duration && !hasSchedule && !mapsLink) {
                    return <p className="text-muted-foreground text-[11px]">لم يتم إدخال تفاصيل إضافية للمقر</p>;
                  }

                  return (
                    <div className="space-y-1 text-xs">
                      {venue && (
                        <div><span className="text-muted-foreground">المقر:</span> <span className="font-semibold text-foreground">{venue}</span></div>
                      )}
                      {duration && (
                        <div><span className="text-muted-foreground">المدة:</span> <span className="font-medium text-foreground">{duration}</span></div>
                      )}
                      {hasSchedule && (morningTime || eveningTime || fridayTime) && (
                        <div className="space-y-0.5 border-t pt-1.5 mt-1 text-[11px]">
                          <span className="font-bold text-foreground">أوقات استقبال المعزين:</span>
                          {morningTime && <div>• الفترة الصباحية: <span className="font-medium text-foreground">{morningTime}</span></div>}
                          {eveningTime && <div>• الفترة المسائية: <span className="font-medium text-foreground">{eveningTime}</span></div>}
                          {fridayTime && <div>• يوم الجمعة: <span className="font-medium text-foreground">{fridayTime}</span></div>}
                        </div>
                      )}
                      {mapsLink && (
                        <div>
                          <span className="text-muted-foreground">الموقع:</span>{" "}
                          <a href={mapsLink} target="_blank" rel="noreferrer" className="text-primary underline text-[11px] inline-flex items-center gap-1 font-mono">
                            <LinkIcon className="w-3 h-3" /> رابط الخريطة
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* عزاء النساء */}
            {(condolences?.type === "full" || condolences?.type === "women_only") && (
              <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                <div className="font-bold text-primary text-xs flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  مقر عزاء النساء
                </div>
                {(() => {
                  const card = condolences?.women;
                  const venue = card?.locationName?.trim() || "";
                  const duration = card?.durationDays ? `${card.durationDays} أيام` : "";
                  const mapsLink = card?.mapsLink?.trim() || "";
                  const schedule = card?.schedule;
                  const hasSchedule = schedule?.enabled;
                  
                  const morningTime = (schedule?.morningFrom || schedule?.morningTo)
                    ? `من ${formatTime12h(schedule?.morningFrom || "")} إلى ${formatTime12h(schedule?.morningTo || "")}`
                    : "";
                  const eveningTime = (schedule?.eveningFrom || schedule?.eveningTo)
                    ? `من ${formatTime12h(schedule?.eveningFrom || "")} إلى ${formatTime12h(schedule?.eveningTo || "")}`
                    : "";
                  const fridayTime = schedule?.fridayNote?.trim() || "";

                  if (!venue && !duration && !hasSchedule && !mapsLink) {
                    return <p className="text-muted-foreground text-[11px]">لم يتم إدخال تفاصيل إضافية للمقر</p>;
                  }

                  return (
                    <div className="space-y-1 text-xs">
                      {venue && (
                        <div><span className="text-muted-foreground">المقر:</span> <span className="font-semibold text-foreground">{venue}</span></div>
                      )}
                      {duration && (
                        <div><span className="text-muted-foreground">المدة:</span> <span className="font-medium text-foreground">{duration}</span></div>
                      )}
                      {hasSchedule && (morningTime || eveningTime || fridayTime) && (
                        <div className="space-y-0.5 border-t pt-1.5 mt-1 text-[11px]">
                          <span className="font-bold text-foreground">أوقات استقبال المعزين:</span>
                          {morningTime && <div>• الفترة الصباحية: <span className="font-medium text-foreground">{morningTime}</span></div>}
                          {eveningTime && <div>• الفترة المسائية: <span className="font-medium text-foreground">{eveningTime}</span></div>}
                          {fridayTime && <div>• يوم الجمعة: <span className="font-medium text-foreground">{fridayTime}</span></div>}
                        </div>
                      )}
                      {mapsLink && (
                        <div>
                          <span className="text-muted-foreground">الموقع:</span>{" "}
                          <a href={mapsLink} target="_blank" rel="noreferrer" className="text-primary underline text-[11px] inline-flex items-center gap-1 font-mono">
                            <LinkIcon className="w-3 h-3" /> رابط الخريطة
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* هواتف التعزية (تظهر فقط عند هاتف فقط) */}
            {condolences?.type === "phone_only" && condolences?.phones && condolences.phones.length > 0 && (
              <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                <span className="text-muted-foreground font-semibold">هواتف التعزية:</span>{" "}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {condolences.phones.map((phone, idx) => (
                    <Badge key={idx} variant="outline" className="font-mono text-xs" dir="ltr">
                      {phone}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
