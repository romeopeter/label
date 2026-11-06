import type { ImageElement } from "@/types";
import { visibleCrop } from "@/lib/layouts";
import { inpaint } from "./inpaint";

/*
  Heal, Hide and Expand change the picture itself, unlike the Style and Adjust
  edits, which are settings. Hide has to: covered details must be gone from the
  project file as well as from exports. Expand changes the picture's size, which
  crop, frames and layouts all measure from. Heal is costly to work out again.
  Undo still brings back the picture from before.
*/

/** An area of the picture, as shares of its width and height. */
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A brush stroke: points as shares of the picture, radius as a share of its shorter side. */
export interface Stroke {
  points: [number, number][];
  radius: number;
}

export type HideStyle = "blur" | "pixels" | "bar";

export type ExpandFill = "fill" | "mirror" | "edges";

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Heal works on a copy no bigger than this around what was painted, then scales back. */
const HEAL_SIDE = 360;
/** Expand fills in on a copy no bigger than this. */
const EXPAND_SIDE = 512;

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const context = (canvas: HTMLCanvasElement) => {
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("Layer couldn't work on this picture.");
  return g;
};

export const copyOf = (picture: HTMLCanvasElement) => {
  const copy = canvasOf(picture.width, picture.height);
  context(copy).drawImage(picture, 0, 0);
  return copy;
};

/** The element's picture, as a canvas to work on. */
export const loadPicture = async (src: string) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = canvasOf(image.naturalWidth, image.naturalHeight);
  context(canvas).drawImage(image, 0, 0);
  return canvas;
};

/** The picture as a data URL, keeping JPEG pictures as JPEG so files don't balloon. */
export const encodePicture = (picture: HTMLCanvasElement, originalSrc: string) =>
  originalSrc.startsWith("data:image/jpeg")
    ? picture.toDataURL("image/jpeg", 0.95)
    : picture.toDataURL("image/png");

/** Paints strokes, white on clear, at a canvas's size. */
const drawStrokes = (canvas: HTMLCanvasElement, strokes: Stroke[], grow = 1) => {
  const g = context(canvas);
  const shorter = Math.min(canvas.width, canvas.height);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const stroke of strokes) {
    const radius = stroke.radius * shorter * grow;
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    g.lineWidth = radius * 2;
    g.beginPath();
    g.arc(first[0] * canvas.width, first[1] * canvas.height, radius, 0, Math.PI * 2);
    g.fill();
    if (!rest.length) continue;
    g.beginPath();
    g.moveTo(first[0] * canvas.width, first[1] * canvas.height);
    for (const [x, y] of rest) g.lineTo(x * canvas.width, y * canvas.height);
    g.stroke();
  }
};

