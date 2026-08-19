import type Konva from "konva";

export const konvaToScreenCoords = (
  konvaX: number,
  konvaY: number,
  stage: Konva.Stage,
): { left: number; top: number } => {
  const rect = stage.container().getBoundingClientRect();

  return {
    left: rect.left + stage.x() + konvaX * stage.scaleX(),
    top: rect.top + stage.y() + konvaY * stage.scaleY(),
  };
};
