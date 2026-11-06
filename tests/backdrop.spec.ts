import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

interface Backdrop {
  style: string;
  seed: number;
  color: string | null;
  colors: string[];
}

interface Effects {
  blur: number;
  frost: number;
  grain: number;
  vignette: number;
  opacity: number;
}

const backdrop = (page: Page): Promise<Backdrop> => page.evaluate(`S.getState().background.backdrop`);
const effects = (page: Page): Promise<Effects> => page.evaluate(`S.getState().background.effects`);
const mode = (page: Page): Promise<string> => page.evaluate(`S.getState().background.mode`);

const openAbstract = async (page: Page) => {
  const errors = await openApp(page, "Background");
  await page.getByRole("radio", { name: "Abstract", exact: true }).click();
  await page.waitForTimeout(200);
  return errors;
};

/** The colours of a few pixels of the background Konva is drawing, spread over it. */
const samples = (page: Page): Promise<number[][]> =>
  page.evaluate(`(() => {
    const picture = ST().findOne(".background-fill").image();
    const g = picture.getContext("2d");
    return [[0.2, 0.2], [0.5, 0.5], [0.8, 0.3], [0.3, 0.8], [0.9, 0.9]].map(([x, y]) =>
      [...g.getImageData(Math.floor(picture.width * x), Math.floor(picture.height * y), 1, 1).data]);
  })()`);

const spread = (pixels: number[][]) =>
  Math.max(...pixels.map((p) => p[0] + p[1] + p[2])) - Math.min(...pixels.map((p) => p[0] + p[1] + p[2]));

