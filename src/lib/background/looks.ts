import type { BackgroundGradient, BackgroundMode, BackgroundState } from "@/types";
import type { BackdropLook } from "@/types/backdrop";
import { newSeed, pick, randomFrom, shuffledPalette } from "@/lib/backdrops/colors";
import { shuffledLook as shuffledBackdrop } from "@/lib/backdrops/presets";

/*
  A look is what Shuffle changes for one background type, and what Back and
  Forward step through: a solid's colour, a gradient's two colours and angle, a
  pattern's colours, an abstract background's style, seed and colours. Effects
  and the rest of the settings are left as they are.
*/

export const SHUFFLE_MODES = ["solid", "gradient", "pattern", "abstract"] as const;
export type ShuffleMode = (typeof SHUFFLE_MODES)[number];

export const isShuffleMode = (mode: BackgroundMode): mode is ShuffleMode =>
  (SHUFFLE_MODES as readonly BackgroundMode[]).includes(mode);

export type BackgroundLook =
  | { mode: "solid"; color: string }
  | { mode: "gradient"; gradient: BackgroundGradient }
  | { mode: "pattern"; colorPairId: string; colors?: { base: string; accent: string } }
  | { mode: "abstract"; backdrop: BackdropLook };

export const lookOfBackground = (bg: BackgroundState, mode: ShuffleMode): BackgroundLook => {
  switch (mode) {
    case "solid":
      return { mode, color: bg.color };
    case "gradient":
      return { mode, gradient: bg.gradient };
    case "pattern":
      return {
        mode,
        colorPairId: bg.pattern.colorPairId,
        ...(bg.pattern.colors ? { colors: bg.pattern.colors } : {}),
      };
    case "abstract": {
      const { style, seed, color, colors } = bg.backdrop;
      return { mode, backdrop: { style, seed, color, colors } };
    }
  }
};

export const sameLook = (a: BackgroundLook, b: BackgroundLook) => JSON.stringify(a) === JSON.stringify(b);

/** The change that shows a look. */
export const applyLook = (bg: BackgroundState, look: BackgroundLook): Partial<BackgroundState> => {
  switch (look.mode) {
    case "solid":
      return { mode: "solid", color: look.color };
    case "gradient":
      return { mode: "gradient", gradient: look.gradient };
    case "pattern": {
      const { colors: _previous, ...pattern } = bg.pattern;
      void _previous;
      return {
        mode: "pattern",
        pattern: { ...pattern, colorPairId: look.colorPairId, ...(look.colors ? { colors: look.colors } : {}) },
      };
    }
    case "abstract":
      return { mode: "abstract", backdrop: look.backdrop };
  }
};

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * A new look for the type. Colours come from the same palettes as abstract
 * backgrounds, so they're in tune with each other and never muddy.
 */
export const shuffledLookFor = (bg: BackgroundState, mode: ShuffleMode, seed = newSeed()): BackgroundLook => {
  if (mode === "abstract") return { mode, backdrop: shuffledBackdrop(bg.backdrop, seed) };

  const [deep, main, accent, highlight] = shuffledPalette(seed, null);
  const random = randomFrom(seed ^ 0x2c1b3c6d);

  if (mode === "solid") {
    return { mode, color: pick(random, [[main, 3], [deep, 2], [accent, 2], [highlight, 1]]) };
  }
  if (mode === "gradient") {
    const [from, to] = pick<[string, string]>(random, [
      [[deep, main], 3],
      [[main, accent], 3],
      [[deep, accent], 2],
      [[main, highlight], 1],
    ]);
    return { mode, gradient: { from, to, angle: ANGLES[Math.floor(random() * ANGLES.length)] } };
  }
  // A pattern needs its two colours far apart in lightness to read at all.
  const [base, accentColor] = pick<[string, string]>(random, [
    [[deep, highlight], 3],
    [[deep, accent], 3],
    [[highlight, deep], 2],
    [[highlight, main], 1],
  ]);
  return { mode, colorPairId: bg.pattern.colorPairId, colors: { base, accent: accentColor } };
};
