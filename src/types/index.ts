import type { PatternConfig } from "./pattern";

export type ElementKind = "image" | "text" | "shape" | "icon";

export type ShapeKind =
  | "rect"
  | "rounded-rect"
  | "ellipse"
  | "arrow"
  | "line"
  | "highlight"
  | "callout"
  | "qr-code"
  | "emoji"
  | "pencil"
  | "number"
  | "icons"
  | "badge"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "heart"
  | "cross";

export type ConnectorRoute = "straight" | "curved" | "elbow";

export type ConnectorHead = "none" | "arrow" | "open" | "dot";

/** A line defined by its ends, not a box. Points are relative to the element. */
export interface Connector {
  start: [number, number];
  end: [number, number];
  /** Curved routes only: the off-curve point of a quadratic curve. */
  control?: [number, number];
  route: ConnectorRoute;
  headStart: ConnectorHead;
  headEnd: ConnectorHead;
}

export type CalloutKind = "speech" | "round" | "thought" | "shout" | "label";

export type MarkEffect = "none" | "soft" | "hard" | "glow";

export type DeviceFrame =
  | null
  | "macbook-light"
  | "macbook-dark"
  | "iphone-light"
  | "iphone-dark"
  | "browser-light"
  | "browser-dark";

export interface BaseElement {
  id: string;
  type: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  /** Can't be moved, resized or deleted from the canvas. */
  locked?: boolean;
  /** Not drawn on the canvas or in exports. */
  hidden?: boolean;
  // basic style available to all visual elements
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  border?: {
    enabled: boolean;
    color: string;
    width: number;
  };
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string; // object URL or data URL
  deviceFrame: DeviceFrame;
  cornerRadius: number;
  transform: string;
  /** The visible part of the original, as 0–1 fractions. Absent shows it all. */
  crop?: { x: number; y: number; width: number; height: number };
}

export interface UploadedImage {
  id: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  createdAt: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  variant: "heading" | "body";
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  fill: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  dashed: boolean;
  // false draws the outline only; absent means filled
  filled?: boolean;
  // drop shadow or glow on shapes and callouts
  effect?: MarkEffect;
  // arrows and lines
  connector?: Connector;
  arrowHeadSize?: number;
  // callouts: bubble style, where the tail points (relative to the box), text size
  calloutKind?: CalloutKind;
  tail?: [number, number];
  fontSize?: number;
  // callout/badge label, number, emoji character, QR content, icon name
  text?: string;
  // label colour for callout, number and badge
  textFill?: string;
  // the light squares of a QR code
  backgroundFill?: string;
  // icon outline in a 24×24 box
  iconPath?: string;
  // pencil and highlighter stroke as x,y pairs in 0–1 fractions of the box
  points?: number[];
}

export type LayerElement = ImageElement | TextElement | ShapeElement;

export type BackgroundMode = "solid" | "gradient" | "image" | "pattern";

export interface BackgroundState {
  mode: BackgroundMode;
  color: string;
  gradient: { from: string; to: string; angle: number };
  imageSrc: string | null;
  imageBlur: number;
  imageOpacity: number;
  pattern: PatternConfig;
}

/**
 * Layout grid. A viewport aid, not artwork — it never renders into an export,
 * and like `zoom` it is deliberately absent from `LayerProject` because it
 * describes how you're looking at the canvas, not what's on it.
 */
export interface GridState {
  enabled: boolean;
  /** Spacing between lines, in canvas px. */
  size: number;
  opacity: number;
}

/** What a canvas drag creates. Null means dragging selects and moves as usual. */
export type MarkTool =
  | { kind: "stroke"; shape: "pencil" | "highlight" }
  | { kind: "box"; shape: ShapeKind }
  | { kind: "connector"; shape: "arrow" | "line" }
  /** A ready-made mark to place: number, badge, emoji, icon, QR code. */
  | { kind: "stamp"; shape: ShapeKind; preset: Partial<ShapeElement> }
  | { kind: "text" };

/** Tools in one category share the style used for the next mark they make. */
export type MarkCategory =
  | "shape"
  | "arrow"
  | "line"
  | "callout"
  | "pencil"
  | "highlight";

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export * from "./pattern";

export interface LayerProject {
  version: 1;
  canvas: { width: number; height: number };
  background: BackgroundState;
  elements: LayerElement[];
  watermark: boolean;
}
