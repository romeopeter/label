import { useState } from "react";
import { Undo, Redo, Eye, ChevronDown, Download } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { hasOverlayTitleBar } from "@/lib/host";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CanvasSizePicker } from "./CanvasSizePicker";
import { ExportMenu } from "./ExportMenu";

/* ------------------------------------------------------------------------------------------------ */

interface Props {
  onPreview: () => void;
}

export const TopBar = ({ onPreview }: Props) => {
  const canvas = useEditor((s) => s.canvas);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header
      data-tauri-drag-region
      className="relative z-30 grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-hairline bg-chrome px-3"
    >
      {/* LEFT */}
      <div
        data-tauri-drag-region
        className={cn("flex items-center gap-2.5", hasOverlayTitleBar && "pl-18")}
      >
        <div
          data-tauri-drag-region
          className="flex select-none items-center gap-2 px-1.5 py-1"
        >
          <img
            src="/icons/logo.svg"
            alt="Layer logo"
            draggable={false}
            className="pointer-events-none h-5 w-5.5"
          />
          <span className="pointer-events-none font-display text-base font-bold tracking-[-0.01em] text-text">
            Layer
          </span>
        </div>
      </div>

      {/* CENTER */}
      <div data-tauri-drag-region className="relative flex justify-center">
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-panel p-1">
          <Button
            variant="icon"
            size="iconSm"
            title="Undo (⌘Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="icon"
            size="iconSm"
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-0.5 h-4.5 w-px bg-hairline" />
          <Button
            variant="icon"
            size="iconSm"
            title="Preview"
            onClick={onPreview}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-0.5 h-4.5 w-px bg-hairline" />
          <Popover open={sizePickerOpen} onOpenChange={setSizePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-medium tabular-nums text-text transition-colors hover:bg-p-200/8 data-[state=open]:bg-p-200/8"
              >
                <span className="font-mono text-[11.5px]">
                  {canvas.width} × {canvas.height} px
                </span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-205 max-w-[calc(100vw-32px)] p-0"
              sideOffset={6}
            >
              <CanvasSizePicker onClose={() => setSizePickerOpen(false)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* RIGHT */}
      <div
        data-tauri-drag-region
        className="relative flex items-center justify-end gap-2"
      >
        {/* <Button variant="ghost" size="sm" className="cursor-pointer">Save as Template</Button> */}

        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={exportOpen ? "active" : "primary"}
              size="sm"
              className="cursor-pointer"
            >
              <Download className="h-3 w-3" /> Export
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-72 p-2">
            <ExportMenu onClose={() => setExportOpen(false)} />
          </PopoverContent>
        </Popover>

        {/* <button
          type="button"
          title="Notifications"
          className="relative flex h-6.5 w-6.5 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-p-200/10 hover:text-text"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="bell-dot" />
        </button> */}

        {/* <Button variant="teal" size="sm">
          Sign In <ArrowRight className="h-3 w-3" />
        </Button> */}
      </div>
    </header>
  );
};
