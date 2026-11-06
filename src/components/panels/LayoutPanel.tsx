import { useRef } from "react";
import { LayoutPanelLeft, Maximize, Upload, Paintbrush } from "lucide-react";
import { useEditor } from "@/store/editor";
import type { CanvasLayout, LayoutAlign, LayoutId } from "@/types";
import { cn } from "@/lib/utils";
import { importImageFile } from "@/lib/importers";
import {
  arrangeLayout,
  layoutOf,
  LAYOUTS,
  newLayout,
} from "@/lib/layouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LabeledSlider,
  Linebreak,
  PanelDesc,
  PanelHelp,
  PanelTitle,
  SectionLabel,
  SwitchRow,
} from "./primitives";
import { choiceClass } from "./choice";

const PREVIEW = { width: 44, height: 32 };

/* Drawn with the real layout maths, so a preview can't drift from the result. */
const previewOf = (id: LayoutId) => {
  const layout: CanvasLayout = {
    ...newLayout(id, null),
    scale: 100,
    spacing: id === "side" || id === "stacked" ? 40 : 30,
    showLabels: false,
  };
  return arrangeLayout(layout, [], PREVIEW);
};

const PREVIEWS = LAYOUTS.map((layout) => ({ layout, preview: previewOf(layout.id) }));

