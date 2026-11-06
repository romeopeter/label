import { expect, test, type Page } from "@playwright/test";
import {
  addTwoToneImage,
  dragBy,
  dragOnCanvas,
  element,
  elementCount,
  handle,
  openApp,
  toScreen,
} from "./helpers";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: string;
  type?: string;
  fontSize?: number;
  crop?: { x: number; y: number; width: number; height: number };
}

const setTool = (page: Page, tool: unknown) =>
  page.evaluate(`S.getState().setMarkTool(${JSON.stringify(tool)})`);
const last = (page: Page): Promise<Box> =>
  page.evaluate(`S.getState().elements[S.getState().elements.length - 1]`);
const markTool = (page: Page) => page.evaluate(`S.getState().markTool`);

test.describe("marks are drawn", () => {
  const drawn: [string, unknown][] = [
    ["rectangle", { kind: "box", shape: "rect" }],
    ["ellipse", { kind: "box", shape: "ellipse" }],
    ["callout", { kind: "box", shape: "callout" }],
    ["arrow", { kind: "connector", shape: "arrow" }],
    ["line", { kind: "connector", shape: "line" }],
    ["highlight", { kind: "stroke", shape: "highlight" }],
    ["pencil", { kind: "stroke", shape: "pencil" }],
  ];

  for (const [name, tool] of drawn) {
    test(`${name}: a drag makes one, then it's back to selecting`, async ({ page }) => {
      const errors = await openApp(page, "Mark");
      await setTool(page, tool);
      await dragOnCanvas(page, [400, 300], [900, 600]);

      expect(await elementCount(page)).toBe(1);
      expect(await markTool(page)).toBeNull();
      const mark = await last(page);
      expect(Math.max(mark.width ?? 0, mark.height ?? 0)).toBeGreaterThan(100);
      expect(errors).toEqual([]);
    });
  }

  test("the tool panel's style is used for what's drawn next", async ({ page }) => {
    await openApp(page, "Mark");
    await page.evaluate(`(() => {
      const s = S.getState();
      s.setMarkTool({ kind: "box", shape: "rect" });
    })()`);
    await dragOnCanvas(page, [400, 300], [700, 500]);
    const first = await last(page);
    expect(first.shape).toBe("rect");
  });
});

test("undo and redo step through a drawn mark and a move", async ({ page }) => {
  await openApp(page, "Mark");
  await setTool(page, { kind: "box", shape: "rect" });
  await dragOnCanvas(page, [400, 300], [800, 600]);
  const placed = await last(page);

  await dragOnCanvas(page, [600, 450], [1000, 700]);
  const moved = await last(page);
  expect(moved.x).toBeGreaterThan(placed.x + 100);

  await page.evaluate(`S.getState().undo()`);
  expect((await last(page)).x).toBeCloseTo(placed.x, 0);
  await page.evaluate(`S.getState().undo()`);
  expect(await elementCount(page)).toBe(0);
  await page.evaluate(`S.getState().redo()`);
  expect(await elementCount(page)).toBe(1);
  await page.evaluate(`S.getState().redo()`);
  expect((await last(page)).x).toBeCloseTo(moved.x, 0);
});

