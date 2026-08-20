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
  | "image"
  | "pencil"
  | "number"
  | "icons"
  | "vector"
  | "other";

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
  // arrows
  arrowHeadSize?: number;
  // callout text
  text?: string;
}

export type LaybelElement = ImageElement | TextElement | ShapeElement;

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
 * and like `zoom` it is deliberately absent from `LaybelProject` because it
 * describes how you're looking at the canvas, not what's on it.
 */
export interface GridState {
  enabled: boolean;
  /** Spacing between lines, in canvas px. */
  size: number;
  opacity: number;
}

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export * from "./pattern";

export interface LaybelProject {
  version: 1;
  canvas: { width: number; height: number };
  background: BackgroundState;
  elements: LaybelElement[];
  watermark: boolean;
}
