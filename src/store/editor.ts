import { create } from "zustand";
import type {
  BackgroundState,
  CanvasSize,
  GridState,
  ImageElement,
  LaybelElement,
  LaybelProject,
  ShapeElement,
  ShapeKind,
  TextElement,
  UploadedImage,
} from "../types";
import type { PatternColorPair, PatternConfig } from "../types/pattern";
import { DEFAULT_PATTERN_CONFIG } from "../types/pattern";

/* ------------------------------------------------------- */

const uid = () => "el_" + Math.random().toString(36).slice(2, 9);

const DEFAULT_CANVAS: CanvasSize = {
  label: "Wide HD",
  width: 2400,
  height: 1350,
};

const DEFAULT_BACKGROUND: BackgroundState = {
  mode: "gradient",
  color: "#1A1826",
  gradient: { from: "#1C1F3B", to: "#534AB7", angle: 135 },
  imageSrc: null,
  imageBlur: 0,
  imageOpacity: 1,
  pattern: DEFAULT_PATTERN_CONFIG,
};

export const ZOOM_MIN = 20;
/**
 * 100% is fit-to-viewport, not 1:1 pixels — `CanvasStage` multiplies zoom by a
 * fit factor that is itself capped at 1. Capping here means the artboard is
 * never magnified past the size it lays out at.
 */
export const ZOOM_MAX = 100;

export const GRID_MIN_SIZE = 8;
export const GRID_MAX_SIZE = 400;

const DEFAULT_GRID: GridState = {
  enabled: false,
  size: 100,
  opacity: 0.45,
};

type Tool =
  | "ai"
  | "uploads"
  | "templates"
  | "images"
  | "annotation"
  | "background"
  | "mockup"
  | "position"
  | "3d"
  | "shadow"
  | "border"
  | "layout"
  | "header"
  | "watermark"
  | "brands"
  | "motion"
  | "customize";

interface EditorState {
  canvas: CanvasSize;
  background: BackgroundState;
  elements: LaybelElement[];
  uploadedImages: UploadedImage[];
  customPatternPairs: PatternColorPair[];
  selectedIds: string[];

  activeTool: Tool;
  zoom: number;
  grid: GridState;
  /** Smart guides + snapping while dragging. A view aid, like `grid`. */
  snapEnabled: boolean;
  watermark: boolean;
  isPro: boolean;
  /** Transient: true while a pattern slider is held. Not part of the project. */
  patternDragging: boolean;

  // tool / UI
  setActiveTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setGrid: (g: Partial<GridState>) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setCanvas: (c: CanvasSize) => void;
  setBackground: (b: Partial<BackgroundState>) => void;
  setPattern: (p: Partial<PatternConfig>) => void;
  setPatternDragging: (v: boolean) => void;
  setWatermark: (v: boolean) => void;

  // pattern colour pairs (in-memory; see "Deferred Rust Implementations" in CLAUDE.md)
  addCustomPatternPair: (base: string, accent: string, label?: string) => string;
  deleteCustomPatternPair: (id: string) => void;

