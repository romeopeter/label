import type { PatternType } from "@/types/pattern";

export interface TileParams {
  size: number; // resolved tile px size (see resolveTileSize.ts)
  base: string;
  accent: string;
}

export type PatternGenerator = (p: TileParams) => string; // returns SVG markup

/**
 * Rotation is deliberately NOT a generator input.
 *
 * Rotating shapes *inside* a tile clips them at the tile edge, so the repeat
 * shows a hard seam at every boundary — which fails the "no visible tile seams"
 * requirement. Instead every generator emits an unrotated, seamlessly tileable
 * square, and rotation is applied to the whole pattern space by Konva via
 * `fillPatternRotation` on the fill Rect. That rotates the infinite lattice
 * rather than each tile's contents, so it stays seamless at any angle — and
 * rotation drops out of the tile cache key, making the rotation slider free to
 * drag.
 *
 * Every shape below is authored to either stay fully inside the tile or to meet
 * its opposite edge exactly, so the tiles butt together invisibly.
 */

const dots: PatternGenerator = ({ size, base, accent }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.12}" fill="${accent}"/>
  </svg>`;

// The band runs edge to edge and starts at y=0, so the tile below continues it
// without a break.
const stripes: PatternGenerator = ({ size, base, accent }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <rect x="0" y="0" width="${size}" height="${size * 0.4}" fill="${accent}"/>
  </svg>`;

// Top and left rules only — the neighbouring tiles supply the bottom and right,
// so lines are drawn once and land continuous.
const grid: PatternGenerator = ({ size, base, accent }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <rect x="0" y="0" width="${size}" height="${size * 0.08}" fill="${accent}"/>
    <rect x="0" y="0" width="${size * 0.08}" height="${size}" fill="${accent}"/>
  </svg>`;

// A "^" band whose left and right ends sit at the same height, so it continues
// straight into the next tile horizontally.
const chevron: PatternGenerator = ({ size, base, accent }) => {
  const t = size * 0.22; // band thickness
  const mid = size * 0.55;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <path d="M0 ${mid} L${size / 2} ${mid - size / 2} L${size} ${mid}
             L${size} ${mid + t} L${size / 2} ${mid - size / 2 + t} L0 ${mid + t} Z"
          fill="${accent}"/>
  </svg>`;
};

