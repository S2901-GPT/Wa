import "./_group.css";
import { useEffect, useState } from "react";
import {
  loadCondolenceFonts,
  renderCondolencePages,
  type CondolenceContentItem,
} from "@/lib/condolence-image-renderer-current";

const content: CondolenceContentItem[] = [
  {
    kind: "section",
    label: "الأقارب وصلات القرابة",
    text: "أبناء المرحوم — محمد عبدالله، خالد عبدالله\n• راشد عبدالله — العمل: مهندس\n• فاطمة عبدالله — رحمها الله",
  },
  { kind: "section", label: "صلاة الجنازة", text: "اليوم: الخميس\nالوقت: بعد صلاة العصر\nالمسجد / مكان الصلاة: مسجد الإمام محمد بن عبدالوهاب" },
  { kind: "section", label: "الدفن", text: "حالة الدفن: سيتم الدفن\nالمقبرة: مقبرة مسيمير" },
  {
    kind: "columns",
    label: "مجالس العزاء",
    columns: [
      { label: "الرجال", text: "بداية العزاء: الخميس\nالفترة: بعد العصر\nالمجلس: مجلس العائلة\nالمنطقة: الدفنة" },
      { label: "النساء", text: "بداية العزاء: الخميس\nالفترة: بعد العصر\nالمجلس: منزل العائلة\nالمنطقة: الهلال" },
    ],
  },
  { kind: "section", label: "التعزية عبر الهاتف", text: "ناصر عبدالله — 5555 1234" },
  { kind: "section", label: "ملاحظات", text: "يرجى مراعاة وقت الزيارة." },
  { kind: "section", text: "نسأل الله أن يرحمه ويغفر له ويسكنه فسيح جناته.", tone: "closing" },
  {
    kind: "qr-row",
    codes: [
      { key: "men", label: "موقع الرجال", url: "https://maps.google.com/?q=Doha" },
      { key: "women", label: "موقع النساء", url: "https://maps.google.com/?q=Doha" },
    ],
  },
];

export function Current() {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      await loadCondolenceFonts();
      const [canvas] = renderCondolencePages({
        designId: "official",
        opening: "إنا لله وإنا إليه راجعون",
        statement: "انتقل إلى رحمة الله تعالى",
        names: "المرحوم عبدالله محمد عبدالله",
        items: content,
        qrImages: {},
      });
      if (active && canvas) setImageUrl(canvas.toDataURL("image/png"));
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ width: "100vw", minHeight: "100vh" }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="التصميم الحالي لصورة التعزية"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      ) : null}
    </main>
  );
}