export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
const NASKH_FONT_SAMPLE = "إنا لله وإنا إليه راجعون توفي الوالد 0123456789";

export async function loadCondolenceFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.allSettled([
    document.fonts.load('700 48px "Noto Naskh Arabic"'),
    document.fonts.load('600 24px "Noto Naskh Arabic"'),
    // خطوط Google مقسّمة بنطاقات Unicode، فيلزم نص عربي حتى يُحمَّل النطاق العربي قبل القياس على Canvas.
    document.fonts.load('400 36px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
    document.fonts.load('700 36px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
    document.fonts.load('700 62px "Noto Naskh Arabic"', NASKH_FONT_SAMPLE),
    document.fonts.load('700 48px "IBM Plex Sans Arabic"'),
    document.fonts.load('500 24px "IBM Plex Sans Arabic"'),
    document.fonts.load('800 48px "Tajawal"'),
    document.fonts.load('700 48px "Tajawal"'),
    document.fonts.load('500 24px "Tajawal"'),
  ]);
  await document.fonts.ready;
}

export type SmartBlockId =
  | "header"
  | "opening"
  | "deceased"
  | "details"
  | "prayer"
  | "burial"
  | "prayerBurialCombined"
  | "men"
  | "women"
  | "phone"
  | "relatives"
  | "notes"
  | "closing"
  | "qrPrayer"
  | "qrBurial"
  | "qrMen"
  | "qrWomen";

export type BlockConfig = {
  id: SmartBlockId;
  label: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  autoHeight: boolean;
  minHeight?: number;
  maxHeight?: number;
  minWidth?: number;
  padding: number;
  gap?: number;
  borderRadius: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  minFontSize?: number;
  maxFontSize?: number;
  fontWeight: number;
  textColor: string;
  accentColor: string;
  textAlign: "right" | "center" | "left";
  lineHeight: number;
  titleGap?: number;
  direction?: "rtl" | "ltr";
  zIndex: number;
  priority: number;
  hideWhenEmpty: boolean;
  allowAutoFit: boolean;
  compactBehavior?: "shrink-text" | "reduce-padding" | "reflow";
  qrPosition?: "left" | "right" | "inside-card";
  qrSize?: number;
  qrMinSize?: number;
  headerRibbonHeight?: number;
};

export type TemplateCanvas = {
  width: number;
  height: number;
  backgroundColor: string;
  backgroundGradient?: {
    from: string;
    to: string;
  };
  outerBorder?: {
    color: string;
    width: number;
    inset: number;
  };
  innerBorder?: {
    color: string;
    width: number;
    inset: number;
  };
  cornerDecorations?: boolean;
  styleId: "official" | "modern" | "cards" | "custom" | "naskh";
};

export type SocialNetwork = "instagram" | "snapchat" | "x";

/** هوية الإعلان في قالب النسخ: الشعار يميناً وحسابات التواصل يساراً، والحد الأقصى لطول الصورة. */
export type TemplateBranding = {
  /** صورة الشعار كـ data URL (PNG مصغّر ≤ 256px)، أو فارغ فيظهر مكان محجوز. */
  logoDataUrl?: string;
  handle?: string;
  socials?: SocialNetwork[];
  /** الصورة تبدأ 1350 وتطول عند الحاجة حتى هذا الحد (1350–1800). */
  maxHeight?: number;
};

export type CondolenceTemplate = {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  canvas: TemplateCanvas;
  blocks: Record<SmartBlockId, BlockConfig>;
  layout: {
    mode: "normal" | "compact";
    autoArrange: boolean;
    singlePageEnforced: true;
    cardGap: number;
    pageMarginX: number;
  };
  branding?: TemplateBranding;
  createdAt?: string;
  updatedAt?: string;
};

export const BLOCK_METADATA: Record<SmartBlockId, { label: string; priority: number; defaultAutoHeight: boolean }> = {
  header: { label: "رأس البطاقة / شارة الهوية", priority: 1, defaultAutoHeight: false },
  opening: { label: "عبارة التعزية الافتتاحية", priority: 1, defaultAutoHeight: false },
  deceased: { label: "اسم المتوفى / المتوفين", priority: 1, defaultAutoHeight: true },
  details: { label: "بيانات المتوفى (العمر، الجنسية)", priority: 2, defaultAutoHeight: true },
  prayerBurialCombined: { label: "صلاة الجنازة والدفن (المدمجة)", priority: 2, defaultAutoHeight: true },
  prayer: { label: "صلاة الجنازة", priority: 2, defaultAutoHeight: true },
  burial: { label: "الدفن", priority: 2, defaultAutoHeight: true },
  men: { label: "عزاء الرجال", priority: 3, defaultAutoHeight: true },
  women: { label: "عزاء النساء", priority: 4, defaultAutoHeight: true },
  phone: { label: "التعزية عبر الهاتف", priority: 5, defaultAutoHeight: true },
  relatives: { label: "الأقارب وصلات القرابة", priority: 6, defaultAutoHeight: true },
  notes: { label: "الملاحظات", priority: 7, defaultAutoHeight: true },
  closing: { label: "دعاء الختام", priority: 8, defaultAutoHeight: false },
  qrPrayer: { label: "QR صلاة الجنازة", priority: 2, defaultAutoHeight: false },
  qrBurial: { label: "QR الدفن", priority: 2, defaultAutoHeight: false },
  qrMen: { label: "QR عزاء الرجال", priority: 3, defaultAutoHeight: false },
  qrWomen: { label: "QR عزاء النساء", priority: 4, defaultAutoHeight: false },
};

// ==========================================
// 1. TEMPLATE: رسمي فاخر وهادئ (Official Qatari Luxury)
// ==========================================
export const DEFAULT_TEMPLATE_OFFICIAL: CondolenceTemplate = {
  id: "official",
  name: "رسمي فاخر وهادئ",
  description: "طابع قطري وقور بإطار عنابي ملكي وذهب عتيق، مع خط نسخي أصيل وبطاقات عاجية مريحة",
  isDefault: false,
  isBuiltIn: true,
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: "#FCFBF7",
    backgroundGradient: {
      from: "#FCFBF7",
      to: "#F5EFE3",
    },
    outerBorder: {
      color: "#671426",
      width: 2.5,
      inset: 36,
    },
    innerBorder: {
      color: "#B38E46",
      width: 1.2,
      inset: 44,
    },
    cornerDecorations: true,
    styleId: "official",
  },
  layout: {
    mode: "normal",
    autoArrange: true,
    singlePageEnforced: true,
    cardGap: 14,
    pageMarginX: 64,
  },
  blocks: {
    header: {
      id: "header",
      label: "رأس البطاقة",
      visible: true,
      locked: false,
      x: 64,
      y: 68,
      width: 952,
      height: 24,
      autoHeight: false,
      padding: 0,
      borderRadius: 0,
      backgroundColor: "transparent",
      borderColor: "#B38E46",
      borderWidth: 0,
      opacity: 1,
      fontFamily: "Noto Naskh Arabic",
      fontSize: 16,
      fontWeight: 600,
      textColor: "#671426",
      accentColor: "#B38E46",
      textAlign: "center",
      lineHeight: 20,
      zIndex: 1,
      priority: 1,
      hideWhenEmpty: false,
      allowAutoFit: false,
    },
    opening: {
      id: "opening",
      label: "عبارة التعزية الافتتاحية",
      visible: true,
      locked: false,
      x: 64,
      y: 84,
      width: 952,
      height: 48,
      autoHeight: false,
      padding: 0,
      borderRadius: 0,
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      opacity: 1,
      fontFamily: "Noto Naskh Arabic",
      fontSize: 27,
      minFontSize: 22,
      fontWeight: 700,
      textColor: "#671426",
      accentColor: "#B38E46",
      textAlign: "center",
      lineHeight: 34,
      zIndex: 2,
      priority: 1,
      hideWhenEmpty: false,
      allowAutoFit: true,
    },
    deceased: {
      id: "deceased",
      label: "اسم المتوفى / المتوفين",
      visible: true,
      locked: false,
      x: 64,
      y: 160,
      width: 952,
      height: 64,
      autoHeight: true,
      minHeight: 56,
      padding: 4,
      borderRadius: 0,
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      opacity: 1,
      fontFamily: "Noto Naskh Arabic",
      fontSize: 44,
      minFontSize: 32,
      fontWeight: 700,
      textColor: "#671426",
      accentColor: "#671426",
      textAlign: "center",
      lineHeight: 56,
      zIndex: 3,
      priority: 1,
      hideWhenEmpty: false,
      allowAutoFit: true,
    },
    details: {
      id: "details",
      label: "بيانات المتوفى",
      visible: true,
      locked: false,
      x: 64,
      y: 228,
      width: 952,
      height: 32,
      autoHeight: true,
      padding: 0,
      borderRadius: 0,
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 18,
      minFontSize: 14,
      fontWeight: 500,
      textColor: "#6E6963",
      accentColor: "#B38E46",
      textAlign: "center",
      lineHeight: 26,
      zIndex: 4,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: true,
    },
    prayerBurialCombined: {
      id: "prayerBurialCombined",
      label: "صلاة الجنازة والدفن المدمجة",
      visible: true,
      locked: false,
      x: 64,
      y: 278,
      width: 952,
      height: 168,
      autoHeight: true,
      minHeight: 140,
      padding: 24,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 30,
      titleGap: 16,
      zIndex: 5,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: true,
      qrPosition: "left",
      qrSize: 114,
      qrMinSize: 96,
    },
    prayer: {
      id: "prayer",
      label: "صلاة الجنازة",
      visible: true,
      locked: false,
      x: 550,
      y: 278,
      width: 466,
      height: 175,
      autoHeight: true,
      minHeight: 150,
      padding: 20,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 28,
      titleGap: 14,
      zIndex: 6,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: true,
      qrPosition: "left",
      qrSize: 104,
      qrMinSize: 90,
    },
    burial: {
      id: "burial",
      label: "الدفن",
      visible: true,
      locked: false,
      x: 64,
      y: 278,
      width: 466,
      height: 175,
      autoHeight: true,
      minHeight: 150,
      padding: 20,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 28,
      titleGap: 14,
      zIndex: 7,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: true,
      qrPosition: "left",
      qrSize: 104,
      qrMinSize: 90,
    },
    men: {
      id: "men",
      label: "عزاء الرجال",
      visible: true,
      locked: false,
      x: 64,
      y: 468,
      width: 952,
      height: 170,
      autoHeight: true,
      minHeight: 140,
      padding: 24,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 30,
      titleGap: 16,
      zIndex: 8,
      priority: 3,
      hideWhenEmpty: true,
      allowAutoFit: true,
      qrPosition: "left",
      qrSize: 114,
      qrMinSize: 96,
    },
    women: {
      id: "women",
      label: "عزاء النساء",
      visible: true,
      locked: false,
      x: 64,
      y: 652,
      width: 952,
      height: 170,
      autoHeight: true,
      minHeight: 140,
      padding: 24,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#7A2838",
      textAlign: "right",
      lineHeight: 30,
      titleGap: 16,
      zIndex: 9,
      priority: 4,
      hideWhenEmpty: true,
      allowAutoFit: true,
      qrPosition: "left",
      qrSize: 114,
      qrMinSize: 96,
    },
    phone: {
      id: "phone",
      label: "التعزية عبر الهاتف",
      visible: true,
      locked: false,
      x: 64,
      y: 836,
      width: 952,
      height: 104,
      autoHeight: true,
      minHeight: 90,
      padding: 22,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 18,
      minFontSize: 15,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 28,
      titleGap: 14,
      zIndex: 10,
      priority: 5,
      hideWhenEmpty: true,
      allowAutoFit: true,
    },
    relatives: {
      id: "relatives",
      label: "الأقارب وصلات القرابة",
      visible: true,
      locked: false,
      x: 64,
      y: 954,
      width: 952,
      height: 140,
      autoHeight: true,
      minHeight: 110,
      padding: 24,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 18,
      minFontSize: 14,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 28,
      titleGap: 14,
      zIndex: 11,
      priority: 6,
      hideWhenEmpty: true,
      allowAutoFit: true,
    },
    notes: {
      id: "notes",
      label: "الملاحظات",
      visible: true,
      locked: false,
      x: 64,
      y: 1108,
      width: 952,
      height: 90,
      autoHeight: true,
      minHeight: 75,
      padding: 20,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#E2D9C8",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 17,
      minFontSize: 14,
      fontWeight: 500,
      textColor: "#2B2625",
      accentColor: "#671426",
      textAlign: "right",
      lineHeight: 26,
      titleGap: 12,
      zIndex: 12,
      priority: 7,
      hideWhenEmpty: true,
      allowAutoFit: true,
    },
    closing: {
      id: "closing",
      label: "دعاء الختام",
      visible: true,
      locked: false,
      x: 64,
      y: 1212,
      width: 952,
      height: 76,
      autoHeight: false,
      padding: 16,
      borderRadius: 14,
      backgroundColor: "#FFFFFF",
      borderColor: "#DFD5C2",
      borderWidth: 1,
      opacity: 1,
      fontFamily: "Noto Naskh Arabic",
      fontSize: 22,
      minFontSize: 18,
      fontWeight: 600,
      textColor: "#671426",
      accentColor: "#B38E46",
      textAlign: "center",
      lineHeight: 32,
      zIndex: 13,
      priority: 8,
      hideWhenEmpty: false,
      allowAutoFit: true,
    },
    qrPrayer: {
      id: "qrPrayer",
      label: "QR صلاة الجنازة",
      visible: true,
      locked: false,
      x: 570,
      y: 310,
      width: 104,
      height: 104,
      autoHeight: false,
      padding: 6,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderColor: "#C5A869",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 12,
      fontWeight: 700,
      textColor: "#671426",
      accentColor: "#671426",
      textAlign: "center",
      lineHeight: 14,
      zIndex: 14,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: false,
    },
    qrBurial: {
      id: "qrBurial",
      label: "QR الدفن",
      visible: true,
      locked: false,
      x: 84,
      y: 310,
      width: 104,
      height: 104,
      autoHeight: false,
      padding: 6,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderColor: "#C5A869",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 12,
      fontWeight: 700,
      textColor: "#671426",
      accentColor: "#671426",
      textAlign: "center",
      lineHeight: 14,
      zIndex: 15,
      priority: 2,
      hideWhenEmpty: true,
      allowAutoFit: false,
    },
    qrMen: {
      id: "qrMen",
      label: "QR عزاء الرجال",
      visible: true,
      locked: false,
      x: 92,
      y: 494,
      width: 114,
      height: 114,
      autoHeight: false,
      padding: 8,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderColor: "#C5A869",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 13,
      fontWeight: 700,
      textColor: "#671426",
      accentColor: "#671426",
      textAlign: "center",
      lineHeight: 16,
      zIndex: 16,
      priority: 3,
      hideWhenEmpty: true,
      allowAutoFit: false,
    },
    qrWomen: {
      id: "qrWomen",
      label: "QR عزاء النساء",
      visible: true,
      locked: false,
      x: 92,
      y: 678,
      width: 114,
      height: 114,
      autoHeight: false,
      padding: 8,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      borderColor: "#C5A869",
      borderWidth: 1.2,
      opacity: 1,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 13,
      fontWeight: 700,
      textColor: "#7A2838",
      accentColor: "#7A2838",
      textAlign: "center",
      lineHeight: 16,
      zIndex: 17,
      priority: 4,
      hideWhenEmpty: true,
      allowAutoFit: false,
    },
  },
};

