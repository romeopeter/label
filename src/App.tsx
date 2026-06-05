import { useEffect, useState, useCallback } from "react";
import { Upload, Minus, Plus, Delete, Command } from "lucide-react";
import { useEditor } from "@/store/editor";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { PanelHost } from "@/components/panels";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { SocialPreviewModal } from "@/components/SocialPreviewModal";
import { CustomizeSidebarModal } from "@/components/CustomizeSidebarModal";
import { KeyBadge } from "@/components/ui/key-badge";
import { importImageFile } from "@/lib/importers";
import {
  exportCanvas,
  copyCanvasToClipboard,
  renderCanvasDataURL,
} from "@/lib/exporters";

/* ------------------------------------------------------------------------------------------ */

export const App = () => {
  const activeTool = useEditor((s) => s.activeTool);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const addImage = useEditor((s) => s.addImage);
  const elements = useEditor((s) => s.elements);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hiddenTools, setHiddenTools] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);

  const toggleVisible = useCallback((k: string) => {
    setHiddenTools((h) => ({ ...h, [k]: !h[k] }));
  }, []);

  const openPreview = useCallback(() => {
    setPreviewDataUrl(renderCanvasDataURL("png", 1));
    setPreviewOpen(true);
  }, []);

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      const inField =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (inField) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        exportCanvas("png", 2);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (useEditor.getState().selectedIds.length > 0) {
          e.preventDefault();
          copyCanvasToClipboard();
        }
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
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith("image/")) await importImageFile(file, addImage);
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

        <aside className="z-10 w-72.5 shrink-0 overflow-y-auto border-r border-hairline bg-panel scrollbar-thin">
          <PanelHost
            activeTool={activeTool}
            onOpenCustomizeModal={() => setCustomizeOpen(true)}
          />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
          <div className="size-full bg-dot-grid absolute inset-0 bottom-20 flex items-center justify-center">
            <CanvasStage />

            {elements.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-text-muted">
                <div className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-p-50 text-p-600">
                  <Upload className="h-5.5 w-5.5" />
                </div>

                <div className="font-display text-[18px] font-semibold tracking-[-0.01em] text-gray-100 cursor-pointer!">
                  <span>Drag image to drop</span>
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
              onClick={() => setZoom(zoom - 10)}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-text-muted hover:bg-p-200/10 hover:text-text"
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
              onClick={() => setZoom(zoom + 10)}
              className="flex h-6 w-6 items-center justify-center rounded text-sm text-text-muted hover:bg-p-200/10 hover:text-text"
            >
              <Plus className="h-3 w-3" />
            </button>
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
