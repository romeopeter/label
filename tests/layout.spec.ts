import { expect, test, type Page } from "@playwright/test";
import { dragBy, element, elementCount, handle, openApp, solidPng, toScreen } from "./helpers";

interface Img {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  crop?: { x: number; y: number; width: number; height: number };
  layoutCrop?: { x: number; y: number; width: number; height: number };
  shadow?: unknown;
  cornerRadius?: number;
}

/** Adds real images of the given sizes, each a different flat colour. */
const addImages = (page: Page, sizes: [number, number, string][]) =>
  page.evaluate<string[]>(`(async () => {
    const ids = [];
    for (const [w, h, color] of ${JSON.stringify(sizes)}) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      ids.push(S.getState().addImage(c.toDataURL(), w, h));
    }
    await new Promise((r) => setTimeout(r, 300));
    return ids;
  })()`);

const pick = async (page: Page, label: string) => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(120);
};
const images = (page: Page) =>
  page.evaluate<Img[]>(`S.getState().elements.filter((e) => e.type === "image")`);
const slots = (page: Page) =>
  page.evaluate<{ id: string | null }[]>(`S.getState().layout?.slots ?? []`);
const canvasSize = (page: Page) => page.evaluate<{ width: number; height: number }>(`S.getState().canvas`);
const overlapArea = (a: Img, b: Img) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

test.describe("picking a layout", () => {
  test("every layout is on offer and places what it says", async ({ page }) => {
    const errors = await openApp(page, "Layout");
    const ids = await addImages(page, [
      [800, 600, "#a33"], [800, 600, "#3a3"], [800, 600, "#33a"], [800, 600, "#aa3"],
      [800, 600, "#3aa"], [800, 600, "#a3a"], [800, 600, "#777"], [800, 600, "#999"], [800, 600, "#222"],
    ]);
    expect(ids).toHaveLength(9);
    const size = await canvasSize(page);

    const expected: [string, number][] = [
      ["Side by side", 2], ["Stacked", 2], ["Overlap up", 2], ["Overlap down", 2], ["Masonry", 4],
      ["Do & don't", 2], ["Before & after", 2], ["Arrow between", 2], ["Three in a row", 3],
      ["One big, two small", 3], ["2×2 grid", 4], ["3×3 grid", 9], ["Cascade", 3], ["Fan", 3],
    ];
    for (const [label, count] of expected) {
      await pick(page, label);
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      const taken = (await slots(page)).filter((s) => s.id);
      expect(taken, label).toHaveLength(count);

      const placed = (await images(page)).filter((img) => taken.some((s) => s.id === img.id));
      for (const img of placed) {
        expect(img.x + img.width / 2, `${label} on canvas`).toBeGreaterThan(0);
        expect(img.x + img.width / 2, `${label} on canvas`).toBeLessThan(size.width);
        expect(img.y + img.height / 2, `${label} on canvas`).toBeGreaterThan(0);
        expect(img.y + img.height / 2, `${label} on canvas`).toBeLessThan(size.height);
      }
    }
    expect(errors).toEqual([]);
  });

  test("side by side sits apart on a line; stacked on top of each other", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);

    await pick(page, "Side by side");
    let [a, b] = await images(page);
    expect(b.x).toBeGreaterThan(a.x + a.width - 0.5);
    expect(b.y).toBeCloseTo(a.y, 0);
    const size = await canvasSize(page);
    expect((a.x + b.x + b.width) / 2).toBeCloseTo(size.width / 2, 0);

    await pick(page, "Stacked");
    [a, b] = await images(page);
    expect(b.y).toBeGreaterThan(a.y + a.height - 0.5);
    expect(a.x + a.width / 2).toBeCloseTo(size.width / 2, 0);
  });

  test("overlaps overlap in the right direction, with the later image in front", async ({ page }) => {
    await openApp(page, "Layout");
    const [first, second] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);

    await pick(page, "Overlap up");
    let [a, b] = await images(page);
    expect(overlapArea(a, b)).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeLessThan(a.y);

    await pick(page, "Overlap down");
    [a, b] = await images(page);
    expect(b.y).toBeGreaterThan(a.y);
    expect(a.id).toBe(first);
    expect(b.id).toBe(second);
  });

  test("fan rotates around each image's middle, and leaving keeps the look", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#3a3"], [800, 600, "#33a"]]);
    await pick(page, "Fan");
    const [left, middle, right] = await images(page);
    expect(left.rotation).toBe(-9);
    expect(middle.rotation).toBe(0);
    expect(right.rotation).toBe(9);

    await pick(page, "Side by side");
    expect((await images(page)).slice(0, 2).every((img) => img.rotation === 0)).toBe(true);
  });

  test("None frees the images where they are, looking the same", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[1000, 500, "#a33"], [500, 1000, "#33a"], [800, 800, "#3a3"], [800, 800, "#aa3"]]);
    await pick(page, "2×2 grid");
    const before = await images(page);
    expect(before[0].layoutCrop).toBeTruthy();

    await pick(page, "None");
    const after = await images(page);
    expect(await slots(page)).toEqual([]);
    expect(after[0].x).toBeCloseTo(before[0].x, 3);
    expect(after[0].width).toBeCloseTo(before[0].width, 3);
    expect(after[0].layoutCrop).toBeUndefined();
    // The trim became its own crop, which Crop can reach back out of.
    expect(after[0].crop?.width).toBeCloseTo(before[0].layoutCrop?.width ?? 0, 3);

    // And it's free to move again.
    const draggable = await page.evaluate<boolean>(`ST().findOne("#" + ${JSON.stringify(after[0].id)}).draggable()`);
    expect(draggable).toBe(true);
  });

  test("extra images stay put and marks aren't moved", async ({ page }) => {
    await openApp(page, "Layout");
    const ids = await addImages(page, [[800, 600, "#a33"], [800, 600, "#3a3"], [800, 600, "#33a"]]);
    const mark = await page.evaluate<string>(`S.getState().addShape("rect", { x: 11, y: 22, width: 100, height: 50 })`);
    const extraBefore = await element<Img>(page, ids[2]);

    await pick(page, "Side by side");

    const extra = await element<Img>(page, ids[2]);
    expect(extra.x).toBe(extraBefore.x);
    expect((await element<Img>(page, mark)).x).toBe(11);
  });
});

