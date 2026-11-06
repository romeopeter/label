import { useEffect, useState, useCallback } from "react";
import { Upload, Minus, Plus, Delete, Command } from "lucide-react";
import { useEditor, ZOOM_MAX, ZOOM_MIN } from "@/store/editor";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { PanelHost } from "@/components/panels";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { GridControl } from "@/components/canvas/GridControl";
import { SocialPreviewModal } from "@/components/SocialPreviewModal";
import { CustomizeSidebarModal } from "@/components/CustomizeSidebarModal";
import { KeyBadge } from "@/components/ui/key-badge";
import { importImageFile } from "@/lib/importers";
import { arrangeLayout, slotAt } from "@/lib/layouts";
import { getStage } from "@/components/canvas/stageRef";
import {
  exportCanvas,
  copyCanvasToClipboard,
  renderCanvasDataURL,
} from "@/lib/exporters";

/* ------------------------------------------------------------------------------------------ */

/** Which layout slot a screen position is over, if any. */
const layoutSlotAt = (clientX: number, clientY: number) => {
  const { layout, elements, canvas } = useEditor.getState();
  const stage = getStage();
  if (!layout || !stage) return null;
  const box = stage.container().getBoundingClientRect();
  const scale = stage.scaleX();
  return slotAt(
    arrangeLayout(layout, elements, canvas),
    (clientX - box.left) / scale,
    (clientY - box.top) / scale,
  );
};

export const App = () => {
  const activeTool = useEditor((s) => s.activeTool);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const addImage = useEditor((s) => s.addImage);
  const elements = useEditor((s) => s.elements);
  const markTool = useEditor((s) => s.markTool);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hiddenTools, setHiddenTools] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);

  const toggleVisible = useCallback((k: string) => {
    setHiddenTools((h) => ({ ...h, [k]: !h[k] }));
  }, []);

  const openPreview = useCallback(async () => {
    setPreviewDataUrl(await renderCanvasDataURL("png", 1));
    setPreviewOpen(true);
  }, []);

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // A colour swatch keeps focus after you pick from it, but takes no typing,
      // so it mustn't swallow shortcuts the way a text field should.
      const inField =
        !!target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            (target as HTMLInputElement).type !== "color"));
      if (inField) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const { undo, redo } = useEditor.getState();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        useEditor.getState().redo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        exportCanvas("png", 2);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (useEditor.getState().selectedIds.length > 0) {
          e.preventDefault();
          copyCanvasToClipboard();
        }
      } else if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        useEditor.getState().toggleGrid();
      } else if (e.key === "Escape") {
        setPreviewOpen(false);
        setCustomizeOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Upload image on drag
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // The first image goes in the slot it was dropped on; the rest fill what's free.
    let slot = layoutSlotAt(e.clientX, e.clientY);
    for (const file of Array.from(e.dataTransfer.files)) {
      if (!file.type.startsWith("image/")) continue;
      const chosen = slot;
      await importImageFile(file, (src, width, height) =>
        chosen === null
          ? addImage(src, width, height)
          : useEditor.getState().fillSlot(chosen, src, width, height),
      );
      slot = null;
    }
  };

  return (
    <div
      className="relative flex h-screen flex-col bg-chrome"
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <TopBar onPreview={openPreview} />

      <div className="flex min-h-0 flex-1">
        <LeftRail hiddenTools={hiddenTools} />

        <aside className="z-10 w-72.5 shrink-0 overflow-y-auto border-r border-hairline bg-panel">
          <PanelHost
            activeTool={activeTool}
            onOpenCustomizeModal={() => setCustomizeOpen(true)}
          />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
          <div className="size-full bg-dot-grid absolute inset-0 bottom-20 flex items-center justify-center">
            <CanvasStage />

            {/* Out of the way once a tool is armed: its icon takes pointer events,
                which would swallow a click or drag starting on it. */}
            {elements.length === 0 && !markTool && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-text-muted">
                <div className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-p-50 text-p-600">
                  <Upload className="h-5.5 w-5.5" />
                </div>

                <div className="font-display text-[18px] font-semibold tracking-[-0.01em] text-gray-100 cursor-pointer!">
                  <span>Drag and drop image to begin</span>
                </div>

                <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
                  paste{" "}
                  <KeyBadge className="border-p-100 bg-p-50 text-p-600">
                    ⌘V
                  </KeyBadge>{" "}
                  from your clipboard
                </div>
              </div>
            )}
          </div>

          {dragOver && (
            <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-p-300 bg-p-600/8 text-sm font-medium text-text" />
          )}

          {/* Zoom buttons */}
          <div className="absolute bottom-23 left-4 z-6 flex items-center gap-1 rounded-lg border border-hairline bg-panel p-1">
            <button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom(zoom - 10)}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-text-muted hover:bg-p-200/10 hover:text-text disabled:pointer-events-none disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>

            <span className="min-w-8 px-1 text-center font-mono text-[11px] text-text">
              {zoom}%
            </span>

            <button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom(zoom + 10)}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-text-muted hover:bg-p-200/10 hover:text-text disabled:pointer-events-none disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>

            {/* View aids live with zoom: both describe how you're looking at
                the canvas, and neither appears in an export. */}
            <div className="mx-0.5 h-4.5 w-px bg-hairline" />
            <GridControl />
          </div>

          {/* Paste, Export and Delete */}
          <div className="absolute bottom-23 right-4 z-6 flex items-center gap-3.5 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-[10.5px] text-text-faint">
              <KeyBadge className="size-fit px-1.5 py-0.5">
                <div className="text-[10.5px] flex items-center justify-center">
                  <Command size={10.5} />V
                </div>
              </KeyBadge>{" "}
              paste
              <KeyBadge className="size-fit px-1.5 py-0.5">
                <div className="text-[10.5px] flex items-center justify-center">
                  <Command size={10.5} />E
                </div>
              </KeyBadge>{" "}
              export
              <KeyBadge className="size-fit px-1.5 py-0.5">
                <div className="text-[10.5px] flex item-center justify-center">
                  <Delete size={10.5} />
                </div>
              </KeyBadge>{" "}
              delete
            </div>
          </div>
        </main>
      </div>

      <SocialPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewDataUrl={previewDataUrl}
      />

      <CustomizeSidebarModal
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        hiddenTools={hiddenTools}
        toggleVisible={toggleVisible}
      />
    </div>
  );
};
