import { useEffect, useRef, useState, useCallback } from "react";
import {
  type CondolenceTemplate,
  type BlockConfig,
  type SmartBlockId,
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  loadCondolenceFonts,
} from "@/lib/template-schema";
import { type NormalizedContent } from "@/lib/presentation-normalizer";
import {
  compileAndRenderSinglePage,
  type QrCodeMap,
  type RenderValidationReport,
} from "@/lib/single-page-engine";

interface DesignerCanvasProps {
  template: CondolenceTemplate;
  content: NormalizedContent;
  qrImages: QrCodeMap;
  selectedBlockId: SmartBlockId | null;
  onSelectBlock: (id: SmartBlockId | null) => void;
  onUpdateBlock: (id: SmartBlockId, partial: Partial<BlockConfig>) => void;
  editMode: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  zoom: number; // e.g. 0.5 for 50%, 1.0 for 100%
  onValidationChange?: (report: RenderValidationReport) => void;
}

type DragState = {
  type: "move" | "resize";
  blockId: SmartBlockId;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
  handle?: string; // 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
};

export function DesignerCanvas({
  template,
  content,
  qrImages,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  editMode,
  showGrid,
  snapEnabled,
  zoom,
  onValidationChange,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});
  const [renderedBlocks, setRenderedBlocks] = useState<Array<BlockConfig & { calculatedHeight: number }>>([]);
  const [isFontReady, setIsFontReady] = useState(false);

  // Load fonts once
  useEffect(() => {
    void loadCondolenceFonts().then(() => setIsFontReady(true));
  }, []);

  // Render template to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const { canvas: compiled, report, renderedBlocks: blocks } = compileAndRenderSinglePage(
        template,
        content,
        qrImages
      );

      canvas.width = IMAGE_WIDTH;
      canvas.height = IMAGE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        ctx.drawImage(compiled, 0, 0);

        // In edit mode: draw grid if enabled
        if (editMode && showGrid) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
          ctx.lineWidth = 1;
          const gridSize = 40;
          for (let x = gridSize; x < IMAGE_WIDTH; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, IMAGE_HEIGHT);
            ctx.stroke();
          }
          for (let y = gridSize; y < IMAGE_HEIGHT; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(IMAGE_WIDTH, y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw Snapping Guides if active
        if (editMode && snapEnabled && (snapGuides.x != null || snapGuides.y != null)) {
          ctx.save();
          ctx.strokeStyle = "#3B82F6";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);

          if (snapGuides.x != null) {
            ctx.beginPath();
            ctx.moveTo(snapGuides.x, 0);
            ctx.lineTo(snapGuides.x, IMAGE_HEIGHT);
            ctx.stroke();
          }

          if (snapGuides.y != null) {
            ctx.beginPath();
            ctx.moveTo(0, snapGuides.y);
            ctx.lineTo(IMAGE_WIDTH, snapGuides.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      setRenderedBlocks(blocks);
      onValidationChange?.(report);
    } catch (e) {
      console.error("Single page compile error:", e);
    }
  }, [template, content, qrImages, editMode, showGrid, snapEnabled, snapGuides, isFontReady, onValidationChange]);

  // Convert client viewport coordinates to 1080×1350 canvas coordinates
  const clientToCanvasCoord = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = IMAGE_WIDTH / rect.width;
      const scaleY = IMAGE_HEIGHT / rect.height;
      return {
        x: Math.round((clientX - rect.left) * scaleX),
        y: Math.round((clientY - rect.top) * scaleY),
      };
    },
    []
  );

  // Mouse Down handler for dragging & resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return;
    const { x, y } = clientToCanvasCoord(e.clientX, e.clientY);

    // If currently selected block has handles clicked
    if (selectedBlockId) {
      const activeBlock = renderedBlocks.find((b) => b.id === selectedBlockId);
      if (activeBlock && !activeBlock.locked) {
        const handleSize = 14;
        const bx = activeBlock.x;
        const by = activeBlock.y;
        const bw = activeBlock.width;
        const bh = activeBlock.calculatedHeight || activeBlock.height;

        // Check 8 handles
        const handles: Record<string, { x: number; y: number }> = {
          nw: { x: bx, y: by },
          ne: { x: bx + bw, y: by },
          se: { x: bx + bw, y: by + bh },
          sw: { x: bx, y: by + bh },
          n: { x: bx + bw / 2, y: by },
          s: { x: bx + bw / 2, y: by + bh },
          e: { x: bx + bw, y: by + bh / 2 },
          w: { x: bx, y: by + bh / 2 },
        };

        for (const [hKey, hCoord] of Object.entries(handles)) {
          if (Math.abs(x - hCoord.x) <= handleSize && Math.abs(y - hCoord.y) <= handleSize) {
            setDragState({
              type: "resize",
              blockId: selectedBlockId,
              startX: x,
              startY: y,
              initialX: bx,
              initialY: by,
              initialW: bw,
              initialH: bh,
              handle: hKey,
            });
            e.stopPropagation();
            return;
          }
        }
      }
    }

    // Check if clicked inside any block
    // Search in reverse zIndex order so top block gets selected
    const sorted = [...renderedBlocks].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    for (const b of sorted) {
      const h = b.calculatedHeight || b.height;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + h) {
        onSelectBlock(b.id);
        if (!b.locked) {
          setDragState({
            type: "move",
            blockId: b.id,
            startX: x,
            startY: y,
            initialX: b.x,
            initialY: b.y,
            initialW: b.width,
            initialH: h,
          });
        }
        e.stopPropagation();
        return;
      }
    }

    // Clicked empty area
    onSelectBlock(null);
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editMode || !dragState) return;
    const { x, y } = clientToCanvasCoord(e.clientX, e.clientY);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;

    if (dragState.type === "move") {
      let targetX = dragState.initialX + dx;
      let targetY = dragState.initialY + dy;

      const guides: { x?: number; y?: number } = {};

      if (snapEnabled) {
        const SNAP_THRESHOLD = 10;
        // Snap to center
        const blockCenterX = targetX + dragState.initialW / 2;
        if (Math.abs(blockCenterX - IMAGE_WIDTH / 2) < SNAP_THRESHOLD) {
          targetX = IMAGE_WIDTH / 2 - dragState.initialW / 2;
          guides.x = IMAGE_WIDTH / 2;
        }

        // Snap to margins
        if (Math.abs(targetX - 56) < SNAP_THRESHOLD) {
          targetX = 56;
          guides.x = 56;
        }
        if (Math.abs(targetX + dragState.initialW - (IMAGE_WIDTH - 56)) < SNAP_THRESHOLD) {
          targetX = IMAGE_WIDTH - 56 - dragState.initialW;
          guides.x = IMAGE_WIDTH - 56;
        }
      }

      setSnapGuides(guides);
      onUpdateBlock(dragState.blockId, {
        x: Math.max(10, Math.min(IMAGE_WIDTH - dragState.initialW - 10, targetX)),
        y: Math.max(20, Math.min(IMAGE_HEIGHT - dragState.initialH - 20, targetY)),
      });
    } else if (dragState.type === "resize") {
      const h = dragState.handle || "se";
      let newW = dragState.initialW;
      let newH = dragState.initialH;
      let newX = dragState.initialX;
      let newY = dragState.initialY;

      if (h.includes("e")) newW = Math.max(160, dragState.initialW + dx);
      if (h.includes("s")) newH = Math.max(40, dragState.initialH + dy);
      if (h.includes("w")) {
        newW = Math.max(160, dragState.initialW - dx);
        newX = dragState.initialX + (dragState.initialW - newW);
      }
      if (h.includes("n")) {
        newH = Math.max(40, dragState.initialH - dy);
        newY = dragState.initialY + (dragState.initialH - newH);
      }

      onUpdateBlock(dragState.blockId, {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
        autoHeight: false, // manual resize turns off auto-height
      });
    }
  };

  // Mouse Up handler
  const handleMouseUp = () => {
    setDragState(null);
    setSnapGuides({});
  };

  const selectedBlock = selectedBlockId ? renderedBlocks.find((b) => b.id === selectedBlockId) : null;
  const selH = selectedBlock ? selectedBlock.calculatedHeight || selectedBlock.height : 0;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center overflow-auto p-4 select-none min-h-[500px]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative shadow-2xl transition-all duration-150 origin-center bg-white"
        style={{
          width: `${Math.round(IMAGE_WIDTH * zoom)}px`,
          height: `${Math.round(IMAGE_HEIGHT * zoom)}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          onMouseDown={handleMouseDown}
          className={`block w-full h-full ${editMode ? "cursor-default" : "cursor-default"}`}
          style={{ imageRendering: "crisp-edges" }}
        />

        {/* Selected Block Overlay & Handles in Edit Mode */}
        {editMode && selectedBlock && (
          <div
            className="absolute pointer-events-none border-2 border-blue-500 ring-4 ring-blue-500/10 rounded-sm"
            style={{
              left: `${selectedBlock.x * zoom}px`,
              top: `${selectedBlock.y * zoom}px`,
              width: `${selectedBlock.width * zoom}px`,
              height: `${selH * zoom}px`,
            }}
          >
            {/* Dimensions Badge */}
            <div className="absolute -top-7 right-0 bg-blue-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
              {selectedBlock.label} · {Math.round(selectedBlock.width)}×{Math.round(selH)}px
            </div>

            {/* Resize Handles (8 handles) */}
            {!selectedBlock.locked && (
              <>
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize pointer-events-auto" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize pointer-events-auto" />
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ns-resize pointer-events-auto" />
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ns-resize pointer-events-auto" />
                <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ew-resize pointer-events-auto" />
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full cursor-ew-resize pointer-events-auto" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
