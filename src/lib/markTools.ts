import type {
  LayerElement,
  MarkCategory,
  MarkEffect,
  MarkTool,
  ShapeElement,
  ShapeKind,
} from "@/types";
import { constrainAngle, defaultControl, placeConnector } from "./connectors";
import {
  BADGE_HEIGHT,
  badgeWidth,
  FIXED_RATIO_SHAPES,
  nextNumber,
  strokeToElementFields,
} from "./marks";

export const DEFAULT_MARK_STYLES: Record<MarkCategory, Partial<ShapeElement>> = {
  shape: {
    filled: true,
    fill: "#534AB7",
    stroke: "#FFFFFF",
    strokeWidth: 0,
    cornerRadius: 0,
    effect: "none",
  },
  arrow: {
    stroke: "#EF9F27",
    strokeWidth: 8,
    arrowHeadSize: 36,
    connector: {
      start: [0, 0],
      end: [1, 0],
      route: "straight",
      headStart: "none",
      headEnd: "arrow",
    },
  },
  line: {
    stroke: "#FFFFFF",
    strokeWidth: 6,
    arrowHeadSize: 36,
    connector: {
      start: [0, 0],
      end: [1, 0],
      route: "straight",
      headStart: "none",
      headEnd: "none",
    },
  },
  callout: {
    calloutKind: "speech",
    fill: "#FFFFFF",
    textFill: "#1A1826",
    stroke: "#1A1826",
    strokeWidth: 0,
    cornerRadius: 28,
    fontSize: 40,
    effect: "soft",
    text: "",
  },
  pencil: { stroke: "#EF9F27", strokeWidth: 8 },
  highlight: { stroke: "#FFD23F", strokeWidth: 48, opacity: 0.45 },
};

export const CALLOUT_SHAPE: ShapeKind = "callout";

export const toolCategory = (tool: MarkTool): MarkCategory | null => {
  if (tool.kind === "text" || tool.kind === "stamp") return null;
  if (tool.kind === "stroke" || tool.kind === "connector") return tool.shape;
  return tool.shape === CALLOUT_SHAPE ? "callout" : "shape";
};

/** Starting look for ready-made marks; anything absent uses `addShape`'s base. */
export const shapeDefaults = (
  shape: ShapeKind,
  elements: LayerElement[],
): Partial<ShapeElement> => {
  switch (shape) {
    case "rounded-rect":
      return { cornerRadius: 24 };
    case "number":
      return {
        width: 120,
        height: 120,
        text: nextNumber(elements),
        textFill: "#FFFFFF",
      };
    case "badge":
      return {
        width: badgeWidth("New", BADGE_HEIGHT),
        height: BADGE_HEIGHT,
        cornerRadius: BADGE_HEIGHT / 2,
        text: "New",
        textFill: "#FFFFFF",
      };
    case "qr-code":
      return {
        width: 360,
        height: 360,
        fill: "#000000",
        backgroundFill: "#FFFFFF",
      };
    case "icons":
      return { width: 200, height: 200, stroke: "#FFFFFF", strokeWidth: 2 };
    default:
      return {};
  }
};

const DEFAULT_BOX: Record<"shape" | "callout", [number, number]> = {
  shape: [320, 320],
  callout: [520, 200],
};

const CLICK_ARROW_LENGTH = 320;

/** A tail pointing down and left of the box, like a speech bubble's natural one. */
const defaultTail = (width: number, height: number): [number, number] => [
  width * 0.28,
  height + Math.max(48, height * 0.3),
];

export interface Gesture {
  start: [number, number];
  current: [number, number];
  /** Every sampled point, flat x,y, for freehand tools. */
  points: number[];
  shift: boolean;
  /** The pointer barely moved: place at a sensible size rather than a speck. */
  isClick: boolean;
}

