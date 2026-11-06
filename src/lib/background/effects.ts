import type { BackgroundEffects } from "@/types";

/** Blur's top, in canvas pixels. */
export const EFFECT_BLUR_MAX = 100;

export const NO_EFFECTS: BackgroundEffects = { blur: 0, frost: 0, grain: 0, vignette: 0, opacity: 1 };

/** Whether any effect changes pixels, so the background has to go through the renderer. */
export const changesPixels = ({ blur, frost, grain, vignette }: BackgroundEffects) =>
  blur > 0.25 || frost > 0 || grain > 0 || vignette > 0;

const clamp = (value: unknown, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : fallback;

/** Saved effects, made safe whatever the file says. */
export const normaliseEffects = (saved: unknown): BackgroundEffects => {
  const value = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof BackgroundEffects, unknown>>;
  return {
    blur: clamp(value.blur, EFFECT_BLUR_MAX, 0),
    frost: clamp(value.frost, 1, 0),
    grain: clamp(value.grain, 1, 0),
    vignette: clamp(value.vignette, 1, 0),
    opacity: clamp(value.opacity, 1, 1),
  };
};
