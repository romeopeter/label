import { create } from "zustand";
import type {
  BackgroundEffects,
  BackgroundState,
  SavedBackground,
  CanvasSize,
  DeviceFrame,
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
  CanvasLayout,
  LayoutId,
} from "../types";
import type { PatternColorPair, PatternConfig } from "../types/pattern";
import { DEFAULT_PATTERN_CONFIG } from "../types/pattern";
import type { BackdropLook } from "../types/backdrop";
import { DEFAULT_BACKDROP } from "../lib/backdrops/presets";
import { NO_EFFECTS } from "../lib/background/effects";
import { DEFAULT_GRADIENT, normaliseBackground } from "../lib/background/normalise";
import {
  applyLook,
  isShuffleMode,
  lookOfBackground,
  sameLook,
  shuffledLookFor,
  type BackgroundLook,
  type ShuffleMode,
} from "../lib/background/looks";
import { storeSavedBackgrounds } from "../lib/host";
import { migrateElement, nextNumber } from "../lib/marks";
import { placeFrame } from "../lib/mockups";
import { DEFAULT_MARK_STYLES, shapeDefaults } from "../lib/markTools";
import {
  arrangeLayout,
  fittedCanvas,
  layoutOf,
  newLayout,
  settleLayout,
  withoutLayoutCrop,
} from "../lib/layouts";
import { createHistory } from "./history";

/* ------------------------------------------------------- */

const uid = () => "el_" + Math.random().toString(36).slice(2, 9);

const DEFAULT_CANVAS: CanvasSize = {
  label: "Wide HD",
  width: 2400,
  height: 1350,
};

export const DEFAULT_BACKGROUND: BackgroundState = {
  mode: "gradient",
  color: "#1A1826",
  gradient: DEFAULT_GRADIENT,
  imageSrc: null,
  pattern: DEFAULT_PATTERN_CONFIG,
  backdrop: DEFAULT_BACKDROP,
  effects: NO_EFFECTS,
};

/** How many looks Back can return to, for each type. */
const TRAIL_MAX = 50;

/** How many backgrounds can be saved. Image backgrounds are large. */
export const SAVED_MAX = 24;

/** Shuffled and preset looks seen this session, for one background type. */
interface LookTrail {
  looks: BackgroundLook[];
  at: number;
}

/** A saved background is one entry however many times it's saved. */
const sameBackground = (a: BackgroundState, b: BackgroundState) => JSON.stringify(a) === JSON.stringify(b);

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
  /** Null means images are placed by hand. */
  layout: CanvasLayout | null;

  activeTool: Tool;
  zoom: number;
  grid: GridState;
  /** Smart guides + snapping while dragging. A view aid, like `grid`. */
  snapEnabled: boolean;
  watermark: boolean;
  isPro: boolean;
  /** Transient: true while a pattern slider is held. Not part of the project. */
  patternDragging: boolean;
  /**
   * Transient: looks seen this session, for Back and Forward, by background type.
   * Not part of the project or of undo: it's a list to choose from, not a change.
   */
  lookTrails: Partial<Record<ShuffleMode, LookTrail>>;
  /** Backgrounds kept to use again in any project. Not part of the project. */
  savedBackgrounds: SavedBackground[];
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
  /** Changes the abstract background. */
  setBackdrop: (patch: Partial<BackdropLook>) => void;
  /** Changes the effects on the background, whichever type it is. */
  setEffects: (patch: Partial<BackgroundEffects>) => void;
  /** Shows a new look for a type, from Shuffle or a preset, and adds it to that type's trail. */
  showLook: (mode: ShuffleMode, look?: BackgroundLook) => void;
  /** Moves back or forward along a type's trail. Effects and other settings stay as they are. */
  stepLook: (mode: ShuffleMode, by: -1 | 1) => void;
  /** Keeps the current background to use again. */
  saveBackground: () => void;
  useSavedBackground: (id: string) => void;
  deleteSavedBackground: (id: string) => void;
  /** Fills the list from the saved file, at launch. */
  setSavedBackgrounds: (list: SavedBackground[]) => void;
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
  /** Records a picture's size once loaded, for images saved without it. Not an edit. */
  setNaturalSize: (id: string, width: number, height: number) => void;
  setLayout: (id: LayoutId | null) => void;
  updateLayout: (patch: Partial<CanvasLayout>) => void;
  setSlotFocus: (index: number, focus: { x: number; y: number }) => void;
  swapSlots: (a: number, b: number) => void;
  /** Adds an image into this slot, replacing what's there. */
  fillSlot: (index: number, src: string, width: number, height: number) => string;
  fitCanvasToLayout: () => void;
  /** Gives the layout's other images this one's shadow, corners, border and frame. */
  matchLayoutStyle: (sourceId: string) => void;
  addUploadedImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  deleteUploadedImage: (id: string) => void;
  addText: (variant: "heading" | "body", overrides?: Partial<TextElement>) => string;
  addShape: (shape: ShapeKind, overrides?: Partial<ShapeElement>) => string;
  updateElement: (id: string, patch: Partial<LayerElement>) => void;
  /** Puts an image on a device, or takes it off, and gives it the right shape. */
  setDeviceFrame: (id: string, frame: DeviceFrame | null) => void;
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

