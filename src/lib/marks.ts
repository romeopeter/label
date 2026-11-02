import type { LayerElement, ShapeElement, ShapeKind } from "@/types";
import { placeConnector } from "./connectors";

export const EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export const MARK_FONT_FAMILY = "DM Sans";

export const BADGE_HEIGHT = 72;

export const BADGE_PRESETS = ["New", "Beta", "Free", "Sale", "Verified"];

/** Marks that would look wrong stretched, so they only resize from the corners. */
export const FIXED_RATIO_SHAPES = new Set<ShapeKind>([
  "emoji",
  "icons",
  "number",
  "qr-code",
]);

export const nextNumber = (elements: LayerElement[]) => {
  const used = elements.flatMap((el) =>
    el.type === "shape" && el.shape === "number" ? [Number(el.text)] : [],
  );
  return String(Math.max(0, ...used.filter(Number.isFinite)) + 1);
};

export const badgeFontSize = (height: number) => height * 0.45;

/** Width that fits a badge's label, so the pill grows with what you type. */
export const badgeWidth = (text: string, height: number) => {
  const context = document.createElement("canvas").getContext("2d");
  const fontSize = badgeFontSize(height);
  if (!context) return text.length * fontSize + height;
  context.font = `700 ${fontSize}px "${MARK_FONT_FAMILY}"`;
  return Math.ceil(context.measureText(text).width + height);
};

/**
 * Converts a stroke in canvas coordinates into element geometry. Points are
 * stored as 0–1 fractions of the box, so resizing reshapes the stroke without
 * also thickening its line. A straight stroke has no extent on one axis, hence
 * the 1px minimum.
 */
export const strokeToElementFields = (
  points: number[],
): Pick<ShapeElement, "x" | "y" | "width" | "height" | "points"> => {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);

  return {
    x,
    y,
    width,
    height,
    points: points.map((value, index) =>
      index % 2 === 0 ? (value - x) / width : (value - y) / height,
    ),
  };
};

/**
 * Brings marks saved by earlier builds up to date. Arrows and lines used to be
 * a horizontal line in a rotated box; callouts used to size themselves to their
 * text. Everything else loads as it was.
 */
export const migrateElement = (el: LayerElement): LayerElement => {
  if (el.type !== "shape") return el;

  if ((el.shape === "arrow" || el.shape === "line") && !el.connector) {
    const angle = (el.rotation * Math.PI) / 180;
    const rotate = (x: number, y: number): [number, number] => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ];
    return {
      ...el,
      rotation: 0,
      ...placeConnector(el.x, el.y, {
        start: rotate(0, el.height / 2),
        end: rotate(el.width, el.height / 2),
        route: "straight",
        headStart: "none",
        headEnd: el.shape === "arrow" ? "arrow" : "none",
      }),
    };
  }

  if (el.shape === "callout" && !el.calloutKind) {
    return {
      ...el,
      calloutKind: "speech",
      tail: [el.width / 2, el.height + 40],
      fontSize: Math.max(14, el.height / 3),
      cornerRadius: el.cornerRadius || 12,
      textFill: el.textFill ?? "#FFFFFF",
    };
  }

  return el;
};
