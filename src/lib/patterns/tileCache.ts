import type { PatternColorPair, PatternType } from "@/types/pattern";
import { PATTERN_GENERATORS } from "./generators";
import { resolveTileSizePx } from "./resolveTileSize";

const MAX_CACHED_TILES = 50;

/**
 * The only parts of a `PatternConfig` that change the tile bitmap. Intensity and
 * rotation are applied by Konva at draw time, so they're neither inputs here nor
 * part of the cache key.
 */
export interface TileSpec {
  type: PatternType;
  size: number;
}

/**
 * Insertion-ordered LRU. A session can cycle through a lot of type/colour/size
 * combinations while the user experiments, so entries are bounded rather than
 * kept forever. Entries are keyed by their full parameter hash, so a stale
 * entry is impossible — eviction is purely about memory.
 *
 * Rotation is not part of the key: it is applied to the pattern space by Konva
 * rather than baked into the tile (see generators.ts).
 */
const tileCache = new Map<string, HTMLImageElement>();

const cacheKey = (
  spec: TileSpec,
  pair: PatternColorPair,
  dpiScale: number,
): string => [spec.type, pair.base, pair.accent, spec.size, dpiScale].join("|");

const touch = (key: string, img: HTMLImageElement) => {
  // Re-inserting moves the key to the end of the iteration order, which is what
  // makes the "oldest key first" eviction below actually least-recently-used.
  tileCache.delete(key);
  tileCache.set(key, img);

  while (tileCache.size > MAX_CACHED_TILES) {
    const oldest = tileCache.keys().next();
    if (oldest.done) break;
    tileCache.delete(oldest.value);
  }
};

const svgStringToImage = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Failed to rasterize pattern tile: ${
            typeof event === "string" ? event : "image decode error"
          }`,
        ),
      );
    };
    img.src = url;
  });

/**
 * @param dpiScale 1 for a cheap preview during slider drags, the export pixel
 *   ratio at capture time. The tile is generated `dpiScale` times larger and
 *   the caller must scale the Konva fill down by `1 / dpiScale` so the pattern
 *   keeps its intended on-canvas size while carrying more pixels.
 */
export const getPatternTile = async (
  spec: TileSpec,
  pair: PatternColorPair,
  dpiScale = 1,
): Promise<HTMLImageElement> => {
  const key = cacheKey(spec, pair, dpiScale);
  const cached = tileCache.get(key);
  if (cached) {
    touch(key, cached);
    return cached;
  }

  const tilePx = resolveTileSizePx(spec.size) * dpiScale;
  const svg = PATTERN_GENERATORS[spec.type]({
    size: tilePx,
    base: pair.base,
    accent: pair.accent,
  });

  const img = await svgStringToImage(svg);
  touch(key, img);
  return img;
};
