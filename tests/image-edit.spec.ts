import { expect, test } from "@playwright/test";
import {
  addTwoToneImage,
  element,
  expectNear,
  openApp,
  picturePixel,
  solidPng,
} from "./helpers";

test("every option changes the picture, and Strength changes it more", async ({ page }) => {
  await openApp(page);
  const report = await page.evaluate<{ label: string; ok: boolean; low?: number; high?: number }[]>(`(() => {
    const c = document.createElement("canvas");
    c.width = 240; c.height = 160;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 240, 160);
    grad.addColorStop(0, "#102040"); grad.addColorStop(0.5, "#e08030"); grad.addColorStop(1, "#ffffff");
    g.fillStyle = grad; g.fillRect(0, 0, 240, 160);
    // Fine detail everywhere, because blurs only show where there's something to blur.
    g.fillStyle = "rgba(255,255,255,0.7)";
    for (let x = 0; x < 240; x += 12) for (let y = (x / 12) % 2 ? 0 : 6; y < 160; y += 12) g.fillRect(x, y, 6, 6);
    g.fillStyle = "#fff"; g.fillRect(100, 60, 40, 40);
    const pixels = (x) => x.getContext("2d").getImageData(0, 0, x.width, x.height).data;
    const base = pixels(c);
    const change = (edit) => {
      const out = document.createElement("canvas");
      R.renderEdit(c, edit, out);
      const p = pixels(out);
      let sum = 0;
      for (let i = 0; i < p.length; i++) sum += Math.abs(p[i] - base[i]);
      return sum / p.length;
    };
    const out = [];
    for (const s of P.STYLES.filter((x) => x.id !== "double")) for (const v of s.variants) {
      const low = change({ style: { id: s.id, variant: v.id, strength: 20 } });
      const high = change({ style: { id: s.id, variant: v.id, strength: 90 } });
      out.push({ label: s.id + "/" + v.id, ok: high > 0.4 && high > low, low, high });
    }
    for (const x of P.COLORS) out.push({ label: "color/" + x.id, ok: change({ color: { id: x.id, strength: 100 } }) > 0.4 });
    for (const x of P.GRADES) out.push({ label: "grade/" + x.id, ok: change({ grade: { id: x.id, strength: 100 } }) > 0.4 });
    for (const x of P.LENS_MODES) out.push({ label: "lens/" + x.id, ok: change({ lensBlur: { mode: x.id, amount: 80 } }) > 0.4 });
    for (const key of Object.keys(P.NO_ADJUST)) for (const value of [60, -60]) {
      out.push({ label: key + value, ok: change({ adjust: { [key]: value } }) > 0.4 });
    }
    return out;
  })()`);
  expect(report.filter((r) => !r.ok)).toEqual([]);
  expect(report.length).toBeGreaterThan(50);
});

test("removing all edits returns the exact original pixels", async ({ page }) => {
  const errors = await openApp(page, "Images");
  const id = await addTwoToneImage(page, { color: { id: "mono", strength: 100 } });
  expect(await picturePixel(page, id, 100, 100)).not.toEqual([29, 158, 117, 255]);

  await page.getByRole("button", { name: "Remove all edits" }).click();
  await expect.poll(() => picturePixel(page, id, 100, 100)).toEqual([29, 158, 117, 255]);
  expect(errors).toEqual([]);
});