// One wave per tile, drawn from a tile before to a tile after so the viewport
// clips it. Ending the path on the edge left the stroke's square ends standing
// across the curve, which showed as a notch at every seam.
const waves: PatternGenerator = ({ size, base, accent }) => {
  const y = size * 0.5;
  const crest = size * 0.2;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <path d="M${-size} ${y} Q ${-size * 0.75} ${crest} ${-size * 0.5} ${y} T 0 ${y} T ${size * 0.5} ${y} T ${size} ${y} T ${size * 1.5} ${y} T ${size * 2} ${y}"
          stroke="${accent}" stroke-width="${size * 0.08}" fill="none"/>
  </svg>`;
};

// Inset off every edge so anti-aliasing along the tile boundary can't leave a
// hairline where the rows meet.
const triangles: PatternGenerator = ({ size, base, accent }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <polygon points="${size / 2},${size * 0.1} ${size * 0.9},${size * 0.9} ${size * 0.1},${size * 0.9}"
             fill="${accent}"/>
  </svg>`;

const hexagon: PatternGenerator = ({ size, base, accent }) => {
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <polygon points="${pts}" fill="none" stroke="${accent}" stroke-width="${size * 0.05}"/>
  </svg>`;
};

/* ---------------------------------------------------------------- scatter -- */

/**
 * Deterministic RNG. Scatter patterns must produce the identical tile every
 * call — the raster cache keys on type/size/colour, not on a run counter, so a
 * non-reproducible tile would flicker between cache misses.
 */
const seededRandom = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

/**
 * Emit a mark at every wrapped position where it could touch the tile.
 *
 * A mark straddling an edge gets completed by its copy on the opposite side.
 * Without this, every clipped mark lands on the same lattice and a "random"
 * scatter reads as a visible grid once tiled.
 *
 * `reach` is how far the mark extends from its anchor point, used to skip
 * copies that can't touch the tile at all.
 */
const scatterWrapped = (
  x: number,
  y: number,
  reach: number,
  width: number,
  height: number,
  mark: (px: number, py: number) => string,
): string[] => {
  const out: string[] = [];
  for (const dx of [-width, 0, width]) {
    for (const dy of [-height, 0, height]) {
      const px = x + dx;
      const py = y + dy;
      if (px + reach < 0 || px - reach > width) continue;
      if (py + reach < 0 || py - reach > height) continue;
      out.push(mark(px, py));
    }
  }
  return out;
};

// Two half-tiles on opposite corners: the classic checkerboard, seamless by
// construction.
const checks: PatternGenerator = ({ size, base, accent }) => {
  const h = size / 2;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <rect x="0" y="0" width="${h}" height="${h}" fill="${accent}"/>
    <rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${accent}"/>
  </svg>`;
};

/**
 * Argyle: a lattice of diamonds in two strengths of the accent, crossed by
 * dashed lines through their centres. The full diamond meets every edge
 * midpoint and the corners hold quarters of the fainter ones, so it repeats
 * point to point.
 */
const argyle: PatternGenerator = ({ size, base, accent }) => {
  const h = size / 2;
  const dash = size * 0.06;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <g fill="${accent}" opacity="0.38">
      <polygon points="0,0 ${h},0 0,${h}"/>
      <polygon points="${size},0 ${size},${h} ${h},0"/>
      <polygon points="0,${size} 0,${h} ${h},${size}"/>
      <polygon points="${size},${size} ${h},${size} ${size},${h}"/>
    </g>
    <polygon points="${h},0 ${size},${h} ${h},${size} 0,${h}" fill="${accent}"/>
    <g stroke="${base}" stroke-width="${size * 0.018}" stroke-dasharray="${dash} ${dash}" opacity="0.8">
      <line x1="0" y1="0" x2="${size}" y2="${size}"/>
      <line x1="${size}" y1="0" x2="0" y2="${size}"/>
    </g>
  </svg>`;
};

// Four quadrants of paired bars, alternating orientation — the weave read comes
// from the perpendicular neighbours. Everything sits inside its quadrant, so
// nothing crosses a tile edge.
const basketweave: PatternGenerator = ({ size, base, accent }) => {
  const half = size / 2;
  const gap = size * 0.05;
  const inner = half - gap;
  const bar = (inner - gap) / 2;

  const horiz = (x: number, y: number) => `
    <rect x="${x}" y="${y}" width="${inner}" height="${bar}" fill="${accent}"/>
    <rect x="${x}" y="${y + bar + gap}" width="${inner}" height="${bar}" fill="${accent}"/>`;
  const vert = (x: number, y: number) => `
    <rect x="${x}" y="${y}" width="${bar}" height="${inner}" fill="${accent}"/>
    <rect x="${x + bar + gap}" y="${y}" width="${bar}" height="${inner}" fill="${accent}"/>`;

  const o = gap / 2;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${horiz(o, o)}
    ${vert(half + o, o)}
    ${vert(o, half + o)}
    ${horiz(half + o, half + o)}
  </svg>`;
};

/**
 * Isometric cubes. Each cube is a hexagon split into three rhombi, shaded by
 * accent opacity so a two-colour pair still reads as three faces.
 *
 * The hex lattice isn't square, so this is the one non-square tile: horizontal
 * pitch is one tile width, vertical pitch is `3q`, and odd rows shift by half a
 * width — meaning the vertical period is *two* rows. The tile is that full
 * period, and cubes are drawn one row/column beyond it on every side so the
 * ones straddling an edge are completed by their clipped copies.
 */
const CUBE_ROW_RATIO = 0.5773502691896258 * 3; // (a·tan30)·3 per row, in units of a

const cubes: PatternGenerator = ({ size, base, accent }) => {
  const a = size / 2; // hexagon half-width
  const q = a * 0.5773502691896258; // side-vertex offset from the centre
  const rowPitch = q * 3;
  const height = rowPitch * 2; // two rows = one full vertical period

  const hex = (cx: number, cy: number) => `
    <polygon points="${cx},${cy - 2 * q} ${cx + a},${cy - q} ${cx},${cy} ${cx - a},${cy - q}"
             fill="${accent}"/>
    <polygon points="${cx + a},${cy - q} ${cx + a},${cy + q} ${cx},${cy + 2 * q} ${cx},${cy}"
             fill="${accent}" fill-opacity="0.55"/>
    <polygon points="${cx - a},${cy - q} ${cx},${cy} ${cx},${cy + 2 * q} ${cx - a},${cy + q}"
             fill="${accent}" fill-opacity="0.28"/>`;

  const cells: string[] = [];
  for (let r = -1; r <= 2; r++) {
    const odd = (((r % 2) + 2) % 2) === 1; // guard against JS's negative modulo
    for (let c = -1; c <= 2; c++) {
      cells.push(hex(c * size + (odd ? a : 0), r * rowPitch));
    }
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}">
    <rect width="${size}" height="${height}" fill="${base}"/>
    ${cells.join("")}
  </svg>`;
};

/**
 * Tartan. The same band set is laid horizontally and vertically; where two
 * bands cross, their opacities compound and the square reads darker — which is
 * what gives real plaid its woven depth from a single accent colour.
 *
 * Every band starts at its offset and ends inside the tile, so the set repeats
 * exactly at the edge in both axes.
 */
const plaid: PatternGenerator = ({ size, base, accent }) => {
  const bands = [
    { at: 0.0, w: 0.16, o: 0.5 },
    { at: 0.22, w: 0.045, o: 0.28 },
    { at: 0.34, w: 0.045, o: 0.28 },
    { at: 0.5, w: 0.24, o: 0.4 },
    { at: 0.84, w: 0.028, o: 0.72 },
  ];

  const horizontal = bands
    .map(
      (b) =>
        `<rect x="0" y="${b.at * size}" width="${size}" height="${b.w * size}" fill="${accent}" opacity="${b.o}"/>`,
    )
    .join("");
  const vertical = bands
    .map(
      (b) =>
        `<rect x="${b.at * size}" y="0" width="${b.w * size}" height="${size}" fill="${accent}" opacity="${b.o}"/>`,
    )
    .join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${horizontal}${vertical}
  </svg>`;
};

/**
 * Seigaiha: overlapping fans of rings, each row tucked under the next. Rows are
 * a quarter tile apart and alternate their offset by half a tile, so two rows
 * make the vertical period and the tile holds it exactly. Rows are drawn top to
 * bottom from above the tile to below it, which is the same painting order in
 * every tile, so the overlaps match across the seams.
 */
const scales: PatternGenerator = ({ size, base, accent }) => {
  const r = size / 2;
  const fan = (cx: number, cy: number) => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}"/>
    ${[0.92, 0.7, 0.48, 0.26]
      .map((k) => `<circle cx="${cx}" cy="${cy}" r="${r * k}" fill="none" stroke="${accent}" stroke-width="${size * 0.05}"/>`)
      .join("")}`;

  const fans: string[] = [];
  for (let row = -2; row <= 6; row++) {
    const offset = row % 2 === 0 ? 0 : size / 2;
    for (let col = -1; col <= 2; col++) fans.push(fan(col * size + offset, (row * size) / 4));
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${fans.join("")}
  </svg>`;
};