test.describe("settings", () => {
  test("spacing is the gap, and it grows", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    const gapAt = async (spacing: number) => {
      await page.evaluate(`S.getState().updateLayout({ spacing: ${spacing} })`);
      const [a, b] = await images(page);
      return b.x - (a.x + a.width);
    };
    expect(await gapAt(0)).toBeCloseTo(0, 1);
    const small = await gapAt(30);
    const big = await gapAt(100);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });

  test("scale changes how much of the canvas it fills", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().updateLayout({ scale: 100 })`);
    const big = (await images(page))[0].width;
    await page.evaluate(`S.getState().updateLayout({ scale: 40 })`);
    expect((await images(page))[0].width).toBeLessThan(big);
  });

  test("align moves shorter images along the other axis", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 800, "#a33"], [800, 300, "#33a"]]);
    await pick(page, "Side by side");
    const shortTop = async (align: string) => {
      await page.getByRole("radio", { name: align, exact: true }).click();
      await page.waitForTimeout(60);
      const [tall, short] = await images(page);
      return { tall, short };
    };
    const start = await shortTop("Start");
    const end = await shortTop("End");
    expect(start.short.y).toBeLessThan(end.short.y);
    const middle = await shortTop("Center");
    expect(middle.short.y).toBeGreaterThan(start.short.y);
    expect(middle.short.y).toBeLessThan(end.short.y);
  });

  test("same width matches widths; turning it off lets them differ", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[1600, 600, "#a33"], [400, 800, "#33a"]]);
    await pick(page, "Side by side");
    let [a, b] = await images(page);
    expect(a.width).toBeCloseTo(b.width, 1);

    await page.evaluate(`S.getState().updateLayout({ sameWidth: false })`);
    [a, b] = await images(page);
    expect(a.width).toBeGreaterThan(b.width + 1);
    expect(a.width / a.height).toBeCloseTo(1600 / 600, 1);
    expect(b.width / b.height).toBeCloseTo(0.5, 1);
  });

  test("same shape trims without touching the user's crop, and undoes cleanly", async ({ page }) => {
    await openApp(page, "Layout");
    const [id] = await addImages(page, [[1600, 600, "#a33"], [400, 800, "#33a"]]);
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { crop: { x: 0.1, y: 0, width: 0.8, height: 1 }, width: 800, height: 375 })`);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().updateLayout({ sameShape: true })`);

    const [trimmed, other] = await images(page);
    expect(trimmed.width / trimmed.height).toBeCloseTo(other.width / other.height, 2);
    expect(trimmed.crop).toEqual({ x: 0.1, y: 0, width: 0.8, height: 1 });
    expect(trimmed.layoutCrop).toBeTruthy();

    await page.evaluate(`S.getState().updateLayout({ sameShape: false })`);
    const [a] = await images(page);
    expect(a.layoutCrop).toBeUndefined();
    expect(a.crop).toEqual({ x: 0.1, y: 0, width: 0.8, height: 1 });
    expect(a.width / a.height).toBeCloseTo((1600 * 0.8) / 600, 1);
  });
});

test.describe("filling slots", () => {
  test("an empty slot on the canvas opens a picker and takes the file", async ({ page }) => {
    const errors = await openApp(page, "Layout");
    await pick(page, "Side by side");
    expect((await slots(page)).every((s) => !s.id)).toBe(true);
    await expect(page.getByText("0 of 2 filled.", { exact: false })).toBeVisible();

    const placeholder = await page.evaluate<{ x: number; y: number }>(`(() => {
      const g = ST().find(".layout-empty-slot")[1];
      const r = g.getClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    const box = await page.locator(".canvas-artboard canvas").first().boundingBox();
    const chooser = page.waitForEvent("filechooser");
    await page.mouse.click((box?.x ?? 0) + placeholder.x, (box?.y ?? 0) + placeholder.y);
    await (await chooser).setFiles(solidPng());
    await expect.poll(async () => (await slots(page))[1]?.id).toBeTruthy();
    expect((await slots(page))[0].id).toBeNull();
    expect(errors).toEqual([]);
  });

  test("several files at once fill the slots in order, extras stay free", async ({ page }) => {
    await openApp(page, "Layout");
    await pick(page, "Side by side");
    const file = solidPng();
    await page.setInputFiles('input[aria-label="Add images to layout"]', [
      { ...file, name: "a.png" },
      { ...file, name: "b.png" },
      { ...file, name: "c.png" },
    ]);
    await expect.poll(() => elementCount(page)).toBe(3);
    expect((await slots(page)).every((s) => s.id)).toBe(true);
  });

  test("images added any other way take the next free slot", async ({ page }) => {
    await openApp(page, "Layout");
    await pick(page, "Stacked");
    const [id] = await addImages(page, [[800, 600, "#a33"]]);
    expect((await slots(page))[0].id).toBe(id);
  });

  test("dropping a file on a slot fills it, and on a full slot replaces it", async ({ page }) => {
    await openApp(page, "Layout");
    const [first, second] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    const target = await element<Img>(page, second);
    const at = await toScreen(page, target.x + target.width / 2, target.y + target.height / 2);

    await page.evaluate(`(async ([x, y]) => {
      const blob = await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8Dwn4GBgYGJgYGBAQAOBQEBa0sVlQAAAABJRU5ErkJggg==").then((r) => r.blob());
      const data = new DataTransfer();
      data.items.add(new File([blob], "drop.png", { type: "image/png" }));
      const app = document.querySelector(".canvas-artboard");
      app.dispatchEvent(new DragEvent("drop", { bubbles: true, clientX: x, clientY: y, dataTransfer: data }));
      await new Promise((r) => setTimeout(r, 300));
    })([${at.x}, ${at.y}])`);

    const after = await slots(page);
    expect(after[0].id).toBe(first);
    expect(after[1].id).not.toBe(second);
    expect(after[1].id).toBeTruthy();
    expect(await elementCount(page)).toBe(2);
  });

  test("deleting an image empties its slot and leaves a placeholder", async ({ page }) => {
    await openApp(page, "Layout");
    const [first, second] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().deleteElement(${JSON.stringify(first)})`);
    await page.waitForTimeout(150);
    const after = await slots(page);
    expect(after[0].id).toBeNull();
    expect(after[1].id).toBe(second);
    await expect.poll(() => page.evaluate(`ST().find(".layout-empty-slot").length`)).toBe(1);
  });
});

test.describe("dragging", () => {
  test("no resize handles; dragging onto another slot swaps", async ({ page }) => {
    const errors = await openApp(page, "Layout");
    const [first, second] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().selectElement(${JSON.stringify(first)})`);
    await page.waitForTimeout(150);
    expect(await page.evaluate(`ST().findOne("Transformer").enabledAnchors().length`)).toBe(0);
    expect(await page.evaluate(`ST().findOne("Transformer").rotateEnabled()`)).toBe(false);

    const a = await element<Img>(page, first);
    const b = await element<Img>(page, second);
    const from = await toScreen(page, a.x + a.width / 2, a.y + a.height / 2);
    const to = await toScreen(page, b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await expect.poll(() => page.evaluate(`!!ST().findOne(".layout-drop-target")`)).toBe(true);
    await page.mouse.up();

    await expect.poll(async () => (await slots(page))[0].id).toBe(second);
    expect((await slots(page))[1].id).toBe(first);
    expect(await page.evaluate(`!!ST().findOne(".layout-drop-target")`)).toBe(false);
    expect((await element<Img>(page, first)).x).toBeGreaterThan((await element<Img>(page, second)).x);
    expect(errors).toEqual([]);

    await page.evaluate(`S.getState().undo()`);
    expect((await slots(page))[0].id).toBe(first);
  });

  test("dragging inside a slot moves the picture within the trim", async ({ page }) => {
    await openApp(page, "Layout");
    const [wide] = await addImages(page, [[1600, 400, "#a33"], [800, 800, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().updateLayout({ sameShape: true })`);
    const before = await element<Img>(page, wide);
    const startX = before.layoutCrop?.x ?? 0;
    expect(startX).toBeGreaterThan(0);

    const at = await toScreen(page, before.x + before.width / 2, before.y + before.height / 2);
    await dragBy(page, at, { x: -40, y: 0 });

    const after = await element<Img>(page, wide);
    expect(after.layoutCrop?.x).toBeGreaterThan(startX);
    expect(after.x).toBeCloseTo(before.x, 1);
    expect((await slots(page))[0].id).toBe(wide);
  });

  test("a locked image doesn't move or swap", async ({ page }) => {
    await openApp(page, "Layout");
    const [first] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(first)}, { locked: true })`);
    const a = await element<Img>(page, first);
    const from = await toScreen(page, a.x + a.width / 2, a.y + a.height / 2);
    await dragBy(page, from, { x: 300, y: 0 });
    expect((await slots(page))[0].id).toBe(first);
  });

  test("crop in a layout changes only what shows, and the slot re-fits", async ({ page }) => {
    await openApp(page, "Layout");
    const [first] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().selectElement(${JSON.stringify(first)})`);
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await page.waitForTimeout(200);
    await dragBy(page, await handle(page, "bottom-right"), { x: -60, y: -40 });
    await page.getByRole("button", { name: "Apply crop" }).click();
    await page.waitForTimeout(150);
    const cropped = await element<Img>(page, first);
    expect(cropped.crop?.width).toBeLessThan(1);
    expect((await slots(page))[0].id).toBe(first);
  });
});

test.describe("labels and marks", () => {
  test("before and after labels show by default, edit, and hide", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Before & after");
    const texts = () =>
      page.evaluate<string[]>(`ST().find("Text").map((t) => t.text()).filter((t) => ["Before", "After", "Then", "Now"].includes(t))`);
    await expect.poll(texts).toEqual(["Before", "After"]);
    expect(await page.evaluate(`ST().find("Arrow").length`)).toBe(1);

    await page.getByRole("textbox", { name: "Label 1" }).fill("Then");
    await expect.poll(texts).toEqual(["Then", "After"]);

    await page.evaluate(`S.getState().updateLayout({ showLabels: false })`);
    await expect.poll(texts).toEqual([]);
  });

  test("do and don't shows both badges, red first", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Do & don't");
    const fills = await page.evaluate<string[]>(`ST().find("Circle").map((c) => c.fill())`);
    expect(fills).toEqual(["#dc2626", "#1d9e75"]);
    await expect(page.getByRole("textbox", { name: "Label 1" })).toHaveValue("Don't");
  });

  test("the export has the artwork but not the empty slots", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 600, "#a33"]]);
    await pick(page, "Do & don't");
    const hidden = await page.evaluate<boolean[]>(`(async () => {
      const seen = [];
      const stage = ST();
      const real = stage.toDataURL.bind(stage);
      stage.toDataURL = (o) => {
        seen.push(stage.findOne(".layout-slots").visible(), stage.find("Circle")[0].isVisible());
        return real(o);
      };
      await X.renderCanvasDataURL("png", 1);
      stage.toDataURL = real;
      return seen;
    })()`);
    expect(hidden).toEqual([false, true]);
  });
});

test.describe("whole-layout actions", () => {
  test("style all images copies the selected look to the others", async ({ page }) => {
    await openApp(page, "Layout");
    const [first, second, third] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#3a3"], [800, 600, "#33a"]]);
    await pick(page, "Three in a row");
    const look = { cornerRadius: 40, shadow: { enabled: false, color: "#000", blur: 1, offsetX: 0, offsetY: 0 }, border: { enabled: true, color: "#f00", width: 4 } };
    await page.evaluate(`(() => {
      const s = S.getState();
      s.updateElement(${JSON.stringify(second)}, ${JSON.stringify(look)});
      s.selectElement(${JSON.stringify(second)});
    })()`);
    await page.getByRole("button", { name: "Apply style to images" }).click();

    for (const id of [first, third]) {
      const img = await element<Img>(page, id);
      expect(img.cornerRadius).toBe(40);
      expect(img.shadow).toEqual(look.shadow);
    }
    await page.evaluate(`S.getState().undo()`);
    expect((await element<Img>(page, first)).cornerRadius).toBe(8);
  });

  test("fit canvas wraps the images with even padding, and keeps them whole", async ({ page }) => {
    await openApp(page, "Layout");
    await addImages(page, [[800, 800, "#a33"], [800, 800, "#33a"]]);
    await pick(page, "Stacked");
    const before = await canvasSize(page);
    await page.getByRole("button", { name: "Fit canvas to layout" }).click();
    await page.waitForTimeout(150);

    const after = await canvasSize(page);
    expect(after.width).not.toBe(before.width);
    const [a, b] = await images(page);
    const left = Math.min(a.x, b.x);
    const right = after.width - Math.max(a.x + a.width, b.x + b.width);
    const top = Math.min(a.y, b.y);
    const bottom = after.height - Math.max(a.y + a.height, b.y + b.height);
    for (const pad of [right, top, bottom]) expect(Math.abs(pad - left)).toBeLessThan(2);
    expect(left).toBeGreaterThan(0);
  });
});

test.describe("history and saving", () => {
  test("picking a layout is one undo step, back to where the images were", async ({ page }) => {
    await openApp(page, "Layout");
    const [first] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await page.waitForTimeout(500);
    const before = await element<Img>(page, first);
    await pick(page, "Side by side");
    await page.waitForTimeout(500);
    expect((await element<Img>(page, first)).x).not.toBeCloseTo(before.x, 0);

    await page.evaluate(`S.getState().undo()`);
    expect(await page.evaluate(`S.getState().layout`)).toBeNull();
    expect((await element<Img>(page, first)).x).toBeCloseTo(before.x, 3);
    await page.evaluate(`S.getState().redo()`);
    expect((await slots(page))[0].id).toBe(first);
  });

  test("a project keeps its layout, and older projects open without one", async ({ page }) => {
    await openApp(page, "Layout");
    const [first] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    await page.evaluate(`S.getState().updateLayout({ spacing: 77 })`);
    const saved = await page.evaluate<string>(`JSON.stringify(S.getState().toProject())`);

    await page.evaluate(`(() => { const s = S.getState(); s.resetProject(); s.loadProject(${saved}); })()`);
    expect(await page.evaluate(`S.getState().layout.spacing`)).toBe(77);
    expect((await slots(page))[0].id).toBe(first);

    const older = JSON.parse(saved);
    delete older.layout;
    await page.evaluate(`S.getState().loadProject(${JSON.stringify(older)})`);
    expect(await page.evaluate(`S.getState().layout`)).toBeNull();
    const parsed = await page.evaluate<boolean>(`(async () => {
      const importers = await import("/src/lib/importers.ts");
      return !!importers.parseProject(${JSON.stringify(JSON.stringify(older))});
    })()`);
    expect(parsed).toBe(true);
  });

  test("resizing the canvas re-arranges the images", async ({ page }) => {
    await openApp(page, "Layout");
    const [first] = await addImages(page, [[800, 600, "#a33"], [800, 600, "#33a"]]);
    await pick(page, "Side by side");
    const before = (await element<Img>(page, first)).width;
    await page.evaluate(`S.getState().setCanvas({ label: "Custom", width: 800, height: 800 })`);
    await page.waitForTimeout(100);
    expect((await element<Img>(page, first)).width).toBeLessThan(before);
  });
});

test("the rail has Layout, and Position explains itself in a layout", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(page.getByText("PICK A LAYOUT")).toBeVisible();
  await expect(page.getByText("PRO")).toHaveCount(0);

  const [first] = await addImages(page, [[800, 600, "#a33"]]);
  await pick(page, "Side by side");
  await page.evaluate(`S.getState().selectElement(${JSON.stringify(first)})`);
  await expect(page.getByRole("button", { name: "Padding", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Position", exact: true }).click();
  await expect(page.getByText("This image's place comes from its layout.", { exact: false })).toBeVisible();
});
