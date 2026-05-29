---

## Product implementation context

Laybel is a desktop-first branded graphics editor for founders, content creators, and marketing teams. It does what Brandbird does — turning screenshots/images and assets into polished branded visuals — and exported as static image.

**Platform:** Desktop app (Tauri), with web as a planned future target. The UI is built in HTML/React,Typescript,Tailwind so the migration path is minimal.

---

## Tech stack

### Shell — Tauri (Rust + WebView)

Use Tauri as the native desktop shell. Do not use Electron.

- Tauri's WebView renders the React UI natively — the app bundle is ~3–5MB vs Electron's ~100MB
- All file system access (reading uploaded images, writing export files) goes through Tauri's Rust commands via `invoke()`
- IPC pattern: React calls `invoke('command_name', { payload })`, Rust handler returns result
- Window config: single window, no default chrome, custom titlebar in React, min size 1100×700px
- The WebView is the full app surface — treat it like a browser environment

```
src-tauri/         ← Rust shell (Tauri config, file I/O commands, FFmpeg calls)
src/               ← React app (canvas, panels, animation engine, export UI)
```

When ready to ship web, the entire `src/` directory ports without changes.

### UI framework — React + Konva.js

- **React 18** for the app shell, panels, toolbars, and all UI outside the canvas
- **Konva.js** (`react-konva`) for the canvas layer — handles element selection, drag-to-move, resize handles, transform controls, and z-ordering natively
- Konva's `Stage > Layer > Group > Shape` model maps directly onto Laybel's element hierarchy
- Each element on the canvas (image, text, shape, icon) is a Konva node with a corresponding React state object
- State shape per element:

```ts
type LaybelElement = {
  id: string
  type: 'image' | 'text' | 'shape' | 'icon'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // element-specific props (fill, fontSize, src, etc.)
  animation: AnimationConfig   // see Animation engine section
}
```

### State management — Zustand + SQLite

