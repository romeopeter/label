# Layer — Implementation Spec

> Source of truth for what and how to build the Layer editor.
> Conceptual background (why choices were made, mental models) lives in
> [learn/](./learn/). Removed Phase-2 video-editor hints are parked in
> [split.md](./split.md).

## Contents

- [1. Product overview](#1-product-overview)
  - [Phase 1 includes](#phase-1-includes)
  - [Phase 1 does NOT include](#phase-1-does-not-include)
  - [Commands](#commands)
- [2. Tech stack](#2-tech-stack)
  - [Tauri constraints](#tauri-constraints)
- [3. Architecture](#3-architecture)
  - [Two-layer split](#two-layer-split)
  - [Repo layout](#repo-layout)
- [4. Element model & state](#4-element-model--state)
  - [Element union](#element-union)
  - [Store shape (Zustand)](#store-shape-zustand)
  - [State rules](#state-rules)
- [5. Canvas (Konva)](#5-canvas-konva)
- [6. Image import](#6-image-import)
  - [Entry points](#entry-points)
  - [Import flow](#import-flow)
  - [Screenshot heuristic](#screenshot-heuristic)
  - [10% padding centring](#10-padding-centring)
  - [Data URLs](#data-urls)
  - [Not handled](#not-handled)
- [7. Backgrounds & device frames](#7-backgrounds--device-frames)
  - [Background modes](#background-modes)
  - [Abstract backgrounds](#abstract-backgrounds)
  - [Device frames](#device-frames)
- [8. Text & shapes](#8-text--shapes)
  - [Text](#text)
  - [Shapes](#shapes)
- [9. Export](#9-export)
  - [Static PNG/JPG/WebP](#static-pngjpgwebp)
  - [Watermark](#watermark)
  - [Browser download](#browser-download)
  - [Desktop export](#desktop-export)
  - [Clipboard](#clipboard)
- [10. Project file (`.layer`)](#10-project-file-layer)
- [11. Free vs Pro gate](#11-free-vs-pro-gate)
  - [Rules](#rules)
  - [Why the gate must not live in JS](#why-the-gate-must-not-live-in-js)
  - [Target Rust design](#target-rust-design)
  - [Dev activation](#dev-activation)
  - [Phase 2: Paddle / Lemon Squeezy](#phase-2-paddle--lemon-squeezy)
- [12. Tauri shell](#12-tauri-shell)
  - [Capability map](#capability-map)
  - [IPC rules](#ipc-rules)
  - [Shell configuration](#shell-configuration)
  - [Web/Tauri divergence](#webtauri-divergence)
- [13. Deferred: SQLite persistence](#13-deferred-sqlite-persistence)
  - [Phase 1 schema](#phase-1-schema)
  - [Migrations](#migrations)
  - [JS usage](#js-usage)
  - [Adapter pattern](#adapter-pattern)
  - [Transactions & concurrency](#transactions--concurrency)
  - [Backup](#backup)
- [14. Conventions](#14-conventions)
  - [React](#react)
  - [Styling](#styling)
  - [Imports](#imports)
  - [State](#state)
  - [Canvas](#canvas)
  - [Adding a new element type](#adding-a-new-element-type)
- [15. Success criteria & out of scope](#15-success-criteria--out-of-scope)
  - [Phase 1 success criteria](#phase-1-success-criteria)
  - [Out of scope (Phase 1)](#out-of-scope-phase-1)
  - [Known follow-ups](#known-follow-ups)

## 1. Product overview [↑ Go up](#contents)

Layer is a desktop-first editor for creating polished and branded marketing
banners, product launch screens, and social-media visuals. Phase 1 turns
screenshots/images and assets into polished branded visuals, exported as a
static image (Brandbird parity).

- **Platform:** Desktop app (Tauri), web as a planned future target. Mobile is
  not a target. UI is HTML/React/TypeScript/Tailwind for a minimal migration
  path.
- **Phase 1 is the static editor.**

### Phase 1 includes

1. Screenshot / image import
2. Canvas with background control
3. Device frame overlay (Mockup)
4. Text layers (heading + body)
5. Marks drawn directly on the canvas: shapes, arrows, lines, callouts, highlighter
   and freehand; plus text, emoji, icons, QR codes, numbers, badges, and a layer
   list with lock, hide and reorder for every element
6. Export: static PNG/JPG (watermarked on free tier)
7. Canvas size presets for common destinations, and layouts that place several images
   together
8. Image upload, presets and effects
9. Above as free version

### Phase 1 does NOT include

- Custom fonts (system fonts only)
- Website-by-URL capture / tweet import (no button; needs Tauri capture pipeline)
- 3D image rendering effect (prior implementation removed; redesign needed)

### Commands

```bash
npm run dev         # Vite dev server on http://127.0.0.1:5173/
npm run build       # tsc -b && vite build → dist/
npm run lint        # ESLint flat config
npm run typecheck   # tsc -b --noEmit
npm run preview     # serve dist/
npm run tauri:dev   # native window + Vite hot reload
npm run tauri:build # bundle the desktop app
npm run emoji:sync  # regenerate src/data/emojis.json (needs FREE_EMOJI_KEY in .env)
npm run icons:sync  # regenerate src/data/icons.json from lucide-static
```

## 2. Tech stack [↑ Go up](#contents)

| Layer | Choice | Constraint |
|---|---|---|
| UI shell | React 18 + TypeScript | Function components + hooks; no classes, no SSR |
| Bundler | Vite 5 | `@` alias → `src/`; dev on `127.0.0.1:5173` |
| Styling | Tailwind v4 (CSS-first) + ShadCN | Tokens via `@theme` in `src/styles/app.css`; primitives owned in `src/components/ui/` |
| Icons | `lucide-react` | — |
| State | Zustand | One store: `src/store/editor.ts` |
| Canvas | Konva + `react-konva` | One `Stage` in `CanvasStage.tsx` |
| Desktop shell | Tauri 2 | Rust + WebView; no Electron |
| Persistence | SQLite via `tauri-plugin-sql` (deferred) | `localStorage` forbidden |
| Website/tweet import | Tauri Rust command pipeline (deferred) | Host adapter / invoke boundary |

### Tauri constraints

- All file system access goes through Tauri Rust commands via `invoke()`. The
  webview never supplies a path: commands open the native dialog themselves.
- IPC pattern: `invoke('command_name', { payload })` → `Result<T, String>`.
- Window config: single window, min size 1100×700 px, native OS window buttons
  on every platform. macOS overlays them on the React top bar; Windows and Linux
  show the normal OS title bar above it.
- **Web portability:** everything in `src/` keeps working in a plain browser.
  No `@tauri-apps/*` import at module top-level anywhere in `src/`.
  All Tauri calls go through a thin adapter (`src/lib/host.ts`) that no-ops
  (or falls back to browser-native behavior) when `window.__TAURI__` is
  undefined.

## 3. Architecture [↑ Go up](#contents)

### Two-layer split

```
React UI (src/)  ← runs in WebView (Tauri) or browser (Vite dev)
      │ Tauri IPC (desktop only)
Rust shell (src-tauri/)  ← native binary, ~3-5 MB
  - File I/O (open/save .layer)
  - PNG/JPG/WebP export file write
  - Watermark composite (deferred)
  - SQLite via tauri-plugin-sql (deferred)
  - Licence validation (deferred)
```

`src-tauri/` is a sibling of `src/`, in the same git repo.

### Repo layout

```
layer/
├── AGENTS.md                  ← project memory
├── implementation.md          ← you are reading this (product spec)
├── learn/                     ← conceptual docs (reference only)
├── scripts/                   ← emoji and icon data generators
├── src-tauri/                 ← Rust shell (file commands in src/files.rs)
├── src/
│   ├── App.tsx                ← shell + hotkeys + drag/drop
│   ├── main.tsx
│   ├── styles/app.css         ← Tailwind v4 @theme tokens + base + utilities
│   ├── types/                 ← LayerElement union + shared state types
│   │   ├── index.ts
│   │   └── pattern.ts         ← PatternConfig, PatternColorPair, Pro gate map
│   ├── data/
│   │   ├── curatedPatternPairs.ts
│   │   └── emojis.json, icons.json  ← generated; see scripts/
│   ├── lib/
│   │   ├── utils.ts           ← cn()
│   │   ├── constants.ts       ← CANVAS_SIZES, SYSTEM_FONTS
│   │   ├── mockups.ts         ← Device list and screen geometry
│   │   ├── host.ts            ← desktop/web boundary (all Tauri calls)
│   │   ├── importers.ts       ← file → image element
│   │   ├── marks.ts           ← Mark helpers (numbering, stroke geometry, migration)
│   │   ├── markTools.ts       ← Drag gesture → mark fields, default tool styles
│   │   ├── connectors.ts      ← Arrow and line geometry
│   │   ├── callouts.ts        ← Bubble outlines
│   │   ├── shapePaths.ts      ← Polygon, star and heart outlines
│   │   ├── imageFit.ts        ← Fit an image to the canvas with padding
│   │   ├── qr.ts              ← text → QR vector path
│   │   ├── exporters.ts       ← stage → PNG/JPG/clipboard, .layer save/load
│   │   ├── patterns/          ← SVG tile generators, LRU raster cache, lookups
│   │   └── export/            ← export-time asset prep (pattern tile DPI swap)
│   ├── store/editor.ts        ← Zustand
│   ├── store/history.ts       ← Undo and redo
│   └── components/
│       ├── ui/                ← ShadCN primitives
│       ├── canvas/            ← Konva nodes (Stage, Image, Text, Shape, Background)
│       └── panels/            ← Right-rail panels + shared primitives
├── components.json            ← ShadCN config (style: new-york)
├── vite.config.ts             ← Vite + @tailwindcss/vite + @/ alias
├── tsconfig.json
└── package.json
```

## 4. Element model & state [↑ Go up](#contents)

### Element union

```ts
type LayerElement = ImageElement | TextElement | ShapeElement;

interface BaseElement {
  id: string;
  type: 'image' | 'text' | 'shape';
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  opacity: number;
  shadow?: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number };
  border?: { enabled: boolean; color: string; width: number };
}

interface ImageElement extends BaseElement {
  type: 'image';
  src: string;              // object URL or data URL
  deviceFrame: DeviceFrame | null;
  cornerRadius: number;
  transform: string;
}

interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  variant: 'heading' | 'body';
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
}

interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  dashed: boolean;
  arrowHeadSize?: number;   // arrows
  filled?: boolean;         // false draws the outline only; absent means filled
  effect?: MarkEffect;      // none | soft | hard | glow, on shapes and callouts
  connector?: Connector;    // arrows and lines: ends, route, heads
  calloutKind?: CalloutKind; // speech | round | thought | shout | label
  tail?: [number, number];  // where a callout points, relative to its box
  fontSize?: number;        // callout text size
  text?: string;            // callout/badge label, number, emoji, QR content, icon name
  textFill?: string;        // label colour: callout, number, badge
  backgroundFill?: string;  // light squares of a QR code
  iconPath?: string;        // icon outline in a 24×24 box
  points?: number[];        // pencil, highlight: x,y pairs as 0–1 fractions of the box
}
```

- `ShapeKind`: `rect`, `rounded-rect`, `ellipse`, `arrow`, `line`,
  `highlight`, `callout`, `qr-code`, `emoji`, `pencil`, `number`, `icons`,
  `badge`, `triangle`, `diamond`, `pentagon`, `hexagon`, `star`, `heart`, `cross`.
- `Connector`: `start`, `end`, optional `control` (curves), `route` (`straight`,
  `curved`, `elbow`), `headStart`, `headEnd` (`none`, `arrow`, `open`, `dot`).
- `BaseElement` also carries optional `locked` (can't be moved, resized or
  deleted from the canvas) and `hidden` (not drawn or exported). The Mark panel's
  layer rows list every element, including text and images, and set these.
- `DeviceFrame`: `null`, `macbook-light`, `macbook-dark`, `iphone-light`,
  `iphone-dark`, `browser-light`, `browser-dark`.

### Store shape (Zustand)

One store: `src/store/editor.ts`.

```ts
interface EditorState {
  // Canvas
  canvas: { width: number; height: number; label?: string };
  background: BackgroundState;
  watermark: boolean;

  // Elements
  elements: LayerElement[];
  selectedIds: string[];

  // UI
  activeTool: Tool;
  zoom: number;
  grid: GridState;
  snapEnabled: boolean;

  // Licence
  isPro: boolean;

  // Pattern colour pairs + uploads (in-memory until SQLite lands)
  customPatternPairs: PatternColorPair[];
  uploadedImages: UploadedImage[];

  // Actions
  addImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  addUploadedImage: (src: string, naturalWidth: number, naturalHeight: number) => string;
  deleteUploadedImage: (id: string) => void;
  addText: (variant: 'heading' | 'body') => string;
  addShape: (shape: ShapeKind, overrides?: Partial<ShapeElement>) => string;
  reorderElement: (id: string, targetId: string) => void;
  setMarkTool: (tool: MarkTool | null) => void;
  setMarkStyle: (category: MarkCategory, patch: Partial<ShapeElement>) => void;
  setEditingId: (id: string | null) => void;
  setCropId: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  updateElement: (id: string, patch: Partial<LayerElement>) => void;
  duplicateElement: (id: string) => void;
  deleteElement: (id: string) => void;
  selectElement: (id: string | null, additive?: boolean) => void;
  moveElement: (id: string, dz: 1 | -1) => void;
  setActiveTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setGrid: (g: Partial<GridState>) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setCanvas: (c: CanvasSize) => void;
  setBackground: (b: Partial<BackgroundState>) => void;
  setPattern: (p: Partial<PatternConfig>) => void;
  setWatermark: (v: boolean) => void;
  addCustomPatternPair: (base: string, accent: string, label?: string) => string;
  deleteCustomPatternPair: (id: string) => void;
  loadProject: (project: LayerProject) => void;
  toProject: () => LayerProject;
  resetProject: () => void;
}
```

### State rules

- **Selectors:** subscribe to the minimum fields a component needs —
  separate `useEditor(s => s.x)` calls beat object selectors. Object selectors
  compare by reference and re-render every change; if unavoidable, use
  `shallow` from `zustand/shallow`.
- **Outside React:** `useEditor.getState()` for snapshots in hotkeys, timers,
  IPC callbacks; `useEditor.subscribe(...)` for imperative reactions.
- **Actions:** always return new arrays/objects (reference equality drives
  re-renders). Use `set((state) => ...)` when new state depends on previous
  state (rapid calls like drags). Use `get()` when an action reads other
  slices.
- **No middleware** (no persist, devtools, immer). Reconsider immer only
  when element count regularly exceeds ~100.
- `elements` are canvas elements only; `uploadedImages` is the app-memory
  asset bucket — never mix the two.

## 5. Canvas (Konva) [↑ Go up](#contents)

- Model: `Stage > Layer > Group > Shape`. One `Stage` lives in
  `src/components/canvas/CanvasStage.tsx`.
- Each store element renders to exactly one Konva node — dispatch on
  `element.type` and `element.shape`.
- The store is authoritative; Konva is a renderer for it.
- **Transformer:** wraps selected nodes with the 8-handle bounding box. On
  `transformend`, bake `x/y/scaleX/scaleY/rotation` into the element's
  `width`/`height`/`rotation` and reset node scale to 1 (otherwise the next
  transform compounds the scale).
- **Coordinates:** stage coordinates are logical artboard pixels; container
  coordinates are DOM screen positions. HTML overlays (text-edit textarea)
  must combine `stage.container().getBoundingClientRect()` with
  `node.getAbsolutePosition()` and the stage scale.
- **Background layer:** the background is a locked `Rect` at z-index 0 with
  `listening={false}`; it is the first child of its Layer (document order =
  z-order). Clicks on it pass through to the empty stage = deselect.
- **Groups inherit transforms** — device frame + screenshot live in one
  `Group` so they move/resize as a unit.
- **Performance levers** (measure first): `listening={false}` on decorative
  nodes; multiple `<Layer>`s; `perfectDrawEnabled={false}` on `<Image>`;
  `cache()` for complex nodes.

## 6. Image import [↑ Go up](#contents)

### Entry points

Three paths, all funneling into `importImageFile(file, addImage)` in
`src/lib/importers.ts`:

1. **Drag and drop** — drop zone is the app shell root (`src/App.tsx`).
   Only treat as file drag when `e.dataTransfer.types` includes `Files`.
   `preventDefault()` on `dragover` is required for `drop` to fire.
2. **File picker** — hidden `<input type="file">` in the Uploads panel;
   `accept="image/png,image/jpeg,image/webp,image/svg+xml"`. Reset
   `e.target.value = ''` after selection so re-picking the same file fires
   `onChange`.
3. **Paste** — window-level `paste` listener; inspect `clipboardData.items`
   for `image/*` and call `item.getAsFile()`.

### Import flow

1. Reject if not `image/*`.
2. Decode to data URL (`fileToDataURL`).
3. Measure natural dimensions.
4. Run the screenshot heuristic.
5. Compute target size with 10% padding.
6. `addImage(src, { width, height })`.

### Screenshot heuristic

Offer "Apply device frame" when width ≥ 1280 px and the aspect ratio matches
16:9, 16:10, or 4:3 (within 0.02). The user always opts in — never auto-apply.

### 10% padding centring

Fit inside 80% of the canvas, preserving aspect ratio, with no upscaling
(`Math.min(..., 1)`).

### Data URLs

Data URLs are fine for in-memory editing but bloat `.layer` files (~33%
base64 overhead). `URL.createObjectURL` can't be JSON-serialised. The Tauri
filesystem path (`.layer-assets/` sidecar) solves this — see §10.

### Not handled

- **HEIC / HEIF** — needs a wasm decoder; deferred.
- **Animated GIF** — imports as a static first frame.
- **PSD** — out of scope.
- **EXIF rotation** — browser `<img>` honours it; some Konva versions don't.

## 7. Backgrounds & device frames [↑ Go up](#contents)

### Background modes

Three spec'd modes, toggled in the right panel when no element is selected:

1. **Solid** — colour picker and swatches.
2. **Gradient** — two-stop linear, angle slider 0–360°, two colour pickers, presets.
3. **Image** — upload, screenshot or Pixabay picture, cover-fitted.

A fourth mode, **pattern**, ships in the current build (beyond the spec's
three): duotone SVG tiles, drawn once onto a canvas, LRU-cached, and repeated
with Konva's `fillPatternImage`. See `src/lib/patterns/` and `src/types/pattern.ts`.

A fifth, **abstract**, is also beyond the spec: backgrounds Layer draws itself. See
[Abstract backgrounds](#abstract-backgrounds).

```ts
interface BackgroundState {
  mode: 'solid' | 'gradient' | 'image' | 'pattern' | 'abstract';
  color: string;
  gradient: { from: string; to: string; angle: number };
  imageSrc: string | null;
  pattern: PatternConfig;     // colors?: { base, accent } when Shuffle chose them
  backdrop: BackdropLook;
  effects: BackgroundEffects;
}

interface BackgroundEffects {
  blur: number;      // canvas px, 0–100
  frost: number;     // 0–1
  grain: number;     // 0–1
  vignette: number;  // 0–1
  opacity: number;   // 0–1; below 1 shows through in PNG and WebP exports
}
```

The store keeps a fully-populated object with a discriminating `mode` field
so toggling modes restores previous values.

**Panel.** Type, then that type's own settings, then two tabs:

- **Shuffle with Back and Forward** is on Solid (a colour), Gradient (two colours
  and an angle), Pattern (its two colours) and Abstract. Colours come from the
  abstract backgrounds' OKLCH palettes, so they're always in tune. Each type keeps
  its own trail, for the session only, and it's not undo. Picking a swatch or a
  colour by hand replaces the look Back and Forward are on.
- **Saved** keeps the whole current background (type, settings and effects) to use
  again in any project, up to 24. On the desktop the list lives in
  `saved-backgrounds.json` in the app's data folder (`saved.rs`), until SQLite lands;
  in the browser it lasts the session.
- **Effects** — Blur, Frost, Grain, Vignette and Opacity — apply to every type and
  stay as the type changes. Settings that only make sense for one type stay in its
  section: a pattern's intensity, size and rotation.

**Drawing.** Without effects, solid, gradient, image and pattern backgrounds are
plain Konva nodes. With an effect that changes pixels, the type is drawn to a 2D
canvas (`drawBackgroundSource`) and goes through the abstract backgrounds' renderer,
which blurs it and adds frost, vignette and grain; export draws it again at full
size. Opacity is a Konva group opacity, so it never needs the renderer.

**Older files.** An image's `imageBlur` and `imageOpacity`, and an abstract
background's own `blur`, `frost` and `grain`, become the background's effects when
that type was showing.

**Patterns.** 22 types, each unlike every other: none is another turned, resized or
recoloured. Dropped because they repeated one (and what an older file gets instead):
Rules (Stripes), Diamonds (Argyle), Crosses (Dots), Grain (Starry Night: grain is now
an effect), Half Blocks (Pinwheel), Wedge and Bowtie (Triangles), Quarters (Truchet).
Tiles are drawn onto a canvas before they're repeated: WebKit treats a canvas filled
with a pattern made straight from an SVG image as unreadable, so exports of pattern
backgrounds used to come out empty.

- **Gradient:** convert the angle to start/end points on the rect's bounding
  box and use `fillLinearGradientStartPoint/EndPoint/ColorStops`
  (`gradientEnds`, shared with the 2D drawing).

### Abstract backgrounds

Backgrounds drawn by Layer, not taken from stock, so there are no licence terms and
they stay sharp at any size. Code is in `src/lib/backdrops/`, types in
`src/types/backdrop.ts`.

```ts
interface BackdropLook {
  style: 'soft' | 'waves' | 'streaks' | 'glow' | 'glass' | 'aurora' | 'silk' | 'marble';
  seed: number;              // lays out the shapes; picks colours when none was picked
  color: string | null;      // the colour Shuffle builds on, or null for any
  colors: [deep, main, accent, highlight];  // saved, so files don't change if the generator does
}
```

- **Panel:** Style (two rows of four), ten presets that between them show every style,
  Shuffle with Back and Forward, and Color. Blur, Frost and Grain are background
  effects, in the Effects tab; a preset still brings the ones it was made with.
- **Styles:** Soft (blurred patches), Waves (layered folds), Streaks (light pulled
  along a diagonal), Glow (lights on a dark ground), Glass (clear panels over soft
  colour, bending it at their edges; usually one is fluted), Aurora (curtains of light
  over a night sky, with stars), Silk (glossy folds, lit from one side) and Marble
  (wandering veins; light stone with dark veins, or dark with light ones, to match the
  main colour).
- **Shuffle** makes a new layout and palette in the current style, built on the
  picked colour if there is one. **Back and Forward** move through what this session
  has shown, like a browser's history: a new Shuffle partway back drops what was
  ahead. They change the look and keep the effects. The trail is not saved, and is
  not undo: each Shuffle, Back or Forward is one undo step of its own.
- **Colour** is worked out in OKLCH, where equal steps look equal. From one colour
  come a deep shade, the colour, an accent round the wheel (same, neighbours,
  opposite or split) and a pale highlight, at the lightness of one of four moods.
  Shadows lean towards blue-violet so dark yellows don't go olive, Shuffle skips the
  muddy yellow-greens, and a grey stays grey.
- **Frost** scatters what's behind it like frosted glass and makes it milkier.
  **Blur** softens it. **Grain** adds film-like noise. All three are measured in
  canvas pixels, so the export matches the preview.
- **Stars** in Aurora are sized in canvas pixels, like grain, so an export has the
  same stars as the preview.
- **Drawing** uses a WebGL2 context of its own, separate from image editing's. The
  noise uses an integer hash: a float one rounds differently at each place the GPU
  uses it, which shows as seams. Without WebGL2 the colours show as a plain gradient.
- **Export** draws it again at the export's scale (`prepareExportBackdrop`), as
  patterns do.
- **Moods per style:** a style can ask Shuffle for the moods it suits. Aurora only
  gets dark ones, since it needs a night sky; Glow leans dark; Marble leans to light
  and dark stone. The rest use the usual mix.

### Device frames

Twenty devices, each from one source only, plus five windows (see below). Every source
is MIT, and its licence ships in `public/frames/`:

| Source | Devices |
|---|---|
| [react-mockframe](https://github.com/mbdev3/react-mockframe) | iPhone 18 Pro, iPhone Duo, iPhone 17, Pixel 10, Galaxy S25, iPad Pro, iPad Mini, MacBook Pro |
| [Devices.css](https://devicescss.xyz) | iPhone 14 Pro, Pixel 6 Pro, Galaxy S8, Surface Pro, MacBook, Surface Book, iMac, Pro Display, Surface Studio, Watch Ultra, Watch Series 8 |
| [Monkr](https://github.com/blaineam/Monkr) | Laptop |

The first two are pure CSS, which Konva can't draw, so `npm run devices:sync` renders
each device in WebKit to a PNG in `public/frames/`, and writes
`src/data/deviceFrames.json`.

**Only Monkr's laptop is used.** Monkr's code says it's the one frame there that isn't
vendor artwork. Its other frames are Apple's bezels, or what its docs call third-party
art with no stated source, so its MIT licence can't be relied on for them.

**Screen areas are measured, never typed in.** Each CSS device is rendered with a black
screen and with a white one. A pixel that differs shows the screen, and how much it
differs is how much it shows. That gives a true hole with soft corners, and keeps
what sits over the screen, such as a notch. The screen's box comes from the hole
itself, not the stylesheet, because the two differ by a screen's border. Its corner
radii come from the stylesheet. All are stored as fractions of the device. Monkr's
laptop is already a PNG, so its hole is measured from its transparency.

```ts
interface DeviceFrame {
  device: string;            // "iphone-14-pro", a screen ("glass-light") or a browser ("chrome")
  finish: string;            // "black"
  landscape: boolean;        // ignored by devices that can't turn
  fit: 'fill' | 'fit';       // fill crops to the screen; fit shows it all, with bars
  zoom: number;              // 1 to 4, on top of fill or fit
  panX: number;              // -1 to 1: a share of the room the picture has to move
  panY: number;
  barColor: string;          // around a picture that doesn't cover the screen
  thickness: number;         // a screen frame's padding, against its design
  roundness: number;         // a drawn frame's corners, against its design
  address: string;           // what a browser shows
}
```

**Rendering**, all in `ImageNode` with geometry from `src/lib/mockups.ts`:

1. The frame, only if there's a shadow, so the shadow doesn't fall across the screen.
2. The picture, clipped to the rounded screen. A screen's square corners stick out
   past a phone's rounded edge, so being covered by the frame isn't enough.
3. The frame again, on top.

**Rules that keep the picture right:**
- A framed image's box always has its device's shape, and resizes from corners only.
- Fill takes the part of the picture with the screen's shape, so it's never stretched.
- Crop keeps to the screen's shape, so what's chosen is what shows.
- A wide picture puts a device that can turn on its side. The picture stays upright.
- A screen or desktop browser wraps its picture exactly, so it changes height with the crop.
- Old `.layer` files naming the six earlier frames open on the matching real device,
  and retired devices (iPhone 14, X and 8) open on the iPhone 17. The old Browser opens
  on Safari, and the old Glass and Inset on the light or dark tile of Tint and Matte.

**The panel** has three tabs, with the gallery capped in height so the controls stay in
view: Screens, Windows and Devices.

**Screens** are generic frames: Plain, Tint Light and Dark, Shine, Matte Light and Dark,
Line, Edge, Block, Paper, Pile and Steps. They take a picture of any shape, so
they're drawn in `WindowFrame`, not from artwork, with their proportions in `SCREEN_LOOKS`.
Tint and Shine are translucent over what's behind them; they don't blur it. These are our
own designs and names. Don't copy shots.so's artwork, tile names or pixels: its terms reserve
its designs. Saved ids (`glass-light`, `retro`) are older than the labels and stay as they are.

**Windows** are browsers: Safari, Edge, Firefox, Brave and Chrome, plus tablet and mobile
Safari and Chrome. They're drawn in `BrowserFrame` with sizes in `BROWSER_LOOKS`, follow
each browser's general layout, and take any address. They use no vendor's logo or artwork.
Desktop ones wrap their picture. Tablet and mobile ones keep their own shape, so they fill
or fit like a device, and tablets can turn.

**Controlling a mockup.** `pictureView` is the one place that works out what shows on a
screen: fill or fit, then zoom, then moving, as a share of the room the picture has. The
panel has sliders for these, and holding Alt while dragging moves the picture
(`usePictureDrag`, not Konva's drag, since the frame stays put). Crop is a coarser version
of the same thing, so it opens on what the screen shows and applying it resets zoom and
moving. Size, rotation and centring work around the mockup's middle. Corners are capped so
a picture's square corners can't poke past the frame.

Devices are flat. 3D devices are a separate, later piece of work.

## 8. Text & shapes [↑ Go up](#contents)

### Text

Two presets: **heading** and **body**. `variant` selects sensible defaults at
creation; the panel edits all fields freely afterwards.

```ts
interface TextElement extends BaseElement {
  type: 'text';
  variant: 'heading' | 'body';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  fill: string;
}
```

- Konva `fontStyle` is the weight/italic catch-all; `width` is the wrap point;
  letter spacing may be negative.
- **In-place editing:** double-click a `Text` node opens an overlaid HTML
  `<textarea>` at the node's screen position (stage container offset +
  absolute position × stage scale), mirroring Konva typography exactly (font,
  size, line-height, letter-spacing, rotation). On blur (or Escape), sync the
  value back via `updateElement`. Key events must `stopPropagation` so global
  hotkeys (e.g. Backspace = delete) don't fire while typing.
- **Fonts:** Phase 1 is system fonts only — Inter, SF Pro (macOS), Segoe UI
  (Windows), bundled JetBrains Mono. Custom upload / Google Fonts are
  Phase 2. List lives in `SYSTEM_FONTS` (`src/lib/constants.ts`).
- **Panel controls:** font family, size, weight, colour, alignment, letter
  spacing (−2 to +10), line height (1.0–2.0).

### Shapes

| Shape | Konva primitive | Notes |
|---|---|---|
| Rectangle | `<Rect>` | fill optional, stroke, cornerRadius, effect |
| Rounded rectangle | `<Rect cornerRadius={N}>` | same node, non-zero radius |
| Ellipse | `<Ellipse radiusX radiusY>` | Shift-drag = circle |
| Triangle, diamond, pentagon, hexagon, star, heart, cross | `<Path>` | Outline rebuilt from the box, so stroke width survives resize |
| Arrow / line | `<Path>` shaft + head paths | Straight, curved or elbow; four head styles per end |
| Highlighter | `<Line>` with `multiply` | Freehand marker stroke |
| Callout | `<Path>` + `<Text>` | Speech, pill, square, round, thought, shout, label |
| Number marker | `<Ellipse>` + `<Text>` | Next unused number on add and duplicate |
| Badge | `<Rect>` + `<Text>` | Width follows the label; presets in the panel |
| Emoji | `<Text>` | Drawn by the OS emoji font; see below |
| Icon | `<Path>` stroke | Lucide outline, stored in the element |
| QR code | `<Rect>` + `<Path>` fill | Generated locally, encoded as UTF-8 |
| Freehand | `<Line tension>` | One layer per stroke; stroke width survives resize |

```ts
interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;  // full field list in §4
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  dashed: boolean;
}
```

**Marks are drawn, not dropped.** Picking a tool arms it (`markTool` in the store)
and a drag on the canvas creates the mark; the logic is `useMarkPlacement` plus the
pure `gestureFields` in `src/lib/markTools.ts`. A click with no drag places a sensible
default size. Shift gives equal sides, or 45° for lines and arrows. Esc cancels. Every
tool, Draw and Highlight included, hands back to selecting and selects what it made, so
its settings are right there. Number, badge, emoji, icon and QR tools are placed the
same way: pick, then click or drag on the canvas. A tool's panel is the same
`StyleControls` a selected layer uses, fed a stand-in element, so the two can't drift
apart. Tool styles (`markStyles`) last the session.

**Arrows and lines are defined by their ends, not a box.** They have no Transformer:
`MarkHandles` draws drag points for each end, the curve and callout tails, in a layer
of their own that the exporter hides. `placeConnector` re-bases a connector on its
bounding box after every change, so `x`/`y`/`width`/`height` stay true.

**Highlighter blending.** `multiply` tints what's beneath, so dark text under the
marker stays dark. It blends within the content layer, which holds images and other
marks; the background is its own layer, so over it the stroke is plain translucent.

**Text has two resizes.** Side handles set the wrap width and never the font size.
Corner handles scale the font and width together, keeping the same line breaks. There
are no top or bottom handles, since the box height always follows the lines.
`TextEditor` is the on-canvas textarea for text and callouts; double-click opens it.

**Resizing is live.** Images, shapes and text clear Konva's scale on every `transform` event
and write a real size to the store, so strokes and text never stretch mid-drag. That
writes on every pointer move, which is why nodes are memoised on their own element.
A callout's group reports only its box to the Transformer, so a tail doesn't inflate
the selection. Polygon outlines must touch all four sides of their box, or the
selection frame and the element drift apart during a resize.

Images, emoji, icons and QR codes resize from the corners only, keeping their
proportions, and so does any multi-selection that includes an image. Crop is how an
image changes shape. Framed images keep their side handles, because the screenshot
is cover-fitted to the frame and can't stretch.

**Emoji and icon data ships in the repo.** `npm run emoji:sync` fetches the list
from emoji-api.com using `FREE_EMOJI_KEY` in `.env`, and `npm run icons:sync`
builds the list from `lucide-static`. The generated JSON is committed and
lazy-loaded with its picker. The API key is used only by that script: it must
never reach `src/`, a `VITE_` variable or the app bundle. New emoji need a re-run.

**Emoji use the OS font,** because the API returns characters, not images. The
same design can look different on macOS and Windows, can soften at very large
sizes, and flags don't render as flags on Windows.

**Icons are stored as path data in the element,** not as a name to look up, so
`.layer` files keep working if an icon later leaves lucide.

**Marks never touch the store mid-gesture.** `MarkDraft` holds the preview in its own
state, like `SnapGuides`, drawn by the real `ShapeNode`, and is in the export hide list.

**Older projects.** `migrateElement` runs on load: box-based arrows and lines become
connectors, and callouts gain a kind and tail. Box-based highlights still draw as they
were.

Each shape element maps to exactly one Konva node (dispatched in
`ShapeNode.tsx`). **Resize math:** store `width`/`height` for all shapes
(Ellipse converts to radii at render) so one `Transformer` math serves every
element.

### Undo and redo

`src/store/history.ts` keeps snapshots of the document (`canvas`, `background`,
`elements`, `watermark`), not selection or view state. Elements are immutable, so
snapshots share everything unchanged. One step is one action: everything while the
pointer is down is one step, a new press closes the previous step, and changes with no
pointer (typing, arrow keys) close after a 400 ms pause. Changes that aren't the user's
doing must go through `history.silently`, as `measureElement` does, or they would wipe
redo. Loading or resetting a project clears history. In a text field, ⌘Z belongs to the
field. Uploads are part of history, so adding or removing one can be undone.

### Image toolbar

- **Crop** is non-destructive: `ImageElement.crop` holds the visible part as 0–1
  fractions of the original, so a later crop can reach back out. A tilted image crops
  flat, then tilts again. On a framed image the frame keeps its size, and the crop
  changes only what its screen shows.
- **Padding** centres the image with a gap to the canvas edge, in proportion, as in §6,
  but can also scale up. It sets size and position; nothing about it is stored.
- **Highlight** arms the highlighter.

### Adding images

An image can go on the canvas or become the background. It comes from one of three places:

- **Upload:** a file from the device, or drag and drop or paste.
- **Screenshot:** anything on the desktop. **Add screenshot** in the Images and Background
  panels. Layer first gets the whole screen: on macOS it hides itself and captures the
  display it's on, with no system picker; other systems and the web build use the
  webview's screen picker. Then the screen fills Layer's window to choose the area: drag
  a box, then move it or pull its sides and corners. **Capture** (or Space or Enter)
  keeps the box, or the whole screen if none was drawn; **Cancel** (or Esc) keeps
  nothing. The area goes on as it is, without opening Crop. While the picker is open,
  no key reaches the editor.
- **Free images:** search Pixabay in the Images and Background panels (desktop app only).
  The search and download run in Rust, so the API key never reaches the webview. Following
  Pixabay's API terms, searches are cached in a file for 24 hours, results say they come from Pixabay,
  and a chosen image is downloaded into the project rather than linked.

### Layout

The **Layout** tool puts several images together on one canvas, in one click. Pick an
arrangement and images on the canvas fill its slots in order. They stay normal images, so
editing, shadows and frames still work, and marks and text aren't moved. **None** returns
to free placement, with images staying where they are and looking the same.

- **Arrangements:** Side by side, Stacked, Overlap up, Overlap down, Masonry, Do & don't,
  Before & after, Arrow between, Three in a row, One big and two small, 2×2 and 3×3 grids,
  Cascade and Fan.
- **Settings:** Align (Start, Center, End), Spacing, Scale, Same width and Same shape. Same
  shape trims images to their slots without touching the user's own crop.
- **Filling slots:** any new image takes the next free slot, however it arrives. Clicking an
  empty slot adds there, and dropping a file on a slot fills or replaces it. Several files
  can be added at once. Images beyond the slots stay where they are.
- **Moving:** a slot decides an image's place and size, so there are no resize handles.
  Dragging inside a slot chooses which part of a trimmed picture shows; dragging onto
  another slot swaps the two.
- **Style all images** gives the others the selected image's shadow, corners, border and
  frame. **Fit canvas to layout** resizes the canvas around the images with even padding.
- **Labels, badges and arrows** are part of the artwork and export. Label text is edited in
  the panel. Empty slots are an editing aid and don't export.

### Image editing

Editing lives at the bottom of the **Images** panel, not in a tool of its own, because it
only applies to images. It appears once the canvas has an image, works on the selected one,
and Edit on the image toolbar scrolls to it. It has three tabs. Options come first, as
thumbnails of the user's own picture, with one Strength slider, because users aren't
expected to know photo editing.

- **Fix:** Crop, and Reset proportions on a stretched image. Remove, Hide, Expand and
  Straighten are the next stages.
- **Style:** one at a time, each with named variants: Glow, Motion, Color split, Double
  exposure (a second image, added here or from Uploads, with six blend options shown as
  overlapping circles), Fish-eye, Halo, Grunge, Film.
- **Adjust:** Quick fix, Color (tints, black and white), Color grade (named looks), Lens
  blur, then Brightness, Contrast, Highlights, Shadows, Ambience, Saturation and Warmth.

**Edits are settings, not pixels.** `ImageElement.edit` is stored in the `.layer` file,
undoes like any change, and `src` always stays the original. Removing an edit restores
the exact original pixels, because an image with nothing to change skips the renderer.

**One shared WebGL2 renderer** (`src/lib/imageEdit/`) draws edits to a 2D canvas per
image, which Konva draws like any picture, so export needs no special handling. Browsers
allow few WebGL contexts, so never create one per image. The crop is baked in before
effects run, so fish-eye and lens blur centre on what's visible; the crop window itself
shows the unedited original. Work is capped at 4096 px on the longest side. On a device
without WebGL2, images show unedited and the panel says so.

### Snapping

Applies to moving elements, resize handles, drawing marks, and dragging line ends and
callout tails. It doesn't apply to freehand strokes, curve handles, rotated boxes or
several elements at once. Shift turns it off for that drag, because it already pins the
shape or angle.

A guide shows while something is snapped. The Transformer fires drag events of its own
as it follows the element, and they bubble to the same handler, so the handler ignores
anything that isn't an element. Otherwise it snaps the Transformer, and its empty
guides wipe the element's guide as soon as it's drawn.

## 9. Export [↑ Go up](#contents)

### Static PNG/JPG/WebP

- `stage.toDataURL({ pixelRatio: 2 })` — 2× for retina; the export menu
  offers 1×/2×/3× per export.
- Hide editor chrome (Transformer, grid, snap guides, mark draft, mark handles, crop overlay) during capture;
  `withOverlaysHidden` in `src/lib/exporters.ts` is the seam. Any future
  viewport aid belongs in that hide list.

### Watermark

- Free tier composites the Layer logo watermark on every export.
- **Current state (web and desktop):** Konva node added to the stage during export and
  removed after. This is bypassable via DevTools — see §11 for the required
  Rust enforcement.

### Browser download

`downloadBlob(blob, filename)` in `src/lib/host.ts`, via object URL +
`<a download>`; `dataURLtoBlob` for the conversion. Web build only.

### Desktop export

`<a download>` can't be relied on in the desktop webview, so `saveExport()` in
`src/lib/host.ts` sends the encoded image to Rust as a raw IPC body:

```ts
await invoke('export_static', bytes, {
  headers: { 'x-layer-filename': filename },
});
```

`export_static` opens the native save dialog and writes the file. It takes no
path, format flag or `isPro` flag: the format comes from the filename's
extension, and only `png`, `jpg` and `webp` are accepted. See §11 for the
deferred watermark gate.

### Clipboard

`navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])]`.
PNG only (widely); must be called from a user gesture. If the write fails,
the image goes through `saveExport()` instead.

## 10. Project file (`.layer`) [↑ Go up](#contents)

Versioned JSON snapshot of the editable state:

```json
{
  "version": 1,
  "canvas": { "width": 1200, "height": 628, "label": "LinkedIn post" },
  "background": {
    "mode": "gradient",
    "gradient": { "from": "#1C1F3B", "to": "#2563EB", "angle": 135 }
  },
  "elements": [
    {
      "id": "el_01",
      "type": "image",
      "x": 120, "y": 80, "width": 960, "height": 480,
      "rotation": 0, "opacity": 1,
      "src": "data:image/png;base64,iVBORw0KGgo...",
      "deviceFrame": { "device": "macbook-pro", "finish": "spacegray", "landscape": true, "fit": "fill" },
      "cornerRadius": 0
    },
    {
      "id": "el_02",
      "type": "text",
      "x": 80, "y": 500, "width": 600, "height": 100,
      "rotation": 0, "opacity": 1,
      "variant": "heading",
      "text": "Ship visuals,\nnot pixels.",
      "fontFamily": "Inter", "fontSize": 64, "fontWeight": 700,
      "align": "left", "letterSpacing": -1, "lineHeight": 1.05,
      "fill": "#FFFFFF"
    }
  ],
  "watermark": true,
  "exportedAt": null
}
```

- **Today (web):** JSON download / upload.
- **Today (desktop):** the same JSON, through `save_project` and `open_project`,
  which own the native dialogs. `open_project` refuses files over 512 MiB.
- **Both:** open accepts `.layer` and legacy `.laybel` for backward compat;
  reject unknown versions. Parsing and version checks stay in `src/lib/`.
- **Later (desktop):** asset files copy into a `project-name.layer-assets/`
  sidecar; the JSON stores relative `src` paths instead of inline base64.
  Open reverses the process.
- **Migrations:** always migrate up, never write old versions — a switch on
  `data.version` in `loadProject`.

## 11. Free vs Pro gate [↑ Go up](#contents)

### Rules

These describe the target. The gate is deferred with SQLite: today the
watermark is composited in JS, as §9 describes.

1. `isPro` is a SQLite-backed flag; the Rust side is the source of truth.
2. The watermark is composited in Rust — even a spoofed JS `isPro` can't
   bypass it.
3. Phase 1 hard-codes `isPro: false`; the "Upgrade" button opens a
   coming-soon email capture modal (non-functional).

### Why the gate must not live in JS

Whatever runs in the WebView is patchable (`useEditor.setState({ isPro:
true })` → clean export). The Layer logo watermark distribution mechanic dies.

### Target Rust design

```rust
#[tauri::command]
async fn export_static(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    request: tauri::ipc::Request<'_>,  // raw image bytes + filename header
) -> Result<(), String> {
    let (filename, bytes) = parse_export_request(&request)?;
    let format = ExportFormat::from_filename(&filename)?;
    let mut img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let is_pro = state.licence.lock().await.is_pro;  // SQLite, not the JS flag
    if !is_pro {
        img = composite_watermark(img);
    }
    let encoded = encode(img, format).map_err(|e| e.to_string())?;
    // Off the async runtime: the dialog and the write both block.
    if let Some(path) = pick_save_path(&app, &filename, format.filter())? {
        std::fs::write(path, encoded).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

Invariants:

- The signature does not accept `is_pro` or a path — no JS path bypasses the
  check or chooses where a file lands.
- The watermark PNG is `include_bytes!`'d into the binary.
- The licence check is `await`'d inside the export, so mid-session revocations
  are caught on the next export.

### Dev activation

A `dev_set_pro` command exists only under `#[cfg(debug_assertions)]` — it
cannot exist in release builds.

### Phase 2: Paddle / Lemon Squeezy

1. User pastes a key into Settings → Licence.
2. JS calls `invoke('validate_licence', { key })`.
3. Rust validates server-side; on success writes `is_pro`, `key`,
   `validated_at`, `expires_at` to SQLite.
4. Periodic re-validation (weekly) catches refunds/cancellations. Responses are
   signature-verified against the vendor's public key.

## 12. Tauri shell [↑ Go up](#contents)

**Status: LANDED (Tauri 2).** `src-tauri/` holds the window and the file
commands `save_project`, `open_project` and `export_static`. SQLite and the Rust
watermark gate are still deferred (§11, §13).

### Capability map

| Capability | Web | Desktop | Desktop status |
|---|---|---|---|
| Open project | `<input type="file">` | `open_project` (Rust-owned dialog) | Done |
| Save project / export | browser download | `save_project` / `export_static` (Rust-owned dialog) | Done |
| Native dialogs (Save As) | `<a download>` (limited) | OS-native picker | Done |
| Paste image | paste event | same | Done |
| App icon | none | `tauri.conf.json` | Done |
| Read clipboard image | `navigator.clipboard.read()` | same + native fallback | Planned |
| Per-user settings | `localStorage` | `tauri-plugin-store` + SQLite | Deferred |
| Auto-updater | manual ServiceWorker dance | `tauri-plugin-updater` | Planned |
| Menu bar, dock badge | none | Tauri APIs | Default menu only |
| Code signing & notarization | n/a | bundler config | Planned |

File access deliberately does not use `plugin-fs` or `plugin-dialog`'s JS API,
and the window's capabilities don't grant them. A script in the webview must not
be able to name a path. `tauri-plugin-dialog` is used from Rust only.

### IPC rules

- Commands are plain `#[tauri::command]` functions; Tauri serialises JSON
  both ways.
- Return `Result<T, String>` — errors reach JS as rejected promises.
- Long-running work is `async fn`; the WebView thread isn't blocked. Blocking
  dialogs and disk I/O run on `spawn_blocking`, not on the async runtime.
- File commands take no path. They open the dialog, and a cancelled dialog is
  `Ok`, not an error.
- Failures show a native error dialog as well as rejecting, and their messages
  never include file paths.
- Large binary payloads use a raw IPC body, not a JSON data URL.
- Progress events: `tauri::Window::emit(...)` +
  `window.__TAURI__.event.listen(...)`.

### Shell configuration

- **Bundle ID:** `layer.duowork.tech`. Don't change it after the first release:
  macOS treats a new ID as a different app, and user data lives under it.
- **Targets:** desktop only. The Rust crate builds as a normal library plus
  binary, with no mobile library outputs or mobile icons.
- **Dev server:** `127.0.0.1:5173` with `strictPort`, since `devUrl` is fixed.
  `npm run dev` stays web-only; `npm run tauri:dev` opens the native window.
- **JS adapter** (`src/lib/host.ts`): uses `invoke()` when `window.__TAURI__`
  exists, else falls back to browser behaviour. `withGlobalTauri: true` is what
  makes that global exist. `src/lib/exporters.ts` never imports `@tauri-apps/*`
  directly.
- **Window** (`tauri.conf.json`): single window, title "Layer", 1280×800, min
  1100×700.
- **Window buttons are native on every OS; the app never draws its own.** macOS
  uses `titleBarStyle: "Overlay"`, so the traffic lights sit over the React
  `<TopBar>`, which reserves space for them and is the drag region
  (`data-tauri-drag-region`). Windows and Linux show the normal OS title bar
  above `<TopBar>`.
- **Drag and drop:** `dragDropEnabled: false`, so Tauri doesn't intercept drops
  and the same HTML5 `dataTransfer` code runs on web and desktop.
- **CSP:** set in `tauri.conf.json`. It only applies to built apps, so check
  changes with `npx tauri build --debug --no-bundle`, not `tauri:dev`.

### Web/Tauri divergence

- Tauri only: native menu bar, auto-updater.
- Web only: `beforeunload` tab-close confirmation.
- Everything that works on web also works on Tauri (its WebView is a
  browser); Tauri-only features are progressive enhancements behind
  `isTauri`.

## 13. Deferred: SQLite persistence [↑ Go up](#contents)

**Status: DEFERRED.** Today the only persistence is the manually saved
`.layer` JSON. **Rule: `localStorage` is forbidden** — all persistent state
goes through SQLite via Tauri IPC. (A lossy web fallback for recents is
tolerated on the web target only.)

### Phase 1 schema

```sql
CREATE TABLE schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE recent_projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT NOT NULL UNIQUE,    -- absolute path to .layer file
  name       TEXT NOT NULL,
  thumbnail  BLOB,
  opened_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE licence (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  is_pro        INTEGER NOT NULL DEFAULT 0,
  key           TEXT,                          -- Paddle/Lemon Squeezy (Phase 2)
  validated_at  TIMESTAMP,
  expires_at    TIMESTAMP
);
INSERT INTO licence (id, is_pro) VALUES (1, 0);
```

Phase 2 additions: `brand_kits`, `brand_kit_colors`, `brand_kit_fonts`,
`asset_library_items`.

### Migrations

`tauri-plugin-sql` migrations are **up-only** (never roll back schema in
production). Each migration is a `Migration { version, description, sql,
kind: Up }`; append new ones, never edit existing. On start, the plugin
applies any missing migrations in order.

### JS usage

```ts
const db = await Database.load('sqlite:layer.sqlite');
const rows = await db.select<RecentProject[]>('SELECT ... FROM recent_projects ...');
await db.execute('INSERT OR REPLACE INTO recent_projects (path, name) VALUES ($1, $2)', [path, name]);
```

### Adapter pattern

`src/lib/persistence.ts` exposes `isTauri`-checked functions (e.g.
`loadRecents()`): SQLite on desktop, lossy `localStorage` fallback on web.

### Transactions & concurrency

Wrap multi-statement updates in `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`.
SQLite serialises writes (WAL helps read-during-write) — fine for a
single-user desktop editor.

### Backup

The SQLite file sits in the OS app data directory
(`~/Library/Application Support/layer.duowork.tech/layer.sqlite` on macOS) and
survives reinstalls; users can put it in iCloud Drive for cross-machine sync.

## 14. Conventions [↑ Go up](#contents)

### React

- Function components + **named exports only** (no default exports).
- Hooks for state/effects. `useCallback` only when the handler is passed to a
  memoized child or is a `useEffect` dep.
- Refs for imperative escape hatches (the Konva `Stage` lives behind a ref).
- No Context for app state (Zustand is the store), no class components, no
  preemptive `memo`/`useMemo`/`useCallback`, no Suspense for data.

### Styling

- All tokens live in `@theme` in `src/styles/app.css` — never define brand
  colours or fonts elsewhere.
- Components style themselves with Tailwind utilities + `cn()`.
- ShadCN primitives in `src/components/ui/` use `cva()` for variants.
- Composites that don't read as utility chains (pseudo-elements, clip-paths,
  multi-stop gradients) go in `@layer utilities` in `app.css` — don't pile
  recurring inline `style={}`.
- **Never write `border-t-400`** for the teal border colour (parses as
  `border-top-width: 400px`). Use `border-primary`.
- **Presets and options select the same way everywhere:** `choiceClass(selected)`
  in `src/components/panels/choice.ts`. Hover is the accent border
  (`border-secondary`), as on the 3D presets; selected adds a ring of it. Tiles set
  `aria-pressed`.

### Imports

- `@/` → `src/` (configured in `vite.config.ts` and `tsconfig.json`).
- Named exports only.

### State

- One Zustand store (`src/store/editor.ts`); immutable updates; minimum
  selectors (see §4).

### Canvas

- One `Stage` in `CanvasStage.tsx`; one Konva node per store element;
  device frame + screenshot locked in a `Group` with `clipFunc`.

### Adding a new element type

1. Extend the union in `src/types/index.ts`.
2. Add the store action in `src/store/editor.ts`.
3. Add the Konva renderer under `src/components/canvas/`.
4. Add the dispatch case in `CanvasStage.tsx`.
5. Wire a panel in `src/components/panels/`.

## 15. Success criteria & out of scope [↑ Go up](#contents)

### Phase 1 success criteria

- [ ] User can import a screenshot (PNG/JPG) and place it on canvas
- [ ] User can add a device frame that clips and follows the screenshot
- [ ] User can set a solid, gradient, or image background
- [ ] User can add heading and body text, edit in-place
- [ ] User can add shape types and annotations
- [ ] User can export static PNG/WebP/JPG at @2×
- [ ] Projects save and reopen correctly as `.layer` files

### Out of scope (Phase 1)

- Custom fonts (system fonts only)
- Website-by-URL capture / tweet import (Tauri capture pipeline)
- 3D image rendering effect (redesign needed)
- HEIC/HEIF decode, PSD import

### Known follow-ups

- CSS 3D tilt rasterization issue (tilt feature)
- Auto website/tweet capture (no button; Tauri pipeline planned)
