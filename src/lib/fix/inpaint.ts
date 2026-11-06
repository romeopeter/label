/*
  Fills holes in a picture from the rest of it, the way Heal and Expand need:
  every missing pixel ends up made of small patches copied from elsewhere in the
  picture, so texture carries on instead of smearing.

  It's the method of Wexler, Shechtman and Irani: for each patch that touches the
  hole, find the most alike patch outside it (with PatchMatch, which guesses at
  random and passes good guesses on to neighbours), then set each missing pixel
  to the average of what those patches say it should be. That's repeated a few
  times, from a small copy of the picture up to full size, so large shapes are
  settled before fine detail.

  Pure: no DOM, so it can be tested and could move to a worker.
*/

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 0 to 255. Holes are filled in place. */
  data: Uint8ClampedArray;
}

/** Patch radius: patches are 7 × 7. */
const R = 3;
/** The smallest side a level is shrunk to. */
const MIN_SIDE = 24;
const MAX_LEVELS = 6;

interface Level {
  width: number;
  height: number;
  /** RGB as floats, three to a pixel. */
  rgb: Float32Array;
  /** 1 where the pixel is missing. */
  hole: Uint8Array;
}

/** A tiny seeded random, so the same input always fills the same way. */
const randomFrom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const levelOf = ({ width, height, data }: Pixels, hole: Uint8Array): Level => {
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = data[i * 4];
    rgb[i * 3 + 1] = data[i * 4 + 1];
    rgb[i * 3 + 2] = data[i * 4 + 2];
  }
  return { width, height, rgb, hole: hole.slice() };
};

/**
 * Half the size. A small pixel counts as missing if any pixel under it is, so a
 * known small pixel is made only of known ones.
 */
const shrink = (level: Level): Level => {
  const width = Math.ceil(level.width / 2);
  const height = Math.ceil(level.height / 2);
  const rgb = new Float32Array(width * height * 3);
  const hole = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let known = 0;
      let missing = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(level.width - 1, x * 2 + dx);
          const sy = Math.min(level.height - 1, y * 2 + dy);
          const i = sy * level.width + sx;
          if (level.hole[i]) {
            missing++;
          } else {
            r += level.rgb[i * 3];
            g += level.rgb[i * 3 + 1];
            b += level.rgb[i * 3 + 2];
            known++;
          }
        }
      }
      const o = y * width + x;
      hole[o] = missing > 0 ? 1 : 0;
      if (known) {
        rgb[o * 3] = r / known;
        rgb[o * 3 + 1] = g / known;
        rgb[o * 3 + 2] = b / known;
      }
    }
  }
  return { width, height, rgb, hole };
};

/** A first guess at the smallest level: the hole filled from its edge inwards. */
const fillFromEdges = ({ width, height, rgb, hole }: Level) => {
  const done = new Uint8Array(width * height);
  for (let i = 0; i < done.length; i++) done[i] = hole[i] ? 0 : 1;
  let left = hole.reduce((sum, value) => sum + value, 0);
  while (left > 0) {
    const ring: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (done[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = ny * width + nx;
            if (!done[j]) continue;
            r += rgb[j * 3];
            g += rgb[j * 3 + 1];
            b += rgb[j * 3 + 2];
            n++;
          }
        }
        if (n) {
          rgb[i * 3] = r / n;
          rgb[i * 3 + 1] = g / n;
          rgb[i * 3 + 2] = b / n;
          ring.push(i);
        }
      }
    }
    // Nothing known at all: leave it grey rather than loop forever.
    if (!ring.length) break;
    for (const i of ring) done[i] = 1;
    left -= ring.length;
  }
};

/** Carries a filled smaller level's guess up into this level's hole. */
const growInto = (small: Level, level: Level) => {
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const i = y * level.width + x;
      if (!level.hole[i]) continue;
      const j = Math.min(small.height - 1, y >> 1) * small.width + Math.min(small.width - 1, x >> 1);
      level.rgb[i * 3] = small.rgb[j * 3];
      level.rgb[i * 3 + 1] = small.rgb[j * 3 + 1];
      level.rgb[i * 3 + 2] = small.rgb[j * 3 + 2];
    }
  }
};

