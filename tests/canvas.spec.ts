import { expect, test, type Page } from "@playwright/test";
import {
  addTwoToneImage,
  dragBy,
  dragOnCanvas,
  element,
  elementCount,
  handle,
  openApp,
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
