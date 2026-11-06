import { frameShape, pictureRatioOf } from "./mockups";
import type {
  CanvasLayout,
  ImageCrop,
  ImageElement,
  LayerElement,
  LayoutAlign,
  LayoutId,
  LayoutSlot,
} from "@/types";

/*
  Layouts as plain data, and the one pure function that turns a layout into where
  each image goes. Images stay ordinary elements: the store writes these results
  onto them whenever anything changes, which is what keeps them linked.
*/

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutDef {
  id: LayoutId;
  label: string;
  /** "row" and "column" pack images together; "grid" and "overlap" use fixed places. */
  kind: "row" | "column" | "grid" | "overlap";
  slots: number;
  /** Starts trimmed to its slots, because the slots are the point of the layout. */
  fills?: boolean;
  /** Grid size, with each slot's column, row, column span and row span. */
  grid?: { cols: number; rows: number; cells: [number, number, number, number][] };
  /** Slot size as a share of the area, then each slot's offset and rotation. */
  overlap?: { size: number; places: [number, number, number][] };
  labels?: string[];
  decor?: "verdict" | "arrow-above" | "arrow-between";
}

const gridCells = (cols: number, rows: number) =>
  Array.from({ length: cols * rows }, (_, i): [number, number, number, number] => [
    i % cols,
    Math.floor(i / cols),
    1,
    1,
  ]);

export const LAYOUTS: LayoutDef[] = [
  { id: "side", label: "Side by side", kind: "row", slots: 2 },
  { id: "stacked", label: "Stacked", kind: "column", slots: 2 },
  {
    id: "overlap-up",
    label: "Overlap up",
    kind: "overlap",
    slots: 2,
    overlap: { size: 0.66, places: [[-0.17, 0.17, 0], [0.17, -0.17, 0]] },
  },
  {
    id: "overlap-down",
    label: "Overlap down",
    kind: "overlap",
    slots: 2,
    overlap: { size: 0.66, places: [[-0.17, -0.17, 0], [0.17, 0.17, 0]] },
  },
  {
    id: "masonry",
    label: "Masonry",
    kind: "grid",
    slots: 4,
    fills: true,
    grid: { cols: 2, rows: 3, cells: [[0, 0, 1, 2], [1, 0, 1, 1], [0, 2, 1, 1], [1, 1, 1, 2]] },
  },
  {
    id: "do-dont",
    label: "Do & don't",
    kind: "row",
    slots: 2,
    labels: ["Don't", "Do"],
    decor: "verdict",
  },
  {
    id: "before-after",
    label: "Before & after",
    kind: "row",
    slots: 2,
    labels: ["Before", "After"],
    decor: "arrow-above",
  },
  {
    id: "arrow-between",
    label: "Arrow between",
    kind: "row",
    slots: 2,
    labels: ["Before", "After"],
    decor: "arrow-between",
  },
  { id: "row-3", label: "Three in a row", kind: "row", slots: 3 },
  {
    id: "hero",
    label: "One big, two small",
    kind: "grid",
    slots: 3,
    fills: true,
    grid: { cols: 3, rows: 2, cells: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1]] },
  },
  {
    id: "grid-2",
    label: "2×2 grid",
    kind: "grid",
    slots: 4,
    fills: true,
    grid: { cols: 2, rows: 2, cells: gridCells(2, 2) },
  },
  {
    id: "grid-3",
    label: "3×3 grid",
    kind: "grid",
    slots: 9,
    fills: true,
    grid: { cols: 3, rows: 3, cells: gridCells(3, 3) },
  },
  {
    id: "cascade",
    label: "Cascade",
    kind: "overlap",
    slots: 3,
    overlap: { size: 0.6, places: [[-0.2, -0.2, 0], [0, 0, 0], [0.2, 0.2, 0]] },
  },
  {
    id: "fan",
    label: "Fan",
    kind: "overlap",
    slots: 3,
    overlap: { size: 0.64, places: [[-0.18, 0.02, -9], [0, 0, 0], [0.18, 0.02, 9]] },
  },
];

export const layoutOf = (id: LayoutId) => LAYOUTS.find((layout) => layout.id === id);

export const newLayout = (id: LayoutId, previous: CanvasLayout | null): CanvasLayout => {
  const def = layoutOf(id);
  return {
    id,
    align: previous?.align ?? "center",
    spacing: previous?.spacing ?? 30,
    scale: previous?.scale ?? 80,
    sameWidth: previous?.sameWidth ?? true,
    sameShape: !!def?.fills,
    showLabels: true,
    labels: def?.labels ?? [],
    slots: Array.from({ length: def?.slots ?? 0 }, (): LayoutSlot => ({ id: null })),
  };
};

/* ------------------------------------------------------------------------ */

