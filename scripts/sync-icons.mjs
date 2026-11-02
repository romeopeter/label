/**
 * Regenerates src/data/icons.json from lucide-static.
 *
 * Each icon becomes one SVG path string so the canvas can draw it as a vector
 * and `.layer` files keep working if an icon later leaves lucide. Importing
 * lucide-react's full icon map instead would pull every icon into the main
 * bundle, because the app already imports that package statically.
 */
import { readFileSync, writeFileSync } from "node:fs";

const read = (file) =>
  JSON.parse(
    readFileSync(new URL(`../node_modules/lucide-static/${file}`, import.meta.url)),
  );

const OUTPUT = new URL("../src/data/icons.json", import.meta.url);

const circlePath = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0z`;

const rectPath = ({ x = 0, y = 0, width: w, height: h, rx = 0, ry = rx }) => {
  const r = Math.min(rx, w / 2);
  const s = Math.min(ry, h / 2);
  if (!r && !s) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${s} 0 0 1 ${r} ${s}v${h - 2 * s}` +
    `a${r} ${s} 0 0 1 ${-r} ${s}h${-(w - 2 * r)}a${r} ${s} 0 0 1 ${-r} ${-s}` +
    `v${-(h - 2 * s)}a${r} ${s} 0 0 1 ${r} ${-s}z`
  );
};

const NUMBER = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)";
const LEADING_MOVE = new RegExp(`^m\\s*(${NUMBER})[\\s,]*(${NUMBER})[\\s,]*`);

/**
 * A leading "m" is absolute only at the very start of a path. Once paths are
 * joined it would turn relative to the previous one and garble the icon. Any
 * coordinates after it are implicit relative lines, which a capital "M" would
 * make absolute, so those get an explicit "l".
 */
const absoluteStart = (d) =>
  d.replace(LEADING_MOVE, (match, x, y, offset, whole) => {
    const rest = whole.slice(match.length);
    return `M${x} ${y}${/^[-+.\d]/.test(rest) ? "l" : ""}`;
  });

const toNumbers = (attrs) =>
  Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [
      key,
      key === "d" || key === "points" ? value : Number(value),
    ]),
  );

const nodeToPath = ([tag, rawAttrs]) => {
  const a = toNumbers(rawAttrs);
  switch (tag) {
    case "path":
      return absoluteStart(a.d);
    case "circle":
      return circlePath(a.cx, a.cy, a.r, a.r);
    case "ellipse":
      return circlePath(a.cx, a.cy, a.rx, a.ry);
    case "rect":
      return rectPath(a);
    case "line":
      return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
    case "polyline":
      return `M${a.points}`;
    case "polygon":
      return `M${a.points}z`;
    default:
      throw new Error(`Unhandled SVG element: ${tag}`);
  }
};

const tags = read("tags.json");
const icons = Object.entries(read("icon-nodes.json")).map(([name, nodes]) => ({
  name,
  tags: tags[name] ?? [],
  path: nodes.map(nodeToPath).join(""),
}));

writeFileSync(OUTPUT, `${JSON.stringify(icons)}\n`);
console.log(`Wrote ${icons.length} icons`);
