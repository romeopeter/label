import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BACKDROP_BLUR_MAX,
  BACKDROP_STYLES,
  BACKDROP_STYLE_LABELS,
  type BackdropStyle,
} from "@/types/backdrop";
import { BACKDROP_PRESETS, lookWithColor } from "@/lib/backdrops/presets";
import { backdropThumb } from "@/lib/backdrops/renderer";
import { ColorRow, LabeledSlider, MutedMini, PanelHelp, SectionLabel } from "../primitives";
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
  const thumb = useMemo(() => backdropThumb(preset.look, preset.effects), [preset]);
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
  const showBackdrop = useEditor((s) => s.showBackdrop);
  const stepBackdrop = useEditor((s) => s.stepBackdrop);
  const trailLength = useEditor((s) => s.backdropTrail.length);
  const trailAt = useEditor((s) => s.backdropTrailAt);

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
              showBackdrop(preset.look);
              setBackdrop(preset.effects);
            }}
          />
        ))}
      </div>

      <SectionLabel right={trailLength > 1 && <MutedMini>{`${trailAt + 1} OF ${trailLength}`}</MutedMini>}>
        SHUFFLE
      </SectionLabel>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          title="Back"
          className="cursor-pointer"
          disabled={trailAt <= 0}
          onClick={() => stepBackdrop(-1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="primary" size="sm" className="flex-1 cursor-pointer" onClick={() => showBackdrop()}>
          <Shuffle className="h-3 w-3" /> Shuffle
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Forward"
          title="Forward"
          className="cursor-pointer"
          disabled={trailAt >= trailLength - 1}
          onClick={() => stepBackdrop(1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <PanelHelp>Back and Forward return to ones you skipped.</PanelHelp>

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

      <LabeledSlider
        label="BLUR"
        unit="px"
        max={BACKDROP_BLUR_MAX}
        value={Math.round(backdrop.blur)}
        onChange={(v) => setBackdrop({ blur: v })}
      />
      <LabeledSlider
        label="FROST"
        unit="%"
        value={Math.round(backdrop.frost * 100)}
        onChange={(v) => setBackdrop({ frost: v / 100 })}
      />
      <LabeledSlider
        label="GRAIN"
        unit="%"
        value={Math.round(backdrop.grain * 100)}
        onChange={(v) => setBackdrop({ grain: v / 100 })}
      />
    </div>
  );
};
