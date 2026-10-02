import { type BlockConfig, type SmartBlockId, type CondolenceTemplate } from "@/lib/template-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlignRight,
  AlignCenter,
  AlignLeft,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
} from "lucide-react";

interface PropertiesPanelProps {
  block: BlockConfig | null;
  template: CondolenceTemplate;
  onUpdateBlock: (id: SmartBlockId, updates: Partial<BlockConfig>) => void;
  onUpdateTemplate: (updates: Partial<CondolenceTemplate>) => void;
  onMoveLayer: (id: SmartBlockId, direction: "up" | "down") => void;
}

const FONTS = [
  { label: "Noto Naskh Arabic (رسمي فاخر)", value: "Noto Naskh Arabic" },
  { label: "Tajawal (عصري هندسي)", value: "Tajawal" },
  { label: "IBM Plex Sans Arabic (تقني مقروء)", value: "IBM Plex Sans Arabic" },
];

export function PropertiesPanel({
  block,
  template,
  onUpdateBlock,
  onUpdateTemplate,
  onMoveLayer,
}: PropertiesPanelProps) {
  if (!block) {
    return (
      <div className="p-4 space-y-4 text-xs text-muted-foreground" dir="rtl">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="font-semibold text-foreground text-sm">إعدادات القالب العامة</p>
          <div className="space-y-1.5">
            <Label className="text-xs">لون خلفية الصفحة</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={template.canvas.backgroundColor}
                onChange={(e) =>
                  onUpdateTemplate({
                    canvas: { ...template.canvas, backgroundColor: e.target.value, backgroundGradient: undefined },
                  })
                }
                className="w-8 h-8 rounded border cursor-pointer"
              />
              <Input
                value={template.canvas.backgroundColor}
                onChange={(e) =>
                  onUpdateTemplate({
                    canvas: { ...template.canvas, backgroundColor: e.target.value },
                  })
                }
                className="font-mono text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label className="text-xs">المسافة بين البطاقات (Gap: {template.layout.cardGap}px)</Label>
            <Slider
              min={6}
              max={24}
              step={1}
              value={[template.layout.cardGap]}
              onValueChange={([val]) =>
                onUpdateTemplate({
                  layout: { ...template.layout, cardGap: val },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs">ترتيب تلقائي للبطاقات</Label>
            <Switch
              checked={template.layout.autoArrange}
              onCheckedChange={(checked) =>
                onUpdateTemplate({
                  layout: { ...template.layout, autoArrange: checked },
                })
              }
            />
          </div>
        </div>

        <p className="text-center pt-6 text-muted-foreground">
          انقر فوق أي بطاقة في مساحة التصميم أو من قائمة الطبقات لتعديل خصائصها.
        </p>
      </div>
    );
  }

  const hasQr = ["prayerBurialCombined", "prayer", "burial", "men", "women"].includes(block.id);

  return (
    <div className="p-4 space-y-5 text-xs overflow-y-auto max-h-[calc(100vh-140px)]" dir="rtl">
      {/* Header Info & Lock / Hide */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h3 className="font-bold text-sm text-foreground">{block.label}</h3>
          <span className="font-mono text-[10px] text-muted-foreground">ID: {block.id}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdateBlock(block.id, { visible: !block.visible })}
            title={block.visible ? "إخفاء" : "إظهار"}
          >
            {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdateBlock(block.id, { locked: !block.locked })}
            title={block.locked ? "إلغاء القفل" : "قفل العنصر"}
          >
            {block.locked ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {/* Dimensions & Coordinates */}
      <div className="space-y-2">
        <span className="font-semibold text-foreground block">الموقع والأبعاد (بكسل)</span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">X</Label>
            <Input
              type="number"
              disabled={block.locked}
              value={block.x}
              onChange={(e) => onUpdateBlock(block.id, { x: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Y</Label>
            <Input
              type="number"
              disabled={block.locked}
              value={block.y}
              onChange={(e) => onUpdateBlock(block.id, { y: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">العرض (W)</Label>
            <Input
              type="number"
              disabled={block.locked}
              value={block.width}
              onChange={(e) => onUpdateBlock(block.id, { width: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">الارتفاع (H)</Label>
            <Input
              type="number"
              disabled={block.locked || block.autoHeight}
              value={block.height}
              onChange={(e) => onUpdateBlock(block.id, { height: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs">ارتفاع تلقائي حسب النص (Auto Height)</Label>
          <Switch
            checked={block.autoHeight}
            disabled={block.locked}
            onCheckedChange={(checked) => onUpdateBlock(block.id, { autoHeight: checked })}
          />
        </div>
      </div>

      {/* Spacing & Borders */}
      <div className="space-y-3 pt-1 border-t">
        <span className="font-semibold text-foreground block">الحواف والتباعد</span>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[11px]">الهامش الداخلي (Padding: {block.padding}px)</Label>
          </div>
          <Slider
            disabled={block.locked}
            min={4}
            max={40}
            step={2}
            value={[block.padding]}
            onValueChange={([val]) => onUpdateBlock(block.id, { padding: val })}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[11px]">استدارة الزوايا (Radius: {block.borderRadius}px)</Label>
          </div>
          <Slider
            disabled={block.locked}
            min={0}
            max={32}
            step={2}
            value={[block.borderRadius]}
            onValueChange={([val]) => onUpdateBlock(block.id, { borderRadius: val })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">لون الخلفية</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                disabled={block.locked}
                value={block.backgroundColor === "transparent" ? "#FFFFFF" : block.backgroundColor}
                onChange={(e) => onUpdateBlock(block.id, { backgroundColor: e.target.value })}
                className="w-7 h-7 rounded border cursor-pointer"
              />
              <Input
                disabled={block.locked}
                value={block.backgroundColor}
                onChange={(e) => onUpdateBlock(block.id, { backgroundColor: e.target.value })}
                className="h-7 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">لون الإطار</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                disabled={block.locked}
                value={block.borderColor === "transparent" ? "#E2E8F0" : block.borderColor}
                onChange={(e) => onUpdateBlock(block.id, { borderColor: e.target.value })}
                className="w-7 h-7 rounded border cursor-pointer"
              />
              <Input
                disabled={block.locked}
                value={block.borderColor}
                onChange={(e) => onUpdateBlock(block.id, { borderColor: e.target.value })}
                className="h-7 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-3 pt-1 border-t">
        <span className="font-semibold text-foreground block">الخط والنصوص</span>
        <div className="space-y-1">
          <Label className="text-[11px]">نوع الخط</Label>
          <select
            disabled={block.locked}
            value={block.fontFamily}
            onChange={(e) => onUpdateBlock(block.id, { fontFamily: e.target.value })}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">حجم الخط (px)</Label>
            <Input
              type="number"
              disabled={block.locked}
              value={block.fontSize}
              onChange={(e) => onUpdateBlock(block.id, { fontSize: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-[11px]">الحد الأدنى (Auto-Fit)</Label>
            <Input
              type="number"
              disabled={block.locked}
              value={block.minFontSize || 14}
              onChange={(e) => onUpdateBlock(block.id, { minFontSize: Number(e.target.value) })}
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">لون النص</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                disabled={block.locked}
                value={block.textColor}
                onChange={(e) => onUpdateBlock(block.id, { textColor: e.target.value })}
                className="w-7 h-7 rounded border cursor-pointer"
              />
              <Input
                disabled={block.locked}
                value={block.textColor}
                onChange={(e) => onUpdateBlock(block.id, { textColor: e.target.value })}
                className="h-7 font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">لون التمييز (العنوان)</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                disabled={block.locked}
                value={block.accentColor}
                onChange={(e) => onUpdateBlock(block.id, { accentColor: e.target.value })}
                className="w-7 h-7 rounded border cursor-pointer"
              />
              <Input
                disabled={block.locked}
                value={block.accentColor}
                onChange={(e) => onUpdateBlock(block.id, { accentColor: e.target.value })}
                className="h-7 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Alignment */}
        <div className="space-y-1">
          <Label className="text-[11px]">محاذاة النص</Label>
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border">
            <Button
              type="button"
              variant={block.textAlign === "right" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => onUpdateBlock(block.id, { textAlign: "right" })}
            >
              <AlignRight className="h-3.5 w-3.5" />
              يمين
            </Button>
            <Button
              type="button"
              variant={block.textAlign === "center" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => onUpdateBlock(block.id, { textAlign: "center" })}
            >
              <AlignCenter className="h-3.5 w-3.5" />
              وسط
            </Button>
            <Button
              type="button"
              variant={block.textAlign === "left" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => onUpdateBlock(block.id, { textAlign: "left" })}
            >
              <AlignLeft className="h-3.5 w-3.5" />
              يسار
            </Button>
          </div>
        </div>
      </div>

      {/* QR Code Controls if block has QR */}
      {hasQr && (
        <div className="space-y-3 pt-1 border-t">
          <span className="font-semibold text-foreground block">إعدادات رمز الـQR Code</span>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label className="text-[11px]">حجم رمز الـQR ({block.qrSize || 114}px)</Label>
            </div>
            <Slider
              disabled={block.locked}
              min={90}
              max={150}
              step={2}
              value={[block.qrSize || 114]}
              onValueChange={([val]) => onUpdateBlock(block.id, { qrSize: val })}
            />
          </div>
        </div>
      )}

      {/* Layer Z-Order */}
      <div className="space-y-2 pt-1 border-t">
        <span className="font-semibold text-foreground block">ترتيب الطبقة</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => onMoveLayer(block.id, "up")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            تقديم للأمام
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => onMoveLayer(block.id, "down")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            إرجاع للخلف
          </Button>
        </div>
      </div>
    </div>
  );
}
