import type Konva from "konva";
import { useEditor } from "@/store/editor";
import { buildCandidates, type Bounds, type SnapCandidates } from "@/lib/snapping";

/** Konva name of the layer holding the document's elements. */
export const CONTENT_LAYER_NAME = "content";

/**
 * Axis-aligned bounds in canvas coordinates.
 *
 * `getClientRect` is used rather than the element's stored x/y/width/height so
 * rotated elements align by the box you actually see. Shadow and stroke are
 * skipped so guides track the shape's geometry instead of its glow.
 */
export const boundsOf = (node: Konva.Node): Bounds => {
  const rect = node.getClientRect({
    relativeTo: node.getLayer() ?? undefined,
    skipShadow: true,
    skipStroke: true,
  });
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };
};

/**
 * Everything a moving thing can line up with. Only real elements count, which
 * filters out the Transformer and the watermark that share their layer.
 */
export const snapCandidatesFor = (
  stage: Konva.Stage,
  excludeId?: string,
): SnapCandidates | null => {
  const { elements, canvas, snapEnabled } = useEditor.getState();
  if (!snapEnabled) return null;

  const layer = stage.findOne<Konva.Layer>(`.${CONTENT_LAYER_NAME}`);
  const elementIds = new Set(elements.map((el) => el.id));
  const others = (layer?.getChildren() ?? [])
    .filter((child) => {
      const id = child.id();
      return !!id && id !== excludeId && elementIds.has(id) && child.visible();
    })
    .map(boundsOf);

  return buildCandidates(others, canvas);
};
