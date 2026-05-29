import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useEditor } from "@/store/editor";
import type { TextElement } from "@/types";
import { SYSTEM_FONTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PanelTitle, SectionLabel, LabeledSlider, ColorRow, PanelDesc } from "./primitives";

export const HeaderPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);
  const addText = useEditor((s) => s.addText);

  const t = elements.find((e) => e.id === selectedIds[0] && e.type === "text") as TextElement | undefined;

  if (!t) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>TEXT</PanelTitle>
        <PanelDesc>Select a text layer to edit it, or add one below.</PanelDesc>
        <Button variant="primary" size="block" onClick={() => addText("heading")}>+ Add heading</Button>
        <Button variant="ghost" size="block" onClick={() => addText("body")}>+ Add body</Button>
      </div>
    );
  }

  const set = (patch: Partial<TextElement>) => update(t.id, patch);

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>TEXT</PanelTitle>

      <SectionLabel>CONTENT</SectionLabel>
      <Textarea value={t.text} onChange={(e) => set({ text: e.target.value })} rows={3} />

      <SectionLabel>FONT</SectionLabel>
      <Select value={t.fontFamily} onValueChange={(v) => set({ fontFamily: v })}>
        <SelectTrigger><SelectValue placeholder="Font family" /></SelectTrigger>
        <SelectContent>
          {SYSTEM_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
        </SelectContent>
      </Select>

      <SectionLabel>WEIGHT</SectionLabel>
      <ToggleGroup
        type="single"
        value={String(t.fontWeight)}
        onValueChange={(v) => v && set({ fontWeight: Number(v) as 400 | 500 | 700 })}
      >
        <ToggleGroupItem value="400">Regular</ToggleGroupItem>
        <ToggleGroupItem value="500">Medium</ToggleGroupItem>
        <ToggleGroupItem value="700">Bold</ToggleGroupItem>
      </ToggleGroup>

      <SectionLabel>ALIGN</SectionLabel>
      <ToggleGroup
        type="single"
        value={t.align}
        onValueChange={(v) => v && set({ align: v as "left" | "center" | "right" })}
      >
        <ToggleGroupItem value="left" aria-label="Left"><AlignLeft className="h-3 w-3" /></ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Center"><AlignCenter className="h-3 w-3" /></ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Right"><AlignRight className="h-3 w-3" /></ToggleGroupItem>
      </ToggleGroup>

      <LabeledSlider label="SIZE" unit="px" min={12} max={240} value={t.fontSize}
                     onChange={(v) => set({ fontSize: v })} />
      <LabeledSlider label="LETTER SPACING" min={-10} max={20} value={t.letterSpacing}
                     onChange={(v) => set({ letterSpacing: v })} />
      <LabeledSlider label="LINE HEIGHT" min={80} max={250} unit="%"
                     value={Math.round(t.lineHeight * 100)}
                     onChange={(v) => set({ lineHeight: v / 100 })} />

      <SectionLabel>COLOR</SectionLabel>
      <ColorRow value={t.fill} onChange={(v) => set({ fill: v })} />
    </div>
  );
};
