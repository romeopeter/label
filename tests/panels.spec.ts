import { expect, test } from "@playwright/test";
import { addTwoToneImage, openApp } from "./helpers";

test.describe("Position", () => {
  test("arrows send the layer to each place, and show where it is", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Position", exact: true }).click();
    const canvas: { width: number; height: number } = await page.evaluate(`S.getState().canvas`);

    for (const [label, h, v] of [
      ["Bottom right", 1, 1],
      ["Top left", 0, 0],
      ["Center", 0.5, 0.5],
    ] as const) {
      const place = page.getByRole("button", { name: label, exact: true });
      await place.click();
      const el: { x: number; y: number; width: number; height: number } = await page.evaluate(
        `S.getState().elements.find((e) => e.id === ${JSON.stringify(id)})`,
      );
      expect(el.x).toBeCloseTo((canvas.width - el.width) * h, 3);
      expect(el.y).toBeCloseTo((canvas.height - el.height) * v, 3);
      await expect(place).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByRole("button", { name: "Top left", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("LOCK ASPECT")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("3D", () => {
  test("a tilt shows when not selected, and exports the same as it shows", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await page.evaluate(
      `S.getState().updateElement(${JSON.stringify(id)}, { transform: "rotateX(25deg) rotateY(-25deg) rotateZ(0deg) perspective(800px) scale(1) innerShadow(true)" })`,
    );
    await page.evaluate(`S.getState().selectElement(null)`);
    await page.waitForTimeout(300);
    expect(await page.evaluate(`!!ST().findOne(".tilted-picture")`)).toBe(true);

    // The image's own top-left corner is left behind by the tilt, in the export too.
    const corner: { exported: number[]; middle: number[] } = await page.evaluate(`(async () => {
      const url = await X.renderCanvasDataURL("png", 1);
      const image = new Image(); image.src = url; await image.decode();
      const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
      const g = c.getContext("2d"); g.drawImage(image, 0, 0);
      const el = S.getState().elements[0];
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
      return { exported: at(el.x + 6, el.y + 6), middle: at(el.x + el.width * 0.25, el.y + el.height / 2) };
    })()`);
    // Not the picture's green at the box's corner, but still green inside.
    expect(corner.exported[1]).toBeLessThan(120);
    expect(corner.middle[1]).toBeGreaterThan(120);
    expect(errors).toEqual([]);
  });
});

test.describe("Corner", () => {
  test("corners follow the image's size, and a border is on when it has a width", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Corner", exact: true }).click();
    await expect(page.getByText("ENABLE BORDER")).toHaveCount(0);

    await page.getByRole("button", { name: "Full corners" }).click();
    const el = () =>
      page.evaluate<{ cornerRadius: number; height: number; border?: { enabled: boolean; width: number } }>(
        `S.getState().elements.find((e) => e.id === ${JSON.stringify(id)})`,
      );
    // Half the shorter side: the short ends are fully round.
    expect((await el()).cornerRadius).toBe((await el()).height / 2);
    await expect(page.getByRole("button", { name: "Full corners" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Medium border" }).click();
    expect((await el()).border).toMatchObject({ enabled: true, width: 6 });
    await page.getByRole("button", { name: "No border" }).click();
    expect((await el()).border).toMatchObject({ enabled: false, width: 0 });
    expect(errors).toEqual([]);
  });
});