test.describe("abstract backgrounds", () => {
  test("draws a background with depth, not a flat colour", async ({ page }) => {
    const errors = await openAbstract(page);
    expect(await mode(page)).toBe("abstract");
    expect(spread(await samples(page))).toBeGreaterThan(60);
    expect(errors).toEqual([]);
  });

  test("every style draws something of its own", async ({ page }) => {
    const errors = await openAbstract(page);
    const styles = ["Soft", "Waves", "Streaks", "Glow", "Glass", "Aurora", "Silk", "Marble"];
    const drawn: number[][][] = [];
    for (const label of styles) {
      await page.getByRole("radio", { name: label, exact: true }).click();
      expect((await backdrop(page)).style).toBe(label.toLowerCase());
      const pixels = await samples(page);
      expect(spread(pixels), label).toBeGreaterThan(20);
      drawn.push(pixels);
    }
    // No two styles draw the same picture from the same colours and seed.
    expect(new Set(drawn.map((pixels) => JSON.stringify(pixels))).size).toBe(styles.length);
    expect(errors).toEqual([]);
  });

  test("Shuffle keeps Aurora's sky dark", async ({ page }) => {
    await openApp(page);
    const grounds: number[] = await page.evaluate(`(async () => {
      const P = await import("/src/lib/backdrops/presets.ts");
      const C = await import("/src/lib/backdrops/colors.ts");
      const look = { ...P.DEFAULT_BACKDROP, style: "aurora" };
      return Array.from({ length: 60 }, (_, i) => C.toOklch(P.shuffledLook(look, i + 1).colors[0]).l);
    })()`);
    expect(Math.max(...grounds)).toBeLessThan(0.3);
  });

  test("offers ten presets, and a preset sets its own style and effects", async ({ page }) => {
    const errors = await openAbstract(page);
    const labels: string[] = await page.evaluate(
      `import("/src/lib/backdrops/presets.ts").then((m) => m.BACKDROP_PRESETS.map((p) => p.label))`,
    );
    expect(labels).toHaveLength(10);
    for (const label of labels) await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Grey frost", exact: true }).click();
    expect((await backdrop(page)).style).toBe("soft");
    expect((await effects(page)).frost).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "Grey frost", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Sunset streaks", exact: true }).click();
    expect((await backdrop(page)).style).toBe("streaks");
    expect((await effects(page)).frost).toBe(0);
    expect(errors).toEqual([]);
  });

  test("Shuffle makes new ones, and Back and Forward return to them", async ({ page }) => {
    const errors = await openAbstract(page);
    const back = page.getByRole("button", { name: "Back", exact: true });
    const forward = page.getByRole("button", { name: "Forward", exact: true });
    await expect(back).toBeDisabled();

    const first = await backdrop(page);
    const pixelsBefore = await samples(page);
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    const second = await backdrop(page);
    expect(second.seed).not.toBe(first.seed);
    expect(second.colors).not.toEqual(first.colors);
    // Shuffle keeps the style.
    expect(second.style).toBe(first.style);
    expect(await samples(page)).not.toEqual(pixelsBefore);

    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    const third = await backdrop(page);
    await expect(page.getByText("3 OF 3")).toBeVisible();

    // Effects you've set stay as you go back.
    await page.evaluate(`S.getState().setEffects({ grain: 0.4 })`);
    await back.click();
    expect(await backdrop(page)).toMatchObject({ seed: second.seed, colors: second.colors });
    expect((await effects(page)).grain).toBe(0.4);
    await back.click();
    expect(await backdrop(page)).toMatchObject({ seed: first.seed, colors: first.colors });
    await expect(back).toBeDisabled();

    await forward.click();
    await forward.click();
    expect(await backdrop(page)).toMatchObject({ seed: third.seed, colors: third.colors });
    await expect(forward).toBeDisabled();

    // A new shuffle partway back replaces what was ahead, as a browser's history does.
    await back.click();
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    await expect(page.getByText("3 OF 3")).toBeVisible();
    expect((await backdrop(page)).seed).not.toBe(third.seed);
    expect(errors).toEqual([]);
  });

  test("a picked colour is what Shuffle builds on, until Any color", async ({ page }) => {
    const errors = await openAbstract(page);
    await page.getByLabel("Color", { exact: true }).fill("#e0457b");
    let now = await backdrop(page);
    expect(now.color).toBe("#e0457b");
    expect(now.colors[1]).toBe("#e0457b");

    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Shuffle", exact: true }).click();
      now = await backdrop(page);
      expect(now.color).toBe("#e0457b");
      expect(now.colors[1]).toBe("#e0457b");
    }

    await page.getByRole("button", { name: "Any color", exact: true }).click();
    expect((await backdrop(page)).color).toBeNull();
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    expect((await backdrop(page)).colors[1]).not.toBe("#e0457b");
    expect(errors).toEqual([]);
  });

  test("palettes stay in tune", async ({ page }) => {
    await openApp(page);
    const result: { greys: number; muddy: number; darkest: number[] } = await page.evaluate(`(async () => {
      const C = await import("/src/lib/backdrops/colors.ts");
      let greys = 0, muddy = 0;
      const darkest = [];
      for (let seed = 1; seed < 200; seed++) {
        // Grey picked: no hue to turn round the wheel, so it all stays grey.
        if (C.shuffledPalette(seed, "#8a8a8a").every((hex) => C.toOklch(hex).c < 0.04)) greys++;
        const main = C.toOklch(C.shuffledPalette(seed, null)[1]);
        if (main.c > 0.04 && main.h > 86 && main.h < 124) muddy++;
        darkest.push(C.toOklch(C.shuffledPalette(seed, null)[0]).l);
      }
      return { greys, muddy, darkest };
    })()`);
    expect(result.greys).toBe(199);
    expect(result.muddy).toBe(0);
    // Even a light palette keeps a darker ground to build on.
    expect(Math.max(...result.darkest)).toBeLessThan(0.9);
  });

  test("blur, frost and grain change what's drawn", async ({ page }) => {
    const errors = await openAbstract(page);
    const plain = await samples(page);
    for (const name of ["BLUR", "FROST", "GRAIN"]) {
      const slider = page.locator("div.flex.flex-col.gap-1\\.5").filter({ hasText: name }).getByRole("slider");
      await slider.focus();
      for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
    }
    const now = await effects(page);
    expect(now.blur).toBeGreaterThan(0);
    expect(now.frost).toBeGreaterThan(0);
    expect(now.grain).toBeGreaterThan(0);
    expect(await samples(page)).not.toEqual(plain);
    expect(errors).toEqual([]);
  });

  test("exports at full size, then puts the preview back", async ({ page }) => {
    const errors = await openAbstract(page);
    const result: { width: number; height: number; restored: boolean } = await page.evaluate(`(async () => {
      const node = ST().findOne(".background-fill");
      const preview = node.image();
      const url = await X.renderCanvasDataURL("png", 2);
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, restored: node.image() === preview };
    })()`);
    const canvas: { width: number; height: number } = await page.evaluate(`S.getState().canvas`);
    expect(result).toEqual({ width: canvas.width * 2, height: canvas.height * 2, restored: true });
    expect(errors).toEqual([]);
  });

  test("saves with the project and opens safely", async ({ page }) => {
    const errors = await openAbstract(page);
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    const saved = await backdrop(page);
    const reopened: Backdrop = await page.evaluate(`(() => {
      const s = S.getState();
      const project = JSON.parse(JSON.stringify(s.toProject()));
      s.resetProject();
      s.loadProject(project);
      return S.getState().background.backdrop;
    })()`);
    expect(reopened).toEqual(saved);
    expect(await page.evaluate(`Object.keys(S.getState().lookTrails).length`)).toBe(0);

    // From before abstract backgrounds, and from a damaged file.
    const older: Backdrop = await page.evaluate(`(() => {
      const s = S.getState();
      const project = JSON.parse(JSON.stringify(s.toProject()));
      delete project.background.backdrop;
      s.loadProject(project);
      return S.getState().background.backdrop;
    })()`);
    expect(older.colors).toHaveLength(4);
    // Before shared effects, an abstract background kept its own blur, frost and grain.
    const damaged: { backdrop: Backdrop; effects: Effects } = await page.evaluate(`(() => {
      const s = S.getState();
      const project = JSON.parse(JSON.stringify(s.toProject()));
      delete project.background.effects;
      project.background.backdrop = { style: "lava", seed: "x", colors: ["red"], blur: 9999, frost: -1, grain: 0.3, color: 5 };
      s.loadProject(project);
      return S.getState().background;
    })()`);
    expect(damaged.backdrop).toMatchObject({ style: "waves", color: null });
    expect(damaged.backdrop.colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(damaged.effects).toEqual({ blur: 100, frost: 0, grain: 0.3, vignette: 0, opacity: 1 });
    expect(errors).toEqual([]);
  });

  test("Shuffle is one undo step", async ({ page }) => {
    const errors = await openAbstract(page);
    const before = await backdrop(page);
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    await page.waitForTimeout(100);
    await page.evaluate(`S.getState().undo()`);
    expect(await backdrop(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
});
