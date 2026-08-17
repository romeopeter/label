import Konva from "konva";
import { useEditor } from "@/store/editor";
import { PATTERN_FILL_NAME } from "@/components/canvas/PatternFillRect";
import { resolveColorPair } from "@/lib/patterns/resolveColorPair";
import { getPatternTile } from "@/lib/patterns/tileCache";

/** Guards against generating an absurdly large tile from a high pixel ratio. */
const MAX_EXPORT_DPI = 4;

/**
 * Swap the pattern background onto an export-resolution tile before capture,
 * and hand back a cleanup that restores the preview tile.
 *
 * The preview tile is rasterized for screen; capturing at a higher pixel ratio
 * would upscale that bitmap and the pattern would land soft in the export. So
 * the tile is regenerated at the capture density and the fill scaled back down
 * by the same factor, which keeps the pattern the same size on the artboard
 * while giving it the pixels the export needs.
 *
 * Shaped to match `renderTiltedImageIntoStage` — returns a cleanup fn or null —
 * so it slots into the existing export lifecycle rather than starting a second one.
 */
export const prepareExportTiles = async (
  stage: Konva.Stage,
  exportScale: number,
): Promise<(() => void) | null> => {
  const { background, customPatternPairs } = useEditor.getState();
  if (background.mode !== "pattern") return null;

  const node = stage.findOne<Konva.Rect>(`.${PATTERN_FILL_NAME}`);
  if (!node) return null;

  const dpiScale = Math.min(Math.max(Math.ceil(exportScale), 1), MAX_EXPORT_DPI);

  const previousImage = node.fillPatternImage();
  const previousScale = node.fillPatternScaleX();
  if (previousScale === 1 / dpiScale && previousImage) return null;

  const { type, size } = background.pattern;
  const tile = await getPatternTile(
    { type, size },
    resolveColorPair(background.pattern.colorPairId, customPatternPairs),
    dpiScale,
  );

  node.fillPatternImage(tile);
  node.fillPatternScaleX(1 / dpiScale);
  node.fillPatternScaleY(1 / dpiScale);
  node.getLayer()?.batchDraw();

  return () => {
    node.fillPatternImage(previousImage);
    node.fillPatternScaleX(previousScale);
    node.fillPatternScaleY(previousScale);
    node.getLayer()?.batchDraw();
  };
};