const WHOLE: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };

/** What an image really shows: its own crop, then any trim its slot adds. */
export const visibleCrop = (
  el: Pick<ImageElement, "crop" | "layoutCrop">,
): ImageCrop | undefined => {
  if (!el.layoutCrop) return el.crop;
  const own = el.crop ?? WHOLE;
  return {
    x: own.x + el.layoutCrop.x * own.width,
    y: own.y + el.layoutCrop.y * own.height,
    width: own.width * el.layoutCrop.width,
    height: own.height * el.layoutCrop.height,
  };
};

/** Turns a slot's trim into the image's own crop, so it looks the same on its own. */
export const withoutLayoutCrop = (el: ImageElement): ImageElement =>
  el.layoutCrop ? { ...el, crop: visibleCrop(el), layoutCrop: undefined } : el;

/** Width over height of the picture, before any trim from a slot. */
const ratioOf = (el: ImageElement) => {
  if (el.deviceFrame) return frameShape(el.deviceFrame, pictureRatioOf(el)).ratio;
  const crop = el.crop ?? WHOLE;
  if (el.naturalWidth && el.naturalHeight) {
    return (el.naturalWidth * crop.width) / (el.naturalHeight * crop.height);
  }
  if (el.layoutCrop) {
    return (el.width / el.height) * (el.layoutCrop.height / el.layoutCrop.width);
  }
  return el.width / el.height;
};

const alignIn = (start: number, room: number, align: LayoutAlign) =>
  align === "start" ? start : align === "end" ? start + room : start + room / 2;

const containIn = (cell: Rect, ratio: number, align: LayoutAlign): Rect => {
  const width = Math.min(cell.width, cell.height * ratio);
  const height = width / ratio;
  return {
    x: alignIn(cell.x, cell.width - width, align),
    y: alignIn(cell.y, cell.height - height, align),
    width,
    height,
  };
};

const trimTo = (ratio: number, target: number, focus = { x: 0.5, y: 0.5 }): ImageCrop | undefined => {
  if (Math.abs(ratio / target - 1) < 0.001) return undefined;
  if (ratio > target) {
    const width = target / ratio;
    return { x: (1 - width) * focus.x, y: 0, width, height: 1 };
  }
  const height = ratio / target;
  return { x: 0, y: (1 - height) * focus.y, width: 1, height };
};

export interface PlacedSlot extends Rect {
  rotation: number;
  /** The image's centre, which is what rotation turns around here. */
  id: string | null;
  crop?: ImageCrop;
}

export type LayoutDecor =
  | { kind: "verdict"; good: boolean; x: number; y: number; radius: number }
  | { kind: "arrow"; points: number[]; width: number }
  | { kind: "label"; text: string; x: number; y: number; width: number; size: number };

export interface Arrangement {
  slots: PlacedSlot[];
  decor: LayoutDecor[];
}

const areaOf = (layout: CanvasLayout, canvas: { width: number; height: number }): Rect => {
  const pad = ((1 - layout.scale / 100) / 2) * Math.min(canvas.width, canvas.height);
  return {
    x: pad,
    y: pad,
    width: Math.max(canvas.width - pad * 2, 1),
    height: Math.max(canvas.height - pad * 2, 1),
  };
};

/** Row or column: images sit next to each other, so the gap is really the gap. */
const packLine = (
  layout: CanvasLayout,
  def: LayoutDef,
  area: Rect,
  gap: number,
  pictures: (ImageElement | null)[],
): (Rect & { crop?: ImageCrop })[] => {
  const across = def.kind === "row";
  const count = pictures.length;
  const cell: Rect = across
    ? { ...area, width: (area.width - gap * (count - 1)) / count }
    : { ...area, height: (area.height - gap * (count - 1)) / count };

  const sizes = pictures.map((el, i) => {
    if (!el) return { width: cell.width, height: cell.height };
    const ratio = ratioOf(el);
    if (layout.sameShape && !el.deviceFrame) {
      const crop = trimTo(ratio, cell.width / cell.height, layout.slots[i]?.focus);
      return { width: cell.width, height: cell.height, crop };
    }
    const { width, height } = containIn(cell, ratio, "center");
    return { width, height };
  });

  if (layout.sameWidth && !layout.sameShape) {
    const shared = Math.min(...pictures.flatMap((el, i) => (el ? [sizes[i].width] : [])), cell.width);
    pictures.forEach((el, i) => {
      if (el) sizes[i] = { width: shared, height: shared / ratioOf(el) };
    });
  }

  const length = sizes.reduce((sum, size) => sum + (across ? size.width : size.height), 0);
  const total = length + gap * (count - 1);
  let along = (across ? area.x + (area.width - total) / 2 : area.y + (area.height - total) / 2);

  return sizes.map((size) => {
    const placed = across
      ? { ...size, x: along, y: alignIn(area.y, area.height - size.height, layout.align) }
      : { ...size, x: alignIn(area.x, area.width - size.width, layout.align), y: along };
    along += (across ? size.width : size.height) + gap;
    return placed;
  });
};

