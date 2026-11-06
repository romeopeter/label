import Konva from "konva";
import { useEditor } from "@/store/editor";
import { BACKDROP_FILL_NAME } from "@/components/canvas/BackdropFill";
import { renderBackdrop } from "@/lib/backdrops/renderer";

/**
 * Draws the abstract background again at the export's scale before capture, and
 * hands back a cleanup that restores the preview. The preview is drawn for the
 * screen, so capturing it as it is would stretch it and leave it soft.
 *
 * Shaped like `prepareExportTiles`, so it slots into the same export steps.
 */
export const prepareExportBackdrop = (stage: Konva.Stage, exportScale: number): (() => void) | null => {
  const { background, canvas } = useEditor.getState();
  if (background.mode !== "abstract") return null;

  const node = stage.findOne<Konva.Image>(`.${BACKDROP_FILL_NAME}`);
  if (!node || !(node instanceof Konva.Image)) return null;

  const sharp = document.createElement("canvas");
  if (!renderBackdrop(background.backdrop, canvas, exportScale, sharp)) return null;

  const preview = node.image();
  node.image(sharp);
  node.getLayer()?.batchDraw();
  return () => {
    node.image(preview);
    node.getLayer()?.batchDraw();
  };
};
