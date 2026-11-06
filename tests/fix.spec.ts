import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

interface Picture {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: unknown;
}

/** A grey 600 × 400 picture with a red spot at (420, 260) and dark text at the top left. */
const addPicture = (page: Page): Promise<string> =>
  page.evaluate(`(async () => {
    const c = document.createElement("canvas"); c.width = 600; c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#808080"; g.fillRect(0, 0, 600, 400);
    g.fillStyle = "#e0262b"; g.beginPath(); g.arc(420, 260, 18, 0, 7); g.fill();
    g.fillStyle = "#000"; g.font = "bold 40px sans-serif"; g.fillText("4242 4242", 30, 80);
    const s = S.getState();
    const id = s.addImage(c.toDataURL("image/png"), 600, 400);
    s.selectElement(id);
    return id;
  })()`);

const picture = (page: Page): Promise<Picture> => page.evaluate(`S.getState().elements[0]`);

/** The colour of a pixel of the element's picture, at a share of its size. */
const pixelOf = (page: Page, x: number, y: number): Promise<number[]> =>
  page.evaluate(`(async () => {
    const i = new Image(); i.src = S.getState().elements[0].src; await i.decode();
    const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(i, 0, 0);
    return [...g.getImageData(Math.floor(c.width * ${x}), Math.floor(c.height * ${y}), 1, 1).data].slice(0, 3);
  })()`);

const openFix = async (page: Page, tool: string) => {
  await page.getByRole("radio", { name: "Fix", exact: true }).click();
  await page.locator("#image-edit").getByRole("button", { name: new RegExp(`^${tool}`) }).click();
  await expect(page.getByRole("dialog", { name: tool })).toBeVisible();
};

const onPicture = async (page: Page, x: number, y: number) => {
  const box = await page.getByRole("img", { name: "Your picture" }).boundingBox();
  if (!box) throw new Error("The editor isn't showing");
  return { x: box.x + box.width * x, y: box.y + box.height * y };
};

const drag = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
};

test.describe("Fix", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, "Images");
    await addPicture(page);
    await page.waitForTimeout(200);
  });

  test("offers Crop, Heal, Hide and Expand", async ({ page }) => {
    await page.getByRole("radio", { name: "Fix", exact: true }).click();
    for (const name of ["Crop", "Heal", "Hide", "Expand"]) {
      await expect(page.locator("#image-edit").getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    }
  });

  test("Heal fills a painted spot from around it, and undo brings it back", async ({ page }) => {
    const before = (await picture(page)).src;
    expect(await pixelOf(page, 420 / 600, 260 / 400)).toEqual([224, 38, 43]);
    await openFix(page, "Heal");
    await page.locator("div.flex.flex-col.gap-1\\.5").filter({ hasText: "BRUSH" }).getByRole("slider").focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await drag(page, await onPicture(page, 410 / 600, 260 / 400), await onPicture(page, 430 / 600, 260 / 400));
    await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect.poll(async () => (await picture(page)).src).not.toBe(before);
    // Grey again, give or take what the soft edge brings in.
    const healed = await pixelOf(page, 420 / 600, 260 / 400);
    for (const channel of healed) expect(Math.abs(channel - 128)).toBeLessThan(20);
    // Away from it, nothing changed.
    expect(await pixelOf(page, 0.9, 0.9)).toEqual([128, 128, 128]);

    await page.evaluate(`S.getState().undo()`);
    expect((await picture(page)).src).toBe(before);
  });

  test("Hide covers an area for good, in the picture itself", async ({ page }) => {
    await openFix(page, "Hide");
    await page.getByRole("radio", { name: "Bar" }).click();
    await drag(page, await onPicture(page, 0.03, 0.08), await onPicture(page, 0.6, 0.26));
    await expect(page.locator("[data-area]")).toHaveCount(1);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(await pixelOf(page, 0.2, 0.15)).toEqual([0, 0, 0]);
    expect(await pixelOf(page, 0.8, 0.8)).toEqual([128, 128, 128]);
  });

  test("Expand grows the picture, and the element with it, at the same scale", async ({ page }) => {
    const before = await picture(page);
    await openFix(page, "Expand");
    await page.getByRole("radio", { name: "Mirror" }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const after = await picture(page);
    // 20% on every side by default.
    expect(after.naturalWidth).toBe(840);
    expect(after.naturalHeight).toBe(560);
    expect(after.width).toBeCloseTo(before.width * 1.4, 1);
    expect(after.x).toBeCloseTo(before.x - before.width * 0.2, 1);
    expect(after.y).toBeCloseTo(before.y - before.height * 0.2, 1);
    expect(after.crop).toBeUndefined();
  });

  test("Esc closes without changing anything, and keys don't reach the canvas", async ({ page }) => {
    const before = (await picture(page)).src;
    await openFix(page, "Hide");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(`S.getState().elements.length`)).toBe(1);
    expect((await picture(page)).src).toBe(before);
  });
});

test("filling in a hole in a flat picture keeps it flat", async ({ page }) => {
  await openApp(page);
  const filled: number[] = await page.evaluate(`(async () => {
    const { inpaint } = await import("/src/lib/fix/inpaint.ts");
    const width = 64, height = 64;
    const data = new Uint8ClampedArray(width * height * 4);
    const hole = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      data.set([40, 120, 200, 255], i * 4);
      const x = i % width, y = (i / width) | 0;
      if (Math.hypot(x - 32, y - 32) < 10) { hole[i] = 1; data.set([255, 0, 0, 255], i * 4); }
    }
    inpaint({ width, height, data }, hole);
    return [...data.slice((32 * width + 32) * 4, (32 * width + 32) * 4 + 3)];
  })()`);
  expect(filled).toEqual([40, 120, 200]);
});