// ==========================================
// 2. TEMPLATE: حديث Minimal (Modern Minimal)
// ==========================================
export const DEFAULT_TEMPLATE_MODERN: CondolenceTemplate = {
  id: "modern",
  name: "حديث Minimal",
  description: "تصميم عصري هندسي نقي بمساحات بيضاء متوازنة وخطوط واضحة، بدون زخارف مبالغ فيها",
  isDefault: false,
  isBuiltIn: true,
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: "#FFFFFF",
    styleId: "modern",
  },
  layout: {
    mode: "normal",
    autoArrange: true,
    singlePageEnforced: true,
    cardGap: 14,
    pageMarginX: 56,
  },
  blocks: {
    ...DEFAULT_TEMPLATE_OFFICIAL.blocks,
    opening: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.opening,
      fontFamily: "Tajawal",
      fontSize: 24,
      textColor: "#0F172A",
      textAlign: "right",
    },
    deceased: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.deceased,
      fontFamily: "Tajawal",
      fontSize: 42,
      fontWeight: 800,
      textColor: "#0F172A",
      textAlign: "right",
    },
    details: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.details,
      fontFamily: "IBM Plex Sans Arabic",
      textColor: "#4B5563",
      textAlign: "right",
    },
    prayerBurialCombined: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.prayerBurialCombined,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#0F172A",
      fontFamily: "Tajawal",
    },
    prayer: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.prayer,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#0F172A",
      fontFamily: "Tajawal",
    },
    burial: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.burial,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#0F172A",
      fontFamily: "Tajawal",
    },
    men: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.men,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#1E3A8A",
      fontFamily: "Tajawal",
    },
    women: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.women,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#581C87",
      fontFamily: "Tajawal",
    },
    phone: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.phone,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#1F2937",
    },
    relatives: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.relatives,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#0F766E",
    },
    notes: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.notes,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      accentColor: "#4B5563",
    },
    closing: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.closing,
      borderRadius: 10,
      borderColor: "#E5E7EB",
      borderWidth: 1,
      fontFamily: "Tajawal",
      textColor: "#0F172A",
    },
    qrPrayer: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrPrayer,
      borderColor: "#E5E7EB",
      textColor: "#1F2937",
    },
    qrBurial: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrBurial,
      borderColor: "#E5E7EB",
      textColor: "#1F2937",
    },
    qrMen: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrMen,
      borderColor: "#E5E7EB",
      textColor: "#1F2937",
    },
    qrWomen: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrWomen,
      borderColor: "#E5E7EB",
      textColor: "#1F2937",
    },
  },
};

