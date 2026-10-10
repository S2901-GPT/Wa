// شعارات التطبيقات الحقيقية (من حزمة simple-icons) لتمييز مقاس كل منصة في أزرار الاستوديو.
// تظهر بألوان كل تطبيق داخل مربع صغير، وللزينة فقط (aria-hidden): اسم الزر يبقى نصياً.
import { siFacebook, siInstagram, siSnapchat, siTelegram, siX } from "simple-icons";
import type { NaskhPosterSizeId } from "@/lib/naskh-poster-plan";

type AppId = "instagram" | "facebook" | "x" | "telegram" | "snapchat";

const APPS: Record<AppId, { path: string; background: string; glyph: string }> = {
  instagram: { path: siInstagram.path, background: "linear-gradient(45deg,#FEDA75 0%,#FA7E1E 25%,#D62976 50%,#962FBF 75%,#4F5BD5 100%)", glyph: "#FFFFFF" },
  facebook: { path: siFacebook.path, background: `#${siFacebook.hex}`, glyph: "#FFFFFF" },
  x: { path: siX.path, background: "#000000", glyph: "#FFFFFF" },
  telegram: { path: siTelegram.path, background: `#${siTelegram.hex}`, glyph: "#FFFFFF" },
  snapchat: { path: siSnapchat.path, background: `#${siSnapchat.hex}`, glyph: "#000000" },
};

export function AppLogo({ app, size = 22 }: { app: AppId; size?: number }) {
  const { path, background, glyph } = APPS[app];
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-md" style={{ width: size, height: size, background }}>
      <svg viewBox="0 0 24 24" width={size * 0.64} height={size * 0.64} fill={glyph}>
        <path d={path} />
      </svg>
    </span>
  );
}

/** التطبيقات المناسبة لكل مقاس: المنشور 4:5 يصلح لكل المنصات، والستوري 9:16 لسناب وإنستغرام وفيسبوك. */
export const SIZE_APPS: Record<NaskhPosterSizeId, readonly AppId[]> = {
  instagram: ["instagram", "facebook", "x", "telegram"],
  story: ["snapchat", "instagram", "facebook"],
  dynamic: [],
};

/** الاسم المختصر الظاهر على الزر؛ الاسم الكامل يبقى للقارئ الشاشي. */
export const SIZE_SHORT_NAME: Record<NaskhPosterSizeId, string> = { instagram: "منشور", story: "ستوري", dynamic: "تلقائي" };

export function SizeLogos({ size }: { size: NaskhPosterSizeId }) {
  return (
    <span className="mt-1 flex items-center justify-center gap-1">
      {SIZE_APPS[size].map((app) => <AppLogo key={app} app={app} />)}
    </span>
  );
}
