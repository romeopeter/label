import { useEditor } from "@/store/editor";
import { EFFECT_BLUR_MAX } from "@/lib/background/effects";
import { LabeledSlider, PanelHelp } from "../primitives";

/** Effects on the whole background, whichever type it is. */
export const EffectsControls = () => {
  const effects = useEditor((s) => s.background.effects);
  const setEffects = useEditor((s) => s.setEffects);

  return (
    <div className="space-y-2.5">
      <LabeledSlider
        label="BLUR"
        unit="px"
        max={EFFECT_BLUR_MAX}
        value={Math.round(effects.blur)}
        onChange={(v) => setEffects({ blur: v })}
      />
      <LabeledSlider
        label="FROST"
        unit="%"
        value={Math.round(effects.frost * 100)}
        onChange={(v) => setEffects({ frost: v / 100 })}
      />
      <LabeledSlider
        label="GRAIN"
        unit="%"
        value={Math.round(effects.grain * 100)}
        onChange={(v) => setEffects({ grain: v / 100 })}
      />
      <LabeledSlider
        label="VIGNETTE"
        unit="%"
        value={Math.round(effects.vignette * 100)}
        onChange={(v) => setEffects({ vignette: v / 100 })}
      />
      <LabeledSlider
        label="OPACITY"
        unit="%"
        value={Math.round(effects.opacity * 100)}
        onChange={(v) => setEffects({ opacity: v / 100 })}
      />
      <PanelHelp>Effects stay as you change type. Lower opacity shows through in PNG and WebP exports.</PanelHelp>
    </div>
  );
};