export const arrangeLayout = (
  layout: CanvasLayout,
  elements: readonly LayerElement[],
  canvas: { width: number; height: number },
): Arrangement => {
  const def = layoutOf(layout.id);
  if (!def) return { slots: [], decor: [] };

  const short = Math.min(canvas.width, canvas.height);
  let area = areaOf(layout, canvas);
  if (def.decor === "arrow-above") {
    const room = area.height * 0.16;
    area = { ...area, y: area.y + room, height: area.height - room };
  }

  const reference = Math.min(area.width, area.height);
  let gap = (layout.spacing / 100) * 0.12 * reference;
  if (def.decor === "arrow-between") gap = Math.max(gap, area.width * 0.12);

  const pictures = layout.slots.map((slot) => {
    const el = elements.find((element) => element.id === slot.id);
    return el?.type === "image" ? el : null;
  });

  let rects: (Rect & { crop?: ImageCrop; rotation?: number })[];
  if (def.kind === "row" || def.kind === "column") {
    rects = packLine(layout, def, area, gap, pictures);
  } else if (def.grid) {
    const { cols, rows, cells } = def.grid;
    const unitW = (area.width - gap * (cols - 1)) / cols;
    const unitH = (area.height - gap * (rows - 1)) / rows;
    rects = cells.map(([col, row, colSpan, rowSpan], i) => {
      const cell: Rect = {
        x: area.x + col * (unitW + gap),
        y: area.y + row * (unitH + gap),
        width: unitW * colSpan + gap * (colSpan - 1),
        height: unitH * rowSpan + gap * (rowSpan - 1),
      };
      const el = pictures[i];
      if (!el) return cell;
      const ratio = ratioOf(el);
      if (layout.sameShape && !el.deviceFrame) {
        return { ...cell, crop: trimTo(ratio, cell.width / cell.height, layout.slots[i]?.focus) };
      }
      return containIn(cell, ratio, layout.align);
    });
  } else {
    const { size, places } = def.overlap ?? { size: 1, places: [] };
    // Spacing here is how far apart the images sit: at the top they just touch the area's edges.
    const spread = 0.3 + 0.7 * (layout.spacing / 100);
    const centreX = area.x + area.width / 2;
    const centreY = area.y + area.height / 2;
    rects = places.map(([dx, dy, rotation], i) => {
      const width = area.width * size;
      const height = area.height * size;
      const cell: Rect = {
        x: centreX + dx * spread * area.width - width / 2,
        y: centreY + dy * spread * area.height - height / 2,
        width,
        height,
      };
      const el = pictures[i];
      if (!el) return { ...cell, rotation };
      const ratio = ratioOf(el);
      if (layout.sameShape && !el.deviceFrame) {
        return {
          ...cell,
          rotation,
          crop: trimTo(ratio, width / height, layout.slots[i]?.focus),
        };
      }
      return { ...containIn(cell, ratio, "center"), rotation };
    });
  }

  const slots: PlacedSlot[] = rects.map((rect, i) => {
    const rotation = rect.rotation ?? 0;
    const angle = (rotation * Math.PI) / 180;
    // Elements turn around their top-left corner, but a fan should turn around the middle.
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const shiftX = halfW - (halfW * Math.cos(angle) - halfH * Math.sin(angle));
    const shiftY = halfH - (halfW * Math.sin(angle) + halfH * Math.cos(angle));
    return {
      x: rect.x + shiftX,
      y: rect.y + shiftY,
      width: rect.width,
      height: rect.height,
      rotation,
      crop: rect.crop,
      id: pictures[i]?.id ?? null,
    };
  });

  const decor: LayoutDecor[] = [];
  const [first, second] = slots;
  if (first && second) {
    const topOf = (slot: PlacedSlot) => [slot.x + slot.width / 2, slot.y] as const;
    if (def.decor === "verdict") {
      const radius = short * 0.028;
      [first, second].forEach((slot, i) => {
        const [x, y] = topOf(slot);
        decor.push({ kind: "verdict", good: i === 1, x, y, radius });
      });
    }
    if (def.decor === "arrow-above") {
      const [x0, y0] = topOf(first);
      const [x1, y1] = topOf(second);
      const lift = Math.min(area.height * 0.13, Math.abs(x1 - x0) * 0.3);
      decor.push({
        kind: "arrow",
        width: short * 0.006,
        points: [x0, y0 - lift * 0.25, (x0 + x1) / 2, Math.min(y0, y1) - lift, x1, y1 - lift * 0.25],
      });
    }
    if (def.decor === "arrow-between") {
      const from = first.x + first.width;
      const room = second.x - from;
      const y = alignIn(area.y, area.height, "center");
      decor.push({
        kind: "arrow",
        width: short * 0.006,
        points: [from + room * 0.22, y - room * 0.12, from + room * 0.5, y - room * 0.3, from + room * 0.78, y],
      });
    }
  }

  if (layout.showLabels) {
    const size = short * 0.028;
    layout.labels.forEach((text, i) => {
      const slot = slots[i];
      if (!slot || !text.trim()) return;
      decor.push({
        kind: "label",
        text,
        size,
        width: slot.width,
        x: slot.x,
        y: slot.y + slot.height - size * 2.6,
      });
    });
  }

  return { slots, decor };
};

