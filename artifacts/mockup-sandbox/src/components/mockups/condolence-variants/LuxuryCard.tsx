import "./_group.css";
import type { ReactNode } from "react";

const facts = [
  ["العمر", "٧٢ عامًا"],
  ["الجنسية", "قطري"],
  ["مكان الوفاة", "مستشفى حمد العام"],
  ["العمل / الصفة", "مهندس متقاعد"],
  ["ملاحظة", "معروف بالإحسان"],
];

function QRUnit({ label, src }: { label: string; src: string }) {
  return (
    <div className="lux-qr-unit">
      <img src={src} alt="" />
      <span>{label}</span>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`lux-panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LuxuryCard() {
  return (
    <main className="lux-stage">
      <style>{`
        .lux-stage {
          --paper: #f2eddf; --card: #faf7ef; --ink: #233a35;
          --muted: #68756c; --line: #d6cbb2; --gold: #a5854f;
          width: min(100vw, 80dvh); aspect-ratio: 4 / 5; max-height: 100dvh;
          margin: auto; container-type: inline-size; box-sizing: border-box;
          padding: 5.2cqw; background: var(--paper); color: var(--ink);
          font-family: "IBM Plex Sans Arabic", sans-serif; direction: rtl;
          display: flex; flex-direction: column; gap: 1.15cqw; overflow: hidden;
          position: relative; isolation: isolate;
        }
        .lux-stage *, .lux-stage *::before, .lux-stage *::after { box-sizing: border-box; }
        .lux-stage::before { content:""; position:absolute; inset:2.1cqw; border:1px solid var(--line); z-index:-1; }
        .lux-head { display:flex; align-items:center; justify-content:space-between; padding:0 1.4cqw 1.2cqw; border-bottom:1px solid var(--line); }
          .lux-brand { font-size:1.4cqw; letter-spacing:.08em; color:var(--muted); font-weight:600; }
        .lux-brand-mark { width:3.3cqw; height:.28cqw; background:var(--gold); }
        .lux-identity { background:var(--card); border:1px solid var(--line); position:relative; text-align:center; padding:2.05cqw 4cqw 1.7cqw; }
        .lux-identity::before,.lux-identity::after { content:""; position:absolute; top:50%; width:3.1cqw; height:3.1cqw; border:1px solid var(--gold); transform:translateY(-50%) rotate(45deg); background:var(--card); }
        .lux-identity::before { right:-1.55cqw; } .lux-identity::after { left:-1.55cqw; }
         .lux-opening { margin:0; font:600 2.4cqw/1.3 "Noto Naskh Arabic",serif; }
         .lux-statement { margin:.55cqw 0 .45cqw; color:var(--gold); font-size:1.65cqw; font-weight:600; }
         .lux-name { margin:0; font:700 3.35cqw/1.42 "Noto Naskh Arabic",serif; }
        .lux-facts { display:grid; grid-template-columns:repeat(5,1fr); border:1px solid var(--line); background:#eae4d5; }
        .lux-fact { padding:1.15cqw .7cqw; min-width:0; text-align:center; border-left:1px solid var(--line); }
        .lux-fact:last-child { border-left:0; }
         .lux-fact b { display:block; font-size:1.35cqw; color:var(--muted); font-weight:500; margin-bottom:.48cqw; }
         .lux-fact span { display:block; font-size:1.5cqw; line-height:1.5; font-weight:600; }
        .lux-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.05cqw; flex:1; min-height:0; }
         .lux-panel { background:var(--card); border:1px solid var(--line); padding:1.55cqw 1.7cqw; min-width:0; display:flex; flex-direction:column; justify-content:space-between; }
         .lux-panel h2 { margin:0 0 .8cqw; color:var(--gold); font-size:1.7cqw; line-height:1.35; font-weight:700; }
         .lux-panel p,.lux-panel li { margin:0; font-size:1.48cqw; line-height:1.58; }
        .lux-panel p + p { margin-top:.45cqw; }
        .lux-list { list-style:none; padding:0; margin:0; }
        .lux-list li { padding:.14cqw 0; }
        .lux-list li::before { content:"—"; color:var(--gold); margin-left:.65cqw; }
         .lux-prayer { display:grid; grid-template-columns:1fr 1fr; gap:1.1cqw; flex:1; align-items:center; }
        .lux-mini + .lux-mini { border-right:1px solid var(--line); padding-right:1.15cqw; }
         .lux-mini strong { display:block; font-size:1.35cqw; margin-bottom:.3cqw; color:var(--muted); }
         .lux-mini span { display:block; font-size:1.42cqw; line-height:1.55; }
        .lux-gatherings { grid-column:1 / -1; }
         .lux-gathering-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.2cqw; flex:1; }
         .lux-gathering { padding-inline-start:1cqw; border-inline-start:2px solid var(--line); display:flex; flex-direction:column; justify-content:space-between; }
         .lux-gathering h3 { margin:0 0 .35cqw; font-size:1.6cqw; color:var(--ink); }
         .lux-gathering p { font-size:1.4cqw; line-height:1.5; }
        .lux-bottom { display:grid; grid-template-columns:1fr auto; align-items:center; gap:1.2cqw; border-top:1px solid var(--line); padding-top:1cqw; }
         .lux-contact-note { font-size:1.4cqw; line-height:1.5; }
        .lux-contact-note b { color:var(--gold); }
         .lux-closing { margin-top:.25cqw; font:600 1.62cqw/1.45 "Noto Naskh Arabic",serif; }
        .lux-qr-row { display:flex; gap:1cqw; }
         .lux-qr-unit { display:flex; gap:.5cqw; align-items:center; font-size:1.25cqw; font-weight:600; }
         .lux-qr-unit img { width:6.8cqw; height:6.8cqw; padding:.35cqw; background:#fff; border:1px solid var(--line); }
        @media (max-width:520px) { .lux-stage { padding:5.2cqw; } }
      `}</style>
      <header className="lux-head">
        <span className="lux-brand">دولة قطر · إعلان وفاة</span>
        <span className="lux-brand-mark" />
      </header>
      <section className="lux-identity">
        <p className="lux-opening">إنا لله وإنا إليه راجعون</p>
        <p className="lux-statement">انتقل إلى رحمة الله تعالى</p>
        <h1 className="lux-name">المرحوم عبدالله محمد عبدالله</h1>
      </section>
      <div className="lux-facts">
        {facts.map(([label, value]) => <div className="lux-fact" key={label}><b>{label}</b><span>{value}</span></div>)}
      </div>
      <div className="lux-grid">
        <Panel title="الأقارب وصلات القرابة">
          <p>أبناء المرحوم — محمد عبدالله، خالد عبدالله</p>
          <ul className="lux-list">
            <li>ناصر عبدالله — العمل: مهندس</li>
            <li>مريم عبدالله — العمل: معلمة</li>
            <li>فاطمة عبدالله — رحمها الله تعالى</li>
          </ul>
          <p>مرجع الأسرة: آل عبدالله</p>
        </Panel>
        <Panel title="الصلاة والدفن">
          <div className="lux-prayer">
            <div className="lux-mini"><strong>صلاة الجنازة</strong><span>الخميس ٢٤ سبتمبر · بعد العصر</span><span>مسجد الإمام محمد بن عبدالوهاب</span></div>
            <div className="lux-mini"><strong>الدفن</strong><span>الخميس ٢٤ سبتمبر · بعد العصر</span><span>مقبرة مسيمير</span></div>
          </div>
        </Panel>
        <Panel title="مجالس العزاء" className="lux-gatherings">
          <div className="lux-gathering-grid">
            <div className="lux-gathering"><h3>الرجال</h3><p>الخميس ٢٤ سبتمبر · لمدة ثلاثة أيام</p><p>من بعد العصر حتى التاسعة مساءً · مجلس العائلة</p><p>الدفنة · شارع الكورنيش · منزل ١٢</p></div>
            <div className="lux-gathering"><h3>النساء</h3><p>الخميس ٢٤ سبتمبر · لمدة ثلاثة أيام</p><p>من بعد العصر حتى الثامنة مساءً · منزل العائلة</p><p>الهلال · مدخل الاستقبال الجانبي</p></div>
          </div>
        </Panel>
      </div>
      <footer className="lux-bottom">
        <div className="lux-contact-note">
          <div><b>التعزية عبر الهاتف</b> · ناصر عبدالله · ٥٥٥٥ ١٢٣٤ · خالد عبدالله · ٥٥٥٥ ٦٧٨٩</div>
          <div><b>ملاحظات</b> · يرجى مراعاة وقت الزيارة واستخدام المدخل الجانبي.</div>
          <div className="lux-closing">نسأل الله أن يرحمه ويغفر له ويسكنه فسيح جناته، ويلهم أهله الصبر والسلوان.</div>
        </div>
        <div className="lux-qr-row">
          <QRUnit label="موقع الرجال" src="/__mockup/images/condolence-qr-men.png" />
          <QRUnit label="موقع النساء" src="/__mockup/images/condolence-qr-women.png" />
          <QRUnit label="موقع الصلاة" src="/__mockup/images/condolence-qr-prayer.png" />
          <QRUnit label="موقع الدفن" src="/__mockup/images/condolence-qr-burial.png" />
        </div>
      </footer>
    </main>
  );
}