test("re-measuring doesn't wipe redo", async ({ page }) => {
  await openApp(page);
  const id = await page.evaluate<string>(`S.getState().addText("heading")`);
  await page.waitForTimeout(100);
  await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { x: 500 })`);
  await page.waitForTimeout(100);
  await page.evaluate(`S.getState().undo()`);
  await page.evaluate(`S.getState().measureElement(${JSON.stringify(id)}, 123)`);
  await page.evaluate(`S.getState().redo()`);
  expect((await element<Box>(page, id)).x).toBe(500);
});

test.describe("resizing", () => {
  test("an image from a corner keeps its shape, and has no side handles", async ({ page }) => {
    await openApp(page);
    const id = await addTwoToneImage(page);
    await expect
      .poll(() => page.evaluate(`ST().findOne("Transformer").nodes().length`))
      .toBe(1);
    await dragBy(page, await handle(page, "bottom-right"), { x: -120, y: -20 });

    const resized = await element<Box>(page, id);
    expect(resized.width).toBeLessThan(800);
    expect(resized.width / resized.height).toBeCloseTo(2, 1);
    const anchors = await page.evaluate<string[]>(`ST().findOne("Transformer").enabledAnchors()`);
    expect(anchors).not.toContain("middle-left");
  });

  test("a new image has handles without being clicked again", async ({ page }) => {
    await openApp(page);
    await addTwoToneImage(page);
    expect(await page.evaluate(`ST().findOne("Transformer").nodes().length`)).toBe(1);
  });

  test("text: a side handle rewraps, a corner scales the font", async ({ page }) => {
    await openApp(page);
    const id = await page.evaluate<string>(`(() => {
      const s = S.getState();
      const id = s.addText("heading");
      s.updateElement(id, { x: 500, y: 400, width: 600 });
      s.selectElement(id);
      return id;
    })()`);
    await page.waitForTimeout(250);
    const before = await element<Box>(page, id);

    await dragBy(page, await handle(page, "middle-right"), { x: -100, y: 0 });
    const wrapped = await element<Box>(page, id);
    expect(wrapped.width).toBeLessThan(before.width);
    expect(wrapped.fontSize).toBe(before.fontSize);

    await dragBy(page, await handle(page, "bottom-right"), { x: 80, y: 40 });
    expect((await element<Box>(page, id)).fontSize).toBeGreaterThan(before.fontSize ?? 0);
  });
});

test.describe("crop", () => {
  test("handles trim the image, and it can reach back out", async ({ page }) => {
    await openApp(page);
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.waitForTimeout(200);

    await dragBy(page, await handle(page, "bottom-right"), { x: -100, y: -50 });
    await page.getByRole("button", { name: "Apply crop" }).click();
    const cropped = await element<Box>(page, id);
    expect(cropped.crop?.width).toBeLessThan(1);
    expect(cropped.width).toBeLessThan(800);

    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.getByRole("button", { name: "Show the whole image" }).click();
    await page.getByRole("button", { name: "Apply crop" }).click();
    const whole = await element<Box>(page, id);
    expect(whole.crop).toBeUndefined();
    expect(whole.width).toBeCloseTo(800, 0);
  });

  test("cancel leaves the image alone", async ({ page }) => {
    await openApp(page);
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.waitForTimeout(200);
    await dragBy(page, await handle(page, "bottom-right"), { x: -100, y: -50 });
    const windowWidth = await page.evaluate<number>(`ST().findOne(".crop-window").width()`);
    expect(windowWidth).toBeLessThan(800);

    await page.getByRole("button", { name: "Cancel crop" }).click();
    const image = await element<Box>(page, id);
    expect(image.crop).toBeUndefined();
    expect(image.width).toBe(800);
  });
});

test("dragging snaps to the canvas centre, and export hides the guides", async ({ page }) => {
  await openApp(page);
  const canvas = await page.evaluate<{ width: number }>(`S.getState().canvas`);
  const id = await page.evaluate<string>(`(() => {
    const s = S.getState();
    const id = s.addShape("rect", { x: 200, y: 300, width: 400, height: 200 });
    s.selectElement(id);
    return id;
  })()`);
  await page.waitForTimeout(150);

  // Ends a few canvas units from centred, inside the snap distance on screen.
  const target = canvas.width / 2 + 4;
  await dragOnCanvas(page, [400, 400], [target, 400]);
  const snapped = await element<Box>(page, id);
  expect(snapped.x + snapped.width / 2).toBeCloseTo(canvas.width / 2, 0);
});

test("a guide stays on screen while a drag is snapped", async ({ page }) => {
  await openApp(page);
  const canvas = await page.evaluate<{ width: number }>(`S.getState().canvas`);
  await page.evaluate(`(() => {
    const s = S.getState();
    s.selectElement(s.addShape("rect", { x: 200, y: 300, width: 400, height: 200 }));
  })()`);
  await page.waitForTimeout(150);

  // The Transformer follows the element with drag events of its own, which used to
  // wipe the guide the element had just drawn.
  const start = await toScreen(page, 400, 400);
  const end = await toScreen(page, canvas.width / 2 + 4, 400);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.waitForTimeout(100);
  const guides: { x: number; count: number } = await page.evaluate(`(() => {
    const lines = ST().findOne(".snap-guides").getChildren();
    return { count: lines.length, x: lines[0]?.points()[0] };
  })()`);
  await page.mouse.up();
  expect(guides).toEqual({ count: 1, x: canvas.width / 2 });
  await page.waitForTimeout(100);
  expect(await page.evaluate(`ST().findOne(".snap-guides").getChildren().length`)).toBe(0);
});

test("locked layers don't move; hidden layers aren't drawn", async ({ page }) => {
  await openApp(page);
  const id = await page.evaluate<string>(`(() => {
    const s = S.getState();
    const id = s.addShape("rect", { x: 300, y: 300, width: 400, height: 200 });
    s.updateElement(id, { locked: true });
    s.selectElement(null);
    return id;
  })()`);
  await page.waitForTimeout(150);
  await dragOnCanvas(page, [500, 400], [900, 700]);
  expect((await element<Box>(page, id)).x).toBe(300);

  await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { locked: false, hidden: true })`);
  await page.waitForTimeout(150);
  expect(await page.evaluate(`!ST().findOne("#" + ${JSON.stringify(id)})?.isVisible()`)).toBe(true);
});

