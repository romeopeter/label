import type { ReactNode } from "react";
import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  Circle as CircleIcon,
  Copy,
  Eye,
  GripVertical,
  Hash,
  Highlighter,
  Image,
  Lock,
  LucideSpline as Line,
  MessageCircle,
  Pencil,
  PenLine,
  Plus,
  PlusSquare,
  QrCode,
  Smile,
  Square as SquareIcon,
  Trash2,
  Type,
} from "lucide-react";
import { useEditor } from "@/store/editor";
import type { ShapeElement, ShapeKind } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ColorRow,
  LabeledSlider,
  PanelDesc,
  PanelHelp,
  PanelTitle,
  SectionLabel,
  SwitchRow,
} from "./primitives";

/* ------------------------------------------------------------------------------------------- */

const ITEMS: {
  icon: ReactNode;
  label: string;
  action: "shape" | "text" | "image" | "vector" | "other";
  shape?: ShapeKind;
  variant?: "heading" | "body";
}[] = [
  {
    icon: <Type className="h-4 w-4" />,
    label: "Text",
    action: "text",
    variant: "heading",
  },
  {
    icon: <SquareIcon className="h-4 w-4" />,
    label: "Rectangle",
    action: "shape",
    shape: "rect",
  },
  {
    icon: <CircleIcon className="h-4 w-4" />,
    label: "Ellipse",
    action: "shape",
    shape: "ellipse",
  },
  {
    icon: <ArrowUpRight className="h-4 w-4" />,
    label: "Arrow",
    action: "shape",
    shape: "arrow",
  },
  {
    icon: <Line className="h-4 w-4" />,
    label: "Line",
    action: "shape",
    shape: "line",
  },
  {
    icon: <Highlighter className="h-4 w-4" />,
    label: "Highlight",
    action: "shape",
    shape: "highlight",
  },
  {
    icon: <MessageCircle className="h-4 w-4" />,
    label: "Callout",
    action: "shape",
    shape: "callout",
  },
  {
    icon: <QrCode className="h-4 w-4" />,
    label: "QR Code",
    action: "shape",
    shape: "qr-code",
  },
  {
    icon: <Smile className="h-4 w-4" />,
    label: "Emoji",
    action: "vector",
    shape: "vector",
  },
  {
    icon: <Image className="h-4 w-4" />,
    label: "Image",
    action: "image",
    shape: "image",
  },
  {
    icon: <Pencil className="h-4 w-4" />,
    label: "Draw",
    action: "shape",
    shape: "pencil",
  },
  {
    icon: <Hash className="size-4" />,
    label: "Number",
    action: "shape",
    shape: "number",
  },
  {
    icon: <BadgeCheck className="size-4.5" />,
    label: "Badge",
    action: "other",
    shape: "other",
  },
  {
    icon: <PlusSquare className="size-4.5" />,
    label: "Icons",
    action: "image",
    shape: "image",
  },
];

const SHAPE_LABELS: Partial<Record<ShapeKind, string>> = {
  rect: "Rectangle",
  "rounded-rect": "Rounded",
  ellipse: "Circle",
  arrow: "Arrow",
  line: "Line",
  highlight: "Highlight",
  callout: "Callout",
  "qr-code": "QR Code",
  pencil: "Draw",
  number: "Number",
};

const ANNOTATION_SHAPES = new Set<ShapeKind>([
  "rect",
  "rounded-rect",
  "ellipse",
  "arrow",
  "line",
  "highlight",
  "callout",
  "qr-code",
  "pencil",
  "number",
]);

const shapeName = (shape: ShapeKind) => SHAPE_LABELS[shape] ?? shape;

