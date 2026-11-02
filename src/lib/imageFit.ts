import type { CanvasSize, ImageElement } from "@/types";

type Box = Pick<ImageElement, "width" | "height">;

/**
 * Centres an image on the canvas, as large as it can be while leaving `percent`
 * of the canvas clear on each side. Keeps its proportions.
 */
export const fitWithPadding = (
  image: Box,
  canvas: Pick<CanvasSize, "width" | "height">,
  percent: number,
) => {
  const room = 1 - (percent * 2) / 100;
  const ratio = Math.min(
    (canvas.width * room) / image.width,
    (canvas.height * room) / image.height,
  );
  const width = image.width * ratio;
  const height = image.height * ratio;

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
  };
};

/** The padding that would give this image its current size. */
export const paddingOf = (
  image: Box,
  canvas: Pick<CanvasSize, "width" | "height">,
) => {
  const widthGap = (canvas.width - image.width) / 2 / canvas.width;
  const heightGap = (canvas.height - image.height) / 2 / canvas.height;
  return Math.max(0, Math.round(Math.min(widthGap, heightGap) * 100));
};
