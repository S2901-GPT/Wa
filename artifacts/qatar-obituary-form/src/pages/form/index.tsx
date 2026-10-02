import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useCreateObituaryRequest } from "@workspace/api-client-react";
import { ObituaryFormValues, ObituaryFormSchema, emptyFormValues } from "@/lib/schema";
import { mapFormToPayload } from "@/lib/mapper";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { 
  DeceasedStep, 
  RelativesStep, 
  BurialPrayerStep, 
  CondolencesStep, 
  ContactsNotesStep, 
  ReviewStep 
} from "@/components/form-steps";

const STEPS = [
  { id: 1, title: 'المتوفون', fields: ['messageType', 'relatedRequestNumber', 'cancellation', 'announcementMode', 'sharedParent', 'deceasedPeople'] },
  { id: 2, title: 'الأقارب', fields: ['relatives'] },
  { id: 3, title: 'الدفن والصلاة', fields: ['burial', 'prayer'] },
  { id: 4, title: 'العزاء', fields: ['condolences'] },
  { id: 5, title: 'الملاحظات', fields: ['notes'] },
  { id: 6, title: 'المراجعة', fields: [] }
];

export default function FormPage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  
  const form = useForm<ObituaryFormValues>({
    resolver: zodResolver(ObituaryFormSchema),
    defaultValues: emptyFormValues(),
    mode: "onChange"
  });

  const createRequest = useCreateObituaryRequest();

  const handleNext = async () => {
    const stepDef = STEPS.find(s => s.id === currentStep);
    if (!stepDef) return;

    let isValid = true;
    if (stepDef.fields.length > 0) {
      isValid = await form.trigger(stepDef.fields as any);
    }

    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error("يرجى إكمال جميع الحقول المطلوبة بشكل صحيح.");
      // Optional: log errors to console for debug
      console.log(form.formState.errors);
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = (data: ObituaryFormValues) => {
    const requestData = mapFormToPayload(data);

    createRequest.mutate(
      { data: requestData },
      {
        onSuccess: (res) => {
          toast.success("تم إرسال الطلب بنجاح");
          setLocation(`/success/${res.requestNumber}`);
        },
        onError: () => {
          toast.error("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <div className="bg-primary text-primary-foreground py-12 px-4 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        <div className="container max-w-3xl mx-auto relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">نموذج بيانات إعلان وفاة</h1>
          <p className="text-primary-foreground/80 md:text-lg max-w-xl mx-auto">
            مساحة رسمية لتسجيل وتوثيق بيانات إعلانات الوفاة وتفاصيل الدفن والعزاء في دولة قطر
          </p>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-4">
        {/* Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10 transform -translate-y-1/2"></div>
            <div className="absolute right-0 top-1/2 h-0.5 bg-primary -z-10 transform -translate-y-1/2 transition-all duration-300" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>
            
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${
                    currentStep >= step.id 
                      ? 'bg-primary border-primary text-primary-foreground shadow-md' 
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? <CheckIcon className="w-5 h-5" /> : step.id}
                </div>
                <span className={`text-xs hidden md:block font-medium absolute -bottom-6 ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-none shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="pt-10 pb-4 px-6 md:px-10 min-h-[400px]">
                {currentStep === 1 && <DeceasedStep />}
                {currentStep === 2 && <RelativesStep />}
                {currentStep === 3 && <BurialPrayerStep />}
                {currentStep === 4 && <CondolencesStep />}
                {currentStep === 5 && <ContactsNotesStep />}
                {currentStep === 6 && <ReviewStep />}
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border/50 px-6 md:px-10 py-6 bg-muted/20">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePrev}
                  disabled={currentStep === 1 || createRequest.isPending}
                  className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  السابق
                </Button>
                
                {/* مفتاحان مختلفان حتى لا يعيد React استخدام زر «التالي» نفسه فيصبح submit أثناء النقر ويتخطى المراجعة. */}
                {currentStep < STEPS.length ? (
                  <Button key="next" type="button" onClick={handleNext} className="gap-2 px-8">
                    التالي
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </Button>
                ) : (
                  <Button key="submit" type="submit" disabled={createRequest.isPending} className="gap-2 px-8 bg-green-700 hover:bg-green-800 text-white">
                    {createRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                    اعتماد وإرسال
                  </Button>
                )}
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}
