/**
 * Palettes for abstract backgrounds, worked out on the colour wheel in OKLCH. Equal
 * steps there look equal to the eye, so a shade of yellow doesn't turn muddy and a
 * blue doesn't go dull the way they do in HSL.
 */

interface Oklch {
  l: number;
  c: number;
  /** Degrees. */
  h: number;
}

/** Seeded, so the same seed always gives the same background. */
export const randomFrom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** Linear red, green and blue, 0 to 1. */
export const hexToLinear = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((v) => toLinear(v / 255)) as [
    number,
    number,
    number,
  ];
};

const hexOf = (rgb: number[]) =>
  `#${rgb
    .map((v) => Math.round(Math.min(Math.max(toGamma(v), 0), 1) * 255).toString(16).padStart(2, "0"))
    .join("")}`;

export const toOklch = (hex: string): Oklch => {
  const [r, g, b] = hexToLinear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
};

const linearOf = ({ l: L, c, h }: Oklch) => {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** Keeps the lightness and hue, and gives up only as much colour as a screen can't show. */
export const hexOfOklch = (color: Oklch) => {
  const lch = { ...color, l: Math.min(Math.max(color.l, 0), 1), h: ((color.h % 360) + 360) % 360 };
  if (inGamut(linearOf(lch))) return hexOf(linearOf(lch));
  let low = 0;
  let high = lch.c;
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (inGamut(linearOf({ ...lch, c: mid }))) low = mid;
    else high = mid;
  }
  return hexOf(linearOf({ ...lch, c: low }));
};

/** Where the other colours sit on the wheel, from the main one. */
export const HARMONIES = {
  /** One colour, darker and lighter. */
  same: { accent: 14, highlight: -12 },
  /** Its neighbours, such as blue into violet. */
  neighbours: { accent: 38, highlight: 62 },
  /** Across the wheel, such as orange and teal. */
  opposite: { accent: 180, highlight: 24 },
  /** Either side of the opposite: livelier, but still in balance. */
  split: { accent: 150, highlight: 34 },
} as const;
export type Harmony = keyof typeof HARMONIES;

/** Lightness of each colour, darkest first, and how much of the main colour's strength it keeps. */
export const MOODS = {
  dark: { deep: [0.16, 0.5], base: [0.5, 1], accent: [0.6, 0.9], highlight: [0.86, 0.4] },
  vivid: { deep: [0.36, 0.7], base: [0.66, 1], accent: [0.72, 0.95], highlight: [0.93, 0.35] },
  light: { deep: [0.74, 0.4], base: [0.88, 0.6], accent: [0.8, 0.65], highlight: [0.97, 0.15] },
  /** Mid-tones, soft and quiet. */
  mist: { deep: [0.56, 0.5], base: [0.76, 0.7], accent: [0.68, 0.7], highlight: [0.94, 0.2] },
} as const;
export type Mood = keyof typeof MOODS;

export type Palette = [string, string, string, string];

export const pick = <T>(random: () => number, weighted: [T, number][]) => {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let at = random() * total;
  for (const [value, weight] of weighted) {
    at -= weight;
    if (at <= 0) return value;
  }
  return weighted[weighted.length - 1][0];
};

/** Shadows lean towards blue-violet, as painters do, so dark yellows don't go olive. */
const COOL_HUE = 275;
const SHADOW_TURN = 25;

const shadowHueOf = (h: number) => {
  const towards = ((COOL_HUE - h + 540) % 360) - 180;
  return h + Math.sign(towards) * Math.min(Math.abs(towards), SHADOW_TURN);
};

/** Four colours from one: a deep shade, the colour, an accent along the wheel, and a pale highlight. */
export const paletteOf = (
  main: { h: number; c: number; l?: number },
  harmony: Harmony,
  mood: Mood,
  /** Which way round the wheel the accent goes. */
  turn: 1 | -1 = 1,
): Palette => {
  const steps = MOODS[mood];
  const offsets = HARMONIES[harmony];
  const at = (h: number, [l, share]: readonly [number, number]) => hexOfOklch({ l, c: main.c * share, h });
  return [
    at(shadowHueOf(main.h), steps.deep),
    main.l === undefined ? at(main.h, steps.base) : hexOfOklch({ l: main.l, c: main.c, h: main.h }),
    at(main.h + offsets.accent * turn, steps.accent),
    at(main.h + offsets.highlight * turn, steps.highlight),
  ];
};

const MUDDY_FROM = 85;
const MUDDY_WIDTH = 40;

/** How often Shuffle lands on each mood, unless a style asks for others. */
export const SHUFFLE_MOODS: [Mood, number][] = [["dark", 5], ["vivid", 3], ["light", 2], ["mist", 1]];

/** Grey has no hue to move round the wheel, so it stays grey with only a hint of colour. */
const GREY_CHROMA = 0.03;

/**
 * A palette for Shuffle: from the colour the user picked when there is one, or any
 * colour otherwise. Ranges are kept to ones that look good, so it never lands on
 * muddy browns or clashing neons.
 */
export const shuffledPalette = (
  seed: number,
  picked: string | null,
  moods: [Mood, number][] = SHUFFLE_MOODS,
): Palette => {
  const random = randomFrom(seed ^ 0x5bd1e995);
  const turn = random() < 0.5 ? 1 : -1;

  if (picked) {
    const color = toOklch(picked);
    if (color.c < GREY_CHROMA) {
      return paletteOf(color, "same", color.l > 0.7 ? "light" : random() < 0.5 ? "dark" : "vivid", turn);
    }
    const harmony = pick<Harmony>(random, [["neighbours", 4], ["same", 2], ["opposite", 3], ["split", 2]]);
    // Unless the style asks for its own moods, one that suits the colour's lightness.
    const mood: Mood =
      moods !== SHUFFLE_MOODS
        ? pick(random, moods)
        : color.l < 0.45
          ? "dark"
          : color.l > 0.82
            ? "light"
            : random() < 0.6
              ? "dark"
              : "vivid";
    // The picked colour is kept as it is, as the main colour.
    return paletteOf(color, harmony, mood, turn);
  }

  const harmony = pick<Harmony>(random, [["neighbours", 4], ["same", 2], ["opposite", 3], ["split", 2]]);
  const mood = pick<Mood>(random, moods);
  // Yellow-greens look muddy at most lightnesses, so Shuffle steps over them.
  const h = (MUDDY_FROM + MUDDY_WIDTH + random() * (360 - MUDDY_WIDTH)) % 360;
  const c = 0.12 + random() * 0.1;
  return paletteOf({ h, c }, harmony, mood, turn);
};

export const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
