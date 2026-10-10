// شبكة شرائح بالأسماء فقط: العنوان فوقها، والخلايا متساوية العرض فتصطف في أعمدة، والمختار بلون الخلفية.
// تُستخدم في استوديو الصورة وصفحة التجربة للمقاس والتخطيط والخط.
import type { ReactNode } from "react";

type Option = { id: string; name: string };

/**
 * `renderOption` يستبدل نص الزر المرئي (مثلاً باسم مختصر وشعارات)؛ الاسم الكامل يبقى في `aria-label`
 * فيبقى الزر مفهوماً للقارئ الشاشي وللاختبارات.
 */
export function PosterChips<T extends string>({ label, options, value, columns, onChange, renderOption }: { label: string; options: readonly Option[]; value: T; columns: 2 | 3 | 4; onChange: (id: T) => void; renderOption?: (option: Option) => ReactNode }) {
  return (
    <div className="mb-3" role="radiogroup" aria-label={label}>
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      <div className={`grid gap-1.5 ${columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {options.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={renderOption ? option.name : undefined}
              onClick={() => onChange(option.id as T)}
              className={`rounded-lg border px-1.5 py-1.5 text-center text-[11px] font-semibold leading-4 transition-colors flex flex-col items-center justify-center ${
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {renderOption ? renderOption(option) : option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
