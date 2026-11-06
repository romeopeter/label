# Layer project memory

> Project memory for Codex. Loaded into every conversation in this
> repo. Keep it terse and current — out-of-date hints here actively
> mislead.

## What is Layer

Layer is a **desktop-first easy-to-use editor** for creating polished and branded marketing banners, product screens and polished visuals. 

- Phase 1 is the static editor.

The product spec lives in [implementation.md](./implementation.md).
**Treat that file as the source of truth.** If a request conflicts with it,
flag it before implementing.

## Current state

- **Web app runs.** Vite + React 18 + TypeScript. `npm run dev` →
  http://127.0.0.1:5173/.
- **Tauri shell runs.** `npm run tauri:dev` opens the native window;
  `npm run dev` stays web-only. Tauri 2 stable, in [src-tauri/](./src-tauri/).
  Everything crosses through [src/lib/host.ts](./src/lib/host.ts).
- **File dialogs live in Rust.** `save_project`, `open_project` and
  `export_static` in [files.rs](./src-tauri/src/files.rs) own the dialog, so the
  webview never supplies a path. Do not add `plugin-fs` or JS dialog permissions.
- **Window config traps.** `dragDropEnabled: false` keeps the HTML5 drop path in
  `App.tsx` alive. `withGlobalTauri: true` is what makes `window.__TAURI__`, and
  so `isTauri`, exist.
- **Window buttons are native on every OS; never draw our own.** macOS uses
  `titleBarStyle: "Overlay"`: traffic lights sit over the TopBar, which reserves
  space via `hasOverlayTitleBar` and is the drag area. Drag regions match the
  exact element clicked, so bare TopBar containers each carry
  `data-tauri-drag-region`. Windows and Linux ignore those settings and show
  the normal OS title bar above the TopBar.
- **Bundle ID is `layer.duowork.tech`.** Desktop only: no mobile targets or
  library outputs.
- **CSP only applies to built apps.** `tauri:dev` loads the Vite server without
  it, so check CSP-sensitive changes with `npx tauri build --debug --no-bundle`.
- **SQLite is still deferred** (see
  [learn/11-sqlite-persistence.md](./learn/11-sqlite-persistence.md)).
- **TypeScript linting is wired.** `npm run lint` runs ESLint flat config.
  It currently passes with React Fast Refresh warnings from multi-export UI
  primitive files.
- **Undo is snapshot-based, in [history.ts](./src/store/history.ts).** A change that
  isn't the user's doing (re-measuring, syncing) must go through `history.silently`,
  or it wipes redo.
- **Marks are drawn, not dropped.** Pick a tool (`markTool`), click or drag on the
  canvas. Every tool hands back to selecting.
  Arrows and lines are `Connector`s defined by their ends, reshaped by `MarkHandles`,
  never a Transformer. Text side handles rewrap; corner handles scale the font. Unframed
  images resize from corners only and never stretch. Tool
  panels and selected layers share `StyleControls`: add a setting there
  once. Polygon outlines must fill their box or resizing drifts. Live resize writes
  to the store per move, so canvas nodes are memoised on their element.
  See `implementation.md` §8.
- **Emoji and icon data.** Emoji and icon lists are generated JSON in
  [src/data/](./src/data/), committed and lazy-loaded with their pickers.
  `FREE_EMOJI_KEY` is for `npm run emoji:sync` only: never read it from `src/`.
  Check `qrcode-generator` at runtime, not by its types: its ESM build lacks the
  `stringToBytesFuncs` the types declare. Layer rows list every element,
  front-most first.
- **Image edits are settings, not pixels.** `ImageElement.edit` is rendered by one shared
  WebGL2 context in [src/lib/imageEdit/](./src/lib/imageEdit/) to a canvas per image via
  `useEditedImage`; Konva and export just read that canvas. Options live in `presets.ts`
  as data. Sampling with a jittered coordinate must use `textureLod`, or mipmaps blur it.
  See `implementation.md` §8.
