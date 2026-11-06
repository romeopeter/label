export type PatternType =
  | "stripes"
  | "grid"
  | "plaid"
  | "chevron"
  | "waves"
  | "dots"
  | "triangles"
  | "checks"
  | "argyle"
  | "hexagon"
  | "cubes"
  | "scales"
  | "arcs"
  | "basketweave"
  | "truchet"
  | "ribbons"
  | "steps"
  | "pinwheel"
  | "circuit"
  | "starry-night"
  | "raindrops"
  | "terrazzo";

/**
 * In the panel's order: lines, then shapes, then tiles, then scatters. Each one
 * looks unlike every other, so none is another turned or resized.
 */
export const PATTERN_TYPES: PatternType[] = [
  "stripes",
  "grid",
  "plaid",
  "chevron",
  "waves",
  "dots",
  "triangles",
  "checks",
  "argyle",
  "hexagon",
  "cubes",
  "scales",
  "arcs",
  "basketweave",
  "truchet",
  "ribbons",
  "steps",
  "pinwheel",
  "circuit",
  "starry-night",
  "raindrops",
  "terrazzo",
];

export const PATTERN_LABELS: Record<PatternType, string> = {
  stripes: "Stripes",
  grid: "Grid",
  plaid: "Plaid",
  chevron: "Chevron",
  waves: "Waves",
  dots: "Dots",
  triangles: "Triangles",
  checks: "Checks",
  argyle: "Argyle",
  hexagon: "Hexagon",
  cubes: "Cubes",
  scales: "Scales",
  arcs: "Arcs",
  basketweave: "Basketweave",
  truchet: "Truchet",
  ribbons: "Ribbons",
  steps: "Steps",
  pinwheel: "Pinwheel",
  circuit: "Circuit",
  "starry-night": "Starry Night",
  raindrops: "Raindrops",
  terrazzo: "Terrazzo",
};

/**
 * Types that were dropped because they repeated another, and what a file that
 * used one gets instead.
 */
const RETIRED_TYPES: Record<string, PatternType> = {
  rules: "stripes",
  diamonds: "argyle",
  crosses: "dots",
  grain: "starry-night",
  halfblocks: "pinwheel",
  wedge: "triangles",
  bowtie: "triangles",
  quarters: "truchet",
};

export const PATTERN_PRO_GATE: Record<PatternType, boolean> = {
  stripes: false,
  grid: false,
  plaid: false,
  chevron: false,
  waves: false,
  dots: false,
  triangles: false,
  checks: false,
  argyle: false,
  hexagon: false,
  cubes: false,
  scales: false,
  arcs: false,
  basketweave: false,
  truchet: false,
  ribbons: false,
  steps: false,
  pinwheel: false,
  circuit: false,
  "starry-night": false,
  raindrops: false,
  terrazzo: false,
};

/**
 * Types where the rotation control is disabled in the panel.
 *
 * Starry night and terrazzo are seeded random scatters, so rotating them
 * is visually a no-op. Dots are a square lattice — rotating the *lattice* is
 * technically visible, but the brief locks the control off, so it stays off.
 * Raindrops is deliberately absent: rotation there sets the angle of the rain,
 * which is the whole point of the control. Flip an entry here if that product
 * call changes; nothing else needs to move.
 */
export const ROTATION_DISABLED_TYPES: PatternType[] = ["dots", "starry-night", "terrazzo"];

export type PatternColorPairSource = "curated" | "brand" | "custom";

export interface PatternColorPair {
  id: string;
  base: string; // hex, tile background
  accent: string; // hex, pattern shape colour
  source: PatternColorPairSource;
  label?: string; // e.g. "Midnight / Signal" for brand pairs
}

export interface PatternConfig {
  type: PatternType;
  colorPairId: string;
  /** Colours from Shuffle, which belong to no swatch. Used instead of the pair when set. */
  colors?: { base: string; accent: string };
  intensity: number; // 0–1, how strongly the accent reads against the base
  size: number; // 0–1, mapped to a tile px size
  rotation: number; // degrees, 0–360
}

export const DEFAULT_PATTERN_CONFIG: PatternConfig = {
  type: "dots",
  colorPairId: "curated-01",
  intensity: 0.5,
  size: 0.5,
  rotation: 0,
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const unit = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;

/** A saved pattern, made safe to draw: retired types are swapped for their nearest. */
export const normalisePattern = (saved: unknown): PatternConfig => {
  if (!saved || typeof saved !== "object") return DEFAULT_PATTERN_CONFIG;
  const value = saved as Record<string, unknown>;
  const named = typeof value.type === "string" ? value.type : "";
  const type = PATTERN_TYPES.includes(named as PatternType)
    ? (named as PatternType)
    : (RETIRED_TYPES[named] ?? DEFAULT_PATTERN_CONFIG.type);
  const colors = value.colors as { base?: unknown; accent?: unknown } | undefined;
  return {
    type,
    colorPairId: typeof value.colorPairId === "string" ? value.colorPairId : DEFAULT_PATTERN_CONFIG.colorPairId,
    ...(colors && isHexColor(colors.base) && isHexColor(colors.accent)
      ? { colors: { base: colors.base, accent: colors.accent } }
      : {}),
    intensity: unit(value.intensity, DEFAULT_PATTERN_CONFIG.intensity),
    size: unit(value.size, DEFAULT_PATTERN_CONFIG.size),
    rotation:
      typeof value.rotation === "number" && Number.isFinite(value.rotation)
        ? ((value.rotation % 360) + 360) % 360
        : DEFAULT_PATTERN_CONFIG.rotation,
  };
};