test.describe("double exposure", () => {
  const blends: [string, number[]][] = [
    ["Default", [83, 74, 183]],
    ["Lighten", [83, 158, 183]],
    ["Darken", [29, 74, 117]],
    ["Add", [112, 232, 255]],
    ["Subtract", [0, 84, 0]],
    ["Overlay", [19, 117, 168]],
  ];

  test("needs a second image, then each blend matches its circles", async ({ page }) => {
    const errors = await openApp(page, "Images");
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Double exposure", exact: true }).click();

    const panel = page.locator("#image-edit");
    await expect(panel.getByText("Add an image to blend it into this one.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Lighten", exact: true })).toHaveCount(0);
    for (const removed of ["Clouds", "Smoke", "Stars"]) {
      await expect(panel.getByText(removed)).toHaveCount(0);
    }
    expectNear(await picturePixel(page, id, 100, 100), [29, 158, 117]);

    await page.setInputFiles('input[aria-label="Add second image"]', solidPng());
    await expect(panel.getByRole("button", { name: "Lighten", exact: true })).toBeVisible();
    await page.evaluate(`(() => {
      const s = S.getState();
      const e = s.elements.find((x) => x.id === ${JSON.stringify(id)});
      s.updateElement(e.id, { edit: { style: { ...e.edit.style, strength: 100 } } });
    })()`);

    for (const [label, want] of blends) {
      const option = panel.getByRole("button", { name: label, exact: true });
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () => {
          const got = await picturePixel(page, id, 100, 100);
          return want.every((v, i) => Math.abs(got[i] - v) <= 3);
        })
        .toBe(true);

      if (label !== "Default") {
        const fill = await option
          .locator("circle")
          .nth(3)
          .evaluate((node) => getComputedStyle(node).fill);
        const parts = (fill.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
        expectNear(fill.includes("srgb") ? parts.map((v) => v * 255) : parts, want);
      }
    }
    expect(errors).toEqual([]);
  });

  test("the export contains the blend", async ({ page }) => {
    await openApp(page, "Images");
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Double exposure", exact: true }).click();
    await page.setInputFiles('input[aria-label="Add second image"]', solidPng());
    await page.locator("#image-edit").getByRole("button", { name: "Add", exact: true }).click();
    await page.evaluate(`(() => {
      const s = S.getState();
      const e = s.elements.find((x) => x.id === ${JSON.stringify(id)});
      s.updateElement(e.id, { edit: { style: { ...e.edit.style, strength: 100 } } });
    })()`);
    await expect
      .poll(async () => (await picturePixel(page, id, 100, 100))[1])
      .toBeGreaterThan(220);

    const pixel = await page.evaluate<number[]>(`(async () => {
      const url = await X.renderCanvasDataURL("png", 1);
      const image = new Image();
      image.src = url;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width; c.height = image.height;
      const g = c.getContext("2d");
      g.drawImage(image, 0, 0);
      return [...g.getImageData(300 * image.width / S.getState().canvas.width, 300 * image.height / S.getState().canvas.height, 1, 1).data];
    })()`);
    expectNear(pixel, [112, 232, 255], 6);

    const saved = await page.evaluate<{ src: string }>(`(() => {
      const e = S.getState().toProject().elements.find((x) => x.id === ${JSON.stringify(id)});
      return { src: e.edit.style.overlaySrc.slice(0, 11) };
    })()`);
    expect(saved.src).toBe("data:image/");
  });
});