const FIT_PASSES = 8;

export const useEditor = create<EditorState>((set, get) => ({
  canvas: DEFAULT_CANVAS,
  background: DEFAULT_BACKGROUND,
  elements: [],
  uploadedImages: [],
  customPatternPairs: [],
  selectedIds: [],
  layout: null,

  activeTool: "uploads",
  zoom: 62,
  grid: DEFAULT_GRID,
  // On by default: this is the behaviour people expect from an editor, and it
  // is unobtrusive because guides only appear when something actually lines up.
  snapEnabled: true,
  watermark: true,
  isPro: false,
  patternDragging: false,
  lookTrails: {},
  savedBackgrounds: [],
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
  setBackground: (b) => {
    const { background, lookTrails } = get();
    const next = { ...background, ...b };
    // A look changed by hand replaces the one Back and Forward are on.
    const mode = next.mode;
    const trail = isShuffleMode(mode) ? lookTrails[mode] : undefined;
    const changed =
      isShuffleMode(mode) && trail && !sameLook(lookOfBackground(background, mode), lookOfBackground(next, mode));
    set({
      background: next,
      ...(changed && trail
        ? {
            lookTrails: {
              ...lookTrails,
              [mode]: { ...trail, looks: trail.looks.map((look, i) => (i === trail.at ? lookOfBackground(next, mode) : look)) },
            },
          }
        : {}),
    });
  },

  setPattern: (p) => {
    const background = get().background;
    get().setBackground({ pattern: { ...background.pattern, ...p } });
  },

  setPatternDragging: (v) => set({ patternDragging: v }),

  setBackdrop: (patch) => {
    const { background } = get();
    get().setBackground({ mode: "abstract", backdrop: { ...background.backdrop, ...patch } });
  },

  setEffects: (patch) => {
    const { background } = get();
    get().setBackground({ effects: { ...background.effects, ...patch } });
  },

  showLook: (mode, look) => {
    const { background, lookTrails } = get();
    const current = lookOfBackground(background, mode);
    const next = look ?? shuffledLookFor(background, mode);
    const trail = lookTrails[mode];
    // Where you started is the first stop, so Back can always return to it.
    const kept = trail ? trail.looks.slice(0, trail.at + 1) : [current];
    const looks = [...kept, next].slice(-TRAIL_MAX);
    set({
      background: { ...background, ...applyLook(background, next) },
      lookTrails: { ...lookTrails, [mode]: { looks, at: looks.length - 1 } },
    });
  },

  stepLook: (mode, by) => {
    const { background, lookTrails } = get();
    const trail = lookTrails[mode];
    const look = trail?.looks[trail.at + by];
    if (!trail || !look) return;
    set({
      background: { ...background, ...applyLook(background, look) },
      lookTrails: { ...lookTrails, [mode]: { ...trail, at: trail.at + by } },
    });
  },

  saveBackground: () => {
    const { background, savedBackgrounds } = get();
    const others = savedBackgrounds.filter((saved) => !sameBackground(saved.background, background));
    const next = [{ id: "bg_" + Math.random().toString(36).slice(2, 9), background }, ...others].slice(0, SAVED_MAX);
    set({ savedBackgrounds: next });
    void storeSavedBackgrounds(next).catch((error) => console.error(error));
  },

  useSavedBackground: (id) => {
    const saved = get().savedBackgrounds.find((entry) => entry.id === id);
    if (saved) get().setBackground(saved.background);
  },

  deleteSavedBackground: (id) => {
    const next = get().savedBackgrounds.filter((entry) => entry.id !== id);
    set({ savedBackgrounds: next });
    void storeSavedBackgrounds(next).catch((error) => console.error(error));
  },

  setSavedBackgrounds: (list) => set({ savedBackgrounds: list }),

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
      naturalWidth,
      naturalHeight,
      deviceFrame: null,
      cornerRadius: 8,
      shadow: { enabled: true, color: "rgba(0,0,0,0.45)", blur: 60, offsetX: 0, offsetY: 30 },
      transform: "rotate3d(0deg, 0deg, 0deg)"
    };
    // Whichever way an image arrives, it takes the layout's next free slot.
    const { layout } = get();
    const free = layout ? layout.slots.findIndex((slot) => !slot.id) : -1;
    set({
      elements: [...elements, el],
      selectedIds: [el.id],
      ...(layout && free !== -1
        ? { layout: { ...layout, slots: layout.slots.map((slot, i) => (i === free ? { id: el.id } : slot)) } }
        : {}),
    });
    return el.id;
  },

  setNaturalSize: (id, naturalWidth, naturalHeight) =>
    history.silently(() =>
      get().updateElement(id, { naturalWidth, naturalHeight } as Partial<LayerElement>),
    ),

  setLayout: (id) => {
    const { layout, elements } = get();
    const bake = (keep: Set<string | null>) =>
      elements.map((el) =>
        el.type === "image" && !keep.has(el.id) ? withoutLayoutCrop(el) : el,
      );

    if (!id) {
      set({ layout: null, elements: bake(new Set()) });
      return;
    }

    // Images already in the layout keep their order, then any others fill up.
    const next = newLayout(id, layout);
    const current = (layout?.slots ?? []).flatMap((slot) => (slot.id ? [slot.id] : []));
    const others = elements
      .filter((el) => el.type === "image" && !current.includes(el.id))
      .map((el) => el.id);
    const queue = [...current, ...others].slice(0, next.slots.length);
    next.slots = next.slots.map((slot, i) => ({ id: queue[i] ?? null }));
    set({ layout: next, elements: bake(new Set(queue)) });
  },

  updateLayout: (patch) => {
    const { layout } = get();
    if (layout) set({ layout: { ...layout, ...patch } });
  },

  setSlotFocus: (index, focus) => {
    const { layout } = get();
    if (!layout) return;
    set({
      layout: {
        ...layout,
        slots: layout.slots.map((slot, i) => (i === index ? { ...slot, focus } : slot)),
      },
    });
  },

  swapSlots: (a, b) => {
    const { layout } = get();
    if (!layout || !layout.slots[a] || !layout.slots[b]) return;
    const slots = layout.slots.slice();
    // The focus belongs to the picture it was chosen for, so it moves too.
    [slots[a], slots[b]] = [slots[b], slots[a]];
    set({ layout: { ...layout, slots } });
  },

  fillSlot: (index, src, width, height) => {
    const { layout, elements, addImage } = get();
    const old = layout?.slots[index]?.id;
    if (layout && old) {
      set({
        elements: elements.filter((el) => el.id !== old),
        layout: {
          ...layout,
          slots: layout.slots.map((slot, i) => (i === index ? { id: null } : slot)),
        },
      });
    }
    const id = addImage(src, width, height);
    const after = get().layout;
    if (after) {
      // addImage took the first free slot, which may be an earlier one.
      set({
        layout: {
          ...after,
          slots: after.slots.map((slot, i) => {
            if (i === index) return { id };
            return slot.id === id ? { id: null } : slot;
          }),
        },
      });
    }
    return id;
  },

  fitCanvasToLayout: () => {
    const { layout, elements, canvas } = get();
    if (!layout) return;
    // Gaps scale with the canvas, so a new size changes what fits. It settles quickly.
    let fitted = canvas;
    for (let pass = 0; pass < FIT_PASSES; pass++) {
      const next = fittedCanvas(layout, arrangeLayout(layout, elements, fitted));
      if (!next) return;
      const settled = next.width === fitted.width && next.height === fitted.height;
      fitted = next;
      if (settled) break;
    }
    set({ canvas: fitted });
  },

  matchLayoutStyle: (sourceId) => {
    const { layout, elements } = get();
    const source = elements.find((el) => el.id === sourceId);
    if (!layout || source?.type !== "image") return;
    const ids = new Set(layout.slots.map((slot) => slot.id));
    set({
      elements: elements.map((el) =>
        el.type === "image" && el.id !== sourceId && ids.has(el.id)
          ? {
              ...el,
              shadow: source.shadow,
              cornerRadius: source.cornerRadius,
              border: source.border,
              deviceFrame: source.deviceFrame,
            }
          : el,
      ),
    });
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

  setDeviceFrame: (id, frame) =>
    set({
      elements: get().elements.map((el) =>
        el.id === id && el.type === "image"
          ? { ...el, deviceFrame: frame, ...placeFrame(el, frame, get().canvas) }
          : el,
      ),
    }),

  measureElement: (id, height) =>
    history.silently(() => get().updateElement(id, { height })),

  duplicateElement: (id) => {
    const source = get().elements.find((e) => e.id === id);
    if (!source) return;
    const copy = {
      // A copy is free of the layout, so the slot's trim becomes its own crop.
      ...(source.type === "image" ? withoutLayoutCrop(source) : source),
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
      // Older files lack whole parts (pattern, backdrop, effects), and keep some
      // settings where they used to live.
      background: normaliseBackground(project.background, DEFAULT_BACKGROUND),
      lookTrails: {},
      elements: project.elements.map(migrateElement),
      watermark: project.watermark,
      layout:
        project.layout && layoutOf(project.layout.id) && Array.isArray(project.layout.slots)
          ? project.layout
          : null,
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
    layout: get().layout,
  }),

  resetProject: () => {
    set({
      markTool: null,
      editingId: null,
      cropId: null,
      canvas: DEFAULT_CANVAS,
      background: DEFAULT_BACKGROUND,
      lookTrails: {},
      elements: [],
      layout: null,
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
  layout,
  watermark,
}: EditorState) => ({
  canvas,
  background,
  elements,
  uploadedImages,
  layout,
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

// Keeps images in a layout where it says they go, whatever just changed.
useEditor.subscribe((state, previous) => {
  if (
    !state.layout ||
    (state.layout === previous.layout &&
      state.elements === previous.elements &&
      state.canvas === previous.canvas)
  ) {
    return;
  }
  const settled = settleLayout(state.layout, state.elements, state.canvas);
  if (settled) useEditor.setState(settled);
});

useEditor.subscribe((state, previous) => {
  if (
    state.elements !== previous.elements ||
    state.uploadedImages !== previous.uploadedImages ||
    state.layout !== previous.layout ||
    state.background !== previous.background ||
    state.canvas !== previous.canvas ||
    state.watermark !== previous.watermark
  ) {
    history.changed();
  }
});

export type { Tool };
