import type { ShapeKind } from "@/types";

type Polygon = [number, number][];

/**
 * Stretches an outline to touch all four sides of the box. Regular polygons and
 * stars don't on their own, which would leave the selection frame smaller than
 * the element and make a resize drift away from the pointer.
 */
const fillBox = (polygon: Polygon): Polygon => {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  return polygon.map(([x, y]) => [(x - minX) / spanX, (y - minY) / spanY]);
};

const regular = (sides: number, rotation = -Math.PI / 2): Polygon =>
  fillBox(
    Array.from({ length: sides }, (_, i) => {
      const angle = rotation + (i * 2 * Math.PI) / sides;
      return [Math.cos(angle), Math.sin(angle)];
    }),
  );

const star = (points: number, inner: number): Polygon =>
  fillBox(
    Array.from({ length: points * 2 }, (_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / points;
      const radius = i % 2 === 0 ? 1 : inner;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    }),
  );

/** Outlines in 0–1 box fractions, so resizing never scales the stroke width. */
const POLYGONS: Partial<Record<ShapeKind, Polygon>> = {
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  pentagon: regular(5),
  hexagon: regular(6, 0),
  star: star(5, 0.45),
  cross: [
    [0.33, 0],
    [0.67, 0],
    [0.67, 0.33],
    [1, 0.33],
    [1, 0.67],
    [0.67, 0.67],
    [0.67, 1],
    [0.33, 1],
    [0.33, 0.67],
    [0, 0.67],
    [0, 0.33],
    [0.33, 0.33],
  ],
};

export const isPathShape = (shape: ShapeKind) =>
  shape === "heart" || POLYGONS[shape] !== undefined;

/** Outline of a shape filling a `width`×`height` box, or "" if it has none. */
export const shapePath = (shape: ShapeKind, width: number, height: number) => {
  if (shape === "heart") {
    const x = (fraction: number) => fraction * width;
    const y = (fraction: number) => fraction * height;
    return (
      `M${x(0.5)} ${y(1)}` +
      `C${x(0.2)} ${y(0.78)} 0 ${y(0.55)} 0 ${y(0.3)}` +
      `C0 ${y(0.12)} ${x(0.14)} 0 ${x(0.28)} 0` +
      `C${x(0.38)} 0 ${x(0.46)} ${y(0.05)} ${x(0.5)} ${y(0.15)}` +
      `C${x(0.54)} ${y(0.05)} ${x(0.62)} 0 ${x(0.72)} 0` +
      `C${x(0.86)} 0 ${x(1)} ${y(0.12)} ${x(1)} ${y(0.3)}` +
      `C${x(1)} ${y(0.55)} ${x(0.8)} ${y(0.78)} ${x(0.5)} ${y(1)}z`
    );
  }

  const polygon = POLYGONS[shape];
  if (!polygon) return "";
  return `${polygon
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px * width} ${py * height}`)
    .join("")}z`;
};
