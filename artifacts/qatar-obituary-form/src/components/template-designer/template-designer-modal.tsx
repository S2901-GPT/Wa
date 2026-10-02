import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  type CondolenceTemplate,
  type BlockConfig,
  type SmartBlockId,
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  BUILT_IN_TEMPLATES,
  loadCondolenceFonts,
} from "@/lib/template-schema";
import {
  fetchAllTemplates,
  saveTemplate,
  duplicateTemplate,
  deleteCustomTemplate,
  resetTemplateToBuiltIn,
  getDefaultTemplateId,
  setDefaultTemplateId,
} from "@/lib/template-storage";
import { normalizeObituaryPresentation } from "@/lib/presentation-normalizer";
import { TEST_DATASETS } from "@/lib/mock-test-datasets";
import {
  generateQrImages,
  compileAndRenderSinglePage,
  type QrCodeMap,
  type RenderValidationReport,
} from "@/lib/single-page-engine";
import { renderPoster } from "@/lib/poster-render";
import { isNaskhTemplate } from "@/lib/naskh-poster-engine";
import { DesignerCanvas } from "./designer-canvas";
import { PropertiesPanel } from "./properties-panel";
import { LayersPanel } from "./layers-panel";
import { NaskhSettingsPanel } from "./naskh-settings-panel";
import { NaskhPreviewCanvas } from "./naskh-preview-canvas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Save,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  Sparkles,
  Eye,
  Edit3,
  Copy,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Layers,
  Sliders,
  ChevronDown,
} from "lucide-react";

interface TemplateDesignerModalProps {
  initialTemplateId?: string;
  onClose: () => void;
  onSelectAndApply?: (template: CondolenceTemplate) => void;
}