// ==========================================
// 3. TEMPLATE: بطاقات معلومات Premium (Information Cards)
// ==========================================
export const DEFAULT_TEMPLATE_CARDS: CondolenceTemplate = {
  id: "cards",
  name: "بطاقات معلومات Premium",
  description: "نظام بطاقات مستقلة عائمة بأشرطة تعريف ملونة، تنظيم تطبيقي تنفيذي عالي الوضوح",
  isDefault: false,
  isBuiltIn: true,
  canvas: {
    width: 1080,
    height: 1350,
    backgroundColor: "#EDF2F7",
    styleId: "cards",
  },
  layout: {
    mode: "normal",
    autoArrange: true,
    singlePageEnforced: true,
    cardGap: 14,
    pageMarginX: 56,
  },
  blocks: {
    ...DEFAULT_TEMPLATE_OFFICIAL.blocks,
    opening: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.opening,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 19,
      textColor: "#FFFFFF",
      textAlign: "center",
    },
    deceased: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.deceased,
      fontFamily: "IBM Plex Sans Arabic",
      fontSize: 40,
      fontWeight: 800,
      textColor: "#0F172A",
      textAlign: "center",
    },
    details: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.details,
      fontFamily: "IBM Plex Sans Arabic",
      textColor: "#475569",
      textAlign: "center",
    },
    prayerBurialCombined: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.prayerBurialCombined,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#1E3A8A",
      headerRibbonHeight: 42,
    },
    prayer: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.prayer,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#1E3A8A",
      headerRibbonHeight: 42,
    },
    burial: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.burial,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#0F766E",
      headerRibbonHeight: 42,
    },
    men: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.men,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#1E293B",
      headerRibbonHeight: 42,
    },
    women: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.women,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#6B21A8",
      headerRibbonHeight: 42,
    },
    phone: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.phone,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#475569",
      headerRibbonHeight: 42,
    },
    relatives: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.relatives,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#334155",
      headerRibbonHeight: 42,
    },
    notes: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.notes,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      accentColor: "#64748B",
      headerRibbonHeight: 42,
    },
    closing: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.closing,
      borderRadius: 16,
      borderColor: "#E2E8F0",
      fontFamily: "IBM Plex Sans Arabic",
      textColor: "#0F172A",
    },
    qrPrayer: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrPrayer,
      borderColor: "#CBD5E1",
      textColor: "#1E293B",
    },
    qrBurial: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrBurial,
      borderColor: "#CBD5E1",
      textColor: "#1E293B",
    },
    qrMen: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrMen,
      borderColor: "#CBD5E1",
      textColor: "#1E293B",
    },
    qrWomen: {
      ...DEFAULT_TEMPLATE_OFFICIAL.blocks.qrWomen,
      borderColor: "#CBD5E1",
      textColor: "#1E293B",
    },
  },
};