  // elements
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  addUploadedImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  deleteUploadedImage: (id: string) => void;
  addText: (variant: "heading" | "body") => string;
  addShape: (shape: ShapeKind) => string;
  updateElement: (id: string, patch: Partial<LaybelElement>) => void;
  duplicateElement: (id: string) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null, additive?: boolean) => void;
  moveElement: (id: string, dz: 1 | -1) => void;

  // project I/O
  loadProject: (project: LaybelProject) => void;
  toProject: () => LaybelProject;
  resetProject: () => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  canvas: DEFAULT_CANVAS,
  background: DEFAULT_BACKGROUND,
  elements: [],
  uploadedImages: [],
  customPatternPairs: [],
  selectedIds: [],

  activeTool: "uploads",
  zoom: 62,
  grid: DEFAULT_GRID,
  // On by default: this is the behaviour people expect from an editor, and it
  // is unobtrusive because guides only appear when something actually lines up.
  snapEnabled: true,
  watermark: true,
  isPro: false,
  patternDragging: false,

  setActiveTool: (t) => set({ activeTool: t }),
  setZoom: (z) => set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z))) }),

  setGrid: (g) => {
    const next = { ...get().grid, ...g };
    // Clamped here rather than at the slider so any caller — hotkey, future
    // panel, restored preference — lands in a renderable range.
    next.size = Math.max(GRID_MIN_SIZE, Math.min(GRID_MAX_SIZE, Math.round(next.size)));
    next.opacity = Math.max(0, Math.min(1, next.opacity));
    set({ grid: next });
  },

  toggleGrid: () => set({ grid: { ...get().grid, enabled: !get().grid.enabled } }),

  toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),
  setCanvas: (c) => set({ canvas: c }),
  setBackground: (b) => set({ background: { ...get().background, ...b } }),

  setPattern: (p) => {
    const background = get().background;
    set({ background: { ...background, pattern: { ...background.pattern, ...p } } });
  },

  setPatternDragging: (v) => set({ patternDragging: v }),

  setWatermark: (v) => set({ watermark: v }),

  addCustomPatternPair: (base, accent, label) => {
    const pair: PatternColorPair = {
      id: "pair_" + Math.random().toString(36).slice(2, 9),
      base,
      accent,
      source: "custom",
      label,
    };
    set({ customPatternPairs: [...get().customPatternPairs, pair] });
    return pair.id;
  },

  deleteCustomPatternPair: (id) =>
    set({ customPatternPairs: get().customPatternPairs.filter((p) => p.id !== id) }),

  addImage: (src, naturalWidth, naturalHeight) => {
    const { canvas, elements } = get();
    // fit inside ~80% of canvas
    const maxW = canvas.width * 0.8;
    const maxH = canvas.height * 0.8;
    const ratio = Math.min(maxW / naturalWidth, maxH / naturalHeight, 1);
    const w = naturalWidth * ratio;
    const h = naturalHeight * ratio;
    const el: ImageElement = {
      id: uid(),
      type: "image",
      x: (canvas.width - w) / 2,
      y: (canvas.height - h) / 2,
      width: w,
      height: h,
      rotation: 0,
      opacity: 1,
      src,
      deviceFrame: null,
      cornerRadius: 8,
      shadow: { enabled: true, color: "rgba(0,0,0,0.45)", blur: 60, offsetX: 0, offsetY: 30 },
      transform: "rotate3d(0deg, 0deg, 0deg)"
    };
    set({ elements: [...elements, el], selectedIds: [el.id] });
    return el.id;
  },

  addUploadedImage: (src, naturalWidth, naturalHeight) => {
    const image: UploadedImage = {
      id: uid(),
      src,
      naturalWidth,
      naturalHeight,
      createdAt: Date.now(),
    };
    set({ uploadedImages: [...get().uploadedImages, image] });
    return image.id;
  },

  deleteUploadedImage: (id) =>
    set({
      uploadedImages: get().uploadedImages.filter((image) => image.id !== id),
    }),

  addText: (variant) => {
    const { canvas, elements } = get();
    const heading = variant === "heading";
    const el: TextElement = {
      id: uid(),
      type: "text",
      x: canvas.width * 0.1,
      y: canvas.height * 0.1,
      width: canvas.width * 0.8,
      height: heading ? 160 : 80,
      rotation: 0,
      opacity: 1,
      text: heading ? "Ship visuals,\nnot pixels." : "Tap to edit",
      variant,
      fontFamily: heading ? "Bricolage Grotesque" : "DM Sans",
      fontSize: heading ? 120 : 40,
      fontWeight: heading ? 700 : 400,
      fill: "#E7E5F5",
      align: "left",
      letterSpacing: heading ? -2 : 0,
      lineHeight: heading ? 1.05 : 1.4,
    };
    set({ elements: [...elements, el], selectedIds: [el.id] });
    return el.id;
  },

  addShape: (shape) => {
    const { canvas, elements } = get();
    const baseW = shape === "arrow" || shape === "highlight" ? 360 : 240;
    const baseH = shape === "arrow" ? 80 : shape === "highlight" ? 80 : 240;
    const el: ShapeElement = {
      id: uid(),
      type: "shape",
      shape,
      x: (canvas.width - baseW) / 2,
      y: (canvas.height - baseH) / 2,
      width: baseW,
      height: baseH,
      rotation: 0,
      opacity: shape === "highlight" ? 0.5 : 1,
      fill: shape === "highlight" ? "#EF9F27" : "#534AB7",
      stroke: "#1D9E75",
      strokeWidth: shape === "arrow" ? 6 : 0,
      cornerRadius: shape === "rounded-rect" ? 24 : 0,
      dashed: false,
      arrowHeadSize: shape === "arrow" ? 18 : undefined,
      text: shape === "callout" ? "Callout" : undefined,
    };
    set({ elements: [...elements, el], selectedIds: [el.id] });
    return el.id;
  },

  updateElement: (id, patch) =>
    set({
      elements: get().elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as LaybelElement) : e
      ),
    }),

  duplicateElement: (id) => {
    const source = get().elements.find((e) => e.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: uid(),
      x: source.x + 32,
      y: source.y + 32,
    } as LaybelElement;
    set({ elements: [...get().elements, copy], selectedIds: [copy.id] });
  },

  deleteElement: (id) =>
    set({
      elements: get().elements.filter((e) => e.id !== id),
      selectedIds: get().selectedIds.filter((s) => s !== id),
    }),

  selectElement: (id, additive = false) => {
    if (id === null) return set({ selectedIds: [] });
    if (additive) {
      const sel = get().selectedIds;
      set({ selectedIds: sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id] });
    } else {
      set({ selectedIds: [id] });
    }
  },

  moveElement: (id, dz) => {
    const els = get().elements.slice();
    const idx = els.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const target = idx + dz;
    if (target < 0 || target >= els.length) return;
    const [item] = els.splice(idx, 1);
    els.splice(target, 0, item);
    set({ elements: els });
  },

  loadProject: (project) =>
    set({
      canvas: {
        label: "Custom",
        width: project.canvas.width,
        height: project.canvas.height,
      },
      // Spread over the defaults: `.laybel` files written before the pattern
      // background existed have no `pattern` key, and the panel/canvas both
      // assume one is always present.
      background: { ...DEFAULT_BACKGROUND, ...project.background },
      elements: project.elements,
      watermark: project.watermark,
      selectedIds: [],
    }),

  toProject: () => ({
    version: 1,
    canvas: { width: get().canvas.width, height: get().canvas.height },
    background: get().background,
    elements: get().elements,
    watermark: get().watermark,
  }),

  resetProject: () =>
    set({
      canvas: DEFAULT_CANVAS,
      background: DEFAULT_BACKGROUND,
      elements: [],
      selectedIds: [],
    }),
}));

export type { Tool };
