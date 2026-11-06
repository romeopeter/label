import {
  BACKDROP_BLUR_MAX,
  BACKDROP_STYLES,
  type BackdropConfig,
  type BackdropLook,
  type BackdropStyle,
} from "@/types/backdrop";
import {
  isHex,
  newSeed,
  paletteOf,
  shuffledPalette,
  toOklch,
  type Harmony,
  type Mood,
  SHUFFLE_MOODS,
  type Palette,
} from "./colors";

interface Preset {
  id: string;
  label: string;
  style: BackdropStyle;
  seed: number;
  main: string;
  harmony: Harmony;
  mood: Mood;
  effects?: Partial<Pick<BackdropConfig, "blur" | "frost" | "grain">>;
}

const PRESET_LIST: Preset[] = [
  { id: "blue-waves", label: "Blue waves", style: "waves", seed: 7, main: "#2f45e0", harmony: "neighbours", mood: "dark" },
  { id: "sunset-streaks", label: "Sunset streaks", style: "streaks", seed: 21, main: "#f07a1e", harmony: "opposite", mood: "vivid" },
  { id: "orange-silk", label: "Orange silk", style: "silk", seed: 9, main: "#f26a1b", harmony: "same", mood: "vivid" },
  { id: "sea-glass", label: "Sea glass", style: "glass", seed: 1000, main: "#0fa3a3", harmony: "neighbours", mood: "vivid" },
  { id: "northern-lights", label: "Northern lights", style: "aurora", seed: 15, main: "#1fd68a", harmony: "split", mood: "dark" },
  { id: "grey-frost", label: "Grey frost", style: "soft", seed: 5, main: "#9aa1aa", harmony: "same", mood: "vivid", effects: { frost: 0.3, grain: 0.45 } },
  { id: "coral", label: "Coral", style: "soft", seed: 12, main: "#ff4f87", harmony: "neighbours", mood: "vivid" },
  { id: "violet-glow", label: "Violet glow", style: "glow", seed: 3, main: "#7b3ff2", harmony: "neighbours", mood: "dark" },
  { id: "white-marble", label: "White marble", style: "marble", seed: 27, main: "#a89a88", harmony: "same", mood: "light" },
  { id: "green-marble", label: "Green marble", style: "marble", seed: 33, main: "#1d7a55", harmony: "same", mood: "dark" },
];

const paletteOfPreset = (preset: Preset): Palette => {
  const { h, c } = toOklch(preset.main);
  return paletteOf({ h, c }, preset.harmony, preset.mood);
};

export const BACKDROP_PRESETS = PRESET_LIST.map((preset) => ({
  id: preset.id,
  label: preset.label,
  look: { style: preset.style, seed: preset.seed, color: null, colors: paletteOfPreset(preset) } as BackdropLook,
  effects: { blur: 0, frost: 0, grain: 0, ...preset.effects },
}));

export const DEFAULT_BACKDROP: BackdropConfig = {
  ...BACKDROP_PRESETS[0].look,
  ...BACKDROP_PRESETS[0].effects,
};

/** Styles that only look right in some moods. Aurora needs a night sky, for one. */
const STYLE_MOODS: Partial<Record<BackdropStyle, [Mood, number][]>> = {
  aurora: [["dark", 1]],
  glow: [["dark", 4], ["vivid", 1]],
  marble: [["light", 3], ["mist", 2], ["vivid", 2], ["dark", 3]],
};

const moodsOf = (style: BackdropStyle) => STYLE_MOODS[style] ?? SHUFFLE_MOODS;

/** A new random look in the same style, built on the picked colour if there is one. */
export const shuffledLook = (current: BackdropLook, seed = newSeed()): BackdropLook => ({
  style: current.style,
  seed,
  color: current.color,
  colors: shuffledPalette(seed, current.color, moodsOf(current.style)),
});

/** The colour picked, with a palette built round it. The shapes stay where they are. */
export const lookWithColor = (current: BackdropLook, color: string | null): BackdropLook => ({
  ...current,
  color,
  colors: color ? shuffledPalette(current.seed, color, moodsOf(current.style)) : current.colors,
});

export const lookOf = ({ style, seed, color, colors }: BackdropLook): BackdropLook => ({
  style,
  seed,
  color,
  colors,
});

const clamp = (value: unknown, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : fallback;

/** A saved background, made safe to draw whatever the file says. */
export const normaliseBackdrop = (saved: unknown): BackdropConfig => {
  if (!saved || typeof saved !== "object") return DEFAULT_BACKDROP;
  const value = saved as Partial<Record<keyof BackdropConfig, unknown>>;
  const colors =
    Array.isArray(value.colors) && value.colors.length === 4 && value.colors.every(isHex)
      ? (value.colors as Palette)
      : DEFAULT_BACKDROP.colors;
  return {
    style: BACKDROP_STYLES.includes(value.style as BackdropStyle) ? (value.style as BackdropStyle) : DEFAULT_BACKDROP.style,
    seed: typeof value.seed === "number" && Number.isFinite(value.seed) ? Math.floor(value.seed) : DEFAULT_BACKDROP.seed,
    color: isHex(value.color) ? value.color : null,
    colors,
    blur: clamp(value.blur, BACKDROP_BLUR_MAX, 0),
    frost: clamp(value.frost, 1, 0),
    grain: clamp(value.grain, 1, 0),
  };
};
