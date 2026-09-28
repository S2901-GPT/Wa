import "./_group.css";

const panels = [
  {
    id: "bio",
    title: "بيانات المتوفى",
    className: "bg-bio",
      body: <><div className="bg-metric"><b>العمر</b><span>٧٢ عامًا</span></div><div className="bg-metric"><b>الجنسية</b><span>قطري</span></div><div className="bg-metric"><b>مكان الوفاة</b><span>مستشفى حمد العام</span></div><div className="bg-metric"><b>العمل / الصفة</b><span>مهندس متقاعد</span></div><div className="bg-metric"><b>ملاحظة</b><span>معروف بالإحسان</span></div></>,
  },
  {
    id: "family",
    title: "الأقارب والأسرة",
    className: "bg-family",
    body: <><p>أبناء المرحوم — محمد عبدالله، خالد عبدالله</p><p>ناصر عبدالله — العمل: مهندس</p><p>مريم عبدالله — العمل: معلمة</p><p>فاطمة عبدالله — رحمها الله تعالى</p><p>مرجع الأسرة — آل عبدالله</p></>,
  },
  {
    id: "prayer",
    title: "صلاة الجنازة",
    className: "bg-prayer",
    body: <><p>الخميس ٢٤ سبتمبر</p><p>بعد صلاة العصر</p><p>مسجد الإمام محمد بن عبدالوهاب</p><p>الدوحة</p></>,
  },
  {
    id: "burial",
    title: "الدفن",
    className: "bg-burial",
    body: <><p>سيتم الدفن · الخميس ٢٤ سبتمبر</p><p>بعد صلاة العصر</p><p>مقبرة مسيمير</p><p>الدوحة</p></>,
  },
];

function QRBlock({ label, src }: { label: string; src: string }) {
  return (
    <div className="bg-qr">
      <img src={src} alt="" />
      <b>{label}</b>
    </div>
  );
}

