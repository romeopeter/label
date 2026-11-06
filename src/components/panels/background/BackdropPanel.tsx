import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BACKDROP_STYLES, BACKDROP_STYLE_LABELS, type BackdropStyle } from "@/types/backdrop";
import { BACKDROP_PRESETS, lookWithColor } from "@/lib/backdrops/presets";
import { backdropThumb } from "@/lib/backdrops/renderer";
import { NO_EFFECTS } from "@/lib/background/effects";
import { ColorRow, MutedMini, PanelHelp, SectionLabel } from "../primitives";
import { ShuffleRow } from "./ShuffleRow";
import { choiceClass } from "../choice";

const PresetTile = ({
  preset,
  selected,
  onSelect,
}: {
  preset: (typeof BACKDROP_PRESETS)[number];
  selected: boolean;
  onSelect: () => void;
}) => {
  const thumb = useMemo(() => backdropThumb(preset.look, { ...NO_EFFECTS, ...preset.effects }), [preset]);
  return (
    <button
      type="button"
      title={preset.label}
      aria-label={preset.label}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "aspect-[4/3] cursor-pointer overflow-hidden rounded-md border bg-chrome bg-cover bg-center transition-colors",
        choiceClass(selected),
      )}
      style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
    />
  );
};

const sameColors = (a: readonly string[], b: readonly string[]) => a.every((color, i) => color === b[i]);

export const BackdropPanel = () => {
  const backdrop = useEditor((s) => s.background.backdrop);
  const setBackdrop = useEditor((s) => s.setBackdrop);
  const showLook = useEditor((s) => s.showLook);
  const setEffects = useEditor((s) => s.setEffects);

  const isPreset = (preset: (typeof BACKDROP_PRESETS)[number]) =>
    !backdrop.color &&
    backdrop.style === preset.look.style &&
    backdrop.seed === preset.look.seed &&
    sameColors(backdrop.colors, preset.look.colors);

  return (
    <div className="space-y-2.5">
      <SectionLabel>STYLE</SectionLabel>
      <ToggleGroup
        type="single"
        value={backdrop.style}
        onValueChange={(v) => v && setBackdrop({ style: v as BackdropStyle })}
        // Eight styles don't fit on one line, so two rows of four.
        className="grid w-full grid-cols-4"
      >
        {BACKDROP_STYLES.map((style) => (
          <ToggleGroupItem key={style} value={style} className="cursor-pointer">
            {BACKDROP_STYLE_LABELS[style]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <SectionLabel right={<MutedMini>{BACKDROP_PRESETS.length}</MutedMini>}>PRESETS</SectionLabel>
      <div className="grid grid-cols-5 gap-1.5">
        {BACKDROP_PRESETS.map((preset) => (
          <PresetTile
            key={preset.id}
            preset={preset}
            selected={isPreset(preset)}
            onSelect={() => {
              showLook("abstract", { mode: "abstract", backdrop: preset.look });
              // A preset brings the effects it was made with.
              setEffects(preset.effects);
            }}
          />
        ))}
      </div>

      <ShuffleRow mode="abstract" />

      <SectionLabel
        right={
          backdrop.color && (
            <Button
              variant="text"
              className="cursor-pointer text-[10px]"
              onClick={() => setBackdrop({ color: null })}
            >
              Any color
            </Button>
          )
        }
      >
        COLOR
      </SectionLabel>
      <ColorRow
        value={backdrop.color ?? backdrop.colors[1]}
        onChange={(v) => setBackdrop(lookWithColor(backdrop, v))}
      />
      <PanelHelp>
        {backdrop.color
          ? "Shuffle builds on this color, round the color wheel."
          : "Pick a color, and Shuffle builds on it."}
      </PanelHelp>
    </div>
  );
};