/** The slot under a canvas point. Later slots sit on top, so they win. */
export const slotAt = (arrangement: Arrangement, x: number, y: number) => {
  for (let i = arrangement.slots.length - 1; i >= 0; i--) {
    const slot = arrangement.slots[i];
    if (x >= slot.x && x <= slot.x + slot.width && y >= slot.y && y <= slot.y + slot.height) {
      return i;
    }
  }
  return null;
};

/** The canvas that fits the images snugly, keeping the current even padding. */
export const fittedCanvas = (layout: CanvasLayout, arrangement: Arrangement) => {
  const placed = arrangement.slots.filter((slot) => slot.id);
  if (!placed.length) return null;
  const minX = Math.min(...placed.map((s) => s.x));
  const minY = Math.min(...placed.map((s) => s.y));
  const width = Math.max(...placed.map((s) => s.x + s.width)) - minX;
  const height = Math.max(...placed.map((s) => s.y + s.height)) - minY;
  const share = layout.scale / 100;
  const pad = ((1 - share) / (2 * share)) * Math.min(width, height);
  return {
    label: "Custom",
    width: Math.round(width + pad * 2),
    height: Math.round(height + pad * 2),
  };
};

/* ------------------------------------------------------------------------ */

const near = (a: number, b: number, within = 0.01) => Math.abs(a - b) <= within;

const sameCrop = (a?: ImageCrop, b?: ImageCrop) =>
  a === b ||
  (!!a &&
    !!b &&
    near(a.x, b.x, 0.0001) &&
    near(a.y, b.y, 0.0001) &&
    near(a.width, b.width, 0.0001) &&
    near(a.height, b.height, 0.0001));

/**
 * What must change for the images to match the layout, or null if they already
 * do. Slots whose image is gone empty out, and images stack in slot order.
 */
export const settleLayout = (
  layout: CanvasLayout,
  elements: LayerElement[],
  canvas: { width: number; height: number },
): { layout?: CanvasLayout; elements?: LayerElement[] } | null => {
  const ids = new Set(elements.map((el) => el.id));
  const gone = layout.slots.some((slot) => slot.id && !ids.has(slot.id));
  const nextLayout = gone
    ? {
        ...layout,
        slots: layout.slots.map((slot) => (slot.id && !ids.has(slot.id) ? { id: null } : slot)),
      }
    : layout;

  const { slots } = arrangeLayout(nextLayout, elements, canvas);
  let changed = false;
  let nextElements = elements.map((el) => {
    const place = slots.find((slot) => slot.id === el.id);
    if (!place || el.type !== "image") return el;
    const same =
      near(el.x, place.x) &&
      near(el.y, place.y) &&
      near(el.width, place.width) &&
      near(el.height, place.height) &&
      near(el.rotation, place.rotation) &&
      sameCrop(el.layoutCrop, place.crop);
    if (same) return el;
    changed = true;
    return {
      ...el,
      x: place.x,
      y: place.y,
      width: place.width,
      height: place.height,
      rotation: place.rotation,
      layoutCrop: place.crop,
    };
  });

  // Slot order among the positions those images already hold, so marks stay on top.
  const slotted = slots.flatMap((slot) => (slot.id ? [slot.id] : []));
  const held = nextElements.flatMap((el, i) => (slotted.includes(el.id) ? [i] : []));
  const byId = new Map(nextElements.map((el) => [el.id, el]));
  if (held.some((index, order) => nextElements[index].id !== slotted[order])) {
    nextElements = nextElements.slice();
    held.forEach((index, order) => {
      const el = byId.get(slotted[order]);
      if (el) nextElements[index] = el;
    });
    changed = true;
  }

  if (!gone && !changed) return null;
  return {
    ...(gone ? { layout: nextLayout } : {}),
    ...(changed ? { elements: nextElements } : {}),
  };
};