- **Device frames are generated, and measured.** `npm run devices:sync` renders
  react-mockframe and Devices.css in WebKit to `public/frames/` and
  `src/data/deviceFrames.json`, with each screen area measured from the render. Each
  device comes from one source only; the script fails on a repeat. From Monkr, use only
  its own laptop: its other frames are Apple's bezels or unsourced third-party art. Never type one in by hand. All geometry
  lives in [mockups.ts](./src/lib/mockups.ts). A rounded screen must stay clipped: its
  square corners poke out past a phone's edge. Screens (Tint, Pile and so on) wrap any picture, so they're drawn in `WindowFrame`
  from `SCREEN_LOOKS`. Windows are browsers, drawn in `BrowserFrame` from `BROWSER_LOOKS`,
  with no vendor's logo. Both are our own designs: don't copy artwork from shots.so, whose
  terms reserve its designs and bar scraping. `pictureView` alone decides what a screen
  shows, from fill or fit, zoom and moving. See `implementation.md` §7.
- **Uploads and Images are split.** Uploads is an in-memory asset bucket
  (`uploadedImages` in Zustand). The Images tool adds images to the canvas
  directly and can insert from Uploads.
- **Layouts arrange images; they don't own them.** `CanvasLayout` (`layout` in the
  store, saved in `.layer`) lists which image is in which slot. `settleLayout` in
  [layouts.ts](./src/lib/layouts.ts) is a pure function, and a store subscriber writes
  its result onto those images after any change, so they stay ordinary elements that
  Edit, Shadow and Mockup still work on. Adding a layout is mostly a new `LAYOUTS` entry.
  A slot's trim is `layoutCrop`, never `crop`, which stays the user's: read what an
  image shows through `visibleCrop`. Dragging is `useLayoutDrag`, not Konva's drag: inside
  a slot it moves the picture, over another slot it swaps. Empty slots are an overlay
  hidden from exports; badges, arrows and labels are artwork and do export.
- **Screenshots are of the desktop, not a URL.** `captureScreen` in
  [host.ts](./src/lib/host.ts) gets the whole screen: macOS desktop runs `screencapture`
  on Layer's display from [capture.rs](./src-tauri/src/capture.rs), with the window
  hidden and always restored, and no system picker; everything else uses the
  webview's `getDisplayMedia` picker. `ScreenAreaPicker` then chooses the area inside
  Layer (Capture or Space, Cancel or Esc) and takes every key while open. Both the
  Images and Background panels use it via `ScreenshotButton`.
- **Searches are cached in a file.** `pixabay-searches.json` in the app cache folder,
  until SQLite lands. It holds searches and Pixabay's URLs, never the key.
- **Pixabay's key stays in Rust.** `PIXELBAY_KEY` in `.env` is read by
  [build.rs](./src-tauri/build.rs) and used only in
  [pixabay.rs](./src-tauri/src/pixabay.rs). Never read it from `src/`, give it a
  `VITE_` name, or pass an HTTP client's error text on: it contains the URL, and
  the URL contains the key. The web build has no image search. Results must stay
  cached 24 hours and credit Pixabay (its API terms). A key compiled into a shipped
  app can still be dug out of the binary; only a server would change that.
- **3D panel UI remains, but image 3D rendering is disabled.** The previous
  sliced-image perspective renderer in `ImageNode` was removed because it was
  incorrect. Do not reintroduce that approach.