// ==========================================
// 4. TEMPLATE: النسخ الرسمي (قالب الصفحة المتدفقة)
// يُرسم بمحرك مستقل (naskh-poster-engine.ts): خلفية مزخرفة، مخطوطة «إنا لله» أعلى، النص من اليمين،
// فواصل رفيعة بين الأقسام، رمز الموقع بجانب كل عزاء، والشعار يميناً وحسابات التواصل يساراً.
// الكتل هنا للتوافق مع النوع فقط ولا تؤثر في الرسم.
// ==========================================
export const DEFAULT_TEMPLATE_NASKH: CondolenceTemplate = {
  id: "naskh",
  name: "النسخ الرسمي",
  description: "خلفية مزخرفة هادئة وخط النسخ، النص من اليمين بفواصل رفيعة، ورمز الموقع بجانب كل عزاء، ويطول تلقائياً عند كثرة الأسماء",
  isDefault: true,
  isBuiltIn: true,
  canvas: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: "#FAF9F7",
    styleId: "naskh",
  },
  blocks: DEFAULT_TEMPLATE_OFFICIAL.blocks,
  layout: { ...DEFAULT_TEMPLATE_OFFICIAL.layout },
  branding: {
    handle: "qatarde",
    socials: ["instagram", "snapchat", "x"],
    maxHeight: 1800,
  },
};

export const BUILT_IN_TEMPLATES: Record<string, CondolenceTemplate> = {
  naskh: DEFAULT_TEMPLATE_NASKH,
  official: DEFAULT_TEMPLATE_OFFICIAL,
  modern: DEFAULT_TEMPLATE_MODERN,
  cards: DEFAULT_TEMPLATE_CARDS,
};
