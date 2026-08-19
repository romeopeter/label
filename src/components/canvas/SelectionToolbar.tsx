import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Crop,
  Highlighter,
  Layers,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Scan,
  Trash2,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ImageElement, LaybelElement, TextElement } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------------ */

interface SelectionToolbarProps {
  element: LaybelElement;
  position: { x: number; y: number };
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayerForward: () => void;
  onLayerBackward: () => void;
  onTextChange: (patch: Partial<TextElement>) => void;
  onOpenTextPanel: () => void;
}

/* ------------------------------------------------------------------------------ */

const toolButtonClass =
  "h-7 max-h-7 min-h-7 w-fit rounded-md border border-transparent p-1 text-text-muted hover:border-hairline-strong hover:bg-p-200/10 hover:text-text cursor-pointer";

const ToolbarButton = ({
  label,
  children,
  onClick,
  active,
  className,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) => (
  <Button
    type="button"
    variant="icon"
    size="icon"
    aria-label={label}
    title={label}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={cn(
      toolButtonClass,
      active && "bg-t-100/10 text-t-100",
      className,
    )}
  >
    {children}
  </Button>
);

const Divider = () => <div className="h-5 max-h-5 w-px shrink-0 bg-border" />;

const MoreMenu = ({
  onDuplicate,
  onLayerForward,
  onLayerBackward,
  onDelete,
}: Pick<
  SelectionToolbarProps,
  "onDuplicate" | "onLayerForward" | "onLayerBackward" | "onDelete"
>) => (
  <div className="absolute right-0 top-[calc(100%+10px)] z-10 h-auto min-w-38 overflow-hidden rounded-md border border-hairline-strong bg-panel py-1 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[11.5px] text-text-muted hover:bg-p-200/10 hover:text-text"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDuplicate}
    >
      <Copy className="h-3.5 w-3.5" /> Duplicate
    </button>
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[11.5px] text-text-muted hover:bg-p-200/10 hover:text-text"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onLayerForward}
    >
      <Layers className="h-3.5 w-3.5" /> Bring forward
    </button>
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[11.5px] text-text-muted hover:bg-p-200/10 hover:text-text"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onLayerBackward}
    >
      <Layers className="h-3.5 w-3.5" /> Send backward
    </button>
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[11.5px] text-red-300 hover:bg-red-500/10 hover:text-red-200"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDelete}
    >
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </button>
  </div>
);

const ImageToolbar = ({
  element,
  moreOpen,
  onMoreOpenChange,
  onDelete,
  onDuplicate,
  onLayerForward,
  onLayerBackward,
}: SelectionToolbarProps) => {
  const image = element as ImageElement;

  return (
    <div className="w-fit flex items-center gap-2.5">
      <ToolbarButton label="Crop">
        <Crop className="h-3.5 w-3.5" /> Crop
      </ToolbarButton>

      <ToolbarButton label="Highlight">
        <Highlighter className="h-3.5 w-3.5" /> Highlight
      </ToolbarButton>

      <ToolbarButton label="Padding" active={image.deviceFrame != null}>
        <Scan className="h-3.5 w-3.5" /> Padding
      </ToolbarButton>

      <ToolbarButton label="Delete" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </ToolbarButton>

      <div className="relative">
        <ToolbarButton
          label="More options"
          active={moreOpen}
          onClick={() => onMoreOpenChange(!moreOpen)}
        >
          <MoreVertical className="h-4 w-4" />
        </ToolbarButton>

        {moreOpen && (
          <MoreMenu
            onDuplicate={onDuplicate}
            onLayerForward={onLayerForward}
            onLayerBackward={onLayerBackward}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
};

const TextToolbar = ({
  element,
  moreOpen,
  onMoreOpenChange,
  onDelete,
  onDuplicate,
  onLayerForward,
  onLayerBackward,
  onTextChange,
  onOpenTextPanel,
}: SelectionToolbarProps) => {
  const text = element as TextElement;
  const setAlign = (align: TextElement["align"]) => onTextChange({ align });

  return (
    <>
      <ToolbarButton label="Edit text" onClick={onOpenTextPanel}>
        <Pencil className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        label="Bold"
        active={text.fontWeight >= 700}
        onClick={() =>
          onTextChange({ fontWeight: text.fontWeight >= 700 ? 400 : 700 })
        }
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Align left"
        active={text.align === "left"}
        onClick={() => setAlign("left")}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={text.align === "center"}
        onClick={() => setAlign("center")}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={text.align === "right"}
        onClick={() => setAlign("right")}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Decrease font size"
        onClick={() =>
          onTextChange({ fontSize: Math.max(8, text.fontSize - 4) })
        }
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="min-w-7 text-center font-mono text-[10.5px] text-text-muted">
        {Math.round(text.fontSize)}
      </span>
      <ToolbarButton
        label="Increase font size"
        onClick={() =>
          onTextChange({ fontSize: Math.min(300, text.fontSize + 4) })
        }
      >
        <Plus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <label
        title="Text color"
        className="relative flex h-7 max-h-7 min-h-7 w-7 min-w-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-transparent hover:border-hairline-strong hover:bg-p-200/10"
        onMouseDown={(event) => event.preventDefault()}
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-white/25"
          style={{ backgroundColor: text.fill }}
        />
        <input
          aria-label="Text color"
          type="color"
          value={text.fill}
          onChange={(event) => onTextChange({ fill: event.target.value })}
          className="absolute left-0 top-0 h-7 max-h-7 min-h-7 w-7 min-w-7 cursor-pointer opacity-0"
        />
      </label>

      <div className="relative">
        <ToolbarButton
          label="More options"
          active={moreOpen}
          onClick={() => onMoreOpenChange(!moreOpen)}
        >
          <MoreVertical className="h-4 w-4" />
        </ToolbarButton>

        {moreOpen && (
          <MoreMenu
            onDuplicate={onDuplicate}
            onLayerForward={onLayerForward}
            onLayerBackward={onLayerBackward}
            onDelete={onDelete}
          />
        )}
      </div>
    </>
  );
};

export const SelectionToolbar = (props: SelectionToolbarProps) => {
  const [showToolBar, setShowToolBar] = useState(false);
  const { element, position } = props;

  if (element.type !== "image" && element.type !== "text") return null;

  const removeToolBar = () => setShowToolBar(!showToolBar);

  return (
    <div
      className={`w-auto pointer-events-auto absolute z-20 flex h-10 
        max-h-12.5 min-h-10 items-center gap-1 overflow-visible rounded-lg 
        border border-hairline-strong bg-panel/95 p-1 shadow-[0_16px_45px_rgba(0,0,0,0.45)] 
        backdrop-blur ${showToolBar ? "hidden" : "block"}`}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {element.type === "image" ? (
        <ImageToolbar {...props} />
      ) : (
        <TextToolbar {...props} />
      )}

      <Divider />

      <ToolbarButton label="Remove toolbar" onClick={removeToolBar}>
        <X className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
};
