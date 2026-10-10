// شبكة شرائح بالأسماء فقط: العنوان فوقها، والخلايا متساوية العرض فتصطف في أعمدة، والمختار بلون الخلفية.
// تُستخدم في استوديو الصورة وصفحة التجربة للمقاس والتخطيط والخط.
type Option = { id: string; name: string };

export function PosterChips<T extends string>({ label, options, value, columns, onChange }: { label: string; options: readonly Option[]; value: T; columns: 2 | 3 | 4; onChange: (id: T) => void }) {
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
              onClick={() => onChange(option.id as T)}
              className={`rounded-lg border px-1.5 py-1.5 text-center text-[11px] font-semibold leading-4 transition-colors ${
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