/**
 * Quarter-arc fans anchored at all four corners. Each arc meets the tile edge
 * with a perpendicular tangent at the same offset on both sides, so the curve
 * continues smoothly into the next tile instead of stopping at the seam.
 * Radii stay under half the tile so opposite fans don't collide.
 */
const arcs: PatternGenerator = ({ size, base, accent }) => {
  const stroke = size * 0.045;
  const radii = [0.18, 0.32, 0.46].map((f) => f * size);
  const fan = (cx: number, cy: number, sx: number, sy: number) =>
    radii
      .map(
        (r) =>
          `<path d="M${cx + sx * r} ${cy} A${r} ${r} 0 0 0 ${cx} ${cy + sy * r}" fill="none"
                 stroke="${accent}" stroke-width="${stroke}"/>`,
      )
      .join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${fan(0, 0, 1, 1)}${fan(size, 0, -1, 1)}
    ${fan(0, size, 1, -1)}${fan(size, size, -1, -1)}
  </svg>`;
};

/**
 * Circuit traces. The rails run along the tile edges and midlines so they cross
 * the repeat unbroken; the branches dead-end inside the tile, which reads as
 * component legs rather than a broken trace. Corner pads are drawn at all four
 * corners so each is whole once tiled.
 */
const circuit: PatternGenerator = ({ size, base, accent }) => {
  const t = size * 0.022;
  const pad = size * 0.05;
  const half = size / 2;

  const pads = [
    [0, 0],
    [size, 0],
    [0, size],
    [size, size],
    [half, 0],
    [0, half],
    [half, half],
    [size, half],
    [half, size],
    [size * 0.82, size * 0.78],
    [size * 0.25, size * 0.76],
  ]
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${pad}" fill="${accent}"/>`)
    .join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <g stroke="${accent}" stroke-width="${t}" fill="none" opacity="0.8">
      <path d="M0 0 H${size}"/>
      <path d="M0 ${half} H${size}"/>
      <path d="M0 0 V${size}"/>
      <path d="M${half} 0 V${half}"/>
      <path d="M${half} ${half} L${half} ${size * 0.78} L${size * 0.82} ${size * 0.78}"/>
      <path d="M${size * 0.25} ${half} L${size * 0.25} ${size * 0.76}"/>
    </g>
    ${pads}
  </svg>`;
};

/**
 * Night sky. A handful of four-point sparkles over a dense field of small
 * specks — the size and opacity spread is what stops it reading as a dot grid.
 * The sparkle's concave arms come from quadratic curves pulled to the centre.
 */
const starryNight: PatternGenerator = ({ size, base, accent }) => {
  const rand = seededRandom(7);
  const marks: string[] = [];

  for (let i = 0; i < 9; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.045 + rand() * 0.045);
    const opacity = 0.6 + rand() * 0.4;
    marks.push(
      ...scatterWrapped(x, y, r, size, size, (px, py) =>
        `<path d="M${px} ${py - r} Q${px} ${py} ${px + r} ${py}
                  Q${px} ${py} ${px} ${py + r} Q${px} ${py} ${px - r} ${py}
                  Q${px} ${py} ${px} ${py - r} Z" fill="${accent}" opacity="${opacity}"/>`,
      ),
    );
  }

  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.007 + rand() * 0.011);
    const opacity = 0.3 + rand() * 0.55;
    marks.push(
      ...scatterWrapped(x, y, r, size, size, (px, py) =>
        `<circle cx="${px}" cy="${py}" r="${r}" fill="${accent}" opacity="${opacity}"/>`,
      ),
    );
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${marks.join("")}
  </svg>`;
};

/**
 * Rain. Slanted streaks of varied length and opacity, which is what suggests
 * depth — short faint ones read as far away. The streaks are drawn at a fixed
 * slant rather than a random one so the rain falls in a consistent direction;
 * use the rotation control to change that direction.
 */
const raindrops: PatternGenerator = ({ size, base, accent }) => {
  const rand = seededRandom(19);
  const slant = size * 0.09;
  const marks: string[] = [];

  for (let i = 0; i < 20; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = size * (0.18 + rand() * 0.24);
    const w = size * (0.017 + rand() * 0.013);
    const opacity = 0.35 + rand() * 0.55;
    marks.push(
      ...scatterWrapped(x, y, len + slant, size, size, (px, py) =>
        `<line x1="${px}" y1="${py}" x2="${px - slant}" y2="${py + len}" stroke="${accent}"
               stroke-width="${w}" stroke-linecap="round" opacity="${opacity}"/>`,
      ),
    );
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${marks.join("")}
  </svg>`;
};

