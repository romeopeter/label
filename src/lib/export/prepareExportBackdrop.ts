import Konva from "konva";
import { BACKGROUND_FILL_NAME, DRAW_AT_ATTR, type DrawAt } from "@/components/canvas/BackgroundFill";

/**
 * Draws a background made by Layer's renderer (an abstract one, or any type with
 * effects) again at the export's scale before capture, and hands back a cleanup
 * that restores the preview. The preview is drawn for the screen, so capturing
 * it as it is would stretch it and leave it soft.
 *
 * Shaped like `prepareExportTiles`, so it slots into the same export steps.
 */
export const prepareExportBackdrop = async (
  stage: Konva.Stage,
  exportScale: number,
): Promise<(() => void) | null> => {
  const node = stage.findOne<Konva.Image>(`.${BACKGROUND_FILL_NAME}`);
  if (!node || !(node instanceof Konva.Image)) return null;
  const drawAt = node.getAttr(DRAW_AT_ATTR) as DrawAt | undefined;
  if (!drawAt) return null;

  const sharp = document.createElement("canvas");
  if (!(await drawAt(exportScale, sharp))) return null;

  const preview = node.image();
  node.image(sharp);
  node.getLayer()?.batchDraw();
  return () => {
    node.image(preview);
    node.getLayer()?.batchDraw();
  };
};
