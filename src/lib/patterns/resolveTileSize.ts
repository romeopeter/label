const MIN_TILE_PX = 48; // small / dense
const MAX_TILE_PX = 160; // large / sparse

/**
 * Map the 0–1 size slider onto a tile dimension in px.
 *
 * The tile SVG is regenerated at this size rather than scaled from a fixed
 * tile, so stroke widths and dot radii stay proportionally correct at every
 * step instead of blurring when scaled up.
 */
export const resolveTileSizePx = (size: number): number => {
  const clamped = Math.min(Math.max(size, 0), 1);
  return Math.round(MIN_TILE_PX + clamped * (MAX_TILE_PX - MIN_TILE_PX));
};
