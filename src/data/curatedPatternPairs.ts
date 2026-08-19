import type { PatternColorPair } from "@/types/pattern";

/**
 * Duotone presets spanning warm / cool / neutral.
 *
 * NOTE (per §10.1 of the brief): these hexes are a structurally-correct
 * placeholder set. The final values are meant to be eyedroppered directly off
 * the reference swatch grid by a designer before ship — replace the values in
 * place, keep the ids stable, since `.laybel` files reference them by id.
 */
export const CURATED_PATTERN_PAIRS: PatternColorPair[] = [
  // Warm
  { id: "curated-01", base: "#1C1F3B", accent: "#F26D5B", source: "curated" },
  { id: "curated-02", base: "#8B5E3C", accent: "#D9B08C", source: "curated" },
  { id: "curated-03", base: "#FBD65B", accent: "#EF4854", source: "curated" },
  { id: "curated-04", base: "#603813", accent: "#D8CDB8", source: "curated" },
  { id: "curated-05", base: "#F5A623", accent: "#F7C873", source: "curated" },
  { id: "curated-06", base: "#C8A13D", accent: "#5B3B8C", source: "curated" },
  { id: "curated-07", base: "#EFA394", accent: "#E8624F", source: "curated" },
  { id: "curated-08", base: "#7A2E1E", accent: "#F0B67F", source: "curated" },

  // Cool
  { id: "curated-09", base: "#0F2E4C", accent: "#4FB0C6", source: "curated" },
  { id: "curated-10", base: "#101B3D", accent: "#7A8CF0", source: "curated" },
  { id: "curated-11", base: "#123B36", accent: "#69D3A7", source: "curated" },
  { id: "curated-12", base: "#1B2A41", accent: "#CCC9DC", source: "curated" },
  { id: "curated-13", base: "#2E1F5E", accent: "#9C6ADE", source: "curated" },
  { id: "curated-14", base: "#0B3954", accent: "#BFD7EA", source: "curated" },
  { id: "curated-15", base: "#254E70", accent: "#8EE3EF", source: "curated" },
  { id: "curated-16", base: "#1F3A5F", accent: "#F4D35E", source: "curated" },

  // Neutral / high contrast
  { id: "curated-17", base: "#0F0E1A", accent: "#E7E5F5", source: "curated" },
  { id: "curated-18", base: "#F4F1EA", accent: "#2B2B2B", source: "curated" },
  { id: "curated-19", base: "#2B2B2B", accent: "#A8A29A", source: "curated" },
  { id: "curated-20", base: "#D8D3C7", accent: "#6B6559", source: "curated" },
  { id: "curated-21", base: "#1A1826", accent: "#AFA9EC", source: "curated" },
  { id: "curated-22", base: "#EDEAE3", accent: "#C25B3A", source: "curated" },
  { id: "curated-23", base: "#3D3B4F", accent: "#F2F0E6", source: "curated" },
  { id: "curated-24", base: "#0A100D", accent: "#1D9E75", source: "curated" },
];
