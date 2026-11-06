import { expect, test, type Page } from "@playwright/test";
import { fakeShell, openApp, PNG_2X2, shellCalls } from "./helpers";

interface Background {
  mode: string;
  color: string;
  gradient: { from: string; to: string; angle: number };
  pattern: { type: string; colorPairId: string; colors?: { base: string; accent: string } };
  effects: { blur: number; frost: number; grain: number; vignette: number; opacity: number };
}

const background = (page: Page): Promise<Background> => page.evaluate(`S.getState().background`);

/** The colour at a share of the canvas, from the node that draws the background. */
const pixelAt = (page: Page, x: number, y: number): Promise<number[]> =>
  page.evaluate(`(() => {
    const picture = ST().findOne(".background-fill").image();
    const g = picture.getContext("2d");
    return [...g.getImageData(Math.floor(picture.width * ${x}), Math.floor(picture.height * ${y}), 1, 1).data];
  })()`);

const exportSize = (page: Page): Promise<{ length: number; width: number; height: number }> =>
  page.evaluate(`(async () => {
    const url = await X.renderCanvasDataURL("png", 2);
    if (!url) return { length: 0, width: 0, height: 0 };
    const image = new Image();
    image.src = url;
    await image.decode();
    return { length: url.length, width: image.naturalWidth, height: image.naturalHeight };
  })()`);

const openBackground = async (page: Page, type: string) => {
  const errors = await openApp(page, "Background");
  await page.getByRole("radio", { name: type, exact: true }).click();
  await page.waitForTimeout(200);
  return errors;
};

test.describe("background effects", () => {
  for (const type of ["Solid", "Gradient", "Pattern", "Image"]) {
    test(`apply to ${type.toLowerCase()} backgrounds, and go when they're off`, async ({ page }) => {
      const errors = await openBackground(page, type);
      if (type === "Image") {
        await page.evaluate(`S.getState().setBackground({ imageSrc: "data:image/png;base64,${PNG_2X2}" })`);
      }
      expect(await page.evaluate(`!!ST().findOne(".background-fill")`)).toBe(false);

      await page.evaluate(`S.getState().setEffects({ vignette: 1 })`);
      await expect.poll(() => page.evaluate(`!!ST().findOne(".background-fill")`)).toBe(true);
      await page.waitForTimeout(300);
      const corner = await pixelAt(page, 0.01, 0.01);
      const middle = await pixelAt(page, 0.5, 0.5);
      // A vignette darkens the corners against the middle, whatever the colours.
      const light = (p: number[]) => p[0] + p[1] + p[2];
      expect(light(corner)).toBeLessThan(light(middle) * 0.6 + 1);

      await page.evaluate(`S.getState().setEffects({ vignette: 0 })`);
      await expect.poll(() => page.evaluate(`!!ST().findOne(".background-fill")`)).toBe(false);
      expect(errors).toEqual([]);
    });
  }

  test("sit in their own tab, and stay as the type changes", async ({ page }) => {
    const errors = await openBackground(page, "Solid");
    await page.getByRole("tab", { name: "Effects" }).click();
    const blur = page.locator("div.flex.flex-col.gap-1\\.5").filter({ hasText: "BLUR" }).getByRole("slider");
    await blur.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    expect((await background(page)).effects.blur).toBe(5);

    await page.getByRole("radio", { name: "Gradient", exact: true }).click();
    expect((await background(page)).effects.blur).toBe(5);
    expect(errors).toEqual([]);
  });

  test("opacity fades the whole background", async ({ page }) => {
    await openBackground(page, "Solid");
    await page.evaluate(`S.getState().setEffects({ opacity: 0.4 })`);
    await page.waitForTimeout(100);
    expect(await page.evaluate(`ST().getLayers()[0].getChildren()[0].opacity()`)).toBeCloseTo(0.4);
  });

  test("export draws them again at full size", async ({ page }) => {
    const errors = await openBackground(page, "Gradient");
    await page.evaluate(`S.getState().setEffects({ blur: 20, grain: 0.3 })`);
    await page.waitForTimeout(300);
    const preview = await page.evaluate(`ST().findOne(".background-fill").image()`);
    const canvas: { width: number; height: number } = await page.evaluate(`S.getState().canvas`);
    const size = await exportSize(page);
    expect(size).toMatchObject({ width: canvas.width * 2, height: canvas.height * 2 });
    expect(await page.evaluate(`ST().findOne(".background-fill").image()`)).toEqual(preview);
    expect(errors).toEqual([]);
  });
});

