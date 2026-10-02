import { type BlockConfig, type SmartBlockId, type CondolenceTemplate } from "@/lib/template-schema";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown } from "lucide-react";

interface LayersPanelProps {
  template: CondolenceTemplate;
  selectedBlockId: SmartBlockId | null;
  onSelectBlock: (id: SmartBlockId) => void;
  onUpdateBlock: (id: SmartBlockId, updates: Partial<BlockConfig>) => void;
  onMoveLayer: (id: SmartBlockId, direction: "up" | "down") => void;
}

export function LayersPanel({
  template,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onMoveLayer,
}: LayersPanelProps) {
  // Sort blocks by zIndex descending
  const sortedBlocks = Object.values(template.blocks).sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  return (
    <div className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-140px)] text-xs" dir="rtl">
      <div className="flex items-center justify-between pb-2 border-b text-muted-foreground px-1">
        <span className="font-semibold text-foreground text-xs">طبقات التصميم ({sortedBlocks.length})</span>
        <span className="text-[10px]">الترتيب من الأعلى للأسفل</span>
      </div>

      <div className="space-y-1">
        {sortedBlocks.map((block) => {
          const isSelected = selectedBlockId === block.id;

          return (
            <div
              key={block.id}
              onClick={() => onSelectBlock(block.id)}
              className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-primary/10 border-primary text-primary font-semibold ring-1 ring-primary/30"
                  : "bg-card border-border text-foreground hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                <span className="truncate text-xs">{block.label}</span>
              </div>

              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onMoveLayer(block.id, "up")}
                  title="تقديم للأعلى"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onMoveLayer(block.id, "down")}
                  title="إنزال للأسفل"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onUpdateBlock(block.id, { locked: !block.locked })}
                  title={block.locked ? "إلغاء القفل" : "قفل العنصر"}
                >
                  {block.locked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3 text-muted-foreground opacity-60" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onUpdateBlock(block.id, { visible: !block.visible })}
                  title={block.visible ? "إخفاء" : "إظهار"}
                >
                  {block.visible ? <Eye className="h-3 w-3 text-foreground" /> : <EyeOff className="h-3 w-3 text-muted-foreground opacity-60" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