export function BalancedGrid() {
  return (
    <main className="bg-stage">
      <style>{`
        .bg-stage {
          --bg-paper:#e8efeb; --bg-ink:#263b3b; --bg-teal:#3c6662;
          --bg-rust:#a75e48; --bg-line:#bdcfca; --bg-card:#f7f8f3;
          width:min(100vw,80dvh); aspect-ratio:4/5; max-height:100dvh;
          margin:auto; padding:5cqw; box-sizing:border-box; container-type:inline-size;
          background:var(--bg-paper); color:var(--bg-ink); direction:rtl;
          font-family:"IBM Plex Sans Arabic",sans-serif; display:flex; flex-direction:column;
          gap:1.15cqw; overflow:hidden; position:relative;
        }
        .bg-stage * { box-sizing:border-box; }
        .bg-head { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--bg-line); padding-bottom:1cqw; }
        .bg-kicker { font-size:1.18cqw; letter-spacing:.06em; font-weight:600; color:var(--bg-teal); }
        .bg-index { border:1px solid var(--bg-teal); padding:.3cqw .9cqw; font:500 1cqw "IBM Plex Sans Arabic",sans-serif; color:var(--bg-teal); }
        .bg-identity { display:grid; grid-template-columns:1fr auto; align-items:center; gap:2cqw; padding:1.35cqw 0 1.6cqw; }
        .bg-identity-copy { text-align:right; }
        .bg-opening { margin:0 0 .55cqw; color:var(--bg-rust); font:600 2cqw/1.35 "Noto Naskh Arabic",serif; }
        .bg-statement { margin:0 0 .35cqw; font-size:1.3cqw; color:var(--bg-teal); }
        .bg-name { margin:0; font:700 3.1cqw/1.35 "Noto Naskh Arabic",serif; }
        .bg-seal { width:10.5cqw; aspect-ratio:1; border:1px solid var(--bg-teal); border-radius:50%; display:grid; place-items:center; position:relative; color:var(--bg-teal); font:600 1.05cqw/1.5 "Noto Naskh Arabic",serif; text-align:center; }
        .bg-seal::before { content:""; position:absolute; inset:.8cqw; border:1px solid var(--bg-line); border-radius:50%; }
        .bg-grid { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:1cqw; flex:1; min-height:0; }
        .bg-card { background:var(--bg-card); border:1px solid var(--bg-line); padding:1.25cqw 1.45cqw; min-width:0; position:relative; display:flex; flex-direction:column; justify-content:space-between; }
        .bg-card::before { content:""; position:absolute; top:0; right:0; width:5.5cqw; height:.32cqw; background:var(--bg-teal); }
        .bg-card.bg-prayer::before,.bg-card.bg-burial::before { background:var(--bg-rust); }
         .bg-card h2 { margin:0 0 .75cqw; padding-top:.25cqw; font-size:1.75cqw; font-weight:700; color:var(--bg-teal); }
         .bg-card p { display:flex; align-items:center; margin:0; font-size:1.52cqw; line-height:1.5; }
         .bg-metric { display:flex; flex:1; align-items:center; justify-content:space-between; gap:.6cqw; padding:.2cqw 0; border-bottom:1px dotted var(--bg-line); font-size:1.38cqw; line-height:1.35; }
        .bg-metric:last-child { border:0; }
        .bg-metric b { color:#627774; font-weight:500; }
        .bg-metric span { text-align:left; }
        .bg-venues { display:grid; grid-template-columns:1fr 1fr; gap:1cqw; background:#dce7e2; border:1px solid var(--bg-line); padding:1cqw 1.2cqw; }
        .bg-venue { min-width:0; display:flex; flex-direction:column; justify-content:space-between; }
        .bg-venue + .bg-venue { border-right:1px solid #b4c8c1; padding-right:1.2cqw; }
         .bg-venue h3 { margin:0 0 .4cqw; font-size:1.65cqw; color:var(--bg-rust); }
         .bg-venue p { margin:0; font-size:1.35cqw; line-height:1.5; }
        .bg-bottom { display:grid; grid-template-columns:1fr auto; align-items:center; gap:1cqw; }
         .bg-contact { font-size:1.35cqw; line-height:1.5; }
        .bg-contact b { color:var(--bg-teal); }
        .bg-note { margin-top:.2cqw; }
         .bg-closing { margin-top:.45cqw; font:600 1.58cqw/1.45 "Noto Naskh Arabic",serif; color:var(--bg-rust); }
        .bg-qr-pair { display:flex; gap:.7cqw; }
         .bg-qr { display:flex; flex-direction:column; align-items:center; gap:.35cqw; font-size:1.18cqw; font-weight:600; white-space:nowrap; }
         .bg-qr img { display:block; width:5.8cqw; aspect-ratio:1; padding:.3cqw; border:1px solid var(--bg-line); background:#fff; }
      `}</style>
      <header className="bg-head"><span className="bg-kicker">دولة قطر · إعلان وفاة</span><span className="bg-index">١ / ١</span></header>
      <section className="bg-identity">
        <div className="bg-identity-copy">
          <p className="bg-opening">إنا لله وإنا إليه راجعون</p>
          <p className="bg-statement">انتقل إلى رحمة الله تعالى</p>
          <h1 className="bg-name">المرحوم عبدالله محمد عبدالله</h1>
        </div>
        <div className="bg-seal">رحمه<br />الله</div>
      </section>
      <div className="bg-grid">
        {panels.map((panel) => <section className={`bg-card ${panel.className}`} key={panel.id}><h2>{panel.title}</h2>{panel.body}</section>)}
      </div>
      <section className="bg-venues">
        <div className="bg-venue"><h3>مجلس الرجال</h3><p>الخميس ٢٤ سبتمبر · لمدة ثلاثة أيام</p><p>من بعد العصر حتى التاسعة مساءً</p><p>مجلس العائلة · الدفنة · منزل ١٢</p></div>
        <div className="bg-venue"><h3>مجلس النساء</h3><p>الخميس ٢٤ سبتمبر · لمدة ثلاثة أيام</p><p>من بعد العصر حتى الثامنة مساءً</p><p>منزل العائلة · الهلال · المدخل الجانبي</p></div>
      </section>
      <footer className="bg-bottom">
        <div className="bg-contact">
          <div><b>التعزية عبر الهاتف</b> · ناصر عبدالله — ٥٥٥٥ ١٢٣٤ · خالد عبدالله — ٥٥٥٥ ٦٧٨٩</div>
          <div className="bg-note"><b>ملاحظات</b> · يرجى مراعاة أوقات الزيارة واستخدام المدخل الجانبي.</div>
          <div className="bg-closing">نسأل الله أن يرحمه ويغفر له ويسكنه فسيح جناته، ويلهم أهله الصبر والسلوان.</div>
        </div>
        <div className="bg-qr-pair">
          <QRBlock label="موقع الرجال" src="/__mockup/images/condolence-qr-men.png" />
          <QRBlock label="موقع النساء" src="/__mockup/images/condolence-qr-women.png" />
          <QRBlock label="موقع الصلاة" src="/__mockup/images/condolence-qr-prayer.png" />
          <QRBlock label="موقع الدفن" src="/__mockup/images/condolence-qr-burial.png" />
        </div>
      </footer>
    </main>
  );
}