- **Zustand** for all in-memory canvas and UI state (selected element, active tool, panel open/closed, preview playing)
- **SQLite** (via Tauri's `tauri-plugin-sql`) for persisted data: projects, brand kits, asset library, recent files
- Do not use localStorage — all persistence goes through SQLite via Tauri IPC
- Store shape:

```ts
// Zustand canvas store
{
  elements: LaybelElement[]
  selectedIds: string[]
  canvasSize: { width: number; height: number }
  brandKit: BrandKit | null
  isPreviewPlaying: boolean
  // actions: addElement, updateElement, deleteElement, selectElement, etc.
}
```

### Rendering and export — FFmpeg + gifski

All export happens in the Tauri Rust layer. The React canvas sends frame data; Rust assembles the output.

- **Static PNG/JPG:** `stage.toDataURL('image/png')` → Tauri file write. Simple, no Rust processing needed

Tauri command pattern for export:

```rust
#[tauri::command]
async fn export_mp4(frames_dir: String, output_path: String, fps: u32) -> Result<(), String> {
    // shell out to bundled ffmpeg binary
}
```

---

## Phase 1 — Brandbird parity

Phase 1 ships the static canvas with. It proves the core loop, drives free signups, and watermark acts as organic distribution.

**Target:** Shippable v0.1.

### What Phase 1 includes

1. Screenshot / image import
2. Canvas with background control
3. Device frame overlay
4. Text layers (heading + body)
5. Basic shapes and annotations
6. Export: static PNG/JPG (watermarked on free tier)
8. Canvas size presets for common destinations

### What Phase 1 does NOT include

- Brand motion kit (Phase 2)
- MP4 export (Phase 2, behind paid gate)
- Lottie export (Phase 3)
- Per-element animation timeline and manual override
- Custom fonts (system fonts only in Phase 1)

---

#### Canvas size presets

```ts
const CANVAS_SIZES = {
  'LinkedIn post':     { width: 1200, height: 628 },
  'Twitter / X card':  { width: 1200, height: 675 },
  'Instagram square':  { width: 1080, height: 1080 },
  'Instagram story':   { width: 1080, height: 1920 },
  'Custom':            { width: 800,  height: 600 },
}
```

---

### Image import

- Accept: PNG, JPG, WebP via drag-and-drop onto canvas or file picker (Tauri `dialog.open()`)
- On import: auto-centre on canvas, add 10% padding relative to canvas edge
- Screenshot detection heuristic: if image width/height ratio matches a common screen ratio (16:9, 16:10, 4:3) and resolution is ≥ 1280px wide, offer "Apply device frame" automatically
- Images stored as Konva `Image` nodes; src held in Zustand as object URL from Tauri-read file bytes

### Background control

Three background modes, toggled in the right panel when no element is selected:

1. **Solid colour** — colour picker, defaults to a gradient of the brand primary on first launch
2. **Gradient** — two-stop linear gradient, angle slider (0–360°), two colour pickers
3. **Image** — upload a background image, with blur slider (0–20px) and opacity slider

Implement background as a dedicated Konva `Rect` at z-index 0, always locked (non-selectable by user click).

### Device frame overlay

A Konva `Image` node rendered above the screenshot but below text/shape layers.

Phase 1 device frames (PNG assets bundled in app):
- MacBook (light bezel)
- MacBook (dark bezel)
- iPhone 15 (light)
- iPhone 15 (dark)
- Browser window (light)
- Browser window (dark)

The user's screenshot is clipped to the device's screen area using a Konva `clipFunc`. Frame position and scale are locked relative to the screenshot — they move together.

### Text layers

Two text types: **Heading** and **Body**. Both are Konva `Text` nodes.

Phase 1 font stack: system fonts only — Inter, SF Pro (macOS), Segoe UI (Windows), plus a monospace option (JetBrains Mono bundled).

Right panel text controls:
- Font family (dropdown, system fonts)
- Font size (number input + stepper)
- Font weight (Regular / Medium / Bold)
- Colour (colour picker)
- Alignment (left / centre / right)
- Letter spacing (slider, -2 to +10)
- Line height (slider, 1.0 to 2.0)

Text editing: double-click a Konva `Text` node enters edit mode using an overlaid HTML `<textarea>` positioned to match the Konva node's canvas coordinates. On blur, sync text back to Konva.

### Shapes and annotations

Phase 1 shape library:

| Shape | Konva primitive |
|---|---|
| Rectangle | `Rect` |
| Rounded rectangle | `Rect` with `cornerRadius` |
| Circle / ellipse | `Ellipse` |
| Line / arrow | `Arrow` |
| Highlight bar | `Rect` with opacity |
| Callout bubble | `Label` + `Tag` |

Each shape exposes fill colour, stroke colour, stroke width, opacity, corner radius (where applicable).

Arrows expose: arrow head size, stroke width, dashed/solid toggle

### Export — Phase 1

#### Static PNG/JPG

```ts
// In React
const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 }) // @2x for retina
await invoke('save_file', { data: dataURL, path: outputPath, format: 'png' })
```

---

### File format — `.laybel` project file

Projects saved as JSON with `.laybel` extension, written to user's Documents folder via Tauri.

```json
{
  "version": 1,
  "canvas": { "width": 1200, "height": 628 },
  "background": { "mode": "gradient", "stops": ["#1C1F3B", "#2563EB"], "angle": 135 },
  "elements": [
    {
      "id": "el_01",
      "type": "image",
      "x": 120, "y": 80, "width": 960, "height": 480,
      "src": "assets/screenshot.png",
      "deviceFrame": "macbook-dark",
      "animation": {
        "entrance": { "type": "fade", "duration": 0.6, "delay": 0, "ease": "power2.out" }
      }
    }
  ],
  "animationPreset": "smooth-reveal",
  "brandKitId": null
}
```

Asset files (images) are copied into a `project-name.laybel-assets/` folder alongside the `.laybel` file.

---

### Free vs Pro gate — Phase 1 implementation

In Phase 1, Everything else is fully available on free.

However, the gate shoulf be enforced in the Rust export command — the React UI passes `isPro: boolean` from the user's licence state. On free tier, the watermark composite is applied server-side (Rust), not in the browser, so it cannot be bypassed by a user patching JS.

Licence state is stored in SQLite as a simple flag. Phase 2 will introduce Paddle/Lemon Squeezy licence key validation.

For Phase 1, ship with a hardcoded `isPro: false` and a non-functional "Upgrade" button that opens a coming-soon email capture modal.

---

### Phase 1 success criteria

- [ ] User can import a screenshot (PNG/JPG) and place it on canvas
- [ ] User can add a device frame that clips and follows the screenshot
- [ ] User can set a solid, gradient, or image background
- [ ] User can add heading and body text, edit in-place
- [ ] User can add shape types and annotations
- [ ] User can export static PNG/WebP/JPG at @2x
- [ ] Projects save and reopen correctly as `.laybel` files