test.describe("snapping while resizing", () => {
  const addRect = (page: Page, x: number, width: number) =>
    page.evaluate<string>(`(() => {
      const s = S.getState();
      const id = s.addShape("rect", { x: ${x}, y: 300, width: ${width}, height: 200 });
      s.selectElement(id);
      return id;
    })()`);

  test("a side handle pulls to the canvas centre", async ({ page }) => {
    await openApp(page);
    const centre = await page.evaluate<number>(`S.getState().canvas.width / 2`);
    const id = await addRect(page, 400, 300);
    await page.waitForTimeout(200);

    const scale = await page.evaluate<number>(`ST().scaleX()`);
    const from = await handle(page, "middle-right");
    // Stops 4 screen px short of the centre: inside the pull.
    await dragBy(page, from, { x: (centre - 700) * scale - 4, y: 0 });

    const rect = await element<Box>(page, id);
    expect(rect.x + rect.width).toBeCloseTo(centre, 0);
    expect(rect.y).toBeCloseTo(300, 1);
    expect(rect.height).toBeCloseTo(200, 0);
  });

  test("holding Shift turns it off", async ({ page }) => {
    await openApp(page);
    const centre = await page.evaluate<number>(`S.getState().canvas.width / 2`);
    const id = await addRect(page, 400, 300);
    await page.waitForTimeout(200);
    const scale = await page.evaluate<number>(`ST().scaleX()`);

    await page.keyboard.down("Shift");
    await dragBy(page, await handle(page, "middle-right"), { x: (centre - 700) * scale - 4, y: 0 });
    await page.keyboard.up("Shift");

    const rect = await element<Box>(page, id);
    expect(Math.abs(rect.x + rect.width - centre)).toBeGreaterThan(2);
  });

  test("an image corner reaches the line and keeps its shape", async ({ page }) => {
    await openApp(page);
    const centre = await page.evaluate<number>(`S.getState().canvas.width / 2`);
    const id = await addTwoToneImage(page);
    await page.waitForTimeout(150);
    const scale = await page.evaluate<number>(`ST().scaleX()`);

    await dragBy(page, await handle(page, "bottom-right"), { x: (centre - 1000) * scale - 3, y: -10 });

    const image = await element<Box>(page, id);
    expect(image.x + image.width).toBeCloseTo(centre, 0);
    expect(image.width / image.height).toBeCloseTo(2, 1);
  });

  test("handles are still free away from anything", async ({ page }) => {
    await openApp(page);
    const id = await addRect(page, 200, 300);
    await page.waitForTimeout(200);
    await dragBy(page, await handle(page, "middle-right"), { x: 37, y: 0 });
    const scale = await page.evaluate<number>(`ST().scaleX()`);
    const rect = await element<Box>(page, id);
    expect(rect.width).toBeCloseTo(300 + 37 / scale, -1);
  });
});

