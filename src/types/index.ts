import type { PatternConfig } from "./pattern";
import type { BackdropConfig } from "./backdrop";

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

/** A device around an image. Its ids and screen areas live in `lib/mockups.ts`. */
export interface DeviceFrame {
  device: string;
  finish: string;
  /** Ignored by devices that can't turn. */
  landscape: boolean;
  /** Fill crops to the screen's shape; fit shows the whole picture, with bars. */
  fit: "fill" | "fit";
  /** How far the picture is zoomed in from there. 1 is not at all. */
  zoom: number;
  /** Where the picture sits in the room it has, from -1 to 1. 0 is centred. */
  panX: number;
  panY: number;
  /** Shows around a picture that doesn't cover the screen. */
  barColor: string;
  /** How thick a screen frame is and how round a frame's corners are, against its design. */
  thickness: number;
  roundness: number;
  /** What a browser shows in its address bar. */
  address: string;
}

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

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string; // object URL or data URL
  deviceFrame: DeviceFrame | null;
  cornerRadius: number;
  transform: string;
  /** The visible part of the original, as 0–1 fractions. Absent shows it all. */
  crop?: ImageCrop;
  /** A layout slot's extra trim, as fractions of `crop`. Kept apart so `crop` stays the user's. */
  layoutCrop?: ImageCrop;
  naturalWidth?: number;
  naturalHeight?: number;
  /** Non-destructive edits. `src` stays the original. */
  edit?: ImageEdit;
}

/** Each is -100 to 100, where 0 changes nothing. */
export interface ImageAdjust {
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  ambience: number;
  saturation: number;
  warmth: number;
}

export type ImageStyleId =
  | "bloom"
  | "motion"
  | "chromatic"
  | "double"
  | "fisheye"
  | "halation"
  | "grunge"
  | "film";

export type LensBlurMode = "background" | "band" | "whole";

export interface ImageEdit {
  adjust?: Partial<ImageAdjust>;
  /** Strengths and amounts are 0 to 100. */
  color?: { id: string; strength: number };
  grade?: { id: string; strength: number };
  lensBlur?: {
    mode: LensBlurMode;
    amount: number;
    /** What stays sharp, as fractions of the picture. The centre if unset. */
    focus?: { x: number; y: number };
  };
  style?: {
    id: ImageStyleId;
    variant: string;
    strength: number;
    /** The second image of a double exposure. Its variant is how the two blend. */
    overlaySrc?: string;
  };
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

export type BackgroundMode = "solid" | "gradient" | "image" | "pattern" | "abstract";

export interface BackgroundState {
  mode: BackgroundMode;
  color: string;
  gradient: { from: string; to: string; angle: number };
  imageSrc: string | null;
  imageBlur: number;
  imageOpacity: number;
  pattern: PatternConfig;
  /** Drawn by Layer from a few colours. Absent in projects saved before it existed. */
  backdrop: BackdropConfig;
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

export type LayoutId =
  | "side"
  | "stacked"
  | "overlap-up"
  | "overlap-down"
  | "masonry"
  | "do-dont"
  | "before-after"
  | "arrow-between"
  | "row-3"
  | "hero"
  | "grid-2"
  | "grid-3"
  | "cascade"
  | "fan";

export type LayoutAlign = "start" | "center" | "end";

export interface LayoutSlot {
  id: string | null;
  /** Which part shows when the slot trims its image, as fractions. Centred if unset. */
  focus?: { x: number; y: number };
}

/** Images in `slots` follow this: their place and size are worked out, not set by hand. */
export interface CanvasLayout {
  id: LayoutId;
  align: LayoutAlign;
  /** 0 to 100. */
  spacing: number;
  /** 30 to 100: how much of the canvas the layout fills. */
  scale: number;
  sameWidth: boolean;
  sameShape: boolean;
  showLabels: boolean;
  labels: string[];
  slots: LayoutSlot[];
}

export interface LayerProject {
  version: 1;
  canvas: { width: number; height: number };
  background: BackgroundState;
  elements: LayerElement[];
  watermark: boolean;
  /** Absent in projects saved before layouts existed. */
  layout?: CanvasLayout | null;
}
