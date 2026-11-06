import { useEffect, useState, type RefObject } from "react";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import { arrangeLayout, slotAt } from "@/lib/layouts";

const DRAG_START_PX = 4;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Dragging an image in a layout: inside its slot it moves the picture within the
 * trim; over another slot it offers a swap, which happens on release. Handled
 * here rather than with Konva's drag, because the node itself must stay put.
 */
export const useLayoutDrag = (stageRef: RefObject<Konva.Stage | null>) => {
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
      const { layout, elements, markTool, cropId } = useEditor.getState();
      if (!layout || markTool || cropId) return;

      let node: Konva.Node | null = event.target;
      let index = -1;
      while (node && index === -1) {
        const id = node.id();
        index = id ? layout.slots.findIndex((slot) => slot.id === id) : -1;
        node = node.getParent();
      }
      if (index === -1) return;
      const element = elements.find((el) => el.id === layout.slots[index].id);
      if (element?.locked) return;

      const startX = event.evt.clientX;
      const startY = event.evt.clientY;
      const startFocus = layout.slots[index].focus ?? { x: 0.5, y: 0.5 };
      let moved = false;
      let target: number | null = null;

      const onMove = (move: MouseEvent) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
        moved = true;

        const state = useEditor.getState();
        if (!state.layout) return;
        const arrangement = arrangeLayout(state.layout, state.elements, state.canvas);
        const box = stage.container().getBoundingClientRect();
        const scale = stage.scaleX();
        const over = slotAt(
          arrangement,
          (move.clientX - box.left) / scale,
          (move.clientY - box.top) / scale,
        );

        if (over !== null && over !== index) {
          target = over;
          setDropSlot(over);
          return;
        }

        target = null;
        setDropSlot(null);

        const place = arrangement.slots[index];
        if (over !== index || !place?.crop) return;
        const roomX = (place.width / place.crop.width - place.width) * scale;
        const roomY = (place.height / place.crop.height - place.height) * scale;
        state.setSlotFocus(index, {
          x: roomX > 0 ? clamp01(startFocus.x - dx / roomX) : startFocus.x,
          y: roomY > 0 ? clamp01(startFocus.y - dy / roomY) : startFocus.y,
        });
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setDropSlot(null);
        if (target !== null) useEditor.getState().swapSlots(index, target);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    stage.on("mousedown.layoutdrag", onDown);
    return () => {
      stage.off("mousedown.layoutdrag");
    };
  }, [stageRef]);

  return dropSlot;
};
