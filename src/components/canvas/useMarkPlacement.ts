import { useEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import { useEditor } from "@/store/editor";
import { gestureFields, toolCategory, type Gesture } from "@/lib/markTools";
import { SNAP_THRESHOLD_PX, snapPoint, type SnapCandidates } from "@/lib/snapping";
import type { MarkTool, ShapeElement, ShapeKind } from "@/types";
import type { MarkDraftHandle } from "./MarkDraft";
import { snapCandidatesFor } from "./snapCandidates";
import type { SnapGuidesHandle } from "./SnapGuides";

/** Screen px the pointer must travel before a stroke records another point. */
const MIN_STEP_PX = 2;
/** Screen px of travel below which a press counts as a click, not a drag. */
const CLICK_SLOP_PX = 4;

const DEFAULT_TEXT_WIDTH = 720;

const NEW_TEXT = {
  text: "",
  fontFamily: "DM Sans",
  fontSize: 72,
  fontWeight: 700,
  fill: "#FFFFFF",
  lineHeight: 1.15,
  letterSpacing: 0,
} as const;

const draftElement = (shape: ShapeKind, fields: Partial<ShapeElement>): ShapeElement => ({
  id: "mark-draft",
  type: "shape",
  shape,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  rotation: 0,
  opacity: 1,
  fill: "#000000",
  stroke: "#000000",
  strokeWidth: 0,
  cornerRadius: 0,
  dashed: false,
  ...fields,
});

const toolStyle = (tool: MarkTool) => {
  const category = toolCategory(tool);
  return category ? useEditor.getState().markStyles[category] : {};
};

const preview = (tool: MarkTool, gesture: Gesture, scale: number): ShapeElement => {
  if (tool.kind === "text") {
    return draftElement("rect", {
      x: Math.min(gesture.start[0], gesture.current[0]),
      y: gesture.start[1],
      width: Math.abs(gesture.current[0] - gesture.start[0]),
      height: NEW_TEXT.fontSize * NEW_TEXT.lineHeight,
      filled: false,
      stroke: "#AFA9EC",
      strokeWidth: 1.5 / scale,
    });
  }
  return draftElement(
    tool.shape,
    gestureFields(tool, toolStyle(tool), gesture, useEditor.getState().elements),
  );
};

const commit = (tool: MarkTool, gesture: Gesture) => {
  const editor = useEditor.getState();

  if (tool.kind === "text") {
    const width = gesture.isClick
      ? DEFAULT_TEXT_WIDTH
      : Math.abs(gesture.current[0] - gesture.start[0]);
    const id = editor.addText("body", {
      ...NEW_TEXT,
      x: gesture.isClick
        ? gesture.start[0]
        : Math.min(gesture.start[0], gesture.current[0]),
      y: gesture.start[1],
      width,
    });
    editor.setMarkTool(null);
    editor.selectElement(id);
    editor.setEditingId(id);
    return;
  }

  const id = editor.addShape(
    tool.shape,
    gestureFields(tool, toolStyle(tool), gesture, editor.elements),
  );

  // Every tool hands back to selecting, with what it made ready to adjust.
  editor.setMarkTool(null);
  editor.selectElement(id);
  if (tool.shape === "callout") editor.setEditingId(id);
};

/** Turns a press-drag-release on the stage into a new mark while a tool is armed. */
export const useMarkPlacement = (
  stageRef: RefObject<Konva.Stage>,
  draftRef: RefObject<MarkDraftHandle>,
  guidesRef: RefObject<SnapGuidesHandle>,
  scale: number,
) => {
  const tool = useEditor((s) => s.markTool);
  const gestureRef = useRef<Gesture | null>(null);
  const candidatesRef = useRef<SnapCandidates | null>(null);

  const pointer = (): [number, number] | null => {
    const point = stageRef.current?.getRelativePointerPosition();
    return point ? [point.x, point.y] : null;
  };

  // A release anywhere finishes the mark, including outside the canvas.
  useEffect(() => {
    if (!tool) return;
    const guides = guidesRef.current;

    const finish = () => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture) return;
      draftRef.current?.show(null);
      guides?.clear();
      commit(tool, gesture);
    };

    window.addEventListener("pointerup", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      // Esc or leaving the tool mid-drag abandons the mark.
      gestureRef.current = null;
      guides?.clear();
    };
  }, [tool, draftRef, guidesRef]);

  const onPointerDown = () => {
    const raw = pointer();
    const stage = stageRef.current;
    if (!tool || !raw || !stage) return;

    // Freehand follows the hand, so it's the one tool that doesn't snap.
    candidatesRef.current =
      tool.kind === "stroke" ? null : snapCandidatesFor(stage);
    const point = candidatesRef.current
      ? snapPoint(raw, candidatesRef.current, SNAP_THRESHOLD_PX / scale).point
      : raw;

    gestureRef.current = {
      start: point,
      current: point,
      points: [point[0], point[1], point[0], point[1]],
      shift: false,
      isClick: true,
    };
  };

  const onPointerMove = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const gesture = gestureRef.current;
    const raw = pointer();
    if (!tool || !gesture || !raw) return;

    // Shift already pins the end to an angle or a square; a snap would fight it.
    const snapped =
      candidatesRef.current && !event.evt.shiftKey
        ? snapPoint(raw, candidatesRef.current, SNAP_THRESHOLD_PX / scale)
        : null;
    const point = snapped?.point ?? raw;
    guidesRef.current?.show(snapped?.guides ?? []);

    const travelled = Math.hypot(
      point[0] - gesture.start[0],
      point[1] - gesture.start[1],
    );
    const { points } = gesture;
    const stepped = Math.hypot(
      point[0] - points[points.length - 2],
      point[1] - points[points.length - 1],
    );
    if (stepped >= MIN_STEP_PX / scale) points.push(point[0], point[1]);

    gesture.current = point;
    gesture.shift = event.evt.shiftKey;
    gesture.isClick = gesture.isClick && travelled * scale < CLICK_SLOP_PX;

    if (!gesture.isClick) draftRef.current?.show(preview(tool, gesture, scale));
  };

  return { onPointerDown, onPointerMove };
};
