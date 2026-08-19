import type { PatternColorPair } from "@/types/pattern";

export interface BrandColor {
  name: string;
  hex: string;
}

/**
 * Brand kits are Phase 2 — there is no brand store to read from yet, and the
 * BRANDS panel is still a Pro stub. This is the single seam where brand colours
 * enter the pattern system: when the brand store lands, return its colours from
 * here and the "From your brand" row lights up with no other change.
 */
export const getBrandColors = (): BrandColor[] => [];

/**
 * Ordered pairs, so a colour can appear as either base or accent — swapping the
 * two reads as a genuinely different pattern, not a duplicate. Capped so the
 * picker doesn't drown in near-identical swatches.
 *
 * Available on the free tier by design: it's the deliberate taste of brand
 * consistency. Only full brand-kit propagation stays Pro-gated.
 */
export const deriveBrandPatternPairs = (
  colors: BrandColor[] = getBrandColors(),
): PatternColorPair[] => {
  if (colors.length < 2) return [];

  const pairs: PatternColorPair[] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = 0; j < colors.length; j++) {
      if (i === j) continue;
      pairs.push({
        id: `brand-${i}-${j}`,
        base: colors[i].hex,
        accent: colors[j].hex,
        source: "brand",
        label: `${colors[i].name} / ${colors[j].name}`,
      });
    }
  }
  return pairs.slice(0, 3);
};