test.describe("crop on framed and tilted images", () => {
  test("framed: a browser keeps its width, wraps the crop and shows it", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { deviceFrame: { device: "safari", finish: "dark", landscape: true, fit: "fill", zoom: 1, panX: 0, panY: 0, barColor: "#000000", thickness: 1, roundness: 1, address: "example.com" }, width: 1000, height: 700 })`);
    await page.waitForTimeout(200);

    const crop = page.getByRole("button", { name: "Crop", exact: true });
    await expect(crop).toBeEnabled();
    await crop.click();
    await page.waitForTimeout(250);

    const windowWidth = await page.evaluate<number>(`ST().findOne(".crop-window").width()`);
    expect(windowWidth).toBeCloseTo(1000, 0);
    await dragBy(page, await handle(page, "middle-left"), {
      x: 500 * (await page.evaluate<number>(`ST().scaleX()`)),
      y: 0,
    });
    await page.getByRole("button", { name: "Apply crop" }).click();
    await page.waitForTimeout(200);

    const framed = await element<Box>(page, id);
    expect(framed.width).toBe(1000);
    // Only a square is left, so the window is a square and its title bar.
    expect(Math.abs(framed.height - 1055)).toBeLessThan(5);
    expect(framed.crop?.x).toBeCloseTo(0.5, 1);

    // Only the right half is left: its grey is what the frame's screen now draws.
    const drawn = await page.evaluate<{ x: number; width: number; crop: { x: number } }>(`(() => {
      const node = ST().findOne("#" + ${JSON.stringify(id)}).findOne(".mockup-picture");
      return { crop: node.crop(), x: node.x(), width: node.width() };
    })()`);
    expect(drawn.crop.x).toBeCloseTo(400, -1);
    expect(errors).toEqual([]);
  });

  test("tilted: crops flat, then the tilt comes back", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await page.evaluate(`(async () => {
      const tilt = await import("/src/lib/tilt.ts");
      S.getState().updateElement(${JSON.stringify(id)}, {
        transform: tilt.serializeImageTilt({ ...tilt.DEFAULT_IMAGE_TILT, tiltX: 20, tiltY: 15 }),
      });
    })()`);
    // Drawn by Layer's tilt renderer, in the canvas.
    const tiltShows = () => page.evaluate<boolean>(`!!ST().findOne(".tilted-picture")?.isVisible()`);
    await expect.poll(tiltShows).toBe(true);

    const crop = page.getByRole("button", { name: "Crop", exact: true });
    await expect(crop).toBeEnabled();
    await crop.click();
    await expect.poll(tiltShows).toBe(false);
    await page.waitForTimeout(200);

    await dragBy(page, await handle(page, "bottom-right"), { x: -100, y: -50 });
    await page.getByRole("button", { name: "Apply crop" }).click();
    expect((await element<Box>(page, id)).crop?.width).toBeLessThan(1);
    await expect.poll(tiltShows).toBe(true);
    expect(errors).toEqual([]);
  });
});

test("a stretched image can be put back in shape", async ({ page }) => {
  await openApp(page, "Images");
  const id = await addTwoToneImage(page);
  const section = page.locator("#image-edit");
  await section.getByText("Fix", { exact: true }).click();
  const reset = section.getByRole("button", { name: "Reset proportions" });
  await expect(reset).toHaveCount(0);

  await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { height: 700 })`);
  await reset.click();
  const fixed = await element<Box>(page, id);
  expect(fixed.width / fixed.height).toBeCloseTo(2, 2);
  expect(fixed.width).toBe(800);
  expect(fixed.y).toBeCloseTo(200 + (700 - 400) / 2, 0);
  await expect(reset).toHaveCount(0);
});

test("adding and removing an upload can be undone", async ({ page }) => {
  await openApp(page);
  const count = () => page.evaluate<number>(`S.getState().uploadedImages.length`);
  const id = await page.evaluate<string>(`S.getState().addUploadedImage("data:image/png;base64,AA", 2, 2)`);
  await page.waitForTimeout(500);
  expect(await count()).toBe(1);

  await page.evaluate(`S.getState().undo()`);
  expect(await count()).toBe(0);
  await page.evaluate(`S.getState().redo()`);
  expect(await count()).toBe(1);

  await page.evaluate(`S.getState().deleteUploadedImage(${JSON.stringify(id)})`);
  await page.waitForTimeout(500);
  await page.evaluate(`S.getState().undo()`);
  expect(await count()).toBe(1);
});

test("copy hands the clipboard a PNG straight away, as WebKit needs", async ({ page }) => {
  await page.addInitScript(`
    window.WRITES = [];
    Object.defineProperty(navigator, "clipboard", { value: {
      write: async (items) => {
        // Called in the same tick as the click: nothing has been awaited yet.
        window.WRITES.push({ sameTick: window.IN_CLICK === true, types: items[0].types });
        const blob = await items[0].getType("image/png");
        window.WRITES[0].size = blob.size;
        window.WRITES[0].type = blob.type;
      },
    } });
  `);
  await openApp(page);
  await addTwoToneImage(page);
  await page.evaluate(`(async () => {
    window.IN_CLICK = true;
    const copied = X.copyCanvasToClipboard();
    window.IN_CLICK = false;
    await copied;
  })()`);
  const write = (await page.evaluate<{ sameTick: boolean; types: string[]; size: number; type: string }[]>(`WRITES`))[0];
  expect(write.sameTick).toBe(true);
  expect(write.types).toEqual(["image/png"]);
  expect(write.type).toBe("image/png");
  expect(write.size).toBeGreaterThan(1000);
});

test("scrollbars are styled for the dark panels", async ({ page }) => {
  await openApp(page);
  const width = await page.evaluate<string>(`getComputedStyle(document.querySelector("aside"), "::-webkit-scrollbar").width`);
  expect(width).toBe("8px");
});
