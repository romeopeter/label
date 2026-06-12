export type ElementKind = "image" | "text" | "shape" | "icon";

export type ShapeKind =
  | "rect"
  | "rounded-rect"
  | "ellipse"
  | "arrow"
  | "highlight"
  | "callout";

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

export type BackgroundMode = "solid" | "gradient" | "image";

export interface BackgroundState {
  mode: BackgroundMode;
  color: string;
  gradient: { from: string; to: string; angle: number };
  imageSrc: string | null;
  imageBlur: number;
  imageOpacity: number;
}

export interface CanvasSize {
  width: number;
  height: number;
  label: string;
}

export interface LaybelProject {
  version: 1;
  canvas: { width: number; height: number };
  background: BackgroundState;
  elements: LaybelElement[];
  watermark: boolean;
}
