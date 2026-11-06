import { useEffect, useState, type RefObject } from "react";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import { frameShapeOf, pictureView, screenBoxOf, sourceOf } from "@/lib/mockups";
import { visibleCrop } from "@/lib/layouts";
import type { ImageElement } from "@/types";

const clampPan = (value: number) => Math.min(Math.max(value, -1), 1);

/** Whether Alt is down. While it is, a mockup stays put and its picture moves instead. */
export const useAltHeld = () => {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setHeld(event.altKey);
    const onBlur = () => setHeld(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return held;
};

const elementUnder = (target: Konva.Node, elements: ImageElement[]) => {
  let node: Konva.Node | null = target;
  while (node) {
    const id = node.id();
    const found = id ? elements.find((el) => el.id === id) : undefined;
    if (found) return found;
    node = node.getParent();
  }
  return undefined;
};

/**
 * Alt-dragging a mockup moves the picture inside it. Handled here rather than with
 * Konva's drag, because the frame itself has to stay put. Layouts have their own drag,
 * which already moves a picture within its slot.
 */
export const usePictureDrag = (stageRef: RefObject<Konva.Stage | null>) => {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (!event.evt.altKey) return;
      const { elements, layout, markTool, cropId } = useEditor.getState();
      if (markTool || cropId) return;
      const images = elements.filter((el): el is ImageElement => el.type === "image");
      const el = elementUnder(event.target, images);
      const frame = el?.deviceFrame;
      if (!el || !frame || el.locked) return;
      if (layout?.slots.some((slot) => slot.id === el.id)) return;
      const shape = frameShapeOf(el);
      if (!shape) return;

      const { room } = pictureView(
        sourceOf(visibleCrop(el), el.naturalWidth ?? el.width, el.naturalHeight ?? el.height),
        screenBoxOf(el, shape),
        frame,
      );
      const angle = (-el.rotation * Math.PI) / 180;
      const scale = stage.scaleX();
      const startX = event.evt.clientX;
      const startY = event.evt.clientY;

      const onMove = (move: MouseEvent) => {
        const dx = (move.clientX - startX) / scale;
        const dy = (move.clientY - startY) / scale;
        // Along the mockup's own sides, whichever way it's turned.
        const along = dx * Math.cos(angle) - dy * Math.sin(angle);
        const down = dx * Math.sin(angle) + dy * Math.cos(angle);
        useEditor.getState().setDeviceFrame(el.id, {
          ...frame,
          panX: room.x ? clampPan(frame.panX + (along * 2) / room.x) : frame.panX,
          panY: room.y ? clampPan(frame.panY + (down * 2) / room.y) : frame.panY,
        });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    stage.on("mousedown.picturedrag", onDown);
    return () => {
      stage.off("mousedown.picturedrag");
    };
  }, [stageRef]);
};
