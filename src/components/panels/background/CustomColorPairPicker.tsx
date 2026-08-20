import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorRow, SectionLabel } from "../primitives";

interface Props {
  onSave: (base: string, accent: string) => void;
  onCancel: () => void;
}

/**
 * Two-colour picker for a custom duotone pair. Reuses `ColorRow` so the hex +
 * native eyedropper affordance matches every other colour input in the panels.
 */
export const CustomColorPairPicker = ({ onSave, onCancel }: Props) => {
  const [base, setBase] = useState("#1C1F3B");
  const [accent, setAccent] = useState("#F26D5B");

  return (
    <div className="space-y-2 rounded-md border border-hairline bg-chrome/40 p-2">
      <SectionLabel>NEW COLOUR PAIR</SectionLabel>
      <div
        className="h-6 rounded border border-hairline"
        style={{ background: `linear-gradient(135deg, ${base} 0 50%, ${accent} 50% 100%)` }}
      />
      <ColorRow value={base} label="BASE" onChange={setBase} />
      <ColorRow value={accent} label="ACCENT" onChange={setAccent} />
      <div className="flex gap-1.5 pt-0.5">
        <Button
          variant="primary"
          size="sm"
          className="flex-1 cursor-pointer"
          onClick={() => onSave(base, accent)}
        >
          Save pair
        </Button>
        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
