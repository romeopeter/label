import { forwardRef, useImperativeHandle, useState } from "react";
import { Layer } from "react-konva";
import type { ShapeElement } from "@/types";
import { ShapeNode } from "./ShapeNode";

/** Konva name the exporter hides before capture. */
export const MARK_DRAFT_LAYER_NAME = "mark-draft";

export interface MarkDraftHandle {
  show: (draft: ShapeElement | null) => void;
}

const noop = () => {};

/**
 * The mark being dragged out, drawn by the same node that draws the finished
 * one so the preview can't disagree with the result. Its state stays in here,
 * like SnapGuides: the store only hears about finished marks, so a pointer move
 * repaints this layer and nothing else.
 */
export const MarkDraft = forwardRef<MarkDraftHandle>((_props, ref) => {
  const [draft, setDraft] = useState<ShapeElement | null>(null);

  useImperativeHandle(ref, () => ({ show: setDraft }), []);

  return (
    <Layer name={MARK_DRAFT_LAYER_NAME} listening={false}>
      {draft && <ShapeNode el={draft} selected={false} onSelect={noop} />}
    </Layer>
  );
});

MarkDraft.displayName = "MarkDraft";
