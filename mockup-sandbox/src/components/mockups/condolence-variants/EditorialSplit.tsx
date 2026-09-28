import "./_group.css";
import type { ReactNode } from "react";

const editorialFacts = [
  ["العمر", "٧٢ عامًا"],
  ["الجنسية", "قطري"],
  ["مكان الوفاة", "مستشفى حمد العام"],
  ["العمل / الصفة", "مهندس متقاعد"],
  ["ملاحظة", "معروف بالإحسان"],
];

function EditorialQR({ label, src }: { label: string; src: string }) {
  return (
    <div className="ed-qr">
      <img src={src} alt="" />
      <span>{label}</span>
    </div>
  );
}

function EditorialBlock({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`ed-block ${className}`}><h2>{title}</h2>{children}</section>;
}

export function EditorialSplit() {
  return (
    <main className="ed-stage">
      <style>{`
        .ed-stage {
          --ed-paper:#f4eee5; --ed-ink:#302d3b; --ed-muted:#77706d;
          --ed-rose:#9a5149; --ed-ochre:#b18b55; --ed-line:#d8c9b9;
          width:min(100vw,80dvh); aspect-ratio:4/5; max-height:100dvh;
          margin:auto; padding:5cqw; box-sizing:border-box; container-type:inline-size;
          background:var(--ed-paper); color:var(--ed-ink); direction:rtl;
          font-family:"IBM Plex Sans Arabic",sans-serif; overflow:hidden;
          display:flex; flex-direction:column; gap:1.2cqw; position:relative;
        }
        .ed-stage * { box-sizing:border-box; }
        .ed-stage::after { content:""; position:absolute; top:0; bottom:0; left:4.1cqw; width:.27cqw; background:var(--ed-ochre); opacity:.8; }
        .ed-mast { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ed-line); padding-bottom:.8cqw; }
        .ed-mast b { font-size:1.18cqw; font-weight:600; letter-spacing:.07em; }
         .ed-mast span { color:var(--ed-muted); font-size:1.25cqw; }
        .ed-top { display:grid; grid-template-columns:1.05fr .95fr; min-height:20cqw; border-bottom:1px solid var(--ed-line); padding:1cqw 0 1.4cqw; gap:2.2cqw; }
        .ed-title { display:flex; flex-direction:column; justify-content:center; }
         .ed-opening { margin:0 0 .85cqw; font:600 2.3cqw/1.35 "Noto Naskh Arabic",serif; color:var(--ed-rose); }
         .ed-statement { margin:0 0 .4cqw; color:var(--ed-muted); font-size:1.55cqw; }
         .ed-name { margin:0; font:700 3.3cqw/1.38 "Noto Naskh Arabic",serif; }
        .ed-name-rule { width:7cqw; height:.25cqw; background:var(--ed-ochre); margin-top:1cqw; }
        .ed-facts { display:grid; grid-template-columns:1fr 1fr; align-content:center; gap:.58cqw 1.25cqw; padding-right:1.6cqw; border-right:1px solid var(--ed-line); }
        .ed-fact { border-bottom:1px solid var(--ed-line); padding:.42cqw 0; }
         .ed-fact b { display:block; font-size:1.28cqw; color:var(--ed-muted); font-weight:500; margin-bottom:.16cqw; }
         .ed-fact span { display:block; font-size:1.48cqw; font-weight:600; line-height:1.35; }
        .ed-middle { display:grid; grid-template-columns:1.08fr .92fr; gap:1.9cqw; flex:1; min-height:0; }
        .ed-column { display:flex; flex-direction:column; gap:1.2cqw; min-height:0; }
        .ed-block { border-top:2px solid var(--ed-ink); padding-top:.7cqw; min-width:0; }
         .ed-block h2 { margin:0 0 .52cqw; color:var(--ed-rose); font-size:1.75cqw; font-weight:700; }
         .ed-block p { margin:0 0 .35cqw; font-size:1.48cqw; line-height:1.5; }
        .ed-family { flex:1; display:flex; flex-direction:column; justify-content:space-between; }
        .ed-prayer-burial { display:grid; grid-template-columns:1fr 1fr; gap:1.15cqw; }
        .ed-prayer-burial .ed-block { border-color:var(--ed-ochre); }
         .ed-prayer-burial .ed-block h2 { font-size:1.5cqw; }
         .ed-prayer-burial .ed-block p { font-size:1.3cqw; line-height:1.5; }
        .ed-councils { flex:1; display:flex; flex-direction:column; justify-content:space-between; }
        .ed-council { flex:1; padding:.55cqw 0; border-bottom:1px solid var(--ed-line); display:flex; flex-direction:column; justify-content:space-between; }
        .ed-council:last-child { border-bottom:0; }
         .ed-council h3 { margin:0 0 .25cqw; font-size:1.55cqw; color:var(--ed-ink); }
         .ed-council p { font-size:1.33cqw; line-height:1.48; }
        .ed-footer { display:grid; grid-template-columns:1fr auto; gap:1.3cqw; border-top:1px solid var(--ed-line); padding-top:.95cqw; align-items:center; }
         .ed-notes { font-size:1.35cqw; line-height:1.5; }
        .ed-notes b { color:var(--ed-rose); }
         .ed-closing { margin-top:.35cqw; font:600 1.55cqw/1.42 "Noto Naskh Arabic",serif; }
        .ed-qrs { display:flex; gap:1.1cqw; }
         .ed-qr { display:flex; flex-direction:column; align-items:center; gap:.35cqw; font-size:1.25cqw; font-weight:600; white-space:nowrap; }
         .ed-qr img { display:block; width:5.8cqw; aspect-ratio:1; padding:.3cqw; border:1px solid var(--ed-line); background:#fff; }
      `}</style>
      <header className="ed-mast"><b>دولة قطر / إعلان وفاة</b><span>مجالس العزاء ومعلومات الأسرة</span></header>
      <section className="ed-top">
        <div className="ed-title">
          <p className="ed-opening">إنا لله وإنا إليه راجعون</p>
          <p className="ed-statement">انتقل إلى رحمة الله تعالى</p>
          <h1 className="ed-name">المرحوم عبدالله محمد عبدالله</h1>
          <span className="ed-name-rule" />
        </div>
        <div className="ed-facts">
          {editorialFacts.map(([label, value]) => <div className="ed-fact" key={label}><b>{label}</b><span>{value}</span></div>)}
        </div>
      </section>
      <div className="ed-middle">
        <div className="ed-column">
          <EditorialBlock title="الأقارب وصلات القرابة" className="ed-family">
            <p>أبناء المرحوم — محمد عبدالله، خالد عبدالله</p>
            <p>ناصر عبدالله — العمل: مهندس</p>
            <p>مريم عبدالله — العمل: معلمة</p>
            <p>فاطمة عبدالله — رحمها الله تعالى</p>
            <p>مرجع الأسرة — آل عبدالله</p>
          </EditorialBlock>
          <div className="ed-prayer-burial">
            <EditorialBlock title="صلاة الجنازة"><p>الخميس ٢٤ سبتمبر</p><p>بعد صلاة العصر</p><p>مسجد الإمام محمد بن عبدالوهاب</p><p>الدوحة</p></EditorialBlock>
            <EditorialBlock title="الدفن"><p>سيتم الدفن · الخميس ٢٤ سبتمبر</p><p>بعد صلاة العصر</p><p>مقبرة مسيمير</p><p>الدوحة</p></EditorialBlock>
          </div>
        </div>
        <div className="ed-column">
          <EditorialBlock title="مجالس العزاء" className="ed-councils">
            <div className="ed-council"><h3>الرجال</h3><p>الخميس ٢٤ سبتمبر · ثلاثة أيام</p><p>من بعد العصر حتى التاسعة مساءً</p><p>مجلس العائلة · الدفنة · منزل ١٢</p></div>
            <div className="ed-council"><h3>النساء</h3><p>الخميس ٢٤ سبتمبر · ثلاثة أيام</p><p>من بعد العصر حتى الثامنة مساءً</p><p>منزل العائلة · الهلال · المدخل الجانبي</p></div>
          </EditorialBlock>
        </div>
      </div>
      <footer className="ed-footer">
        <div className="ed-notes">
          <div><b>التعزية عبر الهاتف</b> · ناصر عبدالله — ٥٥٥٥ ١٢٣٤ · خالد عبدالله — ٥٥٥٥ ٦٧٨٩</div>
          <div><b>ملاحظات</b> · يرجى مراعاة أوقات الزيارة واستخدام المدخل الجانبي.</div>
          <div className="ed-closing">نسأل الله أن يرحمه ويغفر له ويسكنه فسيح جناته، ويلهم أهله الصبر والسلوان.</div>
        </div>
        <div className="ed-qrs">
          <EditorialQR label="موقع الرجال" src="/__mockup/images/condolence-qr-men.png" />
          <EditorialQR label="موقع النساء" src="/__mockup/images/condolence-qr-women.png" />
          <EditorialQR label="موقع الصلاة" src="/__mockup/images/condolence-qr-prayer.png" />
          <EditorialQR label="موقع الدفن" src="/__mockup/images/condolence-qr-burial.png" />
        </div>
      </footer>
    </main>
  );
}