/** The box around everything painted, in pixels, or null if nothing was. */
const paintedBox = (mask: HTMLCanvasElement) => {
  const { data } = context(mask).getImageData(0, 0, mask.width, mask.height);
  let x0 = mask.width;
  let y0 = mask.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (data[(y * mask.width + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

/** Fills what was painted over from the picture around it. */
export const healPicture = (picture: HTMLCanvasElement, strokes: Stroke[]) => {
  const { width, height } = picture;
  // A little wider than the brush, so nothing of what was painted over survives at the edge.
  const mask = canvasOf(width, height);
  drawStrokes(mask, strokes, 1.15);
  const box = paintedBox(mask);
  const out = copyOf(picture);
  if (!box) return out;

  // Worked on with plenty of the picture around it to copy from.
  const margin = Math.max(24, 0.75 * Math.max(box.x1 - box.x0, box.y1 - box.y0));
  const rx = Math.max(0, Math.floor(box.x0 - margin));
  const ry = Math.max(0, Math.floor(box.y0 - margin));
  const rw = Math.min(width, Math.ceil(box.x1 + margin)) - rx;
  const rh = Math.min(height, Math.ceil(box.y1 + margin)) - ry;
  const scale = Math.min(1, HEAL_SIDE / Math.max(rw, rh));

  const work = canvasOf(rw * scale, rh * scale);
  const wg = context(work);
  wg.drawImage(picture, rx, ry, rw, rh, 0, 0, work.width, work.height);
  const workMask = canvasOf(work.width, work.height);
  context(workMask).drawImage(mask, rx, ry, rw, rh, 0, 0, work.width, work.height);
  const maskData = context(workMask).getImageData(0, 0, work.width, work.height).data;
  const hole = new Uint8Array(work.width * work.height);
  for (let i = 0; i < hole.length; i++) hole[i] = maskData[i * 4 + 3] > 0 ? 1 : 0;

  const pixels = wg.getImageData(0, 0, work.width, work.height);
  inpaint({ width: pixels.width, height: pixels.height, data: pixels.data }, hole);
  wg.putImageData(pixels, 0, 0);

  // Only the painted part changes, with a soft edge so it blends in.
  const patch = canvasOf(rw, rh);
  const pg = context(patch);
  pg.drawImage(work, 0, 0, rw, rh);
  const soft = canvasOf(rw / 4, rh / 4);
  context(soft).drawImage(mask, rx, ry, rw, rh, 0, 0, soft.width, soft.height);
  pg.globalCompositeOperation = "destination-in";
  pg.drawImage(soft, 0, 0, rw, rh);
  context(out).drawImage(patch, rx, ry);
  return out;
};

/** Covers each area so what's under it can't be made out. */
export const hidePicture = (picture: HTMLCanvasElement, areas: Area[], style: HideStyle) => {
  const out = copyOf(picture);
  const g = context(out);
  const shorter = Math.min(out.width, out.height);
  // Blocks big enough that text under them can't be read.
  const block = Math.max(6, Math.round(shorter * 0.025));

  for (const area of areas) {
    const x = Math.round(area.x * out.width);
    const y = Math.round(area.y * out.height);
    const w = Math.max(1, Math.round(area.width * out.width));
    const h = Math.max(1, Math.round(area.height * out.height));

    if (style === "bar") {
      g.fillStyle = "#000";
      g.fillRect(x, y, w, h);
      continue;
    }
    // Shrunk hard, then grown back: sharp blocks for pixels, smooth for blur.
    const factor = style === "pixels" ? block : block * 1.6;
    const small = canvasOf(Math.max(1, w / factor), Math.max(1, h / factor));
    const sg = context(small);
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = "high";
    sg.drawImage(picture, x, y, w, h, 0, 0, small.width, small.height);
    g.save();
    g.imageSmoothingEnabled = style === "blur";
    g.imageSmoothingQuality = "high";
    g.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    g.restore();
  }
  return out;
};

/** The picture with new edges, filled in, mirrored, or carried on from its edges. */
export const expandPicture = (picture: HTMLCanvasElement, sides: Sides, fill: ExpandFill, maxSide = EXPAND_SIDE) => {
  const { width, height } = picture;
  const left = Math.round(width * sides.left);
  const top = Math.round(height * sides.top);
  const out = canvasOf(left + width + Math.round(width * sides.right), top + height + Math.round(height * sides.bottom));
  const g = context(out);

  if (fill === "mirror") {
    // The picture flipped into every neighbouring place, so its edges meet themselves.
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        g.save();
        g.translate(left + i * width + (i !== 0 ? width : 0), top + j * height + (j !== 0 ? height : 0));
        g.scale(i !== 0 ? -1 : 1, j !== 0 ? -1 : 1);
        g.drawImage(picture, 0, 0);
        g.restore();
      }
    }
  } else if (fill === "edges") {
    // The last row and column carried outwards, then softened.
    const spread = canvasOf(out.width, out.height);
    const sg = context(spread);
    const rightX = left + width;
    const bottomY = top + height;
    sg.drawImage(picture, 0, 0, 1, height, 0, top, left, height);
    sg.drawImage(picture, width - 1, 0, 1, height, rightX, top, out.width - rightX, height);
    sg.drawImage(picture, 0, 0, width, 1, left, 0, width, top);
    sg.drawImage(picture, 0, height - 1, width, 1, left, bottomY, width, out.height - bottomY);
    sg.drawImage(picture, 0, 0, 1, 1, 0, 0, left, top);
    sg.drawImage(picture, width - 1, 0, 1, 1, rightX, 0, out.width - rightX, top);
    sg.drawImage(picture, 0, height - 1, 1, 1, 0, bottomY, left, out.height - bottomY);
    sg.drawImage(picture, width - 1, height - 1, 1, 1, rightX, bottomY, out.width - rightX, out.height - bottomY);
    const blurred = canvasOf(out.width / 24, out.height / 24);
    const bg = context(blurred);
    bg.imageSmoothingQuality = "high";
    bg.drawImage(spread, 0, 0, blurred.width, blurred.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(blurred, 0, 0, out.width, out.height);
  } else {
    const scale = Math.min(1, maxSide / Math.max(out.width, out.height));
    const work = canvasOf(out.width * scale, out.height * scale);
    const wg = context(work);
    const inner = {
      x: Math.round(left * scale),
      y: Math.round(top * scale),
      w: Math.round(width * scale),
      h: Math.round(height * scale),
    };
    wg.drawImage(picture, inner.x, inner.y, inner.w, inner.h);
    const pixels = wg.getImageData(0, 0, work.width, work.height);
    const hole = new Uint8Array(work.width * work.height);
    for (let y = 0; y < work.height; y++) {
      for (let x = 0; x < work.width; x++) {
        const inside = x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
        hole[y * work.width + x] = inside ? 0 : 1;
      }
    }
    inpaint({ width: pixels.width, height: pixels.height, data: pixels.data }, hole);
    wg.putImageData(pixels, 0, 0);
    g.imageSmoothingQuality = "high";
    g.drawImage(work, 0, 0, out.width, out.height);
  }

  // The picture itself stays as sharp as it was.
  g.drawImage(picture, left, top);
  return out;
};

/**
 * Where an expanded picture goes so the part that was showing stays put at the
 * same scale. Crops are dropped: the new edges are the point.
 */
export const expandedPlace = (el: ImageElement, natural: { width: number; height: number }, sides: Sides) => {
  if (el.deviceFrame) return { crop: undefined, layoutCrop: undefined };
  const shown = visibleCrop(el) ?? { x: 0, y: 0, width: 1, height: 1 };
  // Canvas units for each pixel of the picture, as it's shown now.
  const k = el.width / (shown.width * natural.width);
  const ox = -k * (shown.x + sides.left) * natural.width;
  const oy = -k * (shown.y + sides.top) * natural.height;
  const turn = (el.rotation * Math.PI) / 180;
  return {
    x: el.x + Math.cos(turn) * ox - Math.sin(turn) * oy,
    y: el.y + Math.sin(turn) * ox + Math.cos(turn) * oy,
    width: k * natural.width * (1 + sides.left + sides.right),
    height: k * natural.height * (1 + sides.top + sides.bottom),
    crop: undefined,
    layoutCrop: undefined,
  };
};
