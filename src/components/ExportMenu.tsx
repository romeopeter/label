import { useState } from "react";
import { Download, Film, Clipboard, ChevronDown, FolderOpen, Save } from "lucide-react";
import { useEditor } from "@/store/editor";
import {
  exportCanvas, copyCanvasToClipboard, downloadProject, openProjectFile,
} from "@/lib/exporters";
import { Badge } from "@/components/ui/badge";
import { KeyBadge } from "@/components/ui/key-badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  onClose: () => void;
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const Row = ({ icon, label, right, onClick, disabled }: RowProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-text transition-colors hover:bg-p-200/[0.06] disabled:opacity-50"
  >
    <span className="flex h-3.5 w-3.5 items-center justify-center text-text-muted">{icon}</span>
    <span className="flex-1">{label}</span>
    {right}
  </button>
);

export const ExportMenu = ({ onClose }: Props) => {
  const [adv, setAdv] = useState(false);
  const [scale, setScale] = useState(2);
  const isPro = useEditor((s) => s.isPro);

  const close = (fn: () => void | Promise<void>) => async () => {
    await fn();
    onClose();
  };

  return (
    <div className="text-text">
      <div className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-p-200">
        EXPORT OPTIONS
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-p-200/[0.06]">
        <input type="checkbox" disabled={!isPro} className="accent-t-400" />
        <span className="flex-1">Remove watermark</span>
        {!isPro && <Badge variant="pro" size="sm" />}
      </label>
      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-p-200/[0.06]">
        <input type="checkbox" disabled={!isPro} className="accent-t-400" />
        <span className="flex-1">Remove background</span>
        {!isPro && <Badge variant="pro" size="sm" />}
      </label>
      <Separator className="my-1.5" />
      <Row icon={<Download className="h-3.5 w-3.5" />} label="Download PNG"
           right={<KeyBadge>⌘E</KeyBadge>}
           onClick={close(() => exportCanvas("png", scale))} />
      <Row icon={<Download className="h-3.5 w-3.5" />} label="Download JPG"
           onClick={close(() => exportCanvas("jpg", scale))} />
      <Row icon={<Download className="h-3.5 w-3.5" />} label="Download WebP"
           onClick={close(() => exportCanvas("webp", scale))} />
      <Separator className="my-1.5" />
      <Row icon={<Film className="h-3.5 w-3.5" />} label="Download GIF"
           right={<Badge variant="pro" size="sm" />} disabled />
      <Row icon={<Film className="h-3.5 w-3.5" />} label="Download MP4"
           right={<Badge variant="pro" size="sm" />} disabled />
      <Separator className="my-1.5" />
      <Row icon={<Clipboard className="h-3.5 w-3.5" />} label="Copy to clipboard"
           right={<KeyBadge>⌘C</KeyBadge>}
           onClick={close(copyCanvasToClipboard)} />
      <Separator className="my-1.5" />
      <Row icon={<Save className="h-3.5 w-3.5" />} label="Save project (.laybel)"
           onClick={close(downloadProject)} />
      <Row icon={<FolderOpen className="h-3.5 w-3.5" />} label="Open project (.laybel)"
           onClick={close(openProjectFile)} />
      <button
        type="button"
        onClick={() => setAdv(!adv)}
        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-p-200 hover:bg-p-200/[0.06]"
      >
        ADVANCE OPTIONS
        <ChevronDown className={"h-3 w-3 transition-transform " + (adv ? "rotate-180" : "")} />
      </button>
      {adv && (
        <div className="flex flex-col gap-1 px-2.5 pb-2">
          <div className="flex items-center justify-between rounded-md bg-chrome/40 px-2 py-1.5 text-xs">
            <span>Scale</span>
            <select
              aria-label="Scale"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="rounded border border-hairline bg-transparent px-1.5 py-0.5 font-mono text-[11px] text-text"
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
