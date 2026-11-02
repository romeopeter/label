import type { Connector, ConnectorHead, ShapeElement } from "@/types";

type Point = [number, number];

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const length = (a: Point) => Math.hypot(a[0], a[1]);
const unit = (a: Point): Point => {
  const size = length(a);
  return size === 0 ? [1, 0] : [a[0] / size, a[1] / size];
};

/** A quadratic curve's control point sits off the curve; the handle sits on it. */
export const curveHandle = ({ start, end, control }: Connector): Point =>
  control
    ? [
        0.25 * start[0] + 0.5 * control[0] + 0.25 * end[0],
        0.25 * start[1] + 0.5 * control[1] + 0.25 * end[1],
      ]
    : scale(add(start, end), 0.5);

export const controlFromHandle = (
  { start, end }: Connector,
  handle: Point,
): Point => sub(scale(handle, 2), scale(add(start, end), 0.5));

/** The bow a new curve starts with, so it reads as curved straight away. */
export const defaultControl = (start: Point, end: Point): Point => {
  const delta = sub(end, start);
  const bow = 0.3 * length(delta);
  const normal: Point = [unit(delta)[1], -unit(delta)[0]];
  return add(add(start, scale(delta, 0.5)), scale(normal, bow));
};

/**
 * Re-bases a connector on its own bounding box, so `x`/`y`/`width`/`height` stay
 * true and everything that reads an element's box (alignment, centring) works.
 */
export const placeConnector = (
  originX: number,
  originY: number,
  connector: Connector,
): Pick<ShapeElement, "x" | "y" | "width" | "height" | "connector"> => {
  const points = [connector.start, connector.end];
  if (connector.route === "curved" && connector.control) {
    points.push(connector.control);
  }
  const minX = Math.min(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const maxY = Math.max(...points.map((p) => p[1]));
  const origin: Point = [minX, minY];

  return {
    x: originX + minX,
    y: originY + minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    connector: {
      ...connector,
      start: sub(connector.start, origin),
      end: sub(connector.end, origin),
      control: connector.control && sub(connector.control, origin),
    },
  };
};

/** Changes a connector's route or heads, adding a curve's control point if new. */
export const patchConnector = (
  el: Pick<ShapeElement, "x" | "y">,
  connector: Connector,
  patch: Partial<Connector>,
) => {
  const next = { ...connector, ...patch };
  if (next.route === "curved" && !next.control) {
    next.control = defaultControl(next.start, next.end);
  }
  return placeConnector(el.x, el.y, next);
};

/** The right-angle path between two points, leaving along the longer axis. */
const elbowPoints = (start: Point, end: Point): Point[] => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return [start, end];
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = start[0] + dx / 2;
    return [start, [midX, start[1]], [midX, end[1]], end];
  }
  const midY = start[1] + dy / 2;
  return [start, [start[0], midY], [end[0], midY], end];
};

const roundedPolyline = (points: Point[], radius: number) => {
  let path = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const toPrev = sub(points[i - 1], corner);
    const toNext = sub(points[i + 1], corner);
    const r = Math.min(radius, length(toPrev) / 2, length(toNext) / 2);
    const entry = add(corner, scale(unit(toPrev), r));
    const exit = add(corner, scale(unit(toNext), r));
    path += `L${entry[0]} ${entry[1]}Q${corner[0]} ${corner[1]} ${exit[0]} ${exit[1]}`;
  }
  const last = points[points.length - 1];
  return `${path}L${last[0]} ${last[1]}`;
};

interface HeadShape {
  path: string;
  filled: boolean;
  /** How far the shaft stops short, so a thick line can't poke through a tip. */
  inset: number;
}

const headShape = (
  head: ConnectorHead,
  tip: Point,
  direction: Point,
  size: number,
): HeadShape | null => {
  if (head === "none") return null;

  if (head === "dot") {
    const r = size * 0.35;
    return {
      path:
        `M${tip[0] - r} ${tip[1]}a${r} ${r} 0 1 0 ${r * 2} 0` +
        `a${r} ${r} 0 1 0 ${-r * 2} 0z`,
      filled: true,
      inset: 0,
    };
  }

  const base = sub(tip, scale(direction, size));
  const side = scale([-direction[1], direction[0]], size * 0.55);
  const left = add(base, side);
  const right = sub(base, side);
  const wings =
    `M${left[0]} ${left[1]}L${tip[0]} ${tip[1]}L${right[0]} ${right[1]}`;

  return head === "open"
    ? { path: wings, filled: false, inset: 0 }
    : { path: `${wings}z`, filled: true, inset: size * 0.85 };
};

export interface ConnectorGeometry {
  shaft: string;
  heads: { path: string; filled: boolean }[];
}

/** Turns a connector into the paths that draw it: one shaft, up to two heads. */
export const connectorGeometry = (
  connector: Connector,
  headSize: number,
): ConnectorGeometry => {
  const { start, end, control, route, headStart, headEnd } = connector;
  const corners = route === "elbow" ? elbowPoints(start, end) : null;

  // The direction the line arrives from at each end.
  const fromStart: Point = corners
    ? sub(start, corners[1])
    : route === "curved" && control
      ? sub(start, control)
      : sub(start, end);
  const fromEnd: Point = corners
    ? sub(end, corners[corners.length - 2])
    : route === "curved" && control
      ? sub(end, control)
      : sub(end, start);

  const startDirection = unit(fromStart);
  const endDirection = unit(fromEnd);
  // A head can't be longer than the line it sits on.
  const span = length(sub(end, start));
  const size = Math.min(headSize, Math.max(span * 0.45, 1));
  const startHead = headShape(headStart, start, startDirection, size);
  const endHead = headShape(headEnd, end, endDirection, size);

  const from = sub(start, scale(startDirection, startHead?.inset ?? 0));
  const to = sub(end, scale(endDirection, endHead?.inset ?? 0));

  let shaft: string;
  if (corners) {
    const trimmed = corners.slice();
    trimmed[0] = from;
    trimmed[trimmed.length - 1] = to;
    shaft = roundedPolyline(trimmed, 24);
  } else if (route === "curved" && control) {
    shaft = `M${from[0]} ${from[1]}Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`;
  } else {
    shaft = `M${from[0]} ${from[1]}L${to[0]} ${to[1]}`;
  }

  return {
    shaft,
    heads: [startHead, endHead].flatMap((head) =>
      head ? [{ path: head.path, filled: head.filled }] : [],
    ),
  };
};

/** Pins a point to the nearest 45° from an anchor, for Shift-constrained drags. */
export const constrainAngle = (anchor: Point, point: Point): Point => {
  const delta = sub(point, anchor);
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(delta[1], delta[0]) / step) * step;
  const size = length(delta);
  return add(anchor, [Math.cos(angle) * size, Math.sin(angle) * size]);
};