const AnnotationGrid = ({
  onPick,
  className,
}: {
  onPick: (item: (typeof ITEMS)[number]) => void;
  className?: string;
}) => (
  <div className={cn("grid grid-cols-5 gap-1", className)}>
    {ITEMS.map((it) => (
      <button
        key={it.label}
        type="button"
        onClick={() => onPick(it)}
        className="group flex cursor-pointer flex-col items-center gap-1 rounded-md px-0.5 py-2 text-[9.5px] text-text-muted transition-colors hover:bg-p-200/10 hover:text-text [&:hover_.annot-ic]:text-t-400"
      >
        <span className="annot-ic flex h-[30px] w-[30px] items-center justify-center rounded-md bg-p-50/[0.04]">
          {it.icon}
        </span>
        <span className="leading-none">{it.label}</span>
      </button>
    ))}
  </div>
);

const LayerIconButton = ({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    className="flex h-5 w-5 items-center justify-center rounded text-text-faint transition-colors hover:bg-p-200/10 hover:text-text"
  >
    {children}
  </button>
);

const AnnotationLayerRow = ({
  annotation,
  index,
  active,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  annotation: ShapeElement;
  index: number;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "grid h-11 w-full grid-cols-[18px_24px_1fr_auto] items-center gap-1.5 rounded-md border px-2 text-left text-[11px] transition-colors",
      active
        ? "border-p-300 bg-p-200/10 text-text"
        : "border-hairline bg-chrome/40 text-text-muted hover:border-p-300/70 hover:text-text",
    )}
  >
    <GripVertical className="h-3.5 w-3.5 text-text-faint" />
    <span className="font-mono text-[10px] text-text-faint">{index + 1}.</span>
    <span className="truncate font-semibold uppercase tracking-[0.04em]">
      {shapeName(annotation.shape)}
    </span>
    <span className="flex items-center gap-0.5">
      <LayerIconButton label="Lock">
        <Lock className="h-3.5 w-3.5" />
      </LayerIconButton>
      <LayerIconButton label="Visibility">
        <Eye className="h-3.5 w-3.5" />
      </LayerIconButton>
      <LayerIconButton label="Duplicate" onClick={onDuplicate}>
        <Copy className="h-3.5 w-3.5" />
      </LayerIconButton>
      <LayerIconButton label="Delete" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </LayerIconButton>
    </span>
  </button>
);

const AnnotationStyleControls = ({
  annotation,
  onChange,
}: {
  annotation: ShapeElement;
  onChange: (patch: Partial<ShapeElement>) => void;
}) => {
  const canUseFill = annotation.shape !== "arrow" && annotation.shape !== "line";
  const canUseCorner =
    annotation.shape === "rect" ||
    annotation.shape === "rounded-rect" ||
    annotation.shape === "highlight" ||
    annotation.shape === "callout";

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 pb-6 pt-4">
      <SectionLabel>STYLE</SectionLabel>
      {canUseFill && (
        <>
          <ColorRow
            label="Fill"
            value={annotation.fill}
            onChange={(fill) => onChange({ fill })}
          />
          <LabeledSlider
            label="Opacity"
            unit="%"
            min={0}
            max={100}
            value={Math.round(annotation.opacity * 100)}
            onChange={(value) => onChange({ opacity: value / 100 })}
          />
        </>
      )}

      <SectionLabel>STROKE</SectionLabel>
      <ColorRow
        label="Stroke"
        value={annotation.stroke}
        onChange={(stroke) => onChange({ stroke })}
      />
      <LabeledSlider
        label="Width"
        unit="px"
        min={0}
        max={32}
        value={annotation.strokeWidth}
        onChange={(strokeWidth) => onChange({ strokeWidth })}
      />
      <SwitchRow
        label="Dashed"
        checked={annotation.dashed}
        onCheckedChange={(dashed) => onChange({ dashed })}
      />

      {annotation.shape === "arrow" && (
        <LabeledSlider
          label="Arrow head"
          unit="px"
          min={8}
          max={48}
          value={annotation.arrowHeadSize ?? 18}
          onChange={(arrowHeadSize) => onChange({ arrowHeadSize })}
        />
      )}

      {canUseCorner && (
        <LabeledSlider
          label="Corner"
          unit="px"
          min={0}
          max={120}
          value={annotation.cornerRadius}
          onChange={(cornerRadius) => onChange({ cornerRadius })}
        />
      )}

      {annotation.shape === "callout" && (
        <>
          <SectionLabel>CONTENT</SectionLabel>
          <input
            aria-label="Callout text"
            value={annotation.text ?? ""}
            onChange={(event) => onChange({ text: event.target.value })}
            className="h-8 rounded-md border border-hairline bg-chrome/40 px-2.5 text-xs text-text outline-none focus:border-p-500"
          />
        </>
      )}
    </div>
  );
};