/** Runs the patch search and the vote on one level, `rounds` times. */
const refine = (level: Level, rounds: number, random: () => number) => {
  const { width, height, rgb, hole } = level;
  if (width < R * 2 + 3 || height < R * 2 + 3) return;

  // Where a whole patch is known, by a summed-area table of the hole.
  const sum = new Int32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += hole[y * width + x];
      sum[(y + 1) * (width + 1) + x + 1] = sum[y * (width + 1) + x + 1] + row;
    }
  }
  const missingIn = (x0: number, y0: number, x1: number, y1: number) =>
    sum[(y1 + 1) * (width + 1) + x1 + 1] - sum[y0 * (width + 1) + x1 + 1] - sum[(y1 + 1) * (width + 1) + x0] + sum[y0 * (width + 1) + x0];

  const isSource = new Uint8Array(width * height);
  const sources: number[] = [];
  for (let y = R; y < height - R; y++) {
    for (let x = R; x < width - R; x++) {
      if (missingIn(x - R, y - R, x + R, y + R) === 0) {
        isSource[y * width + x] = 1;
        sources.push(y * width + x);
      }
    }
  }
  if (!sources.length) return;

  // Patches that touch the hole, centred anywhere, read with edges clamped.
  const targets: number[] = [];
  const targetAt = new Int32Array(width * height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - R);
      const y0 = Math.max(0, y - R);
      const x1 = Math.min(width - 1, x + R);
      const y1 = Math.min(height - 1, y + R);
      if (missingIn(x0, y0, x1, y1) > 0) {
        targetAt[y * width + x] = targets.length;
        targets.push(y * width + x);
      }
    }
  }

  const distance = (target: number, source: number, limit: number) => {
    const tx = target % width;
    const ty = (target / width) | 0;
    const sx = source % width;
    const sy = (source / width) | 0;
    let d = 0;
    for (let dy = -R; dy <= R; dy++) {
      const py = Math.min(height - 1, Math.max(0, ty + dy));
      const qy = sy + dy;
      for (let dx = -R; dx <= R; dx++) {
        const px = Math.min(width - 1, Math.max(0, tx + dx));
        const i = (py * width + px) * 3;
        const j = (qy * width + sx + dx) * 3;
        const r = rgb[i] - rgb[j];
        const g = rgb[i + 1] - rgb[j + 1];
        const b = rgb[i + 2] - rgb[j + 2];
        d += r * r + g * g + b * b;
      }
      if (d >= limit) return d;
    }
    return d;
  };

  const match = new Int32Array(targets.length);
  const cost = new Float32Array(targets.length);
  for (let t = 0; t < targets.length; t++) {
    match[t] = sources[(random() * sources.length) | 0];
    cost[t] = distance(targets[t], match[t], Infinity);
  }

  const tryMatch = (t: number, source: number) => {
    if (source < 0 || source >= width * height || !isSource[source]) return;
    const d = distance(targets[t], source, cost[t]);
    if (d < cost[t]) {
      cost[t] = d;
      match[t] = source;
    }
  };

  for (let round = 0; round < rounds; round++) {
    // The picture changed after the last vote, so the costs are stale.
    for (let t = 0; t < targets.length; t++) cost[t] = distance(targets[t], match[t], Infinity);

    for (let pass = 0; pass < 2; pass++) {
      const forward = pass % 2 === 0;
      const step = forward ? 1 : -1;
      for (let k = 0; k < targets.length; k++) {
        const t = forward ? k : targets.length - 1 - k;
        const at = targets[t];
        const x = at % width;
        const y = (at / width) | 0;

        // A neighbour's match, moved along by one, often fits here too.
        const across = x - step >= 0 && x - step < width ? targetAt[at - step] : -1;
        if (across >= 0) tryMatch(t, match[across] + step);
        const down = y - step >= 0 && y - step < height ? targetAt[at - step * width] : -1;
        if (down >= 0) tryMatch(t, match[down] + step * width);

        // Then look around the best so far, nearer and nearer.
        const best = match[t];
        const bx = best % width;
        const by = (best / width) | 0;
        for (let radius = Math.max(width, height); radius >= 1; radius >>= 1) {
          const cx = Math.round(bx + (random() * 2 - 1) * radius);
          const cy = Math.round(by + (random() * 2 - 1) * radius);
          if (cx < R || cy < R || cx >= width - R || cy >= height - R) continue;
          tryMatch(t, cy * width + cx);
        }
      }
    }

    // Each missing pixel becomes the weighted average of what its patches say.
    const total = new Float32Array(width * height * 3);
    const weight = new Float32Array(width * height);
    const scale = 1 / (2 * (R * 2 + 1) ** 2 * 400);
    for (let t = 0; t < targets.length; t++) {
      const at = targets[t];
      const tx = at % width;
      const ty = (at / width) | 0;
      const source = match[t];
      const sx = source % width;
      const sy = (source / width) | 0;
      const w = Math.exp(-cost[t] * scale);
      for (let dy = -R; dy <= R; dy++) {
        const py = ty + dy;
        if (py < 0 || py >= height) continue;
        for (let dx = -R; dx <= R; dx++) {
          const px = tx + dx;
          if (px < 0 || px >= width) continue;
          const i = py * width + px;
          if (!hole[i]) continue;
          const j = ((sy + dy) * width + sx + dx) * 3;
          total[i * 3] += rgb[j] * w;
          total[i * 3 + 1] += rgb[j + 1] * w;
          total[i * 3 + 2] += rgb[j + 2] * w;
          weight[i] += w;
        }
      }
    }
    for (let i = 0; i < width * height; i++) {
      if (!hole[i] || weight[i] <= 0) continue;
      rgb[i * 3] = total[i * 3] / weight[i];
      rgb[i * 3 + 1] = total[i * 3 + 1] / weight[i];
      rgb[i * 3 + 2] = total[i * 3 + 2] / weight[i];
    }
  }
};

