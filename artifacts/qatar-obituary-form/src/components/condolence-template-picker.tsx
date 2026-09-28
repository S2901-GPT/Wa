import { Check, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";

export type CondolenceTemplate = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
};

export interface CondolenceTemplatePickerProps {
  templates: CondolenceTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function CondolenceTemplatePicker({
  templates,
  selectedId,
  onSelect,
  disabled = false,
}: CondolenceTemplatePickerProps) {
  return (
    <section
      aria-labelledby="condolence-template-picker-title"
      className="space-y-4"
      dir="rtl"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary">
            <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
            <h3
              id="condolence-template-picker-title"
              className="text-base font-bold"
              data-testid="text-template-picker-title"
            >
              اختر تصميم صورة التعزية
            </h3>
          </div>
          <p
            className="max-w-2xl text-sm leading-6 text-muted-foreground"
            data-testid="text-template-picker-description"
          >
            تختلف التصاميم في توزيع الوحدات، لا في الألوان فقط. الافتراضي صورة
            واحدة، ولا تُقسّم البيانات إلا إذا تعذر إبقاؤها واضحة.
          </p>
        </div>
        <span
          className="hidden shrink-0 text-xs text-muted-foreground sm:inline"
          data-testid="text-template-picker-size"
          dir="ltr"
        >
          1080 × 1350 px
        </span>
      </div>

      {templates.length > 0 ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="group"
          aria-label="قوالب صور التعزية"
        >
          {templates.map((template, index) => {
            const isSelected = selectedId === template.id;

            return (
              <button
                key={template.id}
                type="button"
                aria-pressed={isSelected}
                aria-label={`اختيار ${template.title}`}
                disabled={disabled}
                onClick={() => onSelect(template.id)}
                data-testid={`button-select-template-${template.id}`}
                className={cn(
                  "group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-right shadow-sm outline-none transition-[border-color,box-shadow,transform,background-color] duration-200",
                  "hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-md",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-55",
                  isSelected
                    ? "border-primary bg-primary/[0.035] shadow-[0_0_0_2px_hsl(var(--primary)/0.16),0_8px_24px_hsl(var(--primary)/0.10)]"
                    : "border-border/80",
                )}
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                  <img
                    src={template.thumbnailUrl}
                    alt={`معاينة ${template.title}`}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.015]"
                    data-testid={`img-template-thumbnail-${template.id}`}
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/35 to-transparent p-3">
                    <span
                      className="rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm"
                      data-testid={`text-template-index-${template.id}`}
                    >
                      التصميم {index + 1}
                    </span>
                    {isSelected && (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "text-base font-bold leading-6",
                        isSelected ? "text-primary" : "text-card-foreground",
                      )}
                      data-testid={`text-template-title-${template.id}`}
                    >
                      {template.title}
                    </span>
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40 bg-transparent",
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <p
                    className="text-sm leading-6 text-muted-foreground"
                    data-testid={`text-template-description-${template.id}`}
                  >
                    {template.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground"
          data-testid="empty-template-picker"
        >
          <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>لا تتوفر قوالب للمعاينة حالياً.</span>
        </div>
      )}
    </section>
  );
}

export default CondolenceTemplatePicker;