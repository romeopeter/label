import { useEditor } from "@/store/editor";
import type { ImageElement, ShapeElement } from "@/types";
import { cn } from "@/lib/utils";
import {
  PanelTitle,
  SectionLabel,
  LabeledSlider,
  ColorRow,
  PanelDesc,
  SwitchRow,
} from "./primitives";
import { Linebreak } from "./primitives";
import { choiceClass } from "./choice";

/* ---------------------------------------------------------------------------------------------------------------- */

interface BorderPreset {
  name: string;
  width: number;
  radius: number;
}

const BORDER_PRESETS: BorderPreset[] = [
  { name: "Sharp", width: 2, radius: 0 },
  { name: "Subtle", width: 2, radius: 8 },
  { name: "Soft", width: 3, radius: 12 },
  { name: "Round", width: 3, radius: 18 },
  { name: "Bold", width: 4, radius: 24 },
  { name: "Pill", width: 4, radius: 32 },
];

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
        <PanelDesc>
          Select an element to add a border or rounded corners.
        </PanelDesc>
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

  const border = el.border ?? { enabled: false, color: "#534AB7", width: 2 };
  const setBorder = (patch: Partial<typeof border>) =>
    update(el.id, { border: { ...border, ...patch } });

  const canCorner =
    el.type === "image" ||
    (el.type === "shape" &&
      (el as ShapeElement).shape !== "ellipse" &&
      (el as ShapeElement).shape !== "arrow");

  const cornerRadius =
    el.type === "image"
      ? (el as ImageElement).cornerRadius
      : el.type === "shape"
        ? (el as ShapeElement).cornerRadius
        : 0;

  const setCorner = (v: number) => {
    if (el.type === "image" || el.type === "shape")
      update(el.id, { cornerRadius: v });
  };

  const applyPreset = (p: BorderPreset) => {
    update(el.id, {
      border: { ...border, enabled: true, width: p.width },
      ...(canCorner ? { cornerRadius: p.radius } : {}),
    });
  };

  const isActivePreset = (p: BorderPreset) =>
    border.enabled &&
    border.width === p.width &&
    (!canCorner || cornerRadius === p.radius);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PanelTitle>CORNER</PanelTitle>

      <Linebreak />

      <SwitchRow
        label="ENABLE BORDER"
        checked={border.enabled}
        onCheckedChange={(v) => setBorder({ enabled: v })}
      />
      <SectionLabel>COLOR</SectionLabel>
      <ColorRow
        value={border.color}
        onChange={(v) => setBorder({ color: v })}
      />
      <LabeledSlider
        label="BORDER WIDTH"
        unit="px"
        max={100}
        value={border.width}
        onChange={(v) => setBorder({ width: v })}
      />
      {canCorner && (
        <LabeledSlider
          label="ROUNDED CORNER"
          unit="px"
          max={120}
          value={cornerRadius}
          onChange={setCorner}
        />
      )}

      <PanelTitle className="mb-2">Select preset</PanelTitle>
      <div className="grid grid-cols-3 gap-2">
        {BORDER_PRESETS.map((p) => {
          const active = isActivePreset(p);
          return (
            <button
              key={p.name}
              type="button"
              title={p.name}
              aria-label={`${p.name} border preset`}
              aria-pressed={active}
              onClick={() => applyPreset(p)}
              className={cn(
                "bg-dot-grid bg-dot-grid-dense relative h-11.25 w-full cursor-pointer overflow-hidden rounded-md border transition-colors",
                choiceClass(active),
              )}
            >
              <span
                aria-hidden
                className="absolute top-[35%] bottom-[-8px] bg-primary"
                style={{
                  left: 10,
                  right: 10 - p.radius,
                  borderRadius: p.radius,
                }}
              />
            </button>
          );
        })}
      </div>

      <Linebreak />
    </div>
  );
};
