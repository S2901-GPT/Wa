import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { ObituaryFormValues } from "@/lib/schema";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, User, Users, Calendar, Heart, FileText, CheckCircle2 } from "lucide-react";

export function DeceasedStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "deceasedPeople"
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <User className="w-6 h-6 text-primary/70" />
          بيانات المتوفين
        </h2>
        <p className="text-muted-foreground mt-1">يرجى إدخال بيانات المتوفى بدقة وعناية.</p>
      </div>

      <div className="space-y-8">
        {fields.map((field, index) => (
          <Card key={field.id} className="relative overflow-hidden border-border bg-background shadow-sm">
            {fields.length > 1 && (
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                className="absolute top-2 left-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                onClick={() => remove(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <CardContent className="pt-8">
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name={`deceasedPeople.${index}.fullName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">الاسم الثلاثي أو الرباعي <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: محمد علي جاسم" className="h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name={`deceasedPeople.${index}.gender`}
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base">الجنس <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-2">
                            {[
                              { label: 'رجل', value: 'man' },
                              { label: 'امرأة', value: 'woman' },
                              { label: 'طفل', value: 'boy' },
                              { label: 'طفلة', value: 'girl' },
                            ].map(opt => (
                              <FormItem key={opt.value} className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-3 py-2 bg-background flex-1 min-w-[80px]">
                                <FormControl>
                                  <RadioGroupItem value={opt.value} />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer w-full text-center text-sm">{opt.label}</FormLabel>
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
                    name={`deceasedPeople.${index}.age`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">العمر (اختياري)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="150" placeholder="مثال: 65" className="h-12" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name={`deceasedPeople.${index}.nationality`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">الجنسية (اختياري)</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: قطري" className="h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`deceasedPeople.${index}.deathPlace`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">مكان الوفاة (اختياري)</FormLabel>
                        <FormControl>
                          <Input placeholder="الدوحة، لندن..." className="h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`deceasedPeople.${index}.occupation`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">المهنة / اللقب (اختياري)</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: سفير سابق، أستاذ..." className="h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`deceasedPeople.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">اللقب الشرفي (اختياري)</FormLabel>
                        <FormControl>
                          <Input placeholder="الشيخ، الدكتور،الوجيه، الوالد..." className="h-12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-2 h-14 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          onClick={() => append({ fullName: "", gender: "man", age: null, nationality: "", deathPlace: "", title: "", occupation: "", note: "" })}
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة متوفى آخر
        </Button>
      </div>
    </div>
  );
}

const RELATION_OPTIONS = [
  "والد", "والدة", "ابن", "ابنة", "أخ", "أخت", "شقيق", "شقيقة", 
  "عم", "عمة", "خال", "خالة", "جد", "جدة", "زوج", "زوجة/حرم", 
  "أرمل", "أرملة", "أخرى"
];

export function RelativesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "relatives"
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Users className="w-6 h-6 text-primary/70" />
          بيانات الأقارب
        </h2>
        <p className="text-muted-foreground mt-1">أضف مجموعات الأقارب (مثل: أبناؤه، إخوانه، أعمامه).</p>
      </div>

      <div className="space-y-8">
        {fields.map((field, index) => (
          <Card key={field.id} className="relative overflow-hidden border-border bg-background shadow-sm">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              className="absolute top-2 left-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
              onClick={() => remove(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <CardContent className="pt-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-4">
                  <FormField
                    control={form.control}
                    name={`relatives.${index}.relationType`}
                    render={({ field: relationField }) => (
                      <FormItem>
                        <FormLabel>صلة القرابة</FormLabel>
                        <Select onValueChange={relationField.onChange} defaultValue={relationField.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="اختر صلة القرابة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RELATION_OPTIONS.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch(`relatives.${index}.relationType`) === "أخرى" && (
                    <FormField
                      control={form.control}
                      name={`relatives.${index}.relationOther`}
                      render={({ field: otherField }) => (
                        <FormItem className="animate-in fade-in zoom-in-95">
                          <FormLabel>صلة القرابة (أخرى)</FormLabel>
                          <FormControl>
                            <Input placeholder="مثال: أبناء عمومته" className="bg-background" {...otherField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name={`relatives.${index}.familyReference`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>مرجع العائلة (اختياري)</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: المرحوم فلان" className="bg-background text-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="md:col-span-3 border-r pr-6 border-border/50">
                  <RelativePeopleArray relativeIndex={index} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-2 h-14 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          onClick={() => append({ relationType: "", relationOther: "", familyReference: "", people: [{ name: "", occupation: "", deceased: false }] })}
        >
          <Plus className="w-5 h-5 ml-2" />
          إضافة مجموعة قرابة جديدة
        </Button>
      </div>
    </div>
  );
}

function RelativePeopleArray({ relativeIndex }: { relativeIndex: number }) {
  const form = useFormContext<ObituaryFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `relatives.${relativeIndex}.people`
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
                  <FormControl>
                    <Input placeholder="الاسم" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`relatives.${relativeIndex}.people.${personIndex}.occupation`}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="الجهة / الصفة" {...field} value={field.value || ""} />
                  </FormControl>
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
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm whitespace-nowrap !mt-0">
                      متوفى
                    </FormLabel>
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

const BURIAL_DAYS = ["اليوم", "غداً", "السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "أخرى"];
const BURIAL_TIMES = ["بعد صلاة الفجر", "بعد صلاة الظهر", "بعد صلاة العصر", "بعد صلاة المغرب", "بعد صلاة العشاء", "بعد صلاة الجمعة", "وقت محدد", "أخرى"];
const CEMETERIES = ["مقبرة مسيمير", "مقبرة الخور", "مقبرة الوكرة الجنوبية", "مقبرة أم صلال علي", "مقبرة الرويس", "مقبرة الريان", "مقبرة الدحيل", "مقبرة الذخيرة", "مقبرة الخريطيات", "مقبرة عين خالد", "مقبرة الوكير", "مقبرة أم قرن", "مقبرة الوسيل", "مقبرة المزروعة", "أخرى"];

export function BurialPrayerStep() {
  const form = useFormContext<ObituaryFormValues>();
  const isOutsideQatar = form.watch("burial.outsideQatar");
  const isPrayerEnabled = form.watch("prayer.enabled");

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* BURIAL SECTION */}
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
                <FormLabel className="text-base font-bold text-primary">حالة الدفن <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                    <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-4 py-3 flex-1 bg-background">
                      <FormControl><RadioGroupItem value="upcoming" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer w-full text-center text-base">سيتم الدفن</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-x-reverse space-y-0 border border-input rounded-md px-4 py-3 flex-1 bg-background">
                      <FormControl><RadioGroupItem value="completed" /></FormControl>
                      <FormLabel className="font-normal cursor-pointer w-full text-center text-base">تم الدفن</FormLabel>
                    </FormItem>
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
                  <RadioGroup onValueChange={(v) => field.onChange(v === 'true')} defaultValue={field.value ? 'true' : 'false'} className="flex gap-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/10 rounded-lg border border-border/50">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="burial.dayType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">يوم الدفن <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger className="h-12 bg-background"><SelectValue placeholder="اختر اليوم" /></SelectTrigger></FormControl>
                    <SelectContent>{BURIAL_DAYS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("burial.dayType") === "أخرى" && (
              <FormField
                control={form.control}
                name="burial.dayOther"
                render={({ field }) => (
                  <FormItem className="animate-in fade-in zoom-in-95">
                    <FormControl><Input placeholder="حدد اليوم" className="h-12 bg-background" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="burial.timeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">وقت الدفن <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger className="h-12 bg-background"><SelectValue placeholder="اختر الوقت" /></SelectTrigger></FormControl>
                    <SelectContent>{BURIAL_TIMES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {["وقت محدد", "أخرى"].includes(form.watch("burial.timeType") || "") && (
              <FormField
                control={form.control}
                name="burial.timeOther"
                render={({ field }) => (
                  <FormItem className="animate-in fade-in zoom-in-95">
                    <FormControl><Input placeholder="مثال: الساعة 9 صباحاً" className="h-12 bg-background" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isOutsideQatar ? (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="burial.cemeteryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">المقبرة <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger className="h-12 bg-background"><SelectValue placeholder="اختر المقبرة" /></SelectTrigger></FormControl>
                      <SelectContent>{CEMETERIES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("burial.cemeteryType") === "أخرى" && (
                <FormField
                  control={form.control}
                  name="burial.cemeteryOther"
                  render={({ field }) => (
                    <FormItem className="animate-in fade-in zoom-in-95">
                      <FormControl><Input placeholder="اسم المقبرة" className="h-12 bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          ) : (
            <FormField
              control={form.control}
              name="burial.outsideLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">مكان الدفن <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="الدولة، المدينة، المقبرة..." className="h-12 bg-background" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="burial.mapLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">رابط خرائط جوجل (اختياري)</FormLabel>
                <FormControl><Input type="url" placeholder="https://maps.google.com/..." className="h-12 bg-background text-left" dir="ltr" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </section>

      {/* PRAYER SECTION */}
      <section className="space-y-6 pt-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              صلاة الجنازة
            </h2>
            <p className="text-muted-foreground mt-1">تفاصيل صلاة الجنازة إذا كانت في مكان/وقت منفصل.</p>
          </div>
          <FormField
            control={form.control}
            name="prayer.enabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 m-0 p-0 border-none bg-transparent">
                <FormLabel className="m-0 font-medium text-base">تفعيل قسم الصلاة</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="scale-110" /></FormControl>
              </FormItem>
            )}
          />
        </div>

        {isPrayerEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/5 rounded-lg border border-primary/20 animate-in fade-in zoom-in-95">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="prayer.dayType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>يوم الصلاة <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="اختر اليوم" /></SelectTrigger></FormControl>
                      <SelectContent>{BURIAL_DAYS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("prayer.dayType") === "أخرى" && (
                <FormField
                  control={form.control}
                  name="prayer.dayOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input placeholder="حدد اليوم" className="bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="prayer.timeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>وقت الصلاة <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="اختر الوقت" /></SelectTrigger></FormControl>
                      <SelectContent>{BURIAL_TIMES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {["وقت محدد", "أخرى"].includes(form.watch("prayer.timeType") || "") && (
                <FormField
                  control={form.control}
                  name="prayer.timeOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl><Input placeholder="مثال: الساعة 9 صباحاً" className="bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="prayer.place"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>مكان الصلاة (مسجد...)</FormLabel>
                  <FormControl><Input placeholder="جامع..." className="bg-background" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prayer.mapLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رابط خرائط جوجل للمسجد</FormLabel>
                  <FormControl><Input type="url" placeholder="https://maps.google.com/..." className="bg-background text-left" dir="ltr" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </section>
    </div>
  );
}

const emptyCondolenceCard = (audience: "men" | "women") => ({
  audience, location: "", mapLink: "", startType: "", startOther: "", expanded: false,
  durationDays: null, time: "", houseNumber: "", buildingNumber: "", street: "",
  area: "", floor: "", apartmentNumber: "", locationNotes: "",
});

function LegacyCondolenceCardForm({ prefix, title }: { prefix: "condolences.menCard" | "condolences.womenCard", title: string }) {
  const form = useFormContext<ObituaryFormValues>();
  
  return (
    <Card className="border border-border shadow-sm">
      <div className="bg-muted/50 px-6 py-4 border-b border-border/50">
        <h3 className="font-bold text-lg text-primary">{title}</h3>
      </div>
      <CardContent className="pt-6 grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name={`${prefix}.startType`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>بداية العزاء</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="اختر بداية العزاء" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="اليوم">اليوم</SelectItem>
                      <SelectItem value="غداً">غداً</SelectItem>
                      <SelectItem value="أخرى">يوم محدد / أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch(`${prefix}.startType`) === "أخرى" && (
              <FormField
                control={form.control}
                name={`${prefix}.startOther`}
                render={({ field }) => (
                  <FormItem className="animate-in fade-in">
                    <FormControl><Input placeholder="حدد اليوم أو التاريخ" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
          <FormField
            control={form.control}
            name={`${prefix}.durationDays`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>مدة العزاء (بالأيام)</FormLabel>
                <FormControl><Input type="number" min="1" max="7" placeholder="3" {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name={`${prefix}.time`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>أوقات العزاء</FormLabel>
              <FormControl><Input placeholder="مثال: من العصر إلى العشاء" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 p-4 border rounded-md bg-muted/10">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2 mb-4">تفاصيل الموقع</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`${prefix}.location`}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>اسم الموقع / الوصف</FormLabel>
                  <FormControl><Input placeholder="مثال: خيمة في منطقة الدفنة" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name={`${prefix}.area`} render={({ field }) => (
              <FormItem><FormLabel>المنطقة</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.street`} render={({ field }) => (
              <FormItem><FormLabel>الشارع</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.buildingNumber`} render={({ field }) => (
              <FormItem><FormLabel>رقم المبنى/المنزل</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.mapLink`} render={({ field }) => (
              <FormItem>
                <FormLabel>رابط خرائط جوجل</FormLabel>
                <FormControl><Input type="url" placeholder="https://maps.google.com/..." className="text-left" dir="ltr" {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.locationNotes`} render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>ملاحظات إضافية للموقع (اختياري)</FormLabel>
                <FormControl><Textarea className="resize-none" rows={2} {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SimpleCondolenceCardForm({ prefix, title }: { prefix: "condolences.menCard" | "condolences.womenCard", title: string }) {
  const form = useFormContext<ObituaryFormValues>();
  const expanded = form.watch(`${prefix}.expanded`);
  return (
    <Card className="border border-border shadow-sm">
      <div className="bg-muted/50 px-4 py-3 border-b border-border/50"><h3 className="font-bold text-base text-primary">{title}</h3></div>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name={`${prefix}.startType`} render={({ field }) => (
            <FormItem>
              <FormLabel>بداية العزاء</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="اختر البداية" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="اليوم">اليوم</SelectItem>
                  <SelectItem value="غداً">غداً</SelectItem>
                  <SelectItem value="أخرى">يوم محدد</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          {form.watch(`${prefix}.startType`) === "أخرى" && (
            <FormField control={form.control} name={`${prefix}.startOther`} render={({ field }) => (
              <FormItem><FormLabel>حدد اليوم</FormLabel><FormControl><Input placeholder="مثال: الأحد 12 مايو" {...field} /></FormControl></FormItem>
            )} />
          )}
        </div>
        <FormField control={form.control} name={`${prefix}.location`} render={({ field }) => (
          <FormItem><FormLabel>المكان / الوصف</FormLabel><FormControl><Textarea rows={2} placeholder="مجلس فلان في معيذر، منزل الفقيد في الوكرة، خلف المسجد..." {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name={`${prefix}.mapLink`} render={({ field }) => (
          <FormItem><FormLabel>رابط الموقع <span className="font-normal text-muted-foreground">(اختياري)</span></FormLabel><FormControl><Input type="url" placeholder="https://maps.google.com/..." className="text-left" dir="ltr" {...field} /></FormControl></FormItem>
        )} />
        <Button type="button" variant="ghost" className="justify-start w-fit px-0 text-primary hover:bg-transparent" onClick={() => form.setValue(`${prefix}.expanded`, !expanded, { shouldDirty: true })}>
          {expanded ? "إخفاء التفاصيل" : "إضافة تفاصيل"} <span className="text-xs text-muted-foreground mr-2">وقت، مدة، وعنوان دقيق</span>
        </Button>
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border bg-muted/10 p-3 animate-in fade-in">
            <FormField control={form.control} name={`${prefix}.time`} render={({ field }) => (
              <FormItem><FormLabel>وقت العزاء</FormLabel><FormControl><Input placeholder="بعد صلاة العصر أو من 4 إلى 9 مساءً" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.durationDays`} render={({ field }) => (
              <FormItem><FormLabel>مدة العزاء</FormLabel><FormControl><Input type="number" min="1" max="7" placeholder="بالأيام" {...field} value={field.value || ""} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`${prefix}.houseNumber`} render={({ field }) => (<FormItem><FormLabel>رقم المنزل</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.street`} render={({ field }) => (<FormItem><FormLabel>الشارع</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.area`} render={({ field }) => (<FormItem><FormLabel>المنطقة</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.buildingNumber`} render={({ field }) => (<FormItem><FormLabel>المبنى / العمارة</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.floor`} render={({ field }) => (<FormItem><FormLabel>الطابق</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.apartmentNumber`} render={({ field }) => (<FormItem><FormLabel>الشقة</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
            <FormField control={form.control} name={`${prefix}.locationNotes`} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>ملاحظات إضافية</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CondolencesStep() {
  const form = useFormContext<ObituaryFormValues>();
  const options = form.watch("condolences");
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "condolences.phoneContacts" });
  const setOption = (name: "none" | "phone" | "men" | "women", checked: boolean) => {
    form.setValue(`condolences.${name}`, checked, { shouldDirty: true });
    if (name === "none" && checked) {
      form.setValue("condolences.phone", false);
      form.setValue("condolences.men", false);
      form.setValue("condolences.women", false);
    } else if (checked) {
      form.setValue("condolences.none", false);
    }
  };
  const copyMenToWomen = () => {
    const men = form.getValues("condolences.menCard");
    if (men) form.setValue("condolences.womenCard", { ...men, audience: "women" }, { shouldDirty: true });
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {([
          ["phone", "تعزية عبر الهاتف"],
          ["none", "لا يوجد عزاء"],
          ["men", "عزاء الرجال"],
          ["women", "عزاء النساء"],
        ] as const).map(([name, label]) => (
          <FormField key={name} control={form.control} name={`condolences.${name}`} render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border bg-background px-3 py-3">
              <FormLabel className="cursor-pointer font-medium">{label}</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={(checked) => setOption(name, checked)} /></FormControl>
            </FormItem>
          )} />
        ))}
      </div>
      {options.phone && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="font-bold text-primary">أرقام التعزية (اختياري)</h3>
              <p className="text-xs text-muted-foreground mt-1">أضف اسمًا أو رقمًا فقط إذا رغبت. كلاهما اختياري.</p>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormField control={form.control} name={`condolences.phoneContacts.${index}.name`} render={({ field }) => (
                  <FormItem className="flex-1"><FormControl><Input placeholder="اسم الشخص (اختياري)" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`condolences.phoneContacts.${index}.phone`} render={({ field }) => (
                  <FormItem className="flex-1"><FormControl><Input placeholder="رقم الهاتف (اختياري)" dir="ltr" {...field} /></FormControl></FormItem>
                )} />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="حذف"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", phone: "" })}>
              <Plus className="w-4 h-4 ml-2" /> إضافة رقم
            </Button>
          </CardContent>
        </Card>
      )}
      {options.men && <SimpleCondolenceCardForm prefix="condolences.menCard" title="عزاء الرجال" />}
      {options.women && (
        <div className="space-y-2">
          {options.men && <Button type="button" variant="ghost" size="sm" className="text-primary px-0" onClick={copyMenToWomen}>نفس بيانات عزاء الرجال</Button>}
          <SimpleCondolenceCardForm prefix="condolences.womenCard" title="عزاء النساء" />
        </div>
      )}
    </div>
  );
}

export function ContactsNotesStep() {
  const form = useFormContext<ObituaryFormValues>();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <div className="mb-6 border-b pb-4">
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
                <Textarea placeholder="مثال: يقتصر العزاء على الدفن..." className="min-h-[120px] resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}

export function ReviewStep() {
  const form = useFormContext<ObituaryFormValues>();
  const data = form.getValues();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="text-center mb-10">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">مراجعة البيانات</h2>
        <p className="text-muted-foreground mt-2">يرجى التأكد من صحة البيانات قبل الاعتماد والإرسال.</p>
      </div>

      <div className="bg-muted/10 border border-border/50 rounded-lg p-6 space-y-8">
        
        <section>
          <h3 className="font-bold text-lg text-primary border-b pb-2 mb-4">بيانات المتوفين</h3>
          <ul className="list-disc list-inside space-y-2 pr-4 text-sm">
            {data.deceasedPeople.map((d, i) => (
              <li key={i}>
                <span className="font-medium">{d.fullName}</span> 
                <span className="text-muted-foreground"> ({d.gender === 'man' ? 'رجل' : d.gender === 'woman' ? 'امرأة' : d.gender === 'boy' ? 'طفل' : d.gender === 'girl' ? 'طفلة' : 'أخرى'})</span>
              </li>
            ))}
          </ul>
        </section>

        {data.relatives.length > 0 && (
          <section>
            <h3 className="font-bold text-lg text-primary border-b pb-2 mb-4">الأقارب</h3>
            <div className="space-y-4">
              {data.relatives.map((r, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-muted-foreground">{r.relationType === "أخرى" ? r.relationOther : r.relationType}:</span>{" "}
                  {r.people.map(p => `${p.name}${p.occupation ? ` (${p.occupation})` : ""}${p.deceased ? " (متوفى)" : ""}`).join("، ")}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="font-bold text-lg text-primary border-b pb-2 mb-4">الدفن والصلاة</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">حالة الدفن:</span> {data.burial.status === "completed" ? "تم الدفن" : "سيتم الدفن"}</div>
            <div><span className="text-muted-foreground">يوم الدفن:</span> {data.burial.dayType === "أخرى" ? data.burial.dayOther : data.burial.dayType}</div>
            <div><span className="text-muted-foreground">وقت الدفن:</span> {["وقت محدد", "أخرى"].includes(data.burial.timeType || "") ? data.burial.timeOther : data.burial.timeType}</div>
            {!data.burial.outsideQatar ? (
              <div><span className="text-muted-foreground">المقبرة:</span> {data.burial.cemeteryType === "أخرى" ? data.burial.cemeteryOther : data.burial.cemeteryType}</div>
            ) : (
              <div><span className="text-muted-foreground">خارج قطر:</span> {data.burial.outsideLocation}</div>
            )}
          </div>
          {data.prayer.enabled && (
            <div className="mt-4 p-3 bg-muted/20 rounded text-sm">
              <span className="font-medium">يوجد صلاة منفصلة:</span> {data.prayer.dayType === "أخرى" ? data.prayer.dayOther : data.prayer.dayType} - {["وقت محدد", "أخرى"].includes(data.prayer.timeType || "") ? data.prayer.timeOther : data.prayer.timeType} في {data.prayer.place}
            </div>
          )}
        </section>

        <section>
          <h3 className="font-bold text-lg text-primary border-b pb-2 mb-4">العزاء</h3>
          {data.condolences.none || (!data.condolences.phone && !data.condolences.men && !data.condolences.women) ? (
            <p className="text-sm text-muted-foreground">لا يوجد عزاء</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>{[
                data.condolences.phone && "تعزية عبر الهاتف",
                data.condolences.men && "عزاء الرجال",
                data.condolences.women && "عزاء النساء",
              ].filter(Boolean).join("، ")}</p>
              {data.condolences.phone && data.condolences.phoneContacts.length > 0 && (
                <div className="rounded bg-muted/20 p-3">
                  {data.condolences.phoneContacts.filter(c => c.name || c.phone).map((c, i) => (
                    <div key={i}>{c.name && <span>{c.name}</span>}{c.name && c.phone && " — "}{c.phone && <span dir="ltr">{c.phone}</span>}</div>
                  ))}
                </div>
              )}
              {[
                data.condolences.men && ["الرجال", data.condolences.menCard],
                data.condolences.women && ["النساء", data.condolences.womenCard],
              ].filter(Boolean).map((item, i) => {
                const [label, card] = item as [string, NonNullable<ObituaryFormValues["condolences"]["menCard"]> | undefined];
                if (!card) return null;
                const start = card.startType === "أخرى" ? card.startOther : card.startType;
                return <div key={i} className="rounded border p-3"><strong>عزاء {label}</strong><div className="mt-1">{start && `البداية: ${start}`}{card.location && ` — ${card.location}`}{card.mapLink && <span className="block" dir="ltr">{card.mapLink}</span>}</div></div>;
              })}
            </div>
          )}
        </section>
        
      </div>
    </div>
  );
}