/**
 * Terrazzo: broken chips of stone, each a jagged polygon at its own angle, in
 * the accent and a softer tone of it. Chips are kept apart, measured across the
 * tile's wrap, so they read as separate pieces rather than clumping into blobs.
 */
const terrazzo: PatternGenerator = ({ size, base, accent }) => {
  const rand = seededRandom(101);
  const placed: [number, number, number][] = [];
  const chips: string[] = [];
  const wrapped = (a: number, b: number) => {
    const d = Math.abs(a - b) % size;
    return Math.min(d, size - d);
  };

  for (let tries = 0; tries < 400 && placed.length < 22; tries++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.025 + rand() * 0.06);
    if (placed.some(([px, py, pr]) => Math.hypot(wrapped(x, px), wrapped(y, py)) < r + pr + size * 0.025)) continue;
    placed.push([x, y, r]);

    const corners = 5 + Math.floor(rand() * 3);
    const turn = rand() * Math.PI * 2;
    const outline = Array.from({ length: corners }, (_, i) => {
      const a = turn + (i / corners) * Math.PI * 2 + (rand() - 0.5) * 0.6;
      const reach = r * (0.6 + rand() * 0.4);
      return [Math.cos(a) * reach, Math.sin(a) * reach];
    });
    const opacity = rand() < 0.4 ? 0.45 : 1;
    chips.push(
      ...scatterWrapped(x, y, r, size, size, (px, py) =>
        `<polygon points="${outline.map(([dx, dy]) => `${px + dx},${py + dy}`).join(" ")}" fill="${accent}" opacity="${opacity}"/>`,
      ),
    );
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${chips.join("")}
  </svg>`;
};

/* ----------------------------------------------------------------- blocks -- */

/**
 * Cells per tile edge for the half-fill block patterns below.
 *
 * These all divide the tile into a grid and give each cell one half-fill shape.
 * Because every shape is contained in its own cell and the tile boundary is
 * also a cell boundary, the whole family is seamless by construction — no
 * edge-wrapping needed.
 */
const CELLS = 4;

/** The four diagonal half-fills — the tile's corner that keeps its fill. */
const TRIANGLES = [
  (x: number, y: number, c: number) => `${x},${y} ${x + c},${y} ${x},${y + c}`,
  (x: number, y: number, c: number) => `${x},${y} ${x + c},${y} ${x + c},${y + c}`,
  (x: number, y: number, c: number) => `${x},${y} ${x},${y + c} ${x + c},${y + c}`,
  (x: number, y: number, c: number) => `${x + c},${y} ${x + c},${y + c} ${x},${y + c}`,
];

/** Classic Truchet: every cell is a randomly rotated diagonal half. */
const truchet: PatternGenerator = ({ size, base, accent }) => {
  const rand = seededRandom(23);
  const c = size / CELLS;
  const cells: string[] = [];

  for (let row = 0; row < CELLS; row++) {
    for (let col = 0; col < CELLS; col++) {
      const points = TRIANGLES[Math.floor(rand() * 4) % 4](col * c, row * c, c);
      cells.push(`<polygon points="${points}" fill="${accent}"/>`);
    }
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${cells.join("")}
  </svg>`;
};