test.describe("patterns", () => {
  test("export, which came out empty in WebKit before", async ({ page }) => {
    const errors = await openBackground(page, "Pattern");
    await page.waitForTimeout(300);
    const size = await exportSize(page);
    expect(size.length).toBeGreaterThan(1000);
    expect(errors).toEqual([]);
  });

  test("each type draws a tile unlike any other", async ({ page }) => {
    await openApp(page);
    const tiles: string[] = await page.evaluate(`(async () => {
      const T = await import("/src/types/pattern.ts");
      const C = await import("/src/lib/patterns/tileCache.ts");
      const out = [];
      for (const type of T.PATTERN_TYPES) {
        const tile = await C.getPatternTile({ type, size: 0.5 }, { id: "x", base: "#123b36", accent: "#69d3a7", source: "curated" }, 1);
        out.push(tile.toDataURL());
      }
      return out;
    })()`);
    expect(tiles).toHaveLength(22);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  test("files with a dropped type open with the nearest one", async ({ page }) => {
    await openApp(page);
    const types: string[] = await page.evaluate(`(() => {
      const s = S.getState();
      return ["diamonds", "rules", "grain", "nonsense"].map((type) => {
        const project = JSON.parse(JSON.stringify(s.toProject()));
        project.background = { ...project.background, mode: "pattern", pattern: { ...project.background.pattern, type } };
        s.loadProject(project);
        return S.getState().background.pattern.type;
      });
    })()`);
    expect(types).toEqual(["argyle", "stripes", "starry-night", "dots"]);
  });

  test("a swatch replaces colours Shuffle chose", async ({ page }) => {
    const errors = await openBackground(page, "Pattern");
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    expect((await background(page)).pattern.colors).toBeDefined();
    await page.evaluate(`S.getState().setPattern({ colorPairId: "curated-09", colors: undefined })`);
    expect((await background(page)).pattern.colors).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test.describe("Shuffle, Back and Forward", () => {
  const cases: [string, (bg: Background) => unknown][] = [
    ["Solid", (bg) => bg.color],
    ["Gradient", (bg) => bg.gradient],
    ["Pattern", (bg) => bg.pattern.colors ?? bg.pattern.colorPairId],
  ];

  for (const [type, lookOf] of cases) {
    test(`work for ${type.toLowerCase()} backgrounds, and keep effects`, async ({ page }) => {
      const errors = await openBackground(page, type);
      const back = page.getByRole("button", { name: "Back", exact: true });
      const forward = page.getByRole("button", { name: "Forward", exact: true });
      const first = lookOf(await background(page));

      await page.getByRole("button", { name: "Shuffle", exact: true }).click();
      const second = lookOf(await background(page));
      expect(second).not.toEqual(first);
      await page.evaluate(`S.getState().setEffects({ grain: 0.5 })`);
      await page.getByRole("button", { name: "Shuffle", exact: true }).click();
      await expect(page.getByText("3 OF 3")).toBeVisible();

      await back.click();
      expect(lookOf(await background(page))).toEqual(second);
      await back.click();
      expect(lookOf(await background(page))).toEqual(first);
      await expect(back).toBeDisabled();
      expect((await background(page)).effects.grain).toBe(0.5);
      await forward.click();
      expect(lookOf(await background(page))).toEqual(second);
      expect(errors).toEqual([]);
    });
  }

  test("each type keeps its own trail", async ({ page }) => {
    await openBackground(page, "Solid");
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    await page.getByRole("radio", { name: "Gradient", exact: true }).click();
    await expect(page.getByText(/\d OF \d/)).toHaveCount(0);
    await page.getByRole("radio", { name: "Solid", exact: true }).click();
    await expect(page.getByText("2 OF 2")).toBeVisible();
  });
});

test.describe("saved backgrounds", () => {
  test("are kept, used again, and deleted", async ({ page }) => {
    const errors = await openBackground(page, "Solid");
    await page.getByRole("tab", { name: "Saved" }).click();
    await expect(page.getByText("Save a background to use it again")).toBeVisible();

    await page.evaluate(`S.getState().setBackground({ color: "#3366cc" })`);
    await page.getByRole("button", { name: "Save this background" }).click();
    await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
    const tile = page.getByRole("button", { name: "Use this saved background" });
    await expect(tile).toHaveCount(1);
    await expect(tile).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("radio", { name: "Gradient", exact: true }).click();
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    await tile.click();
    expect(await background(page)).toMatchObject({ mode: "solid", color: "#3366cc" });

    await tile.hover();
    await page.getByRole("button", { name: "Delete this saved background" }).click();
    await expect(tile).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("on the desktop, come back from the file and go to it", async ({ page }) => {
    const saved = JSON.stringify([
      { id: "bg_old", background: { mode: "solid", color: "#aa3355", imageBlur: 4 } },
      { id: 5, background: "damaged" },
    ]);
    await fakeShell(page, `(command) => command === "load_saved_backgrounds" ? ${JSON.stringify(saved)} : null`);
    const errors = await openBackground(page, "Solid");
    await page.getByRole("tab", { name: "Saved" }).click();
    await expect(page.getByRole("button", { name: "Use this saved background" })).toHaveCount(1);

    await page.getByRole("button", { name: "Save this background" }).click();
    const stored = await shellCalls(page, "store_saved_backgrounds");
    expect(stored).toHaveLength(1);
    const list = JSON.parse(stored[0].list as string) as { id: string }[];
    expect(list.map((entry) => entry.id).slice(1)).toEqual(["bg_old"]);
    expect(errors).toEqual([]);
  });
});

test("older image backgrounds keep their blur and opacity, as effects", async ({ page }) => {
  await openApp(page);
  const effects = await page.evaluate(`(() => {
    const s = S.getState();
    const project = JSON.parse(JSON.stringify(s.toProject()));
    project.background = { mode: "image", color: "#000000", gradient: project.background.gradient, imageSrc: null, imageBlur: 12, imageOpacity: 0.5 };
    s.loadProject(project);
    return S.getState().background.effects;
  })()`);
  expect(effects).toEqual({ blur: 12, frost: 0, grain: 0, vignette: 0, opacity: 0.5 });
});