const LayoutPreview = ({ id }: { id: LayoutId }) => {
  const entry = PREVIEWS.find(({ layout }) => layout.id === id);
  if (!entry) return null;
  return (
    <svg viewBox={`0 0 ${PREVIEW.width} ${PREVIEW.height}`} className="h-8 w-11" aria-hidden>
      {entry.preview.slots.map((slot, i) => (
        <rect
          key={i}
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          rx={1.5}
          transform={slot.rotation ? `rotate(${slot.rotation} ${slot.x} ${slot.y})` : undefined}
          className="fill-primary/25 stroke-primary"
          strokeWidth={0.8}
        />
      ))}
      {entry.preview.decor.map((item, i) => {
        if (item.kind === "verdict") {
          return (
            <circle
              key={i}
              cx={item.x}
              cy={Math.max(item.y, 2.5)}
              r={2.5}
              className={item.good ? "fill-primary" : "fill-destructive"}
            />
          );
        }
        if (item.kind === "arrow") {
          const [x0, y0, cx, cy, x1, y1] = item.points;
          return (
            <path
              key={i}
              d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`}
              fill="none"
              className="stroke-text-muted"
              strokeWidth={1}
            />
          );
        }
        return null;
      })}
    </svg>
  );
};

const Tile = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border p-1.5 text-center text-[9.5px] leading-tight transition-colors hover:text-text",
      choiceClass(active),
      active ? "text-text" : "text-text-muted",
    )}
  >
    {children}
    <span>{label}</span>
  </button>
);

export const LayoutPanel = () => {
  const layout = useEditor((s) => s.layout);
  const selectedIds = useEditor((s) => s.selectedIds);
  const setLayout = useEditor((s) => s.setLayout);
  const updateLayout = useEditor((s) => s.updateLayout);
  const addImage = useEditor((s) => s.addImage);
  const fitCanvasToLayout = useEditor((s) => s.fitCanvasToLayout);
  const matchLayoutStyle = useEditor((s) => s.matchLayoutStyle);
  const fileRef = useRef<HTMLInputElement>(null);

  const def = layout ? layoutOf(layout.id) : undefined;
  const filled = layout?.slots.filter((slot) => slot.id) ?? [];
  const free = (layout?.slots.length ?? 0) - filled.length;
  const fixedSlots = def?.kind === "grid";
  // The selected image, or the first in the layout when nothing in it is selected.
  const styleSource = filled.find((slot) => slot.id && selectedIds.includes(slot.id))?.id ?? filled[0]?.id;

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    for (const file of Array.from(input.files ?? [])) {
      await importImageFile(file, addImage);
    }
    input.value = "";
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex flex-col gap-2">
        <PanelTitle>
          <div className="flex items-center gap-1">
            <span>LAYOUT</span> <LayoutPanelLeft className="h-4.5 w-4.5" />
          </div>
        </PanelTitle>
        <PanelDesc>Put images together. They arrange themselves.</PanelDesc>
      </div>

      <div className="space-y-2">
        <SectionLabel>PICK A LAYOUT</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          <Tile label="None" active={!layout} onClick={() => setLayout(null)} />
          {LAYOUTS.map(({ id, label }) => (
            <Tile key={id} label={label} active={layout?.id === id} onClick={() => setLayout(id)}>
              <LayoutPreview id={id} />
            </Tile>
          ))}
        </div>
      </div>

      {layout && (
        <>
          <Linebreak />

          <div className="flex flex-col gap-2">
            <SectionLabel>IMAGES</SectionLabel>
            <PanelHelp>
              {free > 0
                ? `${filled.length} of ${layout.slots.length} filled. Add images, or click an empty slot on the canvas.`
                : "Drag one image onto another to swap them."}
            </PanelHelp>
            {free > 0 && (
              <>
                <Button variant="ghost" size="block" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3" /> Add images
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={onPick}
                  aria-label="Add images to layout"
                />
              </>
            )}
          </div>

          <Linebreak />

          <div className="flex flex-col gap-3">
            <SectionLabel>LAYOUT SETTINGS</SectionLabel>
            <ToggleGroup
              type="single"
              value={layout.align}
              onValueChange={(align) => align && updateLayout({ align: align as LayoutAlign })}
              className="w-full"
            >
              <ToggleGroupItem value="start" className="cursor-pointer">Start</ToggleGroupItem>
              <ToggleGroupItem value="center" className="cursor-pointer">Center</ToggleGroupItem>
              <ToggleGroupItem value="end" className="cursor-pointer">End</ToggleGroupItem>
            </ToggleGroup>
            <LabeledSlider
              label="SPACING"
              unit="%"
              value={layout.spacing}
              onChange={(spacing) => updateLayout({ spacing })}
            />
            <LabeledSlider
              label="SCALE"
              unit="%"
              min={30}
              max={100}
              value={layout.scale}
              onChange={(scale) => updateLayout({ scale })}
            />
            {!fixedSlots && (
              <SwitchRow
                label="SAME WIDTH"
                checked={layout.sameWidth}
                onCheckedChange={(sameWidth) => updateLayout({ sameWidth })}
              />
            )}
            <SwitchRow
              label="SAME SHAPE"
              description="Trims images to fit. Drag a picture to choose what shows."
              checked={layout.sameShape}
              onCheckedChange={(sameShape) => updateLayout({ sameShape })}
            />
          </div>

          {def?.labels && (
            <>
              <Linebreak />
              <div className="flex flex-col gap-2">
                <SwitchRow
                  label="LABELS"
                  checked={layout.showLabels}
                  onCheckedChange={(showLabels) => updateLayout({ showLabels })}
                />
                {layout.showLabels &&
                  layout.labels.map((text, i) => (
                    <Input
                      key={i}
                      aria-label={`Label ${i + 1}`}
                      value={text}
                      onChange={(event) =>
                        updateLayout({
                          labels: layout.labels.map((label, at) =>
                            at === i ? event.target.value : label,
                          ),
                        })
                      }
                    />
                  ))}
              </div>
            </>
          )}

          <Linebreak />

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="block"
              className="cursor-pointer"
              disabled={filled.length < 2 || !styleSource}
              onClick={() => styleSource && matchLayoutStyle(styleSource)}
            >
              <Paintbrush className="h-3 w-3" /> Apply style to images
            </Button>
            <PanelHelp>
              {filled.length < 2
                ? "Add two or more images to the layout to share a style."
                : !styleSource
                  ? "Select an image in the layout, then apply its style to the rest."
                  : "Gives every image the selected one's shadow, corners, border and frame."}
            </PanelHelp>
            <Button
              variant="outline"
              size="block"
              className="cursor-pointer"
              disabled={!filled.length}
              onClick={fitCanvasToLayout}
            >
              <Maximize className="h-3 w-3" /> Fit canvas to layout
            </Button>
            <PanelHelp>
              {filled.length
                ? "Resizes the canvas around the images, with even padding."
                : "Add images to the layout, then fit the canvas around them."}
            </PanelHelp>
          </div>
        </>
      )}
    </div>
  );
};