/**
 * Curved Truchet. Each cell carries two quarter arcs centred on opposite
 * corners, radius half a cell — so every cell-edge midpoint gets exactly one
 * arc endpoint. Whichever way neighbouring cells fall, the endpoints line up
 * and the curves join into continuous ribbons, across the tile seam included.
 */
const ribbons: PatternGenerator = ({ size, base, accent }) => {
  const rand = seededRandom(53);
  const c = size / CELLS;
  const r = c / 2;
  const cells: string[] = [];

  for (let row = 0; row < CELLS; row++) {
    for (let col = 0; col < CELLS; col++) {
      const x = col * c;
      const y = row * c;
      // Sweep flags are per-arc, derived from which corner each is centred on —
      // they are not interchangeable between the two variants. Getting one
      // wrong swaps in the mirror arc (centred on the cell instead of the
      // corner), which meets its neighbour at a cusp rather than a tangent.
      cells.push(
        rand() < 0.5
          ? // centred on the top-left and bottom-right corners
            `<path d="M${x} ${y + r} A${r} ${r} 0 0 0 ${x + r} ${y}"/>
             <path d="M${x + c} ${y + r} A${r} ${r} 0 0 0 ${x + r} ${y + c}"/>`
          : // centred on the top-right and bottom-left corners
            `<path d="M${x + r} ${y} A${r} ${r} 0 0 0 ${x + c} ${y + r}"/>
             <path d="M${x} ${y + r} A${r} ${r} 0 0 1 ${x + r} ${y + c}"/>`,
      );
    }
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    <g stroke="${accent}" stroke-width="${size * 0.03}" fill="none">${cells.join("")}</g>
  </svg>`;
};

/**
 * Staircase: whole cells filled along the diagonals, half the diagonals on and
 * half off. Deterministic, unlike the three above — the blocky stepped edge is
 * the point, and randomising it would just read as noise. The band period
 * divides the cell count, so it lines up at the tile edge.
 */
const steps: PatternGenerator = ({ size, base, accent }) => {
  const c = size / CELLS;
  const cells: string[] = [];

  for (let row = 0; row < CELLS; row++) {
    for (let col = 0; col < CELLS; col++) {
      if ((col + row) % CELLS >= CELLS / 2) continue;
      cells.push(
        `<rect x="${col * c}" y="${row * c}" width="${c}" height="${c}" fill="${accent}"/>`,
      );
    }
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${cells.join("")}
  </svg>`;
};

/* ------------------------------------------------------------------- bold -- */

/**
 * Bold blocks: the straight half-fills at two cells per tile edge, so each mark
 * reads large and graphic instead of as fine mosaic texture. They're only
 * shipped in a composition: a tile simply half-filled top to bottom repeats into
 * `stripes` at 50%.
 */
const BOLD_CELLS = 2;

const boldRect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

/**
 * The straight half-fills rotated a quarter turn per cell. Reading them around
 * the tile rather than stacking them is what stops the pair collapsing into
 * stripes.
 */
const pinwheel: PatternGenerator = ({ size, base, accent }) => {
  const c = size / BOLD_CELLS;
  const h = c / 2;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${base}"/>
    ${boldRect(0, h, c, h, accent)}
    ${boldRect(c, 0, h, c, accent)}
    ${boldRect(h, c, h, c, accent)}
    ${boldRect(c, c, c, h, accent)}
  </svg>`;
};

export const PATTERN_GENERATORS: Record<PatternType, PatternGenerator> = {
  stripes,
  grid,
  plaid,
  chevron,
  waves,
  dots,
  triangles,
  checks,
  argyle,
  hexagon,
  cubes,
  scales,
  arcs,
  basketweave,
  truchet,
  ribbons,
  steps,
  pinwheel,
  circuit,
  "starry-night": starryNight,
  raindrops,
  terrazzo,
};

/**
 * Tile height as a multiple of tile width. Every pattern is square except the
 * isometric cube lattice, whose vertical period doesn't land on a square.
 * Konva repeats by the image's own dimensions, so a non-square tile needs no
 * special handling on the canvas — only the panel thumbnail has to know.
 */
export const PATTERN_TILE_ASPECT: Record<PatternType, number> = {
  stripes: 1,
  grid: 1,
  plaid: 1,
  chevron: 1,
  waves: 1,
  dots: 1,
  triangles: 1,
  checks: 1,
  argyle: 1,
  hexagon: 1,
  cubes: CUBE_ROW_RATIO,
  scales: 1,
  arcs: 1,
  basketweave: 1,
  truchet: 1,
  ribbons: 1,
  steps: 1,
  pinwheel: 1,
  circuit: 1,
  "starry-night": 1,
  raindrops: 1,
  terrazzo: 1,
};

/** Inline `url(...)` value for panel thumbnails — no rasterization needed. */
export const patternPreviewUrl = (
  type: PatternType,
  base: string,
  accent: string,
  size: number,
): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    PATTERN_GENERATORS[type]({ size, base, accent }),
  )}")`;