- **Rust-side export gate is still deferred** — see
  [Deferred Rust Implementations](#deferred-rust-implementations).
- **Background patterns ship as a 4th background mode.** Duotone tiles
  generated as SVG, rasterized and LRU-cached, drawn as a Konva
  `fillPatternImage`. Rotation is applied via `fillPatternRotation` (pattern
  space), *not* baked into the tile — rotating shapes inside a tile clips them
  and seams the repeat. All 29 types are free; `PATTERN_PRO_GATE` remains the
  seam if any need re-gating. Scatter types (grain, starry night, raindrops,
  terrazzo) use a seeded RNG plus `scatterWrapped` so marks straddling a tile
  edge are completed on the opposite side — without it a "random" scatter reads
  as a visible grid. Block types (truchet, half blocks, ribbons, steps at
  `CELLS`; wedge, bowtie, pinwheel, quarters at `BOLD_CELLS`) keep each shape
  inside its own cell, so they are seamless without wrapping. Note a
  half-filled tile repeats into `stripes` at 50%, and its vertical twin is the
  same thing rotated — so straight half-fills are only shipped in composition,
  never alone. The picker is a height-capped scroll strip. Custom colour pairs
  are in-memory only until SQLite lands.

- **Abstract backgrounds are settings, drawn by Layer.** A fifth background mode,
  beyond the spec. `BackdropConfig` saves its four colours as well as the seed, so a
  file looks the same if the generator changes. It's drawn by its own WebGL2 context in
  [src/lib/backdrops/](./src/lib/backdrops/) and drawn again at export scale. Its noise
  hashes with integers: a float hash makes seams on the GPU. Back and Forward walk a
  session-only trail in the store, not undo. See `implementation.md` §7.

- **Layout grid is a viewport aid, not artwork.** It lives in the canvas view
  chrome next to zoom (not the Background panel, whose contents all export),
  renders as its own Konva `Layer` above content, and is hidden at capture time
  by `withOverlaysHidden` in [exporters.ts](./src/lib/exporters.ts). Like
  `zoom`, `grid` is deliberately absent from `toProject()` / `.layer`. Any
  future viewport aid (rulers, safe-area guides) belongs in that same hide list.
  The grid does **not** snap — it is visual only; snapping is a separate system
  (below).

- **Smart guides and snapping are separate from the grid.** The grid is a fixed
  interval that is always on; guides are transient and appear only while
  dragging, only where geometry actually agrees — canvas edges/centre and every
  other element's edges/centres. Geometry lives in
  [snapping.ts](./src/lib/snapping.ts) as pure functions (no Konva, no store).
  Drag is handled **once** on the content `Layer` in `CanvasStage`, not per
  node — Konva bubbles drag events, so one handler covers every element type.
  The Transformer's own drag events bubble there too and must be ignored
  (`isElementNode`), or they snap the Transformer and wipe the guide.
  Candidates are built on `dragstart` and reused, since nothing else moves
  mid-drag. Bounds come from `getClientRect` (so rotated elements align by the
  box you see) with shadow/stroke skipped. The threshold is in *screen* px and
  divides through the stage scale, or the pull feels sticky zoomed out and dead
  zoomed in. `SnapGuides` is driven imperatively through a ref — holding guides
  in the store would re-render every node on every pointer move. Snapping applies
  to moving, drawing marks, resize handles, and line-end and callout-tail handles,
  but not to freehand, curve handles, rotated boxes or multi-selections.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI shell | React 18 + TypeScript | Type-safe element union, hooks ecosystem |
| Bundler | Vite 5 | Fast dev, simple prod build via Rollup |
| Styling | **Tailwind v4 (CSS-first)** + **ShadCN** primitives | Tokens via `@theme` in [src/styles/app.css](./src/styles/app.css); primitives we own in [src/components/ui/](./src/components/ui/) |
| Icons | `lucide-react` | The ShadCN default |
| UI fonts | `@fontsource/*` | Bundled, so they work offline: nothing loads from Google |
| State | Zustand | One store: [src/store/editor.ts](./src/store/editor.ts) |
| Canvas | Konva + `react-konva` | Hit-testing, transform handles, `clipFunc` |
| Desktop shell | **Tauri 2** | Bundle ~3-5 MB vs Electron ~100 MB |
| Persistence | **SQLite via `tauri-plugin-sql`** (deferred) | Spec forbids `localStorage` |
| Website/tweet import | **Tauri Rust command pipeline** | No separate Node service; React calls a host adapter / invoke boundary |

## Repository layout

```
layer/
├── AGENTS.md                  ← you are reading this
├── implementation.md          ← product spec (source of truth)
├── learn/                     ← conceptual docs (start at learn/README.md)
├── scripts/                   ← emoji, icon and device frame generators
├── src-tauri/                 ← Rust shell (commands in src/files.rs)
├── src/
│   ├── App.tsx                ← shell + hotkeys + drag/drop
│   ├── main.tsx
│   ├── styles/app.css         ← Tailwind v4 @theme tokens + base + utilities
│   ├── types/                 ← LayerElement union + shared state types
│   │   ├── index.ts
│   │   └── pattern.ts         ← PatternConfig, PatternColorPair, Pro gate map
│   ├── data/
│   │   ├── curatedPatternPairs.ts
│   │   └── emojis.json, icons.json, deviceFrames.json  ← generated; see scripts/
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
│   │   ├── qr.ts              ← text → QR vector path
│   │   ├── imageEdit/         ← Image edit options, shaders and WebGL renderer
│   │   ├── exporters.ts       ← stage → PNG/JPG/clipboard, .layer save/load
│   │   ├── patterns/          ← SVG tile generators, LRU raster cache, lookups
│   │   ├── backdrops/         ← Abstract backgrounds: palettes, presets, shaders
│   │   └── export/            ← export-time asset prep (pattern tile DPI swap)
│   ├── store/editor.ts        ← Zustand
│   ├── store/history.ts       ← Undo and redo
│   └── components/
│       ├── ui/                ← ShadCN primitives (button, dialog, slider, …)
│       ├── canvas/            ← Konva nodes (Stage, Image, Text, Shape, Background)
│       └── panels/            ← Right-rail panels + shared primitives
├── components.json            ← ShadCN config (style: new-york)
├── vite.config.ts             ← Vite + @tailwindcss/vite + @/ alias
├── tsconfig.json
└── package.json
```

## Commands

```bash
npm run dev         # Vite dev server on http://127.0.0.1:5173/
npm run build       # tsc -b && vite build → dist/
npm run lint        # ESLint flat config for TS/React
npm run typecheck   # tsc -b --noEmit
npm test            # Playwright UI tests (first time: npx playwright install webkit)
npm run preview     # serve dist/ for smoke-testing the prod build
npm run tauri:dev   # native window + Vite hot reload
npm run tauri:build # bundle the desktop app
npm run emoji:sync  # regenerate emoji data (needs FREE_EMOJI_KEY in .env)
npm run icons:sync  # regenerate icon data from lucide-static
npm run devices:sync # regenerate device frames from their sources

# from src-tauri/
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features
```

`npm test` runs the Playwright suite in [tests/](./tests/) in WebKit, on its own
port, so it's safe alongside `tauri:dev`. `@playwright/test` is pinned because newer
WebKit builds crash on macOS 14. The desktop shell is faked there (`fakeShell`), so
real capture and real Pixabay calls aren't covered: `cargo test -- --ignored
real_pixabay` does the latter, and the macOS picker needs trying by hand.

## Conventions

### Imports
- `@/` resolves to `src/` (configured in [vite.config.ts](./vite.config.ts)
  and [tsconfig.json](./tsconfig.json)). Use it instead of `../../../`.
- Named exports only; no default exports.

### Styling
- **All tokens live in `@theme`** inside
  [src/styles/app.css](./src/styles/app.css). Never define brand colors
  or fonts elsewhere.
- Components style themselves with Tailwind utilities + `cn()`.
- ShadCN primitives go in [src/components/ui/](./src/components/ui/) and
  use `cva()` for variants.
- Push composites that don't read as utility chains (pseudo-elements,
  clip-paths, multi-stop gradients) into `@layer utilities` in
  [src/styles/app.css](./src/styles/app.css). Don't pile inline `style={}`
  for things that recur.
- **Presets and options select the same way: `choiceClass(selected)`** from
  [choice.ts](./src/components/panels/choice.ts), the accent border the 3D presets use.
  Don't give a new tile its own hover or selected colours.
- **Never write `border-t-400` for the teal border colour.** Tailwind parses it
  as `border-top-width: 400px`, because `border-t-<number>` is a width utility
  and wins over the `t-400` colour name. Use `border-primary` (aliased to
  `t-400`). The same trap applies to any `border-{t,r,b,l}-<number>` token.

### Design adherence — strict, no deviation
- **Tokens, primitives, and existing panel patterns are the entire visual
  vocabulary.** Use only `@theme` tokens / `@layer utilities` from
  [src/styles/app.css](./src/styles/app.css), ShadCN primitives from
  [src/components/ui/](./src/components/ui/), and class patterns already
  established in `src/components/panels/`. Never invent colours, fonts, spacing, radii, or shadows outside the system — no hardcoded hexes,
  no default Tailwind palette (`blue-400`, `gray-500`, …), no pixel-copied
  values from elsewhere.
- **If the system lacks what the task needs, extend the system — don't
  hardcode around it.** Add the token/utility to `@theme` / `@layer
  utilities` in [src/styles/app.css](./src/styles/app.css) first, then
  consume it. One-off inline values are a last resort and only for truly
  dynamic geometry (e.g. a data-driven offset), never for colour or type.
- **Provided samples (screenshots, mockups, uploads) are NOT UI direction.**
  They convey behaviour and layout intent only (what controls exist, what a
  preset communicates). Never copy their colours, styling, or pixels.
  Extract the intent, then replicate it strictly with project tokens and
  existing panel patterns.
- **When replicating an existing panel's pattern, match its implementation
  exactly** — same class names, sizes, grid, and states — rather than
  inventing a parallel version. If the pattern can't express the task, say
  so before writing code.
- **When a sample is provided, confirm the interpretation before
  implementing:** state what the sample shows, how it maps to project
  tokens/patterns, and what (if anything) needs a new token.

### Design, text & copy — UX is a first-class consideration
- **Labels, titles, descriptions, and empty states are UX, not decoration.**
  Prefer short, plain words users already know (`Mark` over `Annotation`,
  `Corner` over `Border`) over technically precise terms.
- Keep panel titles and rail labels consistent with each other — a tool and
  its panel must use the same word.
- Descriptions answer "what happens if I touch this?" in one line. Empty
  states tell the user what to do next, not what the feature is called.

### State
- One Zustand store: [src/store/editor.ts](./src/store/editor.ts).
- `elements` are canvas elements only. `uploadedImages` is the app-memory
  asset bucket used by Uploads and Images panels; do not mix uploaded assets
  with canvas elements.
- Subscribe to the minimum field a component needs (separate `useEditor(s
  => s.x)` calls beat object selectors). See
  [learn/04-zustand-state.md](./learn/04-zustand-state.md).
- Treat the store as immutable — always return new arrays/objects from
  `set()`.

### Canvas
- One Konva `Stage` lives in
  [src/components/canvas/CanvasStage.tsx](./src/components/canvas/CanvasStage.tsx).
- Each store element renders to exactly one Konva node — dispatch on
  `element.type` and `element.shape`.
- Device frame + screenshot stay locked together via a Konva `Group`. The
  screenshot is clipped to the frame's rounded screen via `clipFunc`. See
  [learn/07-backgrounds-and-device-frames.md](./learn/07-backgrounds-and-device-frames.md).

### Adding a new element type
1. Extend the union in [src/types/index.ts](./src/types/index.ts).
2. Add the store action in [src/store/editor.ts](./src/store/editor.ts).
3. Add the Konva renderer under [src/components/canvas/](./src/components/canvas/).
4. Add the dispatch case in `CanvasStage.tsx`.
5. Wire a panel in [src/components/panels/](./src/components/panels/).

### Working with the Tauri shell
Background: [learn/10-tauri-shell.md](./learn/10-tauri-shell.md). The
contract is that **everything in `src/` keeps working in the browser** —
Tauri calls go through a thin adapter (`src/lib/host.ts`) that falls back on
web. Do not add `import { invoke } from '@tauri-apps/api/core'` at module
top-level anywhere in `src/`.

Website screenshot and tweet import belong behind that same host adapter:
React should call methods such as `captureWebsite()` and `captureTweet()`,
which invoke Tauri commands such as `capture_website` and `capture_tweet`
when the shell exists. The Rust side owns URL validation, network access,
rendering/capture, timeout handling, and returning an image payload usable by
the existing canvas image import path. Do not add a companion Node process,
Express server, Vite proxy, or Playwright Node runtime as the expected product
architecture.

## What's done

Phase 1 success criteria (from the spec):
- ✅ Import a screenshot (PNG/JPG) — drag, picker, paste
- ✅ Uploads panel stores reusable image assets in Zustand memory
- ✅ Images tool can add new images to the canvas and insert from Uploads
- ✅ Device frame that clips and follows the screenshot
- ✅ Solid / gradient / image background with blur+opacity
- ➕ Pattern background (beyond the spec's three modes — see scope note below)
- ➕ Abstract background: Soft, Waves, Streaks, Glow, Glass, Aurora, Silk and Marble,
  with presets, Shuffle, and Blur, Frost and Grain
- ✅ Heading and body text with double-click in-place edit
- ✅ Shape library: rect, rounded, ellipse, arrow, highlight, callout
- ➕ Layouts: 14 arrangements that place several images on one canvas
- ➕ Drawn shapes, arrows, lines, callouts, highlighter, freehand; emoji, icons,
  QR code, number, badge; layer lock/hide/reorder for every element
- ✅ Export PNG/JPG/WebP at @2× (web download today)
- ✅ `.layer` JSON save / open
- ✅ Watermark composited (today in JS — Phase-1 Pro-gate caveat above)

**Scope note on patterns.** [implementation-phase1.md](./implementation-phase1.md)
specifies exactly three background modes (solid, gradient, image). The pattern
mode was added on top of that by explicit request. It's additive — the three
spec'd modes are untouched — but it is beyond Phase 1 as written, so treat the
spec as still authoritative for everything else.

## What's deliberately not done

| Item | Why | When |
|---|---|---|
| SQLite (`tauri-plugin-sql`) | Needs Tauri | With shell |
| Rust-side export gate | Needs Tauri | With shell |
| Custom fonts upload | Phase 2 (system fonts only in Phase 1) | Phase 2 |
| Brand kits | Phase 2 | Phase 2 |
| Website-by-URL capture / tweet import | Needs Tauri capture pipeline | With shell |
| 3D image rendering effect | Prior implementation removed | Redesign needed |
| Persisted custom pattern colour pairs | Needs SQLite | With shell |
| Brand-derived pattern colour pairs | Needs the Phase-2 brand store | With brand kits |

## Future additions

Ideas agreed for later. Not started, so check with the user before building one.

- **Layout: divider line.** A line between before and after images, in a style you can
  change.
- **Layout: overlap controls.** How far images overlap, and which one sits in front.
- **Layout: tilt.** Tilts all images together, using the existing 3D tilt.
- **Layout: per-slot backgrounds.** A colour or gradient behind each image, which helps
  comparison posts.
- **Layout: canvas size suggestions.** For example, a wide canvas for side by side and a
  tall one for stacked.

Left out on purpose: a custom layout builder, grids beyond 3×3, and automatic layout choice.

## Deferred Rust Implementations

Track here any Rust-side work (feature gating, validation, export-pipeline
enforcement, etc.) that was intentionally skipped when a feature shipped, so it
isn't lost. Each entry should say what's deferred, why, and what the gap is in
the meantime.

- **Watermark / export Pro gate** (Phase 1)
  - Deferred: the export gate lives in Rust in the plan; today the watermark
    composite is done in JS.
  - Current state: the store hard-codes `isPro: false`, so the watermark always
    renders.
  - Gap: the JS composite is bypassable by anyone editing the running app.
  - To implement: move the composite behind a Tauri export command. See
    [learn/12-free-vs-pro-gate.md](./learn/12-free-vs-pro-gate.md).

> Pattern type Pro gating was previously listed here. It was dropped on
> 2026-08-16 when all pattern types were made free — with nothing gated there
> is no gap to enforce, so `validate_pattern_config` / `pattern_gate.rs` are no
> longer pending work. If any type is re-gated (flip its entry in
> `PATTERN_PRO_GATE`), add the Rust-side entry back here at the same time.

- **Custom pattern colour pair persistence** (background pattern system, added 2026-08-16)
  - Deferred: the `custom_pattern_color_pairs` SQLite table and its migration.
    The brief specified SQLite, but there is no `src-tauri/` yet and the spec
    forbids `localStorage`, so there is nowhere durable to put them.
  - Current state: custom pairs live in `customPatternPairs` in the Zustand
    store, the same in-memory bucket pattern as `uploadedImages`.
  - Gap: custom pairs are lost on reload and don't follow the user across
    projects. `.layer` files store only the `colorPairId`, so a project
    referencing a custom pair falls back to a curated pair on another install.
  - To implement: add the migration and a host-adapter read/write, keeping
    pairs local to the install (no brand-kit export, no sync).

## When in doubt

- **For UI conventions:** look at the design HTML extract in `design.html` (the original spec's visual reference) and the existing components.
- **Skills:** engineering rules live in [.agents-skills/](./.agents-skills/).
  For Rust, always apply `rust-core`, `rust-error-handling` and `rust-security`,
  then the rest by task per [its README](./.agents-skills/RUST/README.md). For
  React, [JS/REACT](./.agents-skills/JS/REACT/SKILLS.md). Project conventions
  and this spec win over them.
- **For "why X?" questions:** check [implementation.md](./implementation.md),
  then [learn/](./learn/), starting at [learn/README.md](./learn/README.md).
- **For scope questions:** check [implementation.md](./implementation.md).
- **If you're tempted to add a feature that isn't in Phase 1:** stop and
  ask. The spec is explicit about scope; over-shipping creates support
  debt.
