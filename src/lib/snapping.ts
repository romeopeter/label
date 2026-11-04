/**
 * Smart-guide geometry: given the box being dragged and everything it could
 * line up with, work out how far to nudge it and which guide lines to draw.
 *
 * Deliberately pure — no Konva, no store. The caller supplies bounds in canvas
 * coordinates and gets back a delta plus lines; that keeps the fiddly part
 * (which is all arithmetic) separable from the drag plumbing.
 *
 * Distinct from the layout grid: the grid is a fixed interval that is always
 * on, these appear only while dragging and only where the geometry actually
 * agrees. See GridOverlay.tsx.
 */

export type SnapAxis = "x" | "y";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** How close, in *screen* px, a pair has to be before it snaps. */
export const SNAP_THRESHOLD_PX = 6;

/** Positions considered equal once snapped, guarding float drift. */
const EPSILON = 0.01;

export interface SnapCandidate {
  /** Position on the snapping axis. */
  value: number;
  /** Extent of whatever produced this, along the *other* axis. */
  from: number;
  to: number;
}

export interface SnapGuide {
  axis: SnapAxis;
  pos: number;
  from: number;
  to: number;
}

export interface SnapCandidates {
  x: SnapCandidate[];
  y: SnapCandidate[];
}

/** Leading edge, centre, trailing edge — the three lines anything aligns on. */
const refsOf = (min: number, max: number) => [min, (min + max) / 2, max];

/**
 * Build the candidate set once per drag. Bounds don't move while another
 * element is being dragged, so recomputing this on every pointer move would be
 * pure waste.
 */
export const buildCandidates = (
  others: Bounds[],
  canvas: { width: number; height: number },
): SnapCandidates => {
  const x: SnapCandidate[] = [];
  const y: SnapCandidate[] = [];

  // Canvas edges and centre: these guides span the full opposite dimension.
  for (const value of refsOf(0, canvas.width)) x.push({ value, from: 0, to: canvas.height });
  for (const value of refsOf(0, canvas.height)) y.push({ value, from: 0, to: canvas.width });

  for (const b of others) {
    for (const value of refsOf(b.minX, b.maxX)) x.push({ value, from: b.minY, to: b.maxY });
    for (const value of refsOf(b.minY, b.maxY)) y.push({ value, from: b.minX, to: b.maxX });
  }

  return { x, y };
};

/** Smallest nudge that brings any reference onto any candidate. */
const bestDelta = (
  refs: number[],
  candidates: SnapCandidate[],
  threshold: number,
): number => {
  let best: number | null = null;

  for (const ref of refs) {
    for (const candidate of candidates) {
      const delta = candidate.value - ref;
      if (Math.abs(delta) > threshold) continue;
      if (best === null || Math.abs(delta) < Math.abs(best)) best = delta;
    }
  }

  return best ?? 0;
};

/**
 * Every candidate the snapped box now sits on. More than one can match at once
 * — aligning to a neighbour that is itself on the canvas centre should light up
 * both — so extents are merged per position rather than first-match-wins.
 */
const matchGuides = (
  axis: SnapAxis,
  refs: number[],
  candidates: SnapCandidate[],
  perpMin: number,
  perpMax: number,
): SnapGuide[] => {
  const merged = new Map<number, { from: number; to: number }>();

  for (const ref of refs) {
    for (const candidate of candidates) {
      if (Math.abs(candidate.value - ref) > EPSILON) continue;
      const existing = merged.get(candidate.value);
      merged.set(candidate.value, {
        from: Math.min(existing?.from ?? candidate.from, candidate.from, perpMin),
        to: Math.max(existing?.to ?? candidate.to, candidate.to, perpMax),
      });
    }
  }

  return [...merged].map(([pos, { from, to }]) => ({ axis, pos, from, to }));
};

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/** Snaps a lone point, like a line's end or a corner being drawn out. */
export const snapPoint = (
  [x, y]: [number, number],
  candidates: SnapCandidates,
  threshold: number,
): { point: [number, number]; guides: SnapGuide[] } => {
  const { dx, dy, guides } = computeSnap(
    { minX: x, minY: y, maxX: x, maxY: y },
    candidates,
    threshold,
  );
  return { point: [x + dx, y + dy], guides };
};

/**
 * Where a resize handle should go, given the point `snapPoint` pulled it to. A side
 * handle moves on one axis only. With a fixed ratio both can't line up, so the
 * corner takes the axis that snapped and stays on the box's diagonal.
 */
export const resizeSnapResult = (
  anchor: string,
  raw: [number, number],
  snapped: [number, number],
  start: Bounds,
  fixedRatio: boolean,
): { point: [number, number]; axes: SnapAxis[] } => {
  const isSide = anchor.startsWith("middle");
  const isTopOrBottom = anchor === "top-center" || anchor === "bottom-center";
  if (isSide) return { point: [snapped[0], raw[1]], axes: ["x"] };
  if (isTopOrBottom) return { point: [raw[0], snapped[1]], axes: ["y"] };
  if (!fixedRatio) return { point: snapped, axes: ["x", "y"] };

  const movedX = snapped[0] !== raw[0];
  const movedY = snapped[1] !== raw[1];
  if (!movedX && !movedY) return { point: raw, axes: [] };

  const oppositeX = anchor.endsWith("left") ? start.maxX : start.minX;
  const oppositeY = anchor.startsWith("top") ? start.maxY : start.minY;
  const signX = anchor.endsWith("left") ? -1 : 1;
  const signY = anchor.startsWith("top") ? -1 : 1;
  const ratio = (start.maxX - start.minX) / (start.maxY - start.minY);

  if (movedX) {
    const width = Math.abs(snapped[0] - oppositeX);
    return { point: [snapped[0], oppositeY + (signY * width) / ratio], axes: ["x"] };
  }
  const height = Math.abs(snapped[1] - oppositeY);
  return { point: [oppositeX + signX * height * ratio, snapped[1]], axes: ["y"] };
};

/**
 * @param threshold in canvas units — convert from `SNAP_THRESHOLD_PX` through
 *   the stage scale, so the pull feels the same at every zoom level.
 */
export const computeSnap = (
  active: Bounds,
  candidates: SnapCandidates,
  threshold: number,
): SnapResult => {
  const dx = bestDelta(refsOf(active.minX, active.maxX), candidates.x, threshold);
  const dy = bestDelta(refsOf(active.minY, active.maxY), candidates.y, threshold);

  // Guides describe where the box lands, not where it was grabbed.
  const minX = active.minX + dx;
  const maxX = active.maxX + dx;
  const minY = active.minY + dy;
  const maxY = active.maxY + dy;

  return {
    dx,
    dy,
    guides: [
      ...matchGuides("x", refsOf(minX, maxX), candidates.x, minY, maxY),
      ...matchGuides("y", refsOf(minY, maxY), candidates.y, minX, maxX),
    ],
  };
};