/** Box blur of a field, in place, `radius` pixels each way. */
const boxBlur = (field: Float32Array, width: number, height: number, channels: number, radius: number) => {
  const temp = new Float32Array(field.length);
  for (let pass = 0; pass < 2; pass++) {
    const along = pass === 0;
    const from = pass === 0 ? field : temp;
    const to = pass === 0 ? temp : field;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          let total = 0;
          for (let k = -radius; k <= radius; k++) {
            const px = along ? Math.min(width - 1, Math.max(0, x + k)) : x;
            const py = along ? y : Math.min(height - 1, Math.max(0, y + k));
            total += from[(py * width + px) * channels + c];
          }
          to[(y * width + x) * channels + c] = total / (radius * 2 + 1);
        }
      }
    }
  }
};

/**
 * Copied patches carry their own shade, so where they meet the picture there can
 * be a step, as when lower, lighter sky is copied above darker sky. The step is
 * measured all along the edge, smoothed, and spread into the fill, fading with
 * distance, so the two meet without a line.
 */
const blendSeams = ({ width, height, rgb, hole }: Level) => {
  const error = new Float32Array(width * height * 3);
  const weight = new Float32Array(width * height);
  const edge = new Uint8Array(width * height);
  const STEPS = [1, 0, -1, 0, 0, 1, 0, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!hole[i]) continue;
      for (let n = 0; n < 8; n += 2) {
        const nx = x + STEPS[n];
        const ny = y + STEPS[n + 1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (hole[j]) continue;
        for (let c = 0; c < 3; c++) error[i * 3 + c] += rgb[j * 3 + c] - rgb[i * 3 + c];
        weight[i] += 1;
        edge[i] = 1;
      }
    }
  }
  // Smoothed along the edge, so texture there doesn't become noise.
  boxBlur(error, width, height, 3, 4);
  boxBlur(weight, width, height, 1, 4);

  const shift = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (!edge[i] || weight[i] <= 0) continue;
    for (let c = 0; c < 3; c++) shift[i * 3 + c] = error[i * 3 + c] / weight[i];
  }

  // Spread inwards, fading as it goes. Each inner pixel's neighbours in the hole
  // are worked out once, since this runs many times over.
  const inner: number[] = [];
  for (let i = 0; i < width * height; i++) if (hole[i] && !edge[i]) inner.push(i);
  const around = new Int32Array(inner.length * 4).fill(-1);
  inner.forEach((i, k) => {
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0 && hole[i - 1]) around[k * 4] = i - 1;
    if (x < width - 1 && hole[i + 1]) around[k * 4 + 1] = i + 1;
    if (y > 0 && hole[i - width]) around[k * 4 + 2] = i - width;
    if (y < height - 1 && hole[i + width]) around[k * 4 + 3] = i + width;
  });
  for (let round = 0; round < 200; round++) {
    for (let k = 0; k < inner.length; k++) {
      const i = inner[k];
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let n = 0; n < 4; n++) {
        const j = around[k * 4 + n];
        if (j < 0) continue;
        r += shift[j * 3];
        g += shift[j * 3 + 1];
        b += shift[j * 3 + 2];
        count++;
      }
      if (!count) continue;
      const fade = 0.997 / count;
      shift[i * 3] = r * fade;
      shift[i * 3 + 1] = g * fade;
      shift[i * 3 + 2] = b * fade;
    }
  }
  for (let i = 0; i < width * height; i++) {
    if (!hole[i]) continue;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] += shift[i * 3 + c];
  }
};

/** Fills every pixel where `hole` is 1, in place. Alpha is set opaque there. */
export const inpaint = (pixels: Pixels, hole: Uint8Array, seed = 1) => {
  if (!hole.some((value) => value)) return;
  const random = randomFrom(seed);

  const levels = [levelOf(pixels, hole)];
  while (levels.length < MAX_LEVELS) {
    const last = levels[levels.length - 1];
    if (Math.min(last.width, last.height) / 2 < MIN_SIDE) break;
    levels.push(shrink(last));
  }

  const smallest = levels[levels.length - 1];
  fillFromEdges(smallest);
  for (let i = levels.length - 1; i >= 0; i--) {
    if (i < levels.length - 1) growInto(levels[i + 1], levels[i]);
    // More rounds where they're cheap; detail at full size needs fewer.
    refine(levels[i], i === levels.length - 1 ? 5 : i === 0 ? 2 : 3, random);
  }

  blendSeams(levels[0]);
  const { rgb } = levels[0];
  for (let i = 0; i < pixels.width * pixels.height; i++) {
    if (!hole[i]) continue;
    pixels.data[i * 4] = rgb[i * 3];
    pixels.data[i * 4 + 1] = rgb[i * 3 + 1];
    pixels.data[i * 4 + 2] = rgb[i * 3 + 2];
    pixels.data[i * 4 + 3] = 255;
  }
};
