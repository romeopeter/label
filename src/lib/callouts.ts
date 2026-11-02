import type { CalloutKind } from "@/types";

type Point = [number, number];

export interface CalloutGeometry {
  body: string;
  /** Label callouts point with a line instead of a tail. */
  leader?: { from: Point; to: Point };
  /** Where text can sit without crossing the outline. */
  textBox: { x: number; y: number; width: number; height: number };
}

const isInside = ([x, y]: Point, width: number, height: number) =>
  x >= 0 && x <= width && y >= 0 && y <= height;

const circle = ([cx, cy]: Point, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;

/** The nearest box edge to a point, and where along that edge a tail attaches. */
const tailEdge = (
  [tx, ty]: Point,
  width: number,
  height: number,
  radius: number,
) => {
  const verticalLean = Math.abs(ty - height / 2) / height;
  const horizontalLean = Math.abs(tx - width / 2) / width;
  // A pill's short sides are all curve, with nowhere for a tail to attach.
  const shortSidesUsable = height - radius * 2 > 16;
  const useVertical = verticalLean >= horizontalLean || !shortSidesUsable;
  const edge = useVertical
    ? ty < height / 2 ? "top" : "bottom"
    : tx < width / 2 ? "left" : "right";
  const span = edge === "top" || edge === "bottom" ? width : height;
  const halfBase = Math.min(28, span * 0.15);
  const low = radius + halfBase;
  const high = span - radius - halfBase;
  const along = edge === "top" || edge === "bottom" ? tx : ty;
  const center =
    low > high ? span / 2 : Math.max(low, Math.min(high, along));
  return { edge, center, halfBase };
};

const speechBody = (
  width: number,
  height: number,
  radius: number,
  tail: Point,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  const hasTail = !isInside(tail, width, height);
  const { edge, center, halfBase } = tailEdge(tail, width, height, r);
  const wedge = (name: string, a: Point, b: Point) =>
    hasTail && edge === name
      ? `L${a[0]} ${a[1]}L${tail[0]} ${tail[1]}L${b[0]} ${b[1]}`
      : "";

  return (
    `M${r} 0` +
    wedge("top", [center - halfBase, 0], [center + halfBase, 0]) +
    `L${width - r} 0A${r} ${r} 0 0 1 ${width} ${r}` +
    wedge("right", [width, center - halfBase], [width, center + halfBase]) +
    `L${width} ${height - r}A${r} ${r} 0 0 1 ${width - r} ${height}` +
    wedge("bottom", [center + halfBase, height], [center - halfBase, height]) +
    `L${r} ${height}A${r} ${r} 0 0 1 0 ${height - r}` +
    wedge("left", [0, center + halfBase], [0, center - halfBase]) +
    `L0 ${r}A${r} ${r} 0 0 1 ${r} 0z`
  );
};

const inset = (width: number, height: number, fraction: number) => ({
  x: width * fraction,
  y: height * fraction,
  width: width * (1 - fraction * 2),
  height: height * (1 - fraction * 2),
});

const paddedBox = (width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  const pad = 20 + r * 0.3;
  return {
    x: pad,
    y: Math.min(pad, height * 0.2),
    width: Math.max(1, width - pad * 2),
    height: Math.max(1, height - Math.min(pad, height * 0.2) * 2),
  };
};

const onEllipse = (
  width: number,
  height: number,
  angle: number,
  factor = 1,
): Point => [
  width / 2 + (width / 2) * factor * Math.cos(angle),
  height / 2 + (height / 2) * factor * Math.sin(angle),
];

const angleTo = ([tx, ty]: Point, width: number, height: number) =>
  Math.atan2((ty - height / 2) / height, (tx - width / 2) / width);

const isInsideEllipse = ([tx, ty]: Point, width: number, height: number) =>
  ((tx - width / 2) / (width / 2)) ** 2 +
    ((ty - height / 2) / (height / 2)) ** 2 <=
  1;

const roundBody = (width: number, height: number, tail: Point) => {
  const rx = width / 2;
  const ry = height / 2;
  if (isInsideEllipse(tail, width, height)) {
    return `M0 ${ry}A${rx} ${ry} 0 1 1 ${width} ${ry}A${rx} ${ry} 0 1 1 0 ${ry}z`;
  }
  const angle = angleTo(tail, width, height);
  const gap = Math.min(0.3, 44 / Math.max(rx, ry));
  const a = onEllipse(width, height, angle + gap);
  const b = onEllipse(width, height, angle - gap);
  return `M${a[0]} ${a[1]}A${rx} ${ry} 0 1 1 ${b[0]} ${b[1]}L${tail[0]} ${tail[1]}z`;
};

const thoughtBody = (width: number, height: number, tail: Point) => {
  const BUMPS = 11;
  const points = Array.from({ length: BUMPS }, (_, i) =>
    onEllipse(width, height, (i * 2 * Math.PI) / BUMPS, 0.84),
  );
  let path = `M${points[0][0]} ${points[0][1]}`;
  points.forEach((_, i) => {
    const next = points[(i + 1) % BUMPS];
    const chord = Math.hypot(
      next[0] - points[i][0],
      next[1] - points[i][1],
    );
    const r = chord * 0.58;
    path += `A${r} ${r} 0 0 1 ${next[0]} ${next[1]}`;
  });
  path += "z";

  if (!isInsideEllipse(tail, width, height)) {
    const edge = onEllipse(width, height, angleTo(tail, width, height));
    const size = Math.min(width, height) * 0.09;
    [0.3, 0.62, 1].forEach((t, i) => {
      const dot: Point = [
        edge[0] + (tail[0] - edge[0]) * t,
        edge[1] + (tail[1] - edge[1]) * t,
      ];
      path += circle(dot, size * (1 - i * 0.28));
    });
  }
  return path;
};

const shoutBody = (width: number, height: number, tail: Point) => {
  const SPIKES = 12;
  const hasTail = !isInsideEllipse(tail, width, height);
  const tailAngle = angleTo(tail, width, height);
  const step = Math.PI / SPIKES;
  // The spike nearest the tail stretches out to become it.
  const nearest = Math.round(tailAngle / (2 * step)) * 2;
  const points = Array.from({ length: SPIKES * 2 }, (_, i) => {
    if (hasTail && (i - nearest) % (SPIKES * 2) === 0) return tail;
    return onEllipse(width, height, i * step, i % 2 === 0 ? 1 : 0.76);
  });
  return `${points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join("")}z`;
};

export const calloutGeometry = (
  kind: CalloutKind,
  width: number,
  height: number,
  tail: Point,
  radius: number,
): CalloutGeometry => {
  switch (kind) {
    case "round":
      return {
        body: roundBody(width, height, tail),
        textBox: inset(width, height, 0.15),
      };
    case "thought":
      return {
        body: thoughtBody(width, height, tail),
        textBox: inset(width, height, 0.2),
      };
    case "shout":
      return {
        body: shoutBody(width, height, tail),
        textBox: inset(width, height, 0.26),
      };
    case "label": {
      const r = Math.min(radius, width / 2, height / 2);
      const from: Point = [
        Math.max(0, Math.min(width, tail[0])),
        Math.max(0, Math.min(height, tail[1])),
      ];
      return {
        body: speechBody(width, height, r, [width / 2, height / 2]),
        leader: isInside(tail, width, height) ? undefined : { from, to: tail },
        textBox: paddedBox(width, height, r),
      };
    }
    default:
      return {
        body: speechBody(width, height, radius, tail),
        textBox: paddedBox(width, height, radius),
      };
  }
};
