import { useEditor } from "@/store/editor";
import type { ImageElement, ShapeElement } from "@/types";
import { cn } from "@/lib/utils";
import { PanelTitle, SectionLabel, LabeledSlider, ColorRow, PanelDesc, PanelHelp } from "./primitives";
import { Linebreak } from "./primitives";
import { choiceClass } from "./choice";

/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * Corners as a share of the shorter side, so a preset looks the same on any size
 * of image. Full makes the short sides fully round.
 */
const CORNER_PRESETS = [
  { name: "Square", share: 0 },
  { name: "Slight", share: 0.03 },
  { name: "Soft", share: 0.06 },
  { name: "Round", share: 0.1 },
  { name: "Rounder", share: 0.18 },
  { name: "Full", share: 0.5 },
];

/** Border widths, in canvas pixels. None is no border at all. */
const BORDER_PRESETS = [
  { name: "None", width: 0 },
  { name: "Thin", width: 2 },
  { name: "Medium", width: 6 },
  { name: "Thick", width: 14 },
];

const DEFAULT_BORDER_COLOR = "#FFFFFF";

/* ---------------------------------------------------------------------------------------------------------------- */

export const BorderPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedIds[0]);

  if (!el) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>CORNER</PanelTitle>
        <PanelDesc>Select an element to round its corners or give it a border.</PanelDesc>
      </div>
    );
  }

  if (el.type === "image" && el.deviceFrame) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>CORNER</PanelTitle>
        <PanelDesc>
          A device has its own edges. Set Mockup to None to add a border or rounded corners.
        </PanelDesc>
      </div>
    );
  }

  // A border is on when it has a width. Older files could have one switched off.
  const border = el.border ?? { enabled: false, color: DEFAULT_BORDER_COLOR, width: 0 };
  const borderWidth = border.enabled ? border.width : 0;
  const setBorderWidth = (width: number) =>
    update(el.id, { border: { ...border, width, enabled: width > 0 } });

  const canCorner =
    el.type === "image" ||
    (el.type === "shape" &&
      (el as ShapeElement).shape !== "ellipse" &&
      (el as ShapeElement).shape !== "arrow");

  const shorter = Math.max(1, Math.min(el.width, el.height));
  const cornerRadius =
    el.type === "image"
      ? (el as ImageElement).cornerRadius
      : el.type === "shape"
        ? (el as ShapeElement).cornerRadius
        : 0;
  const cornerShare = Math.min(0.5, cornerRadius / shorter);
  const setCornerShare = (share: number) => {
    if (el.type === "image" || el.type === "shape") update(el.id, { cornerRadius: Math.round(share * shorter) });
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PanelTitle>CORNER</PanelTitle>

      {canCorner && (
        <div className="space-y-2.5">
          <SectionLabel>CORNERS</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {CORNER_PRESETS.map((preset) => {
              const active = Math.abs(cornerShare - preset.share) < 0.005;
              return (
                <button
                  key={preset.name}
                  type="button"
                  aria-label={`${preset.name} corners`}
                  aria-pressed={active}
                  onClick={() => setCornerShare(preset.share)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border bg-chrome/50 px-1 pb-1.5 pt-2.5 text-[10px] transition-colors hover:text-text",
                    choiceClass(active),
                    active ? "text-text" : "text-text-muted",
                  )}
                >
                  {/* The tile's own shape, at the preset's share of its shorter side. */}
                  <span
                    aria-hidden
                    className="h-7 w-10 bg-primary"
                    style={{ borderRadius: `${preset.share * 28}px` }}
                  />
                  {preset.name}
                </button>
              );
            })}
          </div>
          <LabeledSlider
            label="ROUNDNESS"
            unit="%"
            max={50}
            value={Math.round(cornerShare * 100)}
            onChange={(v) => setCornerShare(v / 100)}
          />
        </div>
      )}

      <Linebreak />

      <div className="space-y-2.5">
        <SectionLabel>BORDER</SectionLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {BORDER_PRESETS.map((preset) => {
            const active = borderWidth === preset.width;
            return (
              <button
                key={preset.name}
                type="button"
                aria-label={preset.width ? `${preset.name} border` : "No border"}
                aria-pressed={active}
                onClick={() => setBorderWidth(preset.width)}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border bg-chrome/50 px-1 pb-1.5 pt-2.5 text-[10px] transition-colors hover:text-text",
                  choiceClass(active),
                  active ? "text-text" : "text-text-muted",
                )}
              >
                <span
                  aria-hidden
                  className="h-7 w-9 rounded-sm border-text bg-p-700"
                  style={{ borderWidth: preset.width ? Math.max(1, Math.round(preset.width / 3)) : 0 }}
                />
                {preset.name}
              </button>
            );
          })}
        </div>
        <LabeledSlider label="WIDTH" unit="px" max={60} value={borderWidth} onChange={setBorderWidth} />
        {borderWidth > 0 && (
          <ColorRow value={border.color} onChange={(color) => update(el.id, { border: { ...border, color } })} />
        )}
        <PanelHelp>The border sits inside the edge, so the size stays the same.</PanelHelp>
      </div>
    </div>
  );
};