export function TemplateDesignerModal({
  initialTemplateId,
  onClose,
  onSelectAndApply,
}: TemplateDesignerModalProps) {
  const [templates, setTemplates] = useState<Record<string, CondolenceTemplate>>({ ...BUILT_IN_TEMPLATES });
  const [currentTemplateId, setCurrentTemplateId] = useState<string>(initialTemplateId || getDefaultTemplateId());
  const [selectedBlockId, setSelectedBlockId] = useState<SmartBlockId | null>("deceased");
  const [editMode, setEditMode] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(0.48); // default responsive scale ~48% of 1080px (about 518px wide)
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>("standard");

  // History stack for Undo/Redo
  const [history, setHistory] = useState<CondolenceTemplate[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Dialogs
  const [newTemplateDialogOpen, setNewTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Qr codes & Validation report
  const [qrImages, setQrImages] = useState<QrCodeMap>({});
  const [validationReport, setValidationReport] = useState<RenderValidationReport | null>(null);

  // Load templates on mount
  useEffect(() => {
    void fetchAllTemplates().then((loaded) => {
      setTemplates(loaded);
      const targetId = initialTemplateId && loaded[initialTemplateId] ? initialTemplateId : getDefaultTemplateId();
      setCurrentTemplateId(targetId);
      if (loaded[targetId]) {
        setHistory([loaded[targetId]]);
        setHistoryIndex(0);
      }
    });
  }, [initialTemplateId]);

  const currentTemplate = templates[currentTemplateId] || BUILT_IN_TEMPLATES.naskh;
  // قالب النسخ انسيابي: بلا طبقات أو سحب، وله لوحة إعدادات الهوية بدل خصائص الكتل.
  const isNaskh = isNaskhTemplate(currentTemplate);

  // Normalized content from active test dataset
  const activeDataset = TEST_DATASETS[selectedDatasetKey]?.request || TEST_DATASETS.standard.request;
  const normalizedContent = useMemo(() => {
    return normalizeObituaryPresentation(activeDataset);
  }, [activeDataset]);

  // Load real high-contrast QR images for this dataset
  useEffect(() => {
    const urls: Record<string, string | undefined> = {
      prayer: normalizedContent.prayer?.qrUrl,
      burial: normalizedContent.burial?.qrUrl,
      prayerBurialCombined: normalizedContent.prayerBurialCombined?.qrUrl,
      men: normalizedContent.men?.qrUrl,
      women: normalizedContent.women?.qrUrl,
    };
    void generateQrImages(urls).then(setQrImages);
  }, [normalizedContent]);

  // Push new template state to Undo history
  const pushState = useCallback((newTemplate: CondolenceTemplate) => {
    setHistory((prev) => {
      const slice = prev.slice(0, historyIndex + 1);
      return [...slice, newTemplate];
    });
    setHistoryIndex((prev) => prev + 1);
    setTemplates((prev) => ({ ...prev, [newTemplate.id]: newTemplate }));
  }, [historyIndex]);

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const prevTemplate = history[nextIdx];
      setHistoryIndex(nextIdx);
      setTemplates((prev) => ({ ...prev, [prevTemplate.id]: prevTemplate }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const nextTemplate = history[nextIdx];
      setHistoryIndex(nextIdx);
      setTemplates((prev) => ({ ...prev, [nextTemplate.id]: nextTemplate }));
    }
  };

  // Update a single block
  const handleUpdateBlock = (id: SmartBlockId, partial: Partial<BlockConfig>) => {
    const oldBlock = currentTemplate.blocks[id];
    if (!oldBlock) return;

    const updatedTemplate: CondolenceTemplate = {
      ...currentTemplate,
      blocks: {
        ...currentTemplate.blocks,
        [id]: { ...oldBlock, ...partial },
      },
    };
    pushState(updatedTemplate);
  };

  // Update template level properties
  const handleUpdateTemplate = (partial: Partial<CondolenceTemplate>) => {
    const updated: CondolenceTemplate = {
      ...currentTemplate,
      ...partial,
    };
    pushState(updated);
  };

  // Layer order shift
  const handleMoveLayer = (id: SmartBlockId, direction: "up" | "down") => {
    const block = currentTemplate.blocks[id];
    if (!block) return;
    const currentZ = block.zIndex || 1;
    const newZ = direction === "up" ? currentZ + 1 : Math.max(1, currentZ - 1);
    handleUpdateBlock(id, { zIndex: newZ });
  };

  // "ترتيب تلقائي" (Auto Arrange)
  const handleAutoArrange = () => {
    const updated: CondolenceTemplate = {
      ...currentTemplate,
      layout: {
        ...currentTemplate.layout,
        autoArrange: true,
      },
    };
    pushState(updated);
    toast.success("تم إعادة ترتيب البطاقات تلقائيًا بما يضمن عدم التداخل والالتزام بصفحة واحدة");
  };

  // Save current template to Firestore & Local
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveTemplate(currentTemplate);
      toast.success(`تم حفظ القالب "${currentTemplate.name}" بنجاح`);
    } catch {
      toast.error("حدث خطأ أثناء حفظ القالب");
    } finally {
      setIsSaving(false);
    }
  };

  // Save as new template
  const handleSaveAsNew = async () => {
    if (!newTemplateName.trim()) {
      toast.error("يرجى إدخال اسم للقالب الجديد");
      return;
    }
    setIsSaving(true);
    try {
      const duplicated = await duplicateTemplate(currentTemplate, newTemplateName.trim());
      setTemplates((prev) => ({ ...prev, [duplicated.id]: duplicated }));
      setCurrentTemplateId(duplicated.id);
      setHistory([duplicated]);
      setHistoryIndex(0);
      setNewTemplateDialogOpen(false);
      setNewTemplateName("");
      toast.success(`تم إنشاء القالب الجديد "${duplicated.name}"`);
    } catch {
      toast.error("تعذر إنشاء القالب الجديد");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    const factory = resetTemplateToBuiltIn(currentTemplate.id);
    if (factory) {
      pushState(factory);
      toast.success(`تمت استعادة الإعدادات الأصلية للقالب "${factory.name}"`);
    } else {
      toast.info("هذا القالب مخصص وليس له إعدادات مصنع");
    }
  };

  // Set as default
  const handleSetAsDefault = () => {
    setDefaultTemplateId(currentTemplate.id);
    toast.success(`تم تعيين "${currentTemplate.name}" كقالب افتراضي لجميع طلبات التعزية`);
  };

  // Delete custom template
  const handleDeleteCustom = async () => {
    if (currentTemplate.isBuiltIn) {
      toast.error("لا يمكن حذف القوالب الافتراضية المدمجة في النظام");
      return;
    }
    const success = await deleteCustomTemplate(currentTemplate.id);
    if (success) {
      const remaining = { ...templates };
      delete remaining[currentTemplate.id];
      setTemplates(remaining);
      setCurrentTemplateId("naskh");
      toast.success("تم حذف القالب المخصص");
    }
  };

  // Export PNG (1080 × 1350، أو أطول في قالب النسخ)
  const handleExportPng = () => {
    void (async () => {
      const { canvas, report } = await renderPoster(currentTemplate, normalizedContent, qrImages);

      if (!report.isValid) {
        toast.error("يرجى إصلاح التداخلات قبل التصدير");
        return;
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("تعذر تصدير ملف الصورة");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `condolence-${currentTemplate.id}-${Date.now()}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast.success(`تم تصدير صورة التعزية بصيغة PNG عالية الدقة (${canvas.width} × ${canvas.height})`);
      }, "image/png");
    })();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground flex flex-col select-none" dir="rtl">
      {/* TOP MASTER TOOLBAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2.5 shadow-sm">
        {/* Left: Template Selector & Name */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 font-semibold text-xs border-primary/30">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                {currentTemplate.name}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 text-xs" dir="rtl">
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-semibold">القوالب المتاحة</div>
              {Object.values(templates).map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => {
                    setCurrentTemplateId(t.id);
                    setHistory([t]);
                    setHistoryIndex(0);
                  }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className={t.id === currentTemplateId ? "font-bold text-primary" : ""}>{t.name}</span>
                  {t.id === currentTemplateId && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNewTemplateDialogOpen(true)} className="gap-2 text-primary cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                حفظ كقالب جديد...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Test Dataset Switcher */}
          <div className="hidden sm:flex items-center gap-1.5 border-r pr-3">
            <span className="text-[11px] text-muted-foreground">بيانات الاختبار:</span>
            <select
              value={selectedDatasetKey}
              onChange={(e) => setSelectedDatasetKey(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-xs"
            >
              {Object.entries(TEST_DATASETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Tools (Undo, Redo, Zoom, Grid, Snap, Auto Arrange) */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            title="تراجع (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            title="إعادة (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Zoom controls */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.05))}
            title="تصغير (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono px-1 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(1.0, z + 0.05))}
            title="تكبير (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(0.48)}
            title="ملاءمة الشاشة"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          {!isNaskh && (<>
          <div className="h-4 w-px bg-border mx-1" />

          {/* Grid & Snap Toggles */}
          <Button
            type="button"
            variant={showGrid ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowGrid((g) => !g)}
            title="الشبكة الهندسية (Grid)"
          >
            <Grid className={`h-4 w-4 ${showGrid ? "text-primary font-bold" : ""}`} />
          </Button>
          <Button
            type="button"
            variant={snapEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setSnapEnabled((s) => !s)}
            title="المحاذاة الذكية (Snapping)"
          >
            <Magnet className={`h-4 w-4 ${snapEnabled ? "text-primary font-bold" : ""}`} />
          </Button>

          {/* Auto Arrange */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-dashed"
            onClick={handleAutoArrange}
            title="إعادة توزيع البطاقات ذكياً"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            ترتيب تلقائي
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Mode Switch: Edit vs Preview */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg">
            <Button
              type="button"
              variant={editMode ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setEditMode(true)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              تحرير
            </Button>
            <Button
              type="button"
              variant={!editMode ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setEditMode(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              معاينة حقيقية
            </Button>
          </div>
          </>)}
        </div>

        {/* Right: Actions (Save, Apply, Export, Close) */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                خيارات القالب...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs" dir="rtl">
              <DropdownMenuItem onClick={handleSetAsDefault} className="gap-2 cursor-pointer">
                <Check className="h-3.5 w-3.5" />
                تعيين كقالب افتراضي
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResetToDefault} className="gap-2 cursor-pointer">
                <RotateCcw className="h-3.5 w-3.5" />
                استعادة إعدادات المصنع
              </DropdownMenuItem>
              {!currentTemplate.isBuiltIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDeleteCustom} className="gap-2 text-destructive cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف هذا القالب
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-1.5 h-8 text-xs border-primary/30"
          >
            <Save className="h-3.5 w-3.5 text-primary" />
            حفظ التعديلات
          </Button>

          {onSelectAndApply && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onSelectAndApply(currentTemplate)}
              className="gap-1.5 h-8 text-xs bg-green-700 hover:bg-green-800 text-white font-semibold"
            >
              <Check className="h-3.5 w-3.5" />
              تطبيق على الطلب
            </Button>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleExportPng}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير PNG
          </Button>

          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* WORKSPACE MAIN BODY: Left Panels + Center Canvas + Right Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Templates & Layers */}
        <aside className="w-64 border-l bg-card flex flex-col shrink-0">
          <Tabs defaultValue="layers" className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 m-2">
              <TabsTrigger value="layers" className="text-xs gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                الطبقات
              </TabsTrigger>
              <TabsTrigger value="templates" className="text-xs gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                القوالب
              </TabsTrigger>
            </TabsList>

            <TabsContent value="layers" className="flex-1 p-0 m-0 overflow-hidden">
              {isNaskh ? (
                <p className="p-3 text-[11px] leading-relaxed text-muted-foreground">
                  قالب النسخ انسيابي بلا طبقات: الأقسام تُرتَّب تلقائياً بترتيب الأرشيف، وتُضبط هويته من لوحة الإعدادات.
                </p>
              ) : (
                <LayersPanel
                  template={currentTemplate}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={(id) => setSelectedBlockId(id)}
                  onUpdateBlock={handleUpdateBlock}
                  onMoveLayer={handleMoveLayer}
                />
              )}
            </TabsContent>

            <TabsContent value="templates" className="flex-1 p-3 m-0 overflow-y-auto space-y-2">
              <p className="text-xs font-semibold text-foreground">القوالب الجاهزة</p>
              <div className="space-y-2">
                {Object.values(templates).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setCurrentTemplateId(t.id);
                      setHistory([t]);
                      setHistoryIndex(0);
                    }}
                    className={`p-3 rounded-xl border text-right cursor-pointer transition-all text-xs ${
                      t.id === currentTemplateId
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">{t.name}</span>
                      {t.isDefault && (
                        <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium">
                          افتراضي
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{t.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Canvas Viewport */}
        <main className="flex-1 bg-muted/30 overflow-auto flex items-center justify-center p-6 relative">
          {isNaskh ? (
            <NaskhPreviewCanvas
              template={currentTemplate}
              content={normalizedContent}
              qrImages={qrImages}
              zoom={zoom}
              onValidationChange={setValidationReport}
            />
          ) : (
            <DesignerCanvas
              template={currentTemplate}
              content={normalizedContent}
              qrImages={qrImages}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onUpdateBlock={handleUpdateBlock}
              editMode={editMode}
              showGrid={showGrid}
              snapEnabled={snapEnabled}
              zoom={zoom}
              onValidationChange={setValidationReport}
            />
          )}
        </main>

        {/* Right Side: Properties Inspector */}
        <aside className="w-80 border-r bg-card flex flex-col shrink-0">
          <div className="p-3 border-b bg-muted/10 font-bold text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-primary" />
              لوحة الخصائص
            </span>
            {selectedBlockId && (
              <span className="text-[10px] font-mono text-muted-foreground">{selectedBlockId}</span>
            )}
          </div>
          {isNaskh ? (
            <NaskhSettingsPanel template={currentTemplate} onUpdateTemplate={handleUpdateTemplate} />
          ) : (
            <PropertiesPanel
              block={selectedBlockId ? currentTemplate.blocks[selectedBlockId] || null : null}
              template={currentTemplate}
              onUpdateBlock={handleUpdateBlock}
              onUpdateTemplate={handleUpdateTemplate}
              onMoveLayer={handleMoveLayer}
            />
          )}
        </aside>
      </div>

      {/* BOTTOM STATUS BAR */}
      <footer className="h-9 border-t bg-card px-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <strong className="text-foreground">{isNaskh ? `طول ديناميكي (1080 × ${validationReport?.totalUsedHeight ?? 1350} px)` : "صفحة واحدة فقط (1080 × 1350 px)"}</strong>
          </span>

          {validationReport?.isCompactMode && (
            <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px] font-medium">
              <Sparkles className="h-3 w-3" />
              وضع الضغط التلقائي نشط (Compact Mode)
            </span>
          )}

          {validationReport?.issues.length ? (
            <span className="flex items-center gap-1 text-destructive text-[11px]">
              <AlertTriangle className="h-3 w-3" />
              {validationReport.issues[0]?.message}
            </span>
          ) : (
            <span className="text-green-700 text-[11px]">جميع البطاقات ضمن حدود الصفحة المعتمدة</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span>دقة الإخراج: 1080×{isNaskh ? validationReport?.totalUsedHeight ?? 1350 : 1350}</span>
          <span>·</span>
          <span>تصحيح QR: Level H عالي التباين</span>
        </div>
      </footer>

      {/* SAVE AS NEW TEMPLATE DIALOG */}
      <Dialog open={newTemplateDialogOpen} onOpenChange={setNewTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>حفظ كقالب جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold">اسم القالب الجديد:</span>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="مثال: قالب كبار الشخصيات VIP"
              />
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setNewTemplateDialogOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" size="sm" onClick={handleSaveAsNew} disabled={isSaving}>
              حفظ القالب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
