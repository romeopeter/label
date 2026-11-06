import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";
import { useEditor } from "@/store/editor";
import { cn } from "@/lib/utils";
import { PanelTitle, SectionLabel, LabeledSlider, PanelDesc } from "./primitives";
import { choiceClass } from "./choice";

/** The nine places, left to right and top to bottom, each pointing where it sends the layer. */
const PLACES = [
  { label: "Top left", icon: ArrowUpLeft },
  { label: "Top", icon: ArrowUp },
  { label: "Top right", icon: ArrowUpRight },
  { label: "Left", icon: ArrowLeft },
  { label: "Center", icon: CircleDot },
  { label: "Right", icon: ArrowRight },
  { label: "Bottom left", icon: ArrowDownLeft },
  { label: "Bottom", icon: ArrowDown },
  { label: "Bottom right", icon: ArrowDownRight },
];

/* ---------------------------------------------------------------------------------------------- */

export const PositionPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const update = useEditor((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedIds[0]);
  const inLayout = useEditor((s) => !!s.layout?.slots.some((slot) => slot.id === el?.id));

  if (!el) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>POSITION</PanelTitle>
        <PanelDesc>
          Select an element to adjust its position and scale.
        </PanelDesc>
      </div>
    );
  }

  if (inLayout) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>POSITION</PanelTitle>
        <PanelDesc>
          This image's place comes from its layout. Choose None in Layout to move it freely.
        </PanelDesc>
      </div>
    );
  }

  const placeOf = (h: number, v: number) => ({
    x: (h * (canvas.width - el.width)) / 2,
    y: (v * (canvas.height - el.height)) / 2,
  });
  /** Where the layer already sits, so that place shows as chosen. */
  const isAt = (h: number, v: number) => {
    const place = placeOf(h, v);
    return Math.abs(el.x - place.x) < 0.5 && Math.abs(el.y - place.y) < 0.5;
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>POSITION</PanelTitle>
      <PanelDesc>Move the selected layer to an edge, a corner or the center, or set X and Y.</PanelDesc>

      <div className="grid w-full grid-cols-3 gap-1.5">
        {PLACES.map(({ label, icon: Icon }, i) => {
          const h = i % 3;
          const v = Math.floor(i / 3);
          const here = isAt(h, v);
          return (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={here}
              onClick={() => update(el.id, placeOf(h, v))}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-md border bg-chrome/50 transition-colors hover:text-text",
                choiceClass(here),
                here ? "text-text" : "text-text-muted",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <SectionLabel>POSITION</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">
            X
          </span>
          <input
            aria-label="X"
            value={Math.round(el.x)}
            onChange={(e) => update(el.id, { x: Number(e.target.value) || 0 })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">
            Y
          </span>
          <input
            aria-label="Y"
            value={Math.round(el.y)}
            onChange={(e) => update(el.id, { y: Number(e.target.value) || 0 })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
      </div>

      <SectionLabel>SIZE</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">
            W
          </span>
          <input
            aria-label="Width"
            value={Math.round(el.width)}
            onChange={(e) =>
              update(el.id, {
                width: Math.max(10, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">
            H
          </span>
          <input
            aria-label="Height"
            value={Math.round(el.height)}
            onChange={(e) =>
              update(el.id, {
                height: Math.max(10, Number(e.target.value) || 0),
              })
            }
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
      </div>

      <LabeledSlider
        label="ROTATION"
        unit="°"
        min={-180}
        max={180}
        value={Math.round(el.rotation)}
        onChange={(v) => update(el.id, { rotation: v })}
      />
      <LabeledSlider
        label="OPACITY"
        unit="%"
        max={100}
        value={Math.round(el.opacity * 100)}
        onChange={(v) => update(el.id, { opacity: v / 100 })}
      />

    </div>
  );
};
