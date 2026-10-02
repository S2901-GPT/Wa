import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useCreateObituaryRequest } from "@workspace/api-client-react";
import { ObituaryFormValues, ObituaryFormSchema } from "@/lib/schema";
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
  { id: 1, title: 'المتوفون', fields: ['deceasedList'] },
  { id: 2, title: 'الأقارب', fields: ['relatives'] },
  { id: 3, title: 'الدفن والصلاة', fields: ['burial', 'prayer'] },
  { id: 4, title: 'العزاء', fields: ['condolences'] },
  { id: 5, title: 'ابتداء العزاء والملاحظات', fields: ['condolenceStartDate', 'condolenceStartTime', 'notes'] },
  { id: 6, title: 'المراجعة', fields: [] }
];

export default function FormPage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  
  const form = useForm<ObituaryFormValues>({
    resolver: zodResolver(ObituaryFormSchema),
    defaultValues: {
      deceasedList: [
        {
          fullName: "",
          gender: "ذكر",
          title: "none",
          nationality: "",
          deathLocation: "",
          femaleRelations: []
        }
      ],
      relatives: [],
      burial: {
        status: "scheduled",
        isOutsideQatar: false,
        locationName: "",
        dateDescription: "",
        timeDescription: "",
        notes: "",
      },
      prayer: {
        enabled: false,
        status: "scheduled",
        isOutsideQatar: false,
        locationName: "",
        dateDescription: "",
        timeDescription: "",
        notes: "",
      },
      condolences: {
        type: "full",
        men: {
          locationName: "",
          mapsLink: "",
          durationDays: null,
          schedule: {
            enabled: false,
            morningFrom: "",
            morningTo: "",
            eveningFrom: "",
            eveningTo: "",
            fridayNote: "",
          },
          windows: [],
        },
        women: {
          locationName: "",
          mapsLink: "",
          durationDays: null,
          schedule: {
            enabled: false,
            morningFrom: "",
            morningTo: "",
            eveningFrom: "",
            eveningTo: "",
            fridayNote: "",
          },
          windows: [],
        },
        phones: [],
      },
      condolenceStartDate: "",
      condolenceStartTime: "",
      notes: ""
    },
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
      { data: requestData as any },
      {
        onSuccess: (res: any) => {
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
    <div className="min-h-screen bg-muted/30 pb-16 w-full max-w-full overflow-x-hidden box-border">
      <div className="bg-primary text-primary-foreground py-6 sm:py-10 px-3 sm:px-4 mb-4 sm:mb-6 relative overflow-hidden w-full max-w-full box-border">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        <div className="container max-w-3xl mx-auto relative z-10 text-center px-1">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 tracking-tight">تسجيل بيانات إعلان وفاة</h1>
          <p className="text-primary-foreground/80 text-xs sm:text-sm md:text-base max-w-xl mx-auto">
            مساحة رسمية لتسجيل وتوثيق بيانات إعلانات الوفاة وتفاصيل الدفن والعزاء في دولة قطر
          </p>
        </div>
      </div>

      <div className="container max-w-3xl mx-auto px-2 sm:px-4 w-full max-w-full box-border">
        {/* Stepper */}
        <div className="mb-6 w-full overflow-hidden box-border">
          <div className="flex items-center justify-between relative px-1 w-full">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10 transform -translate-y-1/2"></div>
            <div 
              className="absolute right-0 top-1/2 h-0.5 bg-primary -z-10 transform -translate-y-1/2 transition-all duration-300" 
              style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
            ></div>
            
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-1">
                <div 
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs transition-colors border-2 ${
                    currentStep >= step.id 
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : step.id}
                </div>
                <span className={`text-[10px] sm:text-xs hidden sm:block font-medium ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-border/70 shadow-lg bg-card overflow-hidden w-full max-w-full box-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-full box-border">
              <CardContent className="pt-6 pb-4 px-3 sm:px-6 md:px-8 min-h-[380px] w-full max-w-full box-border overflow-hidden">
                {currentStep === 1 && <DeceasedStep />}
                {currentStep === 2 && <RelativesStep />}
                {currentStep === 3 && <BurialPrayerStep />}
                {currentStep === 4 && <CondolencesStep />}
                {currentStep === 5 && <ContactsNotesStep />}
                {currentStep === 6 && <ReviewStep />}
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border/50 px-3 sm:px-6 md:px-8 py-3.5 sm:py-5 bg-muted/20 gap-2 w-full box-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePrev}
                  disabled={currentStep === 1 || createRequest.isPending}
                  className="gap-1.5 sm:gap-2 px-3 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm border-primary/20 hover:bg-primary/5 hover:text-primary shrink-0"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  السابق
                </Button>
                
                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={handleNext} className="gap-1.5 sm:gap-2 px-4 sm:px-8 h-9 sm:h-10 text-xs sm:text-sm shrink-0">
                    التالي
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createRequest.isPending} className="gap-1.5 sm:gap-2 px-3 sm:px-8 h-9 sm:h-10 text-xs sm:text-sm bg-green-700 hover:bg-green-800 text-white font-bold shrink-0">
                    {createRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                    اعتماد وإرسال الطلب
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
