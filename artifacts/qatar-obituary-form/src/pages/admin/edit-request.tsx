import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useLocation, Link } from "wouter";
import { useRequest, useRequestKeys, useUpdateRequest } from "@/lib/requests-api";
import { ObituaryFormSchema, emptyFormValues, type ObituaryFormValues } from "@/lib/schema";
import { mapPayloadToForm, mapFormToPayload } from "@/lib/mapper";
import { useQueryClient } from "@tanstack/react-query";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, ChevronRight, ChevronLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { 
  DeceasedStep, 
  RelativesStep, 
  BurialPrayerStep, 
  CondolencesStep, 
  ContactsNotesStep
} from "@/components/form-steps";
import { ExtrasOpenContext } from "@/components/form-steps-extras";

const STEPS = [
  { id: 1, title: 'المتوفون' },
  { id: 2, title: 'الأقارب' },
  { id: 3, title: 'الدفن والصلاة' },
  { id: 4, title: 'العزاء' },
  { id: 5, title: 'الملاحظات' }
];

export default function AdminEditRequestPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ requestNumber: string }>();
  const requestNumber = params?.requestNumber;
  const queryClient = useQueryClient();
  const keys = useRequestKeys();
  const [currentStep, setCurrentStep] = useState(1);

  const { data: req, isLoading: isFetching, error } = useRequest(requestNumber || "", { query: { enabled: !!requestNumber } });

  const form = useForm<ObituaryFormValues>({
    resolver: zodResolver(ObituaryFormSchema),
    defaultValues: emptyFormValues(),
  });

  useEffect(() => {
    if (req) {
      form.reset(mapPayloadToForm(req));
    }
  }, [req, form]);

  const updateMutation = useUpdateRequest();

  const handleNext = async () => {
    // In edit mode, we can be more lenient or just force validation on the current step fields
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = (data: ObituaryFormValues) => {
    if (!req || !requestNumber) return;
    
    const requestData = mapFormToPayload(data);
    
    updateMutation.mutate(
      { 
        requestNumber, 
        data: { 
          ...requestData, 
          status: req.status 
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: keys.get(requestNumber) });
          queryClient.invalidateQueries({ queryKey: keys.list() });
          toast.success("تم تحديث الطلب بنجاح");
          setLocation(`/${requestNumber}`);
        },
        onError: () => {
          toast.error("حدث خطأ أثناء تحديث الطلب");
        }
      }
    );
  };

  if (isFetching) return <div className="flex justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (error || !req) return <div className="p-10 text-center text-destructive">خطأ في التحميل</div>;

  return (
    <div className="min-h-screen bg-muted/30 pb-20 pt-10">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">تعديل الطلب</h1>
            <p className="text-muted-foreground font-mono">رقم: {requestNumber}</p>
          </div>
          <Link href={`/${requestNumber}`}>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4 rtl:rotate-180" /> إلغاء
            </Button>
          </Link>
        </div>

        <div className="mb-10">
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10 transform -translate-y-1/2"></div>
            <div className="absolute right-0 top-1/2 h-0.5 bg-primary -z-10 transform -translate-y-1/2 transition-all duration-300" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>
            
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setCurrentStep(step.id)}>
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${
                    currentStep === step.id 
                      ? 'bg-primary border-primary text-primary-foreground shadow-md' 
                      : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {step.id}
                </div>
                <span className={`text-xs hidden md:block font-medium absolute -bottom-6 ${currentStep === step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => toast.error("تعذر الحفظ: راجع الحقول المطلوبة في الخطوات (مثل الجنس)."))}>
              <CardContent className="pt-10 pb-4 px-6 md:px-10 min-h-[400px]">
                {/* المسؤول يرى «الخيارات الإضافية» مفتوحة دائماً */}
                <ExtrasOpenContext.Provider value={true}>
                  {currentStep === 1 && <DeceasedStep />}
                  {currentStep === 2 && <RelativesStep />}
                  {currentStep === 3 && <BurialPrayerStep />}
                  {currentStep === 4 && <CondolencesStep />}
                  {currentStep === 5 && <ContactsNotesStep />}
                </ExtrasOpenContext.Provider>
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border/50 px-6 md:px-10 py-6 bg-muted/20">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePrev}
                  disabled={currentStep === 1 || updateMutation.isPending}
                  className="gap-2"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  السابق
                </Button>
                
                <div className="flex gap-4">
                  {currentStep < STEPS.length && (
                    <Button type="button" onClick={handleNext} variant="secondary" className="gap-2 px-6">
                      التالي
                      <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    </Button>
                  )}
                  <Button type="submit" disabled={updateMutation.isPending} className="gap-2 px-8 bg-primary hover:bg-primary/90 text-white">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    حفظ التعديلات
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