const boxFields = (
  category: "shape" | "callout",
  { start, current, shift, isClick }: Gesture,
): Partial<ShapeElement> => {
  if (isClick) {
    const [width, height] = DEFAULT_BOX[category];
    return {
      x: start[0] - width / 2,
      y: start[1] - height / 2,
      width,
      height,
      ...(category === "callout" ? { tail: defaultTail(width, height) } : {}),
    };
  }

  let dx = current[0] - start[0];
  let dy = current[1] - start[1];
  if (shift) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = side * Math.sign(dx || 1);
    dy = side * Math.sign(dy || 1);
  }
  const width = Math.abs(dx);
  const height = Math.abs(dy);

  return {
    x: Math.min(start[0], start[0] + dx),
    y: Math.min(start[1], start[1] + dy),
    width,
    height,
    ...(category === "callout" ? { tail: defaultTail(width, height) } : {}),
  };
};

const connectorFields = (
  style: Partial<ShapeElement>,
  { start, current, shift, isClick }: Gesture,
): Partial<ShapeElement> => {
  const template = style.connector;
  if (!template) return {};
  const end: [number, number] = isClick
    ? [start[0] + CLICK_ARROW_LENGTH, start[1]]
    : shift
      ? constrainAngle(start, current)
      : current;

  return placeConnector(0, 0, {
    ...template,
    start,
    end,
    control:
      template.route === "curved" ? defaultControl(start, end) : undefined,
  });
};

const strokeFields = ({
  start,
  current,
  points,
  shift,
}: Gesture): Partial<ShapeElement> =>
  strokeToElementFields(
    // Shift rules a straight stroke, for underlining and striking through.
    shift ? [start[0], start[1], ...constrainAngle(start, current)] : points,
  );

const stampFields = (
  tool: Extract<MarkTool, { kind: "stamp" }>,
  elements: LayerElement[],
  { start, current, isClick }: Gesture,
): Partial<ShapeElement> => {
  const look = { ...shapeDefaults(tool.shape, elements), ...tool.preset };
  if (isClick) {
    const width = look.width ?? 240;
    const height = look.height ?? 240;
    return {
      ...look,
      width,
      height,
      x: start[0] - width / 2,
      y: start[1] - height / 2,
    };
  }

  let dx = current[0] - start[0];
  let dy = current[1] - start[1];
  if (FIXED_RATIO_SHAPES.has(tool.shape)) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = side * Math.sign(dx || 1);
    dy = side * Math.sign(dy || 1);
  }
  const width = Math.abs(dx);
  const height = Math.abs(dy);

  return {
    ...look,
    x: Math.min(start[0], start[0] + dx),
    y: Math.min(start[1], start[1] + dy),
    width,
    height,
    ...(tool.shape === "badge" ? { cornerRadius: height / 2 } : {}),
  };
};

/** The element a gesture describes so far; used for the preview and the result. */
export const gestureFields = (
  tool: MarkTool,
  style: Partial<ShapeElement>,
  gesture: Gesture,
  elements: LayerElement[],
): Partial<ShapeElement> => {
  if (tool.kind === "stamp") return stampFields(tool, elements, gesture);
  if (tool.kind === "stroke") return { ...style, ...strokeFields(gesture) };
  if (tool.kind === "connector") {
    return { ...style, ...connectorFields(style, gesture) };
  }
  if (tool.kind === "box") {
    const category = tool.shape === CALLOUT_SHAPE ? "callout" : "shape";
    return { ...style, ...boxFields(category, gesture) };
  }
  return {};
};

const EFFECTS: Record<Exclude<MarkEffect, "none">, (fill: string) => object> = {
  soft: () => ({
    shadowColor: "#000000",
    shadowBlur: 32,
    shadowOffsetX: 0,
    shadowOffsetY: 12,
    shadowOpacity: 0.35,
  }),
  hard: () => ({
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowOffsetX: 10,
    shadowOffsetY: 10,
    shadowOpacity: 1,
  }),
  glow: (fill) => ({
    shadowColor: fill,
    shadowBlur: 48,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowOpacity: 0.9,
  }),
};

export const effectProps = ({ effect, fill }: ShapeElement) =>
  effect && effect !== "none" ? EFFECTS[effect](fill) : {};
