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
  - [Tauri constraints (deferred shell)](#tauri-constraints-deferred-shell)
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
  - [Device frames](#device-frames)
- [8. Text & shapes](#8-text--shapes)
  - [Text](#text)
  - [Shapes](#shapes)
- [9. Export](#9-export)
  - [Static PNG/JPG/WebP](#static-pngjpgwebp)
  - [Watermark](#watermark)
  - [Browser download](#browser-download)
  - [Tauri replacement (deferred)](#tauri-replacement-deferred)
  - [Clipboard](#clipboard)
- [10. Project file (`.layer`)](#10-project-file-layer)
- [11. Free vs Pro gate](#11-free-vs-pro-gate)
  - [Rules](#rules)
  - [Why the gate must not live in JS](#why-the-gate-must-not-live-in-js)
  - [Target Rust design](#target-rust-design)
  - [Dev activation](#dev-activation)
  - [Phase 2: Paddle / Lemon Squeezy](#phase-2-paddle--lemon-squeezy)
- [12. Deferred: Tauri shell](#12-deferred-tauri-shell)
  - [Capability map](#capability-map)
  - [IPC rules](#ipc-rules)
  - [Migration plan](#migration-plan)
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

- **Platform:** Desktop app (Tauri), web as a planned future target. UI is
  HTML/React/TypeScript/Tailwind for a minimal migration path.
- **Phase 1 is the static editor.**

### Phase 1 includes

1. Screenshot / image import
2. Canvas with background control
3. Device frame overlay (Mockup)
4. Text layers (heading + body)
5. Basic shapes and annotations
6. Export: static PNG/JPG (watermarked on free tier)
7. Canvas size presets for common destinations
8. Image upload, presets and effects
9. Above as free version

### Phase 1 does NOT include

- Custom fonts (system fonts only)
- Functional website screenshot / tweet import (needs Tauri capture pipeline)
- 3D image rendering effect (prior implementation removed; redesign needed)

### Commands

```bash
npm run dev         # Vite dev server on http://127.0.0.1:5173/
npm run build       # tsc -b && vite build → dist/
npm run lint        # ESLint flat config
npm run typecheck   # tsc -b --noEmit
npm run preview     # serve dist/
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
| Desktop shell | Tauri (deferred) | Rust + WebView; no Electron |
| Persistence | SQLite via `tauri-plugin-sql` (deferred) | `localStorage` forbidden |
| Website/tweet import | Tauri Rust command pipeline (deferred) | Host adapter / invoke boundary |

### Tauri constraints (deferred shell)

- All file system access goes through Tauri Rust commands via `invoke()`.
- IPC pattern: `invoke('command_name', { payload })` → `Result<T, String>`.
- Window config: single window, no default chrome, custom titlebar in React,
  min size 1100×700 px.
- **Web portability:** the entire `src/` directory ports to Tauri without
  changes. No `@tauri-apps/*` import at module top-level anywhere in `src/`.
  All Tauri calls go through a thin adapter (`src/lib/host.ts`) that no-ops
  (or falls back to browser-native behavior) when `window.__TAURI__` is
  undefined.

## 3. Architecture [↑ Go up](#contents)

### Two-layer split

```
React UI (src/)  ← runs in WebView (Tauri) or browser (Vite dev)
      │ Tauri IPC (when shell exists)
Rust shell (src-tauri/)  ← native binary, ~3-5 MB
  - File I/O (open/save .layer)
  - PNG/JPG export + watermark composite
  - SQLite (tauri-plugin-sql)
  - Licence validation
```

When the shell lands, `src-tauri/` joins as a sibling of `src/`. Nothing
inside `src/` moves.

### Repo layout

```
layer/
├── AGENTS.md                  ← project memory
├── implementation.md          ← you are reading this (product spec)
├── learn/                     ← conceptual docs (reference only)
├── src/
│   ├── App.tsx                ← shell + hotkeys + drag/drop
│   ├── main.tsx
│   ├── styles/app.css         ← Tailwind v4 @theme tokens + base + utilities
│   ├── types/                 ← LayerElement union + shared state types
│   │   ├── index.ts
│   │   └── pattern.ts         ← PatternConfig, PatternColorPair, Pro gate map
│   ├── data/
│   │   └── curatedPatternPairs.ts
│   ├── lib/
│   │   ├── utils.ts           ← cn()
│   │   ├── constants.ts       ← CANVAS_SIZES, DEVICE_FRAMES, SYSTEM_FONTS
│   │   ├── importers.ts       ← file → image element
│   │   ├── exporters.ts       ← stage → PNG/JPG/clipboard, .layer save/load
│   │   ├── patterns/          ← SVG tile generators, LRU raster cache, lookups
│   │   └── export/            ← export-time asset prep (pattern tile DPI swap)
│   ├── store/editor.ts        ← Zustand
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
  deviceFrame: DeviceFrame;
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
  text?: string;            // callout text
}
```

- `ShapeKind`: `rect`, `rounded-rect`, `ellipse`, `arrow`, `line`,
  `highlight`, `callout`, `qr-code`, `emoji`, `image`, `pencil`, `number`,
  `icons`, `vector`, `other`.
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
  addShape: (shape: ShapeKind) => string;
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

1. **Solid** — colour picker; defaults to brand purple on first launch.
2. **Gradient** — two-stop linear, angle slider 0–360°, two colour pickers.
3. **Image** — background image with blur slider (0–20px) and opacity slider.

A fourth mode, **pattern**, ships in the current build (beyond the spec's
three): duotone SVG tiles, rasterized and LRU-cached, drawn as a Konva
`fillPatternImage`. See `src/lib/patterns/` and `src/types/pattern.ts`.

```ts
interface BackgroundState {
  mode: 'solid' | 'gradient' | 'image' | 'pattern';
  color: string;
  gradient: { from: string; to: string; angle: number };
  imageSrc: string | null;
  imageBlur: number;
  imageOpacity: number;
  pattern: PatternConfig;
}
```

The store keeps a fully-populated object with a discriminating `mode` field
so toggling modes restores previous values.

- **Gradient:** convert the angle to start/end points on the rect's bounding
  box (CSS-style, 0° = up) and use `fillLinearGradientStartPoint/EndPoint/
  ColorStops`.
- **Image blur:** Konva `Blur` filter requires `node.cache()` after the image
  loads, then `batchDraw()`.

### Device frames

Phase 1 frame library (bundled PNG assets), each with a designer-supplied
screen-area rect in PNG-pixel coordinates (`src/lib/constants.ts`):

| Frame | Asset | Screen area |
|---|---|---|
| MacBook (light) | `macbook-light.png` | ~24px inset top, larger insets sides |
| MacBook (dark) | `macbook-dark.png` | same |
| iPhone 15 (light) | `iphone-light.png` | ~16px inset, rounded corners |
| iPhone 15 (dark) | `iphone-dark.png` | same |
| Browser window (light) | `browser-light.png` | titlebar inset top |
| Browser window (dark) | `browser-dark.png` | same |

```ts
export const DEVICE_FRAMES = [
  { key: 'macbook-light', label: 'MacBook (light)', src: '/frames/macbook-light.png',
    screen: { x: 24, y: 24, w: 920, h: 580, radius: 8 } },
  { key: 'iphone-light',  label: 'iPhone (light)',  src: '/frames/iphone-light.png',
    screen: { x: 14, y: 60, w: 286, h: 596, radius: 48 } },
  // ...
] as const;
```

**Rendering:** the screenshot sits in a `Group` with `clipFunc` (rounded-rect
path matching the scaled screen area); the frame PNG draws on top, occluding
anti-aliasing spill. Frame + screenshot stay locked in one `Group` — dragging
and resizing move both. Load images with `useImage` from `react-konva`.

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
| Rectangle | `<Rect>` | fill, stroke, strokeWidth, cornerRadius |
| Rounded rectangle | `<Rect cornerRadius={N}>` | same node, non-zero radius |
| Circle / ellipse | `<Ellipse radiusX radiusY>` | uniform = circle |
| Line / arrow | `<Arrow points>` | automatic arrowhead |
| Highlight bar | `<Rect opacity={0.4}>` | non-destructive |
| Callout bubble | `<Label>` + `<Tag>` + `<Text>` | Konva ships the geometry |

```ts
interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'rounded-rect' | 'ellipse' | 'arrow' | 'highlight' | 'callout';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  arrowHead?: number;
  dashed?: boolean;
  calloutText?: string;
}
```

Each shape element maps to exactly one Konva node (dispatched in
`ShapeNode.tsx`). **Resize math:** store `width`/`height` for all shapes
(Ellipse converts to radii at render) so one `Transformer` math serves every
element.

## 9. Export [↑ Go up](#contents)

### Static PNG/JPG/WebP

- `stage.toDataURL({ pixelRatio: 2 })` — 2× for retina; the export menu
  offers 1×/2×/3× per export.
- Hide editor chrome (Transformer, grid, snap guides) during capture;
  `withOverlaysHidden` in `src/lib/exporters.ts` is the seam. Any future
  viewport aid belongs in that hide list.

### Watermark

- Free tier composites the Layer logo watermark on every export.
- **Current state (web):** Konva node added to the stage during export and
  removed after. This is bypassable via DevTools — see §11 for the required
  Rust enforcement.

### Browser download

`downloadBlob(blob, filename)` via object URL + `<a download>`;
`dataURLtoBlob` for the conversion.

### Tauri replacement (deferred)

```ts
const path = await save({ defaultPath: `layer-${Date.now()}.png`, filters: [...] });
if (path) {
  await invoke('export_static', { dataUrl: url, path, format, isPro });
  // Rust handles watermark composite + file write
}
```

Rust re-checks `isPro` against its own SQLite licence record — never trusts
the incoming flag.

### Clipboard

`navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])]`.
PNG only (widely); must be called from a user gesture.

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
      "deviceFrame": "macbook-dark",
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

- **Today:** JSON download / upload. Open accepts `.layer` and legacy
  `.laybel` for backward compat; reject unknown versions.
- **Tomorrow (Tauri):** asset files copy into a `project-name.layer-assets/`
  sidecar; the JSON stores relative `src` paths instead of inline base64.
  Open reverses the process.
- **Migrations:** always migrate up, never write old versions — a switch on
  `data.version` in `loadProject`.

## 11. Free vs Pro gate [↑ Go up](#contents)

### Rules

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
    state: tauri::State<'_, AppState>,
    data_url: String,
    path: String,
    format: ExportFormat,
) -> Result<(), String> {
    let raw_png = decode_data_url(&data_url).map_err(|e| e.to_string())?;
    let mut img = image::load_from_memory(&raw_png).map_err(|e| e.to_string())?;
    let is_pro = state.licence.lock().await.is_pro;  // SQLite, not the JS flag
    if !is_pro {
        img = composite_watermark(img);
    }
    let bytes = encode(img, format).map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}
```

Invariants:

- The signature does not accept `is_pro` — no JS path bypasses the check.
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

## 12. Deferred: Tauri shell [↑ Go up](#contents)

**Status: DEFERRED.** `src-tauri/` does not exist yet; `src/` is structured
to migrate without changes. Deferral is product strategy: validate UX on web
first, design IPC contracts in one pass, and ride SQLite + the Rust watermark
gate along with the same plumbing.

### Capability map

| Capability | Web (today) | Tauri (deferred) |
|---|---|---|
| Open file from disk | `<input type="file">` | `plugin-dialog` `open()` |
| Save to disk | browser download | `plugin-dialog` `save()` + `plugin-fs` `writeFile()` |
| Read clipboard image | `navigator.clipboard.read()` | same + native fallback |
| Per-user settings | `localStorage` | `tauri-plugin-store` + SQLite |
| Native dialogs (Save As) | `<a download>` (limited) | OS-native picker |
| Auto-updater | manual ServiceWorker dance | `tauri-plugin-updater` |
| App icon, menu bar, dock badge | none | `tauri.conf.json` + APIs |
| Code signing & notarization | n/a | bundler config |

### IPC rules

- Commands are plain `#[tauri::command]` functions; Tauri serialises JSON
  both ways.
- Return `Result<T, String>` — errors reach JS as rejected promises.
- Long-running work is `async fn`; the WebView thread isn't blocked.
- Progress events: `tauri::Window::emit(...)` +
  `window.__TAURI__.event.listen(...)`.

### Migration plan

1. **Scaffold:** `npm install -D @tauri-apps/cli@latest && npx tauri init`,
   pointing at the Vite dev server (`http://localhost:5173`) and `dist/`.
2. **Dev script:** add `tauri:dev` / `tauri:build`; `npm run dev` stays web.
3. **Runtime SDK:** `@tauri-apps/api`, `plugin-dialog`, `plugin-fs`,
   `plugin-sql`.
4. **Phase 1 commands:** `save_project`, `open_project`, `export_static`
   (sketches in §9/§11/§13).
5. **Thin JS adapter** (`src/lib/host.ts`): use `invoke()` when
   `window.__TAURI__` exists, else fall back to browser behaviour.
   `src/lib/exporters.ts` never imports `@tauri-apps/*` directly.
6. **Window config** (`tauri.conf.json`): single window, title "Layer",
   1280×800, min 1100×700, `decorations: false` — the React `<TopBar>`
   becomes the drag region (`data-tauri-drag-region`).

### Web/Tauri divergence

- Tauri only: native menu bar, auto-updater, desktop drag-and-drop (via
  `tauri-plugin-fs`).
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
(`~/Library/Application Support/com.layer.app/layer.sqlite` on macOS) and
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
- Functional website screenshot / tweet import (Tauri capture pipeline)
- 3D image rendering effect (redesign needed)
- HEIC/HEIF decode, PSD import
- Tests (not yet specced)

### Known follow-ups

- CSS 3D tilt rasterization issue (tilt feature)
- Auto website/tweet screenshot (visible stub; Tauri pipeline planned)