test("the crop window shows the edited picture", async ({ page }) => {
  const errors = await openApp(page, "Images");
  await addTwoToneImage(page, { color: { id: "mono", strength: 100 } });
  await page.getByRole("button", { name: "Crop", exact: true }).click();
  await page.waitForTimeout(300);

  const shown = await page.evaluate<{ isCanvas: boolean; pixel: number[]; width: number }[]>(`(() => {
    return ST().findOne(".crop-overlay").find("Image").map((node) => {
      const image = node.image();
      return {
        isCanvas: image instanceof HTMLCanvasElement,
        width: image.width,
        pixel: image instanceof HTMLCanvasElement ? [...image.getContext("2d").getImageData(100, 100, 1, 1).data] : [],
      };
    });
  })()`);

  expect(shown).toHaveLength(2);
  for (const layer of shown) {
    expect(layer.isCanvas).toBe(true);
    expect(layer.width).toBe(800);
    // Black and white: the green half has no colour left in it.
    expect(Math.abs(layer.pixel[0] - layer.pixel[1])).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test("cropping an edited picture keeps the edit on the result", async ({ page }) => {
  await openApp(page, "Images");
  const id = await addTwoToneImage(page, { color: { id: "mono", strength: 100 } });
  await page.getByRole("button", { name: "Crop", exact: true }).click();
  await page.waitForTimeout(200);
  await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }); S.getState().setCropId(null);`);
  await page.waitForTimeout(250);
  const pixel = await picturePixel(page, id, 50, 50);
  expectNear(pixel, [200, 200, 200]);
  await expect.poll(async () => (await element<{ edit: unknown }>(page, id)).edit).toBeTruthy();
});

test("lens blur stays sharp where the user clicks", async ({ page }) => {
  const errors = await openApp(page, "Images");
  const id = await page.evaluate<string>(`(async () => {
    const c = document.createElement("canvas");
    c.width = 800; c.height = 400;
    const g = c.getContext("2d");
    for (let x = 0; x < 800; x += 8) for (let y = 0; y < 400; y += 8) {
      g.fillStyle = (x + y) % 16 ? "#000" : "#fff";
      g.fillRect(x, y, 8, 8);
    }
    const s = S.getState();
    const id = s.addImage(c.toDataURL(), 800, 400);
    s.updateElement(id, { x: 200, y: 200, width: 800, height: 400 });
    s.selectElement(id);
    await new Promise((r) => setTimeout(r, 300));
    return id;
  })()`);

  const panel = page.locator("#image-edit");
  await panel.getByText("Adjust", { exact: true }).click();
  await panel.getByRole("radio", { name: "Edges" }).click();
  await page.evaluate(`(() => {
    const s = S.getState();
    const e = s.elements.find((x) => x.id === ${JSON.stringify(id)});
    s.updateElement(e.id, { edit: { lensBlur: { ...e.edit.lensBlur, amount: 100 } } });
  })()`);

  // Contrast left in a small patch: high means sharp.
  const sharpness = (x: number, y: number) =>
    page.evaluate<number>(`(() => {
      const image = ST().findOne("#" + ${JSON.stringify(id)}).findOne("Image").image();
      const d = image.getContext("2d").getImageData(${x}, ${y}, 32, 32).data;
      let low = 255, high = 0;
      for (let i = 0; i < d.length; i += 4) { low = Math.min(low, d[i]); high = Math.max(high, d[i]); }
      return high - low;
    })()`);

  await expect.poll(() => sharpness(40, 40)).toBeLessThan(120);
  expect(await sharpness(384, 184)).toBeGreaterThan(200);

  const picker = page.getByTestId("lens-focus");
  await picker.scrollIntoViewIfNeeded();
  const box = await picker.boundingBox();
  if (!box) throw new Error("Focus picker isn't on screen");
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.2);

  const focus = (await element<{ edit: { lensBlur: { focus: { x: number; y: number } } } }>(page, id))
    .edit.lensBlur.focus;
  expect(focus.x).toBeCloseTo(0.1, 1);
  expect(focus.y).toBeCloseTo(0.2, 1);
  await expect.poll(() => sharpness(64, 64)).toBeGreaterThan(200);
  expect(await sharpness(600, 300)).toBeLessThan(120);
  expect(errors).toEqual([]);
});

test("exporting a tilted image logs nothing", async ({ page }) => {
  const logged: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) logged.push(message.text());
  });
  await openApp(page, "Images");
  const id = await addTwoToneImage(page);
  await page.evaluate(`(async () => {
    const tilt = await import("/src/lib/tilt.ts");
    S.getState().updateElement(${JSON.stringify(id)}, {
      transform: tilt.serializeImageTilt({ ...tilt.DEFAULT_IMAGE_TILT, tiltX: 20, tiltY: 15 }),
    });
    await new Promise((r) => setTimeout(r, 300));
    await X.renderCanvasDataURL("png", 1);
  })()`);
  const noise = logged.filter((text) => /domtoimage|CSS rules|fonts\.googleapis/.test(text));
  expect(noise).toEqual([]);
});
