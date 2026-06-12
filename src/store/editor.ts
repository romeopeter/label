import { create } from "zustand";
import type {
  BackgroundState,
  CanvasSize,
  ImageElement,
  LaybelElement,
  LaybelProject,
  ShapeElement,
  ShapeKind,
  TextElement,
} from "../types";

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
  selectedIds: string[];

  activeTool: Tool;
  zoom: number;
  watermark: boolean;
  isPro: boolean;

  // tool / UI
  setActiveTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setCanvas: (c: CanvasSize) => void;
  setBackground: (b: Partial<BackgroundState>) => void;
  setWatermark: (v: boolean) => void;

  // elements
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  addText: (variant: "heading" | "body") => string;
  addShape: (shape: ShapeKind) => string;
  updateElement: (id: string, patch: Partial<LaybelElement>) => void;
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
  selectedIds: [],

  activeTool: "uploads",
  zoom: 62,
  watermark: true,
  isPro: false,

  setActiveTool: (t) => set({ activeTool: t }),
  setZoom: (z) => set({ zoom: Math.max(20, Math.min(200, Math.round(z))) }),
  setCanvas: (c) => set({ canvas: c }),
  setBackground: (b) => set({ background: { ...get().background, ...b } }),
  setWatermark: (v) => set({ watermark: v }),

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
      background: project.background,
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
