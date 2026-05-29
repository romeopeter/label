import { useEditor } from "@/store/editor";
import type { ImageElement, ShapeElement } from "@/types";
import { PanelTitle, SectionLabel, LabeledSlider, ColorRow, PanelDesc, SwitchRow } from "./primitives";

export const BorderPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedIds[0]);

  if (!el) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>BORDER</PanelTitle>
        <PanelDesc>Select an element to add a border or corner radius.</PanelDesc>
      </div>
    );
  }

  const border = el.border ?? { enabled: false, color: "#534AB7", width: 2 };
  const setBorder = (patch: Partial<typeof border>) =>
    update(el.id, { border: { ...border, ...patch } });

  const canCorner =
    el.type === "image" ||
    (el.type === "shape" && (el as ShapeElement).shape !== "ellipse" && (el as ShapeElement).shape !== "arrow");
  const cornerRadius =
    el.type === "image" ? (el as ImageElement).cornerRadius :
    el.type === "shape" ? (el as ShapeElement).cornerRadius : 0;
  const setCorner = (v: number) => {
    if (el.type === "image" || el.type === "shape") update(el.id, { cornerRadius: v });
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>BORDER</PanelTitle>
      <SwitchRow
        label="ENABLE BORDER"
        checked={border.enabled}
        onCheckedChange={(v) => setBorder({ enabled: v })}
      />
      <SectionLabel>COLOR</SectionLabel>
      <ColorRow value={border.color} onChange={(v) => setBorder({ color: v })} />
      <LabeledSlider label="BORDER WIDTH" unit="px" max={20}
                     value={border.width} onChange={(v) => setBorder({ width: v })} />
      {canCorner && (
        <LabeledSlider label="BORDER RADIUS" unit="px" max={120}
                       value={cornerRadius} onChange={setCorner} />
      )}
    </div>
  );
};
