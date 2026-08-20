import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PATTERN_LABELS,
  PATTERN_PRO_GATE,
  PATTERN_TYPES,
  ROTATION_DISABLED_TYPES,
  type PatternType,
} from "@/types/pattern";
import { PATTERN_TILE_ASPECT, patternPreviewUrl } from "@/lib/patterns/generators";
import { deriveBrandPatternPairs } from "@/lib/patterns/deriveBrandPatternPairs";
import { CURATED_PATTERN_PAIRS } from "@/data/curatedPatternPairs";
import { LabeledSlider, MutedMini, PanelHelp, SectionLabel } from "../primitives";
import { ColorPairSwatchGrid } from "./ColorPairSwatchGrid";
import { CustomColorPairPicker } from "./CustomColorPairPicker";

/** Thumbnails use panel-neutral colours so the grid reads regardless of the
 *  user's selected pair, and a small tile so the repeat is visible. */
const THUMB_BASE = "#0f0e1a";
const THUMB_ACCENT = "#afa9ec";
const THUMB_TILE_PX = 26;

const PatternTypeTile = ({
  type,
  selected,
  locked,
  onSelect,
}: {
  type: PatternType;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    title={PATTERN_LABELS[type]}
    aria-label={locked ? `${PATTERN_LABELS[type]} (Pro)` : PATTERN_LABELS[type]}
    aria-pressed={selected}
    onClick={onSelect}
    className={cn(
      "relative aspect-[4/3] cursor-pointer overflow-hidden rounded-md border transition-colors",
      // `border-primary` aliases t-400. Not `border-t-400` — Tailwind reads that
      // as border-top-width: 400px, not a colour.
      selected ? "border-primary" : "border-hairline hover:border-p-300",
    )}
    style={{
      backgroundImage: patternPreviewUrl(type, THUMB_BASE, THUMB_ACCENT, THUMB_TILE_PX),
      backgroundRepeat: "repeat",
      // Honour the tile's own aspect so the non-square cube lattice isn't squashed.
      backgroundSize: `${THUMB_TILE_PX}px ${THUMB_TILE_PX * PATTERN_TILE_ASPECT[type]}px`,
    }}
  >
    {locked && (
      <span className="absolute right-1 top-1">
        <Badge variant="pro" size="sm" />
      </span>
    )}
  </button>
);

export const PatternPanel = () => {
  const pattern = useEditor((s) => s.background.pattern);
  const setPattern = useEditor((s) => s.setPattern);
  const setPatternDragging = useEditor((s) => s.setPatternDragging);
  const customPairs = useEditor((s) => s.customPatternPairs);
  const addCustomPatternPair = useEditor((s) => s.addCustomPatternPair);
  const deleteCustomPatternPair = useEditor((s) => s.deleteCustomPatternPair);
  const isPro = useEditor((s) => s.isPro);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedAttempt, setLockedAttempt] = useState<PatternType | null>(null);

  const brandPairs = useMemo(() => deriveBrandPatternPairs(), []);
  const rotationDisabled = ROTATION_DISABLED_TYPES.includes(pattern.type);

  const onSelectType = (type: PatternType) => {
    if (PATTERN_PRO_GATE[type] && !isPro) {
      // Route to the upgrade path rather than silently applying the pattern.
      setLockedAttempt(type);
      return;
    }
    setLockedAttempt(null);
    setPattern({ type });
  };

  const selectPair = (colorPairId: string) => setPattern({ colorPairId });

  const onSaveCustomPair = (base: string, accent: string) => {
    const id = addCustomPatternPair(base, accent);
    setPattern({ colorPairId: id });
    setPickerOpen(false);
  };

  const onDeleteCustomPair = (id: string) => {
    deleteCustomPatternPair(id);
    // Don't leave the canvas pointing at a pair that no longer exists.
    if (pattern.colorPairId === id) setPattern({ colorPairId: CURATED_PATTERN_PAIRS[0].id });
  };

  /** Sliders drop the canvas to cheap tiles while held, then snap back on release. */
  const dragProps = (apply: (v: number) => void) => ({
    onChange: (v: number) => {
      setPatternDragging(true);
      apply(v);
    },
    onCommit: (v: number) => {
      apply(v);
      setPatternDragging(false);
    },
  });

  return (
    <div className="space-y-2.5">
      <SectionLabel right={<MutedMini>{PATTERN_TYPES.length}</MutedMini>}>
        PATTERN TYPE
      </SectionLabel>
      {/*
        Capped and scrolled rather than laid out in full: the type list has
        outgrown the panel, and letting it run pushes Intensity/Size/Rotation
        below the fold. The cap lands mid-row on purpose — a half-visible tile
        is what signals there's more to scroll to.
      */}
      <div className="max-h-44 overflow-y-auto overscroll-contain rounded-md border border-hairline bg-chrome/30 p-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {PATTERN_TYPES.map((type) => (
            <PatternTypeTile
              key={type}
              type={type}
              selected={pattern.type === type}
              locked={PATTERN_PRO_GATE[type] && !isPro}
              onSelect={() => onSelectType(type)}
            />
          ))}
        </div>
      </div>

      {lockedAttempt && (
        <>
          {/* Nothing is gated today; this renders only if PATTERN_PRO_GATE is
              flipped back on for a type. Kept free of a hardcoded list of free
              types so it can't go stale when that happens. */}
          <PanelHelp>{PATTERN_LABELS[lockedAttempt]} is a Pro pattern.</PanelHelp>
          <Button variant="ghost" size="block" className="cursor-pointer">
            <Lock className="h-3 w-3" /> Unlock Pro patterns
          </Button>
        </>
      )}

      {/* Colour pairs stay free on every tier — only the pattern type is gated. */}
      <ColorPairSwatchGrid
        title="From your brand"
        pairs={brandPairs}
        selectedId={pattern.colorPairId}
        onSelect={selectPair}
      />
      <ColorPairSwatchGrid
        title="Curated color swatch"
        pairs={CURATED_PATTERN_PAIRS}
        selectedId={pattern.colorPairId}
        onSelect={selectPair}
      />
      <ColorPairSwatchGrid
        title="Custom"
        pairs={customPairs}
        selectedId={pattern.colorPairId}
        onSelect={selectPair}
        onDelete={onDeleteCustomPair}
        onAdd={() => setPickerOpen((open) => !open)}
      />

      {pickerOpen && (
        <CustomColorPairPicker
          onSave={onSaveCustomPair}
          onCancel={() => setPickerOpen(false)}
        />
      )}

      <div className="space-y-2.5 pt-1">
        <LabeledSlider
          label="INTENSITY"
          unit="%"
          max={100}
          value={Math.round(pattern.intensity * 100)}
          {...dragProps((v) => setPattern({ intensity: v / 100 }))}
        />
        <LabeledSlider
          label="SIZE"
          unit="%"
          max={100}
          value={Math.round(pattern.size * 100)}
          {...dragProps((v) => setPattern({ size: v / 100 }))}
        />
        <LabeledSlider
          label="ROTATION"
          unit="°"
          max={360}
          value={Math.round(pattern.rotation)}
          disabled={rotationDisabled}
          {...dragProps((v) => setPattern({ rotation: v }))}
        />
        {rotationDisabled && (
          <PanelHelp>
            Rotation has no visible effect on {PATTERN_LABELS[pattern.type].toLowerCase()}.
          </PanelHelp>
        )}
      </div>
    </div>
  );
};