export const AnnotationPanel = () => {
  const [addOpen, setAddOpen] = useState(false);
  const addText = useEditor((s) => s.addText);
  const addShape = useEditor((s) => s.addShape);
  const elements = useEditor((s) => s.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const selectElement = useEditor((s) => s.selectElement);
  const updateElement = useEditor((s) => s.updateElement);
  const deleteElement = useEditor((s) => s.deleteElement);
  const duplicateElement = useEditor((s) => s.duplicateElement);

  const annotations = elements.filter(
    (element): element is ShapeElement =>
      element.type === "shape" && ANNOTATION_SHAPES.has(element.shape),
  );
  const selectedAnnotation =
    annotations.find((annotation) => selectedIds.includes(annotation.id)) ??
    annotations[0];
  const hasAnnotations = annotations.length > 0;

  const pickAnnotation = (item: (typeof ITEMS)[number]) => {
    if (item.action === "text" && item.variant) addText(item.variant);
    if (item.action === "shape" && item.shape) addShape(item.shape);
    setAddOpen(false);
  };

  const removeAnnotation = (id: string) => {
    deleteElement(id);
    const next = annotations.find((annotation) => annotation.id !== id);
    if (next) {
      selectElement(next.id);
    } else {
      setAddOpen(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <PanelTitle className="mb-0">
          <div className="flex items-center gap-1">
            <PenLine className="h-4.5 w-4.5" />
            <span>ANNOTATION</span>
          </div>
        </PanelTitle>
        {hasAnnotations && (
          <div className="relative">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-md px-3"
              onClick={() => setAddOpen(!addOpen)}
            >
              Add <Plus className="h-3.5 w-3.5" />
            </Button>
            {addOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-lg border border-hairline-strong bg-panel p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-p-200">
                    Add annotation
                  </span>
                  <button
                    type="button"
                    className="text-[10px] text-text-faint hover:text-text"
                    onClick={() => setAddOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <AnnotationGrid
                  onPick={pickAnnotation}
                  className="grid-cols-4"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {!hasAnnotations ? (
        <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
          <SectionLabel>ADD ANNOTATION</SectionLabel>
          <AnnotationGrid onPick={pickAnnotation} />
          <PanelHelp>
            Click to add — then drag, resize, or double-click text to edit.
          </PanelHelp>
        </div>
      ) : (
        <>
          <div className="px-4 pb-4 pt-3">
            <SectionLabel
              right={<ChevronDown className="h-3.5 w-3.5 text-text-faint" />}
            >
              LAYERS
            </SectionLabel>
            <div className="flex flex-col gap-1.5">
              {annotations.map((annotation, index) => (
                <AnnotationLayerRow
                  key={annotation.id}
                  annotation={annotation}
                  index={index}
                  active={annotation.id === selectedAnnotation?.id}
                  onSelect={() => selectElement(annotation.id)}
                  onDuplicate={() => duplicateElement(annotation.id)}
                  onDelete={() => removeAnnotation(annotation.id)}
                />
              ))}
            </div>
          </div>

          {selectedAnnotation ? (
            <AnnotationStyleControls
              annotation={selectedAnnotation}
              onChange={(patch) => updateElement(selectedAnnotation.id, patch)}
            />
          ) : (
            <div className="border-t border-border px-4 py-4">
              <PanelDesc>Select an annotation layer to edit it.</PanelDesc>
            </div>
          )}
        </>
      )}

    </div>
  );
};
