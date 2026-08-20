import type { PatternColorPair } from "@/types/pattern";
import { CURATED_PATTERN_PAIRS } from "@/data/curatedPatternPairs";
import { deriveBrandPatternPairs } from "./deriveBrandPatternPairs";

const FALLBACK_PAIR = CURATED_PATTERN_PAIRS[0];

/**
 * `.laybel` files store only the pair id, so hexes aren't duplicated into every
 * project and custom pairs stay editable in one place. Resolution happens at
 * render time against curated presets, brand-derived pairs, and the user's
 * custom pairs.
 *
 * Custom pairs are passed in rather than read from the store so this stays a
 * pure lookup — callers own where the list comes from.
 *
 * A missing id is expected in normal use: a project referencing a custom pair,
 * opened on an install that doesn't have it, has nothing to resolve. So this
 * falls back to a curated pair rather than throwing.
 */
export const resolveColorPair = (
  colorPairId: string,
  customPairs: PatternColorPair[] = [],
): PatternColorPair =>
  CURATED_PATTERN_PAIRS.find((p) => p.id === colorPairId) ??
  customPairs.find((p) => p.id === colorPairId) ??
  deriveBrandPatternPairs().find((p) => p.id === colorPairId) ??
  FALLBACK_PAIR;
