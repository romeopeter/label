export type PatternType =
  | "dots"
  | "stripes"
  | "grid"
  | "chevron"
  | "checks"
  | "rules"
  | "waves"
  | "triangles"
  | "hexagon"
  | "grain"
  | "diamonds"
  | "basketweave"
  | "cubes"
  | "crosses"
  | "plaid"
  | "scales"
  | "arcs"
  | "circuit"
  | "starry-night"
  | "raindrops"
  | "terrazzo"
  | "truchet"
  | "halfblocks"
  | "ribbons"
  | "steps"
  | "wedge"
  | "bowtie"
  | "pinwheel"
  | "quarters";

/** Picker order: simple geometric staples first, elaborate constructions after. */
export const PATTERN_TYPES: PatternType[] = [
  "dots",
  "stripes",
  "grid",
  "chevron",
  "checks",
  "rules",
  "waves",
  "triangles",
  "hexagon",
  "grain",
  "diamonds",
  "basketweave",
  "cubes",
  "crosses",
  "plaid",
  "scales",
  "arcs",
  "circuit",
  "starry-night",
  "raindrops",
  "terrazzo",
  "truchet",
  "halfblocks",
  "ribbons",
  "steps",
  "wedge",
  "bowtie",
  "pinwheel",
  "quarters",
];

export const PATTERN_LABELS: Record<PatternType, string> = {
  dots: "Dots",
  stripes: "Stripes",
  grid: "Grid",
  chevron: "Chevron",
  checks: "Checks",
  rules: "Rules",
  waves: "Waves",
  triangles: "Triangles",
  hexagon: "Hexagon",
  grain: "Grain",
  diamonds: "Diamonds",
  basketweave: "Basketweave",
  cubes: "Cubes",
  crosses: "Crosses",
  plaid: "Plaid",
  scales: "Scales",
  arcs: "Arcs",
  circuit: "Circuit",
  "starry-night": "Starry Night",
  raindrops: "Raindrops",
  terrazzo: "Terrazzo",
  truchet: "Truchet",
  halfblocks: "Half Blocks",
  ribbons: "Ribbons",
  steps: "Steps",
  wedge: "Wedge",
  bowtie: "Bowtie",
  pinwheel: "Pinwheel",
  quarters: "Quarters",
};

/**
 * Every pattern type ships free. The map stays as the gating seam: flipping an
 * entry to `true` re-gates that type — the picker badge, the upgrade CTA, and
 * the block on applying it are all driven from here and need no other change.
 *
 * Colour pairing (curated, brand-derived, custom) is free regardless.
 */
export const PATTERN_PRO_GATE: Record<PatternType, boolean> = {
  dots: false,
  stripes: false,
  grid: false,
  chevron: false,
  checks: false,
  rules: false,
  waves: false,
  triangles: false,
  hexagon: false,
  grain: false,
  diamonds: false,
  basketweave: false,
  cubes: false,
  crosses: false,
  plaid: false,
  scales: false,
  arcs: false,
  circuit: false,
  "starry-night": false,
  raindrops: false,
  terrazzo: false,
  truchet: false,
  halfblocks: false,
  ribbons: false,
  steps: false,
  wedge: false,
  bowtie: false,
  pinwheel: false,
  quarters: false,
};

/**
 * Types where the rotation control is disabled in the panel.
 *
 * Grain, starry night and terrazzo are seeded random scatters, so rotating them
 * is visually a no-op. Dots are a square lattice — rotating the *lattice* is
 * technically visible, but the brief locks the control off, so it stays off.
 * Raindrops is deliberately absent: rotation there sets the angle of the rain,
 * which is the whole point of the control. Flip an entry here if that product
 * call changes; nothing else needs to move.
 */
export const ROTATION_DISABLED_TYPES: PatternType[] = [
  "dots",
  "grain",
  "starry-night",
  "terrazzo",
];

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
