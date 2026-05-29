import { Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { PanelTitle, SectionLabel, LabeledSlider, ColorRow, PanelDesc, SwitchRow } from "./primitives";

export const ShadowPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedIds[0]);

  if (!el) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>SHADOW</PanelTitle>
        <PanelDesc>Select an element to add a drop shadow.</PanelDesc>
      </div>
    );
  }

  const sh = el.shadow ?? { enabled: false, color: "#0F0E1A", blur: 40, offsetX: 0, offsetY: 20 };
  const set = (patch: Partial<typeof sh>) => update(el.id, { shadow: { ...sh, ...patch } });

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>SHADOW</PanelTitle>
      <SwitchRow
        label="ENABLE SHADOW"
        checked={sh.enabled}
        onCheckedChange={(v) => set({ enabled: v })}
      />
      <SectionLabel>COLOR</SectionLabel>
      <ColorRow
        value={sh.color.startsWith("#") ? sh.color : "#000000"}
        onChange={(v) => set({ color: v })}
      />
      <LabeledSlider label="BLUR" unit="px" max={120} value={sh.blur} onChange={(v) => set({ blur: v })} />
      <LabeledSlider label="OFFSET X" min={-80} max={80} value={sh.offsetX} onChange={(v) => set({ offsetX: v })} />
      <LabeledSlider label="OFFSET Y" min={-80} max={80} value={sh.offsetY} onChange={(v) => set({ offsetY: v })} />
      <Button variant="ghost" size="block" onClick={() => set({ enabled: false })}>
        <Trash2 className="h-3 w-3" /> Remove shadow
      </Button>
    </div>
  );
};
