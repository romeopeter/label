import { forwardRef, useImperativeHandle, useState } from "react";
import { Layer, Line } from "react-konva";
import type { SnapGuide } from "@/lib/snapping";

/** Konva name the exporter hides before capture. */
export const SNAP_GUIDES_LAYER_NAME = "snap-guides";

/** Reads as system feedback rather than artwork, and stays clear of the
 *  purple/teal/amber the design itself uses. */
const GUIDE_COLOR = "#ff4d8d";

export interface SnapGuidesHandle {
  show: (guides: SnapGuide[]) => void;
  clear: () => void;
}

const sameGuides = (a: SnapGuide[], b: SnapGuide[]) =>
  a.length === b.length &&
  a.every((g, i) => {
    const other = b[i];
    return (
      g.axis === other.axis &&
      g.pos === other.pos &&
      g.from === other.from &&
      g.to === other.to
    );
  });

/**
 * Transient alignment guides, driven imperatively through a ref.
 *
 * Holding these in the store — or in CanvasStage's state — would re-render
 * every node on the stage on every pointer move of a drag. Keeping the state
 * inside this component means a moving guide repaints only the guide layer.
 * The equality check matters for the same reason: most frames of a drag
 * produce no guides at all, and shouldn't cost a render.
 */
export const SnapGuides = forwardRef<SnapGuidesHandle>((_props, ref) => {
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      show: (next) => setGuides((prev) => (sameGuides(prev, next) ? prev : next)),
      clear: () => setGuides((prev) => (prev.length ? [] : prev)),
    }),
    [],
  );

  return (
    <Layer name={SNAP_GUIDES_LAYER_NAME} listening={false}>
      {guides.map((g) => (
        <Line
          key={`${g.axis}${g.pos}`}
          points={
            g.axis === "x"
              ? [g.pos, g.from, g.pos, g.to]
              : [g.from, g.pos, g.to, g.pos]
          }
          stroke={GUIDE_COLOR}
          strokeWidth={1}
          // Keeps the line a hairline at any zoom instead of thickening with
          // the stage transform.
          strokeScaleEnabled={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
});

SnapGuides.displayName = "SnapGuides";
