import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** Reaches the running app's own modules through Vite. */
export const openApp = async (page: Page, tool?: string) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForSelector("canvas");
  await page.evaluate(`(async () => {
    window.S = (await import("/src/store/editor.ts")).useEditor;
    window.ST = (await import("/src/components/canvas/stageRef.ts")).getStage;
    window.R = await import("/src/lib/imageEdit/renderer.ts");
    window.P = await import("/src/lib/imageEdit/presets.ts");
    window.X = await import("/src/lib/exporters.ts");
  })()`);
  if (tool) await page.getByRole("button", { name: tool, exact: true }).click();
  return errors;
};

/** Puts a two-tone 800×400 image on the canvas at a known place, selected. */
export const addTwoToneImage = (page: Page, edit?: unknown): Promise<string> =>
  page.evaluate(`(async () => {
    const c = document.createElement("canvas");
    c.width = 800; c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "rgb(29,158,117)"; g.fillRect(0, 0, 400, 400);
    g.fillStyle = "rgb(200,200,200)"; g.fillRect(400, 0, 400, 400);
    const s = S.getState();
    const id = s.addImage(c.toDataURL(), 800, 400);
    s.updateElement(id, { x: 200, y: 200, width: 800, height: 400, edit: ${JSON.stringify(edit ?? null)} ?? undefined });
    s.selectElement(id);
    await new Promise((r) => setTimeout(r, 300));
    return id;
  })()`);

export const element = <T = Record<string, never>>(page: Page, id: string): Promise<T> =>
  page.evaluate(`S.getState().elements.find((e) => e.id === ${JSON.stringify(id)})`);

export const elementCount = (page: Page): Promise<number> =>
  page.evaluate(`S.getState().elements.length`);

/** A pixel of the picture Konva is drawing for this image, in its own coordinates. */
export const picturePixel = (page: Page, id: string, x: number, y: number): Promise<number[]> =>
  page.evaluate(`(() => {
    const image = ST().findOne("#" + ${JSON.stringify(id)}).findOne("Image").image();
    let source = image;
    if (!(image instanceof HTMLCanvasElement)) {
      source = document.createElement("canvas");
      source.width = image.naturalWidth; source.height = image.naturalHeight;
      source.getContext("2d").drawImage(image, 0, 0);
    }
    return [...source.getContext("2d").getImageData(${x}, ${y}, 1, 1).data];
  })()`);

export const expectNear = (actual: number[], want: number[], within = 3) => {
  want.forEach((value, i) => {
    expect(Math.abs(actual[i] - value), `${actual} should be near ${want}`).toBeLessThanOrEqual(within);
  });
};

/** Screen position of a point in canvas coordinates. */
export const toScreen = async (page: Page, x: number, y: number) => {
  const box = await page.locator(".canvas-artboard canvas").first().boundingBox();
  const scale: number = await page.evaluate(`ST().scaleX()`);
  if (!box) throw new Error("Canvas isn't on screen");
  return { x: box.x + x * scale, y: box.y + y * scale };
};

/** Drags with real pointer events, between canvas coordinates. */
export const dragOnCanvas = async (
  page: Page,
  from: [number, number],
  to: [number, number],
) => {
  const start = await toScreen(page, ...from);
  const end = await toScreen(page, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
};

/** Screen position of a Transformer handle, such as "bottom-right". */
export const handle = async (page: Page, name: string) => {
  const box = await page.locator(".canvas-artboard canvas").first().boundingBox();
  const at: { x: number; y: number } = await page.evaluate(
    // Whichever is in use: crop mode has its own, on top.
    `ST().find("Transformer").filter((t) => t.nodes().length).pop().findOne("." + ${JSON.stringify(name)}).getAbsolutePosition()`,
  );
  if (!box) throw new Error("Canvas isn't on screen");
  return { x: box.x + at.x, y: box.y + at.y };
};

export const dragBy = async (
  page: Page,
  from: { x: number; y: number },
  by: { x: number; y: number },
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
};

export const PNG_2X2 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8Dwn4GBgYGJgYGBAQAOBQEBa0sVlQAAAABJRU5ErkJggg==";

/** A solid image file, for real file pickers. Pixels here are 83,74,183. */
export const solidPng = (): { name: string; mimeType: string; buffer: Buffer } => ({
  name: "second.png",
  mimeType: "image/png",
  buffer: readFileSync(new URL("./fixtures/solid.png", import.meta.url)),
});

/**
 * Stands in for the desktop shell, so the real UI code runs its desktop path.
 * `handlers` is source for a function of (command, args) run in the page.
 */
export const fakeShell = (page: Page, handlers: string) =>
  page.addInitScript(`
    window.__TAURI__ = {};
    window.CALLS = [];
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (command, args) => {
        window.CALLS.push([command, args]);
        return (${handlers})(command, args);
      },
    };
  `);

export const shellCalls = (page: Page, command: string): Promise<Record<string, unknown>[]> =>
  page.evaluate(`CALLS.filter((c) => c[0] === ${JSON.stringify(command)}).map((c) => c[1])`);
