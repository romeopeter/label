# Laybel — Phase 1

Desktop-first branded graphics editor (Brandbird parity). This repo currently
ships the **Phase 1** scope from [implementation-phase1.md](implementation-phase1.md):
static canvas, image import + device frames, text, shapes, background, watermark,
PNG/JPG/WebP export, and `.laybel` project save/load.

The Tauri shell (Rust + WebView) is **deferred** — the React app is structured
so `src/` ports into a Tauri app without changes. To wrap it later, run
`npm install -D @tauri-apps/cli` and `npx tauri init`; replace
`exporters.ts` file writes with `invoke('save_file', …)` calls.

---

## Stack

- **React 18 + TypeScript** — UI
- **Vite** — dev server + build
- **Konva** (`react-konva`) — canvas, drag/resize/transform, export
- **Zustand** — in-memory editor state
- **`.laybel` project** — JSON download/upload for Phase 1; SQLite persistence in Phase 2

Design tokens, layout CSS, and visual fidelity are imported verbatim from
[`src/styles/app.css`](src/styles/app.css) (copied from the design's `app.css`).

---

## Run it

```sh
npm install
npm run dev      # http://127.0.0.1:5173
```

Other commands:

```sh
npm run typecheck
npm run build
npm run preview
```

---

## Phase 1 features implemented

| Spec item                                    | Where                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| Image import (file picker, drag-drop, ⌘V)    | [Uploads panel](src/components/panels/UploadsPanel.tsx), [App.tsx](src/App.tsx#L65-L80) |
| Canvas size presets + custom W/H             | [CanvasSizePicker](src/components/CanvasSizePicker.tsx)                     |
| Background: solid / gradient / image + blur  | [BackgroundPanel](src/components/panels/BackgroundPanel.tsx), [Background.tsx](src/components/canvas/Background.tsx) |
| Device frame overlay (clips screenshot)      | [MockupPanel](src/components/panels/MockupPanel.tsx), [ImageNode.tsx](src/components/canvas/ImageNode.tsx) |
| Heading + body text, in-place edit (dbl-click)| [HeaderPanel](src/components/panels/HeaderPanel.tsx), [TextNode.tsx](src/components/canvas/TextNode.tsx) |
| Shapes: rect, rounded-rect, ellipse, arrow, highlight, callout | [AnnotationPanel](src/components/panels/AnnotationPanel.tsx), [ShapeNode.tsx](src/components/canvas/ShapeNode.tsx) |
| Position / scale / rotate / opacity          | [PositionPanel](src/components/panels/PositionPanel.tsx) + Konva Transformer |
| Element shadow + border (incl. corner radius)| [ShadowPanel](src/components/panels/ShadowPanel.tsx) · [BorderPanel](src/components/panels/BorderPanel.tsx) |
| Watermark (free tier)                        | [WatermarkPanel](src/components/panels/WatermarkPanel.tsx) + composited in [CanvasStage.tsx](src/components/canvas/CanvasStage.tsx) |
| Export PNG / JPG / WebP @ 2× (default)       | [ExportMenu](src/components/ExportMenu.tsx) · [exporters.ts](src/lib/exporters.ts) |
| Copy to clipboard                            | [exporters.ts:copyCanvasToClipboard](src/lib/exporters.ts)                  |
| `.laybel` save / open                        | [exporters.ts](src/lib/exporters.ts) · [importers.ts](src/lib/importers.ts) |
| Social preview modal                         | [SocialPreviewModal](src/components/SocialPreviewModal.tsx)                 |
| Customize sidebar (hide tools)               | [CustomizeSidebarModal](src/components/CustomizeSidebarModal.tsx)           |
| Keyboard: ⌘E export, ⌘C copy, ⌫ delete, esc | [App.tsx](src/App.tsx)                                                      |

Tools rendered as visual stubs (Phase 2): AI, Templates, Images library, 3D, Layout, Brands, Motion.

---

## Pro gate

`isPro: false` is hard-coded in [the store](src/store/editor.ts). The watermark
is composited on the Konva stage; in Phase 2 export will move into a Rust
command so the watermark cannot be bypassed by patching JS.

---

## Layout

```
src/
├── App.tsx                       app shell + hotkeys + drag-drop
├── main.tsx                      React entry
├── components/
│   ├── TopBar.tsx                logo, undo/redo, size picker, export, sign-in
│   ├── LeftRail.tsx              16 tool buttons + customize
│   ├── CanvasSizePicker.tsx      platform-grouped size dropdown
│   ├── ExportMenu.tsx            export formats + scale + save/open project
│   ├── SocialPreviewModal.tsx    LinkedIn-style preview modal
│   ├── CustomizeSidebarModal.tsx hide/show rail tools
│   ├── canvas/
│   │   ├── CanvasStage.tsx       Konva Stage + fit-zoom + transformer + paste
│   │   ├── Background.tsx        solid / gradient / image+blur
│   │   ├── ImageNode.tsx         screenshot + device frame + clip
│   │   ├── TextNode.tsx          editable text (overlay textarea on dbl-click)
│   │   └── ShapeNode.tsx         rect, ellipse, arrow, callout, highlight
│   ├── panels/                   each rail tool's right-panel UI
│   └── icons/                    all SVG icons from the design
├── store/editor.ts               Zustand store (canvas, elements, selection, IO)
├── lib/
│   ├── constants.ts              canvas sizes, device frames, fonts
│   ├── importers.ts              image + .laybel project loading
│   └── exporters.ts              PNG/JPG/WebP/clipboard/.laybel saving
├── types/index.ts                LaybelElement / Project / Background types
└── styles/app.css                full design CSS (copied from the design artifact)
```

---

## Phase 2 hooks

When wrapping in Tauri:

1. `exporters.ts` → replace `downloadBlob` with `invoke('save_file', { data, path })`.
2. Add `tauri-plugin-sql` and move `useEditor.toProject()` / `loadProject()` into SQLite-backed CRUD.
3. Replace `<input type="file">` with `dialog.open()`.
4. Add `tauri-plugin-shell` to bundle ffmpeg/gifski for MP4/GIF export (deferred Phase 2 work).
