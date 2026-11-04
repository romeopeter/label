import { create } from "zustand";
import type {
  BackgroundState,
  CanvasSize,
  GridState,
  ImageElement,
  LayerElement,
  LayerProject,
  MarkCategory,
  MarkTool,
  ShapeElement,
  ShapeKind,
  TextElement,
  UploadedImage,
} from "../types";
import type { PatternColorPair, PatternConfig } from "../types/pattern";
import { DEFAULT_PATTERN_CONFIG } from "../types/pattern";
import { migrateElement, nextNumber } from "../lib/marks";
import { DEFAULT_MARK_STYLES, shapeDefaults } from "../lib/markTools";
import { createHistory } from "./history";

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
  elements: LayerElement[];
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
  /** Transient: what a canvas drag creates. Null means it selects and moves. */
  markTool: MarkTool | null;
  /** Style for the next mark, by category. Lasts the session, not the project. */
  markStyles: Record<MarkCategory, Partial<ShapeElement>>;
  /** Transient: the element whose text is open for typing on the canvas. */
  editingId: string | null;
  /** Transient: the image open for cropping. */
  cropId: string | null;
  canUndo: boolean;
  canRedo: boolean;

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
  setMarkTool: (tool: MarkTool | null) => void;
  setMarkStyle: (category: MarkCategory, patch: Partial<ShapeElement>) => void;
  setEditingId: (id: string | null) => void;
  setCropId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;

  // pattern colour pairs (in-memory; see "Deferred Rust Implementations" in CLAUDE.md)
  addCustomPatternPair: (base: string, accent: string, label?: string) => string;
  deleteCustomPatternPair: (id: string) => void;

  // elements
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  addUploadedImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  deleteUploadedImage: (id: string) => void;
  addText: (variant: "heading" | "body", overrides?: Partial<TextElement>) => string;
  addShape: (shape: ShapeKind, overrides?: Partial<ShapeElement>) => string;
  updateElement: (id: string, patch: Partial<LayerElement>) => void;
  /** Records a measured height, which isn't an edit and shouldn't be undoable. */
  measureElement: (id: string, height: number) => void;
  duplicateElement: (id: string) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null, additive?: boolean) => void;
  moveElement: (id: string, dz: 1 | -1) => void;
  /** Moves an element into another's place in the stacking order. */
  reorderElement: (id: string, targetId: string) => void;

  // project I/O
  loadProject: (project: LayerProject) => void;
  toProject: () => LayerProject;
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
  markTool: null,
  markStyles: DEFAULT_MARK_STYLES,
  editingId: null,
  cropId: null,
  canUndo: false,
  canRedo: false,

  setActiveTool: (t) =>
    set({ activeTool: t, markTool: null, editingId: null, cropId: null }),
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

  setMarkTool: (tool) =>
    set({ markTool: tool, selectedIds: [], editingId: null, cropId: null }),

  setMarkStyle: (category, patch) => {
    const { markStyles } = get();
    set({
      markStyles: {
        ...markStyles,
        [category]: { ...markStyles[category], ...patch },
      },
    });
  },

  setEditingId: (id) => set({ editingId: id }),
  setCropId: (id) => set({ cropId: id, editingId: null }),
  undo: () => history.undo(),
  redo: () => history.redo(),

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

  addText: (variant, overrides) => {
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
      ...overrides,
    };
    set({ elements: [...elements, el], selectedIds: [el.id] });
    return el.id;
  },

  addShape: (shape, overrides) => {
    const { canvas, elements } = get();
    const look = { ...shapeDefaults(shape, elements), ...overrides };
    const width = look.width ?? 240;
    const height = look.height ?? 240;
    // Step down from centre past anything already there, or a run of new marks
    // piles up and hides itself.
    let x = (canvas.width - width) / 2;
    let y = (canvas.height - height) / 2;
    const taken = () =>
      elements.some(
        (e) =>
          e.x + e.width / 2 === x + width / 2 &&
          e.y + e.height / 2 === y + height / 2,
      );
    while (taken()) {
      x += 32;
      y += 32;
    }
    const el: ShapeElement = {
      id: uid(),
      type: "shape",
      shape,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      fill: "#534AB7",
      stroke: "#1D9E75",
      strokeWidth: 0,
      cornerRadius: 0,
      dashed: false,
      ...look,
    };
    set({ elements: [...elements, el], selectedIds: [el.id] });
    return el.id;
  },

  updateElement: (id, patch) =>
    set({
      elements: get().elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as LayerElement) : e
      ),
    }),

  measureElement: (id, height) =>
    history.silently(() => get().updateElement(id, { height })),

  duplicateElement: (id) => {
    const source = get().elements.find((e) => e.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: uid(),
      x: source.x + 32,
      y: source.y + 32,
      locked: false,
      hidden: false,
      // A copied step marker is almost always the next step.
      ...(source.type === "shape" && source.shape === "number"
        ? { text: nextNumber(get().elements) }
        : {}),
    } as LayerElement;
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

  reorderElement: (id, targetId) => {
    const els = get().elements.slice();
    const from = els.findIndex((e) => e.id === id);
    const to = els.findIndex((e) => e.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const [item] = els.splice(from, 1);
    els.splice(to, 0, item);
    set({ elements: els });
  },

  loadProject: (project) => {
    set({
      markTool: null,
      editingId: null,
      cropId: null,
      canvas: {
        label: "Custom",
        width: project.canvas.width,
        height: project.canvas.height,
      },
      // Spread over the defaults: `.layer` files written before the pattern
      // background existed have no `pattern` key, and the panel/canvas both
      // assume one is always present.
      background: { ...DEFAULT_BACKGROUND, ...project.background },
      elements: project.elements.map(migrateElement),
      watermark: project.watermark,
      selectedIds: [],
    });
    history.reset();
  },

  toProject: () => ({
    version: 1,
    canvas: { width: get().canvas.width, height: get().canvas.height },
    background: get().background,
    elements: get().elements,
    watermark: get().watermark,
  }),

  resetProject: () => {
    set({
      markTool: null,
      editingId: null,
      cropId: null,
      canvas: DEFAULT_CANVAS,
      background: DEFAULT_BACKGROUND,
      elements: [],
      selectedIds: [],
    });
    history.reset();
  },
}));

const documentOf = ({
  canvas,
  background,
  elements,
  uploadedImages,
  watermark,
}: EditorState) => ({
  canvas,
  background,
  elements,
  uploadedImages,
  watermark,
});

const history = createHistory({
  read: () => documentOf(useEditor.getState()),
  write: (doc) => {
    const ids = new Set(doc.elements.map((e) => e.id));
    useEditor.setState({
      ...doc,
      // Selection isn't part of a step, but it can't outlive what it points at.
      selectedIds: useEditor.getState().selectedIds.filter((id) => ids.has(id)),
      editingId: null,
      cropId: null,
    });
  },
  onStacksChange: (canUndo, canRedo) => useEditor.setState({ canUndo, canRedo }),
});

useEditor.subscribe((state, previous) => {
  if (
    state.elements !== previous.elements ||
    state.uploadedImages !== previous.uploadedImages ||
    state.background !== previous.background ||
    state.canvas !== previous.canvas ||
    state.watermark !== previous.watermark
  ) {
    history.changed();
  }
});

export type { Tool };
