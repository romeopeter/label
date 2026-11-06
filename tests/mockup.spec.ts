import { expect, test, type Page } from "@playwright/test";
import rawFrames from "../src/data/deviceFrames.json" with { type: "json" };
import { addTwoToneImage, dragBy, element, expectNear, handle, openApp, toScreen } from "./helpers";

interface Frame {
  device: string;
  finish: string;
  landscape: boolean;
  fit: "fill" | "fit";
  zoom: number;
  panX: number;
  panY: number;
  barColor: string;
  thickness: number;
  roundness: number;
  address: string;
}
interface Framed {
  x: number;
  y: number;
  width: number;
  height: number;
  crop?: { x: number; y: number; width: number; height: number };
  deviceFrame: Frame | null;
}
interface Drawn {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: { x: number; y: number; width: number; height: number };
}

/** The screen of an upright device, as fractions of it. */
const IPHONE = rawFrames.devices.find((device) => device.id === "iphone-14-pro")!;

const rawFramesScreen = (id: string) => rawFrames.devices.find((device) => device.id === id)!.screen;

const roomBelow = (el: Framed, picture: Drawn) => el.height - picture.y - picture.height;

const DEFAULTS = {
  zoom: 1,
  panX: 0,
  panY: 0,
  barColor: "#000000",
  thickness: 1,
  roundness: 1,
  address: "example.com",
};

const frameOn = async (page: Page, id: string, frame: Partial<Frame> & { device: string }) => {
  await page.evaluate(`S.getState().setDeviceFrame(${JSON.stringify(id)}, ${JSON.stringify({
    finish: "default",
    landscape: false,
    fit: "fill",
    ...DEFAULTS,
    ...frame,
  })})`);
  await page.waitForFunction(`!!ST().findOne("#" + ${JSON.stringify(id)}).findOne(".mockup-frame")`);
  await page.waitForTimeout(100);
};

const drawnPicture = (page: Page, id: string): Promise<Drawn> =>
  page.evaluate(`(() => {
    const node = ST().findOne("#" + ${JSON.stringify(id)}).findOne(".mockup-picture");
    return { x: node.x(), y: node.y(), width: node.width(), height: node.height(), crop: node.crop() };
  })()`);

/** A pixel of the finished canvas, as an export would see it, overlays hidden. */
const stagePixel = (page: Page, x: number, y: number): Promise<number[]> =>
  page.evaluate(`(() => {
    const stage = ST();
    const scale = stage.scaleX();
    const transformers = stage.find("Transformer");
    transformers.forEach((t) => t.visible(false));
    const canvas = stage.toCanvas({ pixelRatio: 1 / scale });
    transformers.forEach((t) => t.visible(true));
    const context = canvas.getContext("2d");
    return [...context.getImageData(${Math.round(x)}, ${Math.round(y)}, 1, 1).data];
  })()`);

test("the corners of a rounded screen don't stick out past the phone", async ({ page }) => {
  await openApp(page);
  const id = await addTwoToneImage(page);
  await frameOn(page, id, { device: "iphone-17", finish: "black" });
  await page.evaluate(`(() => {
    const s = S.getState();
    s.updateElement(${JSON.stringify(id)}, { shadow: undefined, x: 300, y: 100 });
    s.setBackground?.({ mode: "solid", color: "#FF00FF" });
  })()`);
  await page.waitForTimeout(200);
  const el = await element<Framed>(page, id);
  // Where the screen's square corner would land: outside the device's rounded edge.
  const screen = rawFramesScreen("iphone-17");
  const x = el.x + screen.x * el.width;
  const y = el.y + screen.y * el.height;
  const pixel = await stagePixel(page, x - 1, y - 1);
  const green = [29, 158, 117];
  expect(green.every((value, i) => Math.abs(value - pixel[i]) < 12)).toBe(false);
});

test("no device is offered twice, and the removed ones are gone", () => {
  const ids = rawFrames.devices.map((device) => device.id);
  const labels = rawFrames.devices.map((device) => device.label);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(labels).size).toBe(labels.length);
  for (const removed of ["iphone-14", "iphone-x", "iphone-8", "the-iphone", "google-pixel"]) {
    expect(ids).not.toContain(removed);
  }
});

test.describe("device artwork", () => {
  test("every frame has a clean hole exactly where its screen area says", async ({ page }) => {
    await page.goto("/");
    const problems = await page.evaluate<string[]>(`(async (devices) => {
      const problems = [];
      for (const device of devices) {
        for (const finish of device.finishes) {
          const name = device.id + "-" + finish.id;
          const image = new Image();
          image.src = "/frames/" + name + ".png";
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const alpha = (x, y) => pixels[(Math.round(y) * canvas.width + Math.round(x)) * 4 + 3];

          const scale = canvas.width / device.width;
          const left = device.screen.x * canvas.width;
          const top = device.screen.y * canvas.height;
          const right = left + device.screen.width * canvas.width;
          const bottom = top + device.screen.height * canvas.height;
          const middleX = (left + right) / 2;
          const middleY = (top + bottom) / 2;
          const check = (what, x, y, ok) => {
            const value = alpha(x, y);
            if (!ok(value)) problems.push(name + ": " + what + " has alpha " + value);
          };
          const clear = (value) => value === 0;
          const solid = (value) => value === 255;

          // Well inside, it must be see-through; a notch is at the top, so that side is skipped.
          check("the screen's middle", middleX, middleY, clear);
          check("just inside the left", left + scale * 2, middleY, clear);
          check("just inside the right", right - scale * 2, middleY, clear);
          check("just inside the bottom", middleX, bottom - scale * 2, clear);
          // Just outside, the picture is drawn a little further, so the frame has to hide it.
          check("just outside the left", left - scale, middleY, solid);
          check("just outside the right", right + scale, middleY, solid);
          check("just outside the bottom", middleX, bottom + scale, solid);
          check("just outside the top", middleX, top - scale, solid);
          // Past a rounded corner the picture is clipped, so that curve has to be covered too.
          [[left, top, 1, 1], [right, top, -1, 1], [right, bottom, -1, -1], [left, bottom, 1, -1]].forEach(
            ([x, y, inX, inY], i) => {
              const radius = device.corners[i] * canvas.width;
              // At least two pixels out, past the soft edge of a less detailed frame.
              const reach = (radius + Math.max(scale, 2)) * Math.SQRT1_2;
              check(
                "outside corner " + i,
                x + inX * (radius - reach),
                y + inY * (radius - reach),
                solid,
              );
            },
          );
        }
      }
      return problems;
    })`.replace(/\)$/, `)(${JSON.stringify(rawFrames.devices)})`));
    expect(problems).toEqual([]);
  });
});

test.describe("a picture on a device", () => {
  test("choosing a phone in the panel gives the box its shape and turns it for a wide picture", async ({ page }) => {
    const errors = await openApp(page, "Mockup");
    const id = await addTwoToneImage(page);
    const before = await element<Framed>(page, id);

    await page.getByRole("radio", { name: "Devices", exact: true }).click();
    await page.getByRole("button", { name: "iPhone 14 Pro", exact: true }).click();
    await page.waitForTimeout(300);

    const framed = await element<Framed>(page, id);
    expect(framed.deviceFrame).toEqual({ ...DEFAULTS, device: "iphone-14-pro", finish: "default", landscape: true, fit: "fill" });
    expect(framed.width / framed.height).toBeCloseTo(IPHONE.height / IPHONE.width, 2);
    // It stays where it was.
    expect(framed.x + framed.width / 2).toBeCloseTo(before.x + before.width / 2, 0);
    expect(framed.y + framed.height / 2).toBeCloseTo(before.y + before.height / 2, 0);
    expect(errors).toEqual([]);
  });

  for (const device of rawFrames.devices) {
    test(`${device.id}: the picture fills its screen and isn't stretched`, async ({ page }) => {
      const errors = await openApp(page);
      const id = await addTwoToneImage(page);
      await frameOn(page, id, {
        device: device.id,
        finish: device.finishes[0].id,
        landscape: device.width > device.height,
      });

      const el = await element<Framed>(page, id);
      const picture = await drawnPicture(page, id);
      expect(el.width / el.height).toBeCloseTo(device.width / device.height, 2);

      // On the screen, give or take the sliver drawn under the frame.
      const slop = Math.max(el.width, el.height) * 0.004;
      expect(Math.abs(picture.x - device.screen.x * el.width)).toBeLessThan(slop);
      expect(Math.abs(picture.y - device.screen.y * el.height)).toBeLessThan(slop);
      expect(Math.abs(picture.width - device.screen.width * el.width)).toBeLessThan(slop * 2);
      expect(Math.abs(picture.height - device.screen.height * el.height)).toBeLessThan(slop * 2);

      // What's taken from the picture has the shape it's drawn at.
      expect(picture.crop.width / picture.crop.height).toBeCloseTo(picture.width / picture.height, 3);
      expect(errors).toEqual([]);
    });
  }

  test("the finished pixels: picture in the screen, notch and frame on top", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro", finish: "black" });
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { shadow: undefined })`);
    await page.waitForTimeout(150);
    const el = await element<Framed>(page, id);

    const at = (fx: number, fy: number) => stagePixel(page, el.x + fx * el.width, el.y + fy * el.height);
    // The two-tone picture's middle is cropped to its centre: left half green, right half grey.
    expectNear(await at(0.3, 0.5), [29, 158, 117, 255], 4);
    expectNear(await at(0.7, 0.5), [200, 200, 200, 255], 4);
    // The island sits over the screen.
    const island = await at(0.5, IPHONE.screen.y + 0.02);
    expect(Math.max(...island.slice(0, 3))).toBeLessThan(40);
    expect(errors).toEqual([]);
  });

  test("landscape: the frame turns, the notch moves, and the picture stays upright", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro", finish: "black", landscape: true });
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { shadow: undefined })`);
    await page.waitForTimeout(150);

    const el = await element<Framed>(page, id);
    expect(el.width).toBeGreaterThan(el.height);

    const at = (fx: number, fy: number) => stagePixel(page, el.x + fx * el.width, el.y + fy * el.height);
    expectNear(await at(0.3, 0.5), [29, 158, 117, 255], 4);
    expectNear(await at(0.7, 0.5), [200, 200, 200, 255], 4);
    const island = await at(IPHONE.screen.y + 0.02, 0.5);
    expect(Math.max(...island.slice(0, 3))).toBeLessThan(40);
    expect(errors).toEqual([]);
  });

  test("fit shows all of the picture, with bars, and fill doesn't", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro", fit: "fit" });

    const picture = await drawnPicture(page, id);
    expect(picture.crop).toEqual({ x: 0, y: 0, width: 800, height: 400 });
    expect(picture.width / picture.height).toBeCloseTo(2, 3);
    expect(errors).toEqual([]);
  });

  test("resizing keeps the device's shape, from corners only", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "macbook-pro", finish: "silver" });
    await page.evaluate(`S.getState().selectElement(${JSON.stringify(id)})`);
    await page.waitForTimeout(200);

    const before = await element<Framed>(page, id);
    await dragBy(page, await handle(page, "bottom-right"), { x: -60, y: -10 });
    const after = await element<Framed>(page, id);

    expect(after.width).toBeLessThan(before.width);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 2);
    const anchors = await page.evaluate<string[]>(`ST().find("Transformer").filter((t) => t.nodes().length)[0].enabledAnchors()`);
    expect(anchors).not.toContain("middle-left");
    expect(errors).toEqual([]);
  });

  test("undo takes back the device and its shape together", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    const before = await element<Framed>(page, id);
    // Changes close together are one undo step, so let adding the image finish.
    await page.waitForTimeout(800);
    await frameOn(page, id, { device: "iphone-14-pro" });
    await page.evaluate(`S.getState().undo()`);
    await page.waitForTimeout(150);

    const after = await element<Framed>(page, id);
    expect(after.deviceFrame).toBeNull();
    expect(after.width).toBeCloseTo(before.width, 3);
    expect(after.height).toBeCloseTo(before.height, 3);
    expect(errors).toEqual([]);
  });

  test("taking it off the device restores the picture's own shape", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro" });
    await page.evaluate(`S.getState().setDeviceFrame(${JSON.stringify(id)}, null)`);

    const el = await element<Framed>(page, id);
    expect(el.width / el.height).toBeCloseTo(2, 2);
    expect(errors).toEqual([]);
  });

  test("crop keeps to the screen's shape, and the screen then shows just that part", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "macbook-pro", finish: "silver" });

    await page.evaluate(`S.getState().selectElement(${JSON.stringify(id)}); S.getState().setCropId(${JSON.stringify(id)})`);
    await page.waitForTimeout(300);
    const before = await element<Framed>(page, id);
    const screenRatio =
      (rawFrames.devices.find((d) => d.id === "macbook-pro")!.screen.width * before.width) /
      (rawFrames.devices.find((d) => d.id === "macbook-pro")!.screen.height * before.height);

    const win = () =>
      page.evaluate<{ width: number; height: number }>(`(() => {
        const node = ST().findOne(".crop-window");
        return { width: node.width(), height: node.height() };
      })()`);
    expect((await win()).width / (await win()).height).toBeCloseTo(screenRatio, 2);

    await dragBy(page, await handle(page, "bottom-right"), { x: -40, y: -40 });
    const shrunk = await win();
    expect(shrunk.width / shrunk.height).toBeCloseTo(screenRatio, 2);

    await page.getByRole("button", { name: "Apply crop" }).click();
    await page.waitForTimeout(200);

    const after = await element<Framed>(page, id);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    const picture = await drawnPicture(page, id);
    // Within a pixel or two of the picture: it's drawn a sliver past the screen.
    expect(Math.abs(picture.crop.width - after.crop!.width * 800)).toBeLessThan(2);
    expect(Math.abs(picture.crop.height - after.crop!.height * 400)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });

  test("a browser wraps its picture exactly, with a rounded bottom", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "safari", finish: "dark", landscape: true });

    const el = await element<Framed>(page, id);
    const picture = await drawnPicture(page, id);
    expect(picture.crop.x).toBeCloseTo(0, 3);
    expect(picture.crop.y).toBeCloseTo(0, 3);
    expect(picture.crop.width).toBeCloseTo(800, 3);
    expect(picture.crop.height).toBeCloseTo(400, 3);
    expect(picture.width / picture.height).toBeCloseTo(2, 3);
    expect(picture.width).toBeCloseTo(el.width, 3);
    expect(picture.y + picture.height).toBeCloseTo(el.height, 3);
    expect(errors).toEqual([]);
  });

  const EVEN_SCREENS: [string, string][] = [
    ["glass-light", "default"],
    ["glass-dark", "default"],
    ["liquid", "default"],
    ["inset-light", "default"],
    ["inset-dark", "default"],
    ["outline", "light"],
    ["outline", "dark"],
    ["border", "light"],
    ["border", "dark"],
    ["card", "light"],
    ["card", "dark"],
  ];
  for (const [style, finish] of EVEN_SCREENS) {
    test(`${style} ${finish}: wraps the whole picture, with room around it`, async ({ page }) => {
      const errors = await openApp(page);
      const id = await addTwoToneImage(page);
      await frameOn(page, id, { device: style, finish, landscape: true });

      const el = await element<Framed>(page, id);
      const picture = await drawnPicture(page, id);
      expect(picture.crop.width).toBeCloseTo(800, 3);
      expect(picture.crop.height).toBeCloseTo(400, 3);
      expect(picture.width / picture.height).toBeCloseTo(2, 3);

      // Centred, with the same room on every side.
      expect(picture.x).toBeGreaterThan(0);
      expect(picture.y).toBeCloseTo(picture.x, 3);
      expect(el.width - picture.x - picture.width).toBeCloseTo(picture.x, 3);
      expect(el.height - picture.y - picture.height).toBeCloseTo(picture.x, 3);

      await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { shadow: undefined })`);
      await page.waitForTimeout(150);
      const at = (fx: number) =>
        stagePixel(page, el.x + picture.x + fx * picture.width, el.y + picture.y + picture.height / 2);
      expectNear(await at(0.25), [29, 158, 117, 255], 4);
      expectNear(await at(0.75), [200, 200, 200, 255], 4);
      expect(errors).toEqual([]);
    });
  }

  test("the panel offers each window style and hides what doesn't apply", async ({ page }) => {
    const errors = await openApp(page, "Mockup");
    const id = await addTwoToneImage(page);
    await page.getByRole("button", { name: "Line", exact: true }).click();
    await page.waitForTimeout(250);

    const el = await element<Framed>(page, id);
    expect(el.deviceFrame).toMatchObject({ device: "outline", finish: "light" });
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Fit", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Address")).toHaveCount(0);

    await page.getByRole("button", { name: "Dark", exact: true }).click();
    expect((await element<Framed>(page, id)).deviceFrame?.finish).toBe("dark");

    // Tint has a tile for each tone, so it has no colour to choose.
    await page.getByRole("button", { name: "Tint Dark", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("cropping a window keeps it wrapped around what's left", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "inset-dark", landscape: true });
    const before = await element<Framed>(page, id);

    await page.evaluate(`S.getState().selectElement(${JSON.stringify(id)}); S.getState().setCropId(${JSON.stringify(id)})`);
    await page.waitForTimeout(300);
    await dragBy(page, await handle(page, "middle-left"), { x: 150, y: 0 });
    await page.getByRole("button", { name: "Apply crop" }).click();
    await page.waitForTimeout(200);

    const after = await element<Framed>(page, id);
    expect(after.width).toBeCloseTo(before.width, 3);
    expect(after.height).toBeGreaterThan(before.height);
    const picture = await drawnPicture(page, id);
    expect(picture.width / picture.height).toBeCloseTo(picture.crop.width / picture.crop.height, 3);
    expect(roomBelow(after, picture)).toBeCloseTo(picture.x, 3);
    expect(errors).toEqual([]);
  });

  test("in a layout, a device keeps its shape", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro" });
    await page.evaluate(`S.getState().setLayout("side")`);
    await page.waitForTimeout(150);

    const el = await element<Framed>(page, id);
    expect(await page.evaluate(`S.getState().layout.slots[0].id`)).toBe(id);
    expect(el.width / el.height).toBeCloseTo(IPHONE.width / IPHONE.height, 2);
    expect(errors).toEqual([]);
  });

  test("projects saved with the old frame names open on real devices", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    const loaded = await page.evaluate<(Frame | null)[]>(`(() => {
      const s = S.getState();
      const project = s.toProject();
      const base = project.elements.find((e) => e.id === ${JSON.stringify(id)});
      project.elements = [
        { ...base, id: "a", deviceFrame: "iphone-dark" },
        { ...base, id: "b", deviceFrame: "browser-light" },
        { ...base, id: "c", deviceFrame: "something-new" },
        { ...base, id: "d", deviceFrame: { device: "iphone-14", finish: "nope", landscape: true, fit: "fit" } },
        { ...base, id: "e", deviceFrame: { device: "macbook-pro", finish: "spacegray", landscape: true, fit: "fill" } },
        { ...base, id: "f", deviceFrame: { device: "glass", finish: "dark", landscape: true, fit: "fill" } },
        { ...base, id: "g", deviceFrame: { device: "browser", finish: "dark", landscape: true, fit: "fill", zoom: 99 } },
      ];
      s.loadProject(project);
      return S.getState().elements.map((e) => e.deviceFrame);
    })()`);
    expect(loaded).toEqual([
      { ...DEFAULTS, device: "iphone-14-pro", finish: "black", landscape: false, fit: "fill" },
      { ...DEFAULTS, device: "safari", finish: "light", landscape: true, fit: "fill" },
      null,
      { ...DEFAULTS, device: "iphone-17", finish: "black", landscape: true, fit: "fit" },
      { ...DEFAULTS, device: "macbook-pro", finish: "space-black", landscape: true, fit: "fill" },
      { ...DEFAULTS, device: "glass-dark", finish: "default", landscape: true, fit: "fill" },
      { ...DEFAULTS, zoom: 4, device: "safari", finish: "dark", landscape: true, fit: "fill" },
    ]);
    const first = await element<Framed>(page, "a");
    expect(first.width / first.height).toBeCloseTo(IPHONE.width / IPHONE.height, 2);
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});

test.describe("controlling a mockup", () => {
  /** What the picture shows: its middle in the original, and how much of it. */
  const zoomOn = (page: Page, id: string, patch: Partial<Frame>) =>
    page.evaluate(`(() => {
      const s = S.getState();
      const el = s.elements.find((e) => e.id === ${JSON.stringify(id)});
      s.setDeviceFrame(el.id, { ...el.deviceFrame, ...${JSON.stringify(patch)} });
    })()`);

  test("zoom shows less of the picture, in the same screen, without stretching", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "macbook-pro", finish: "silver" });
    const before = await drawnPicture(page, id);

    await zoomOn(page, id, { zoom: 2 });
    await page.waitForTimeout(100);
    const after = await drawnPicture(page, id);

    expect(after.width).toBeCloseTo(before.width, 3);
    expect(after.height).toBeCloseTo(before.height, 3);
    expect(after.crop.width).toBeCloseTo(before.crop.width / 2, 3);
    expect(after.crop.height).toBeCloseTo(before.crop.height / 2, 3);
    // Still centred on the same spot.
    expect(after.crop.x + after.crop.width / 2).toBeCloseTo(before.crop.x + before.crop.width / 2, 3);
    expect(errors).toEqual([]);
  });

  test("moving reaches each edge of the picture and never past it", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-17", finish: "black" });
    await zoomOn(page, id, { zoom: 2, panX: 1, panY: 1 });
    await page.waitForTimeout(100);
    // Moved fully right and down, so the picture's top left corner is showing.
    const topLeft = await drawnPicture(page, id);
    expect(topLeft.crop.x).toBeCloseTo(0, 3);
    expect(topLeft.crop.y).toBeCloseTo(0, 3);

    await zoomOn(page, id, { panX: -1, panY: -1 });
    await page.waitForTimeout(100);
    const bottomRight = await drawnPicture(page, id);
    expect(bottomRight.crop.x + bottomRight.crop.width).toBeCloseTo(800, 3);
    expect(bottomRight.crop.y + bottomRight.crop.height).toBeCloseTo(400, 3);
    expect(errors).toEqual([]);
  });

  test("zooming a fitted picture past the screen stays clipped to the screen", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro", fit: "fit", zoom: 4 });
    const el = await element<Framed>(page, id);
    const picture = await drawnPicture(page, id);
    const slop = Math.max(el.width, el.height) * 0.004;
    expect(picture.x).toBeGreaterThanOrEqual(IPHONE.screen.x * el.width - slop);
    expect(picture.x + picture.width).toBeLessThanOrEqual((IPHONE.screen.x + IPHONE.screen.width) * el.width + slop);
    expect(errors).toEqual([]);
  });

  test("the bars take the colour chosen for them", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-14-pro", finish: "black", fit: "fit", barColor: "#FF00FF" });
    await page.evaluate(`S.getState().updateElement(${JSON.stringify(id)}, { shadow: undefined })`);
    await page.waitForTimeout(150);
    const el = await element<Framed>(page, id);
    const pixel = await stagePixel(page, el.x + el.width * 0.5, el.y + el.height * 0.8);
    expectNear(pixel, [255, 0, 255, 255], 4);
    expect(errors).toEqual([]);
  });

  test("holding Alt and dragging moves the picture and leaves the mockup where it is", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-17", finish: "black" });
    const before = await element<Framed>(page, id);
    const middle = await toScreen(page, before.x + before.width / 2, before.y + before.height / 2);

    await page.keyboard.down("Alt");
    await page.waitForTimeout(50);
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await page.mouse.move(middle.x + 40, middle.y, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    await page.waitForTimeout(100);

    const after = await element<Framed>(page, id);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.deviceFrame?.panX).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("the panel resizes and turns the mockup around its middle, and centres it", async ({ page }) => {
    const errors = await openApp(page, "Mockup");
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "iphone-17", finish: "black" });
    await page.getByRole("button", { name: "Center on canvas" }).click();
    const canvas = await page.evaluate<{ width: number; height: number }>(`S.getState().canvas`);
    const before = await element<Framed>(page, id);
    expect(before.x + before.width / 2).toBeCloseTo(canvas.width / 2, 3);
    expect(before.y + before.height / 2).toBeCloseTo(canvas.height / 2, 3);

    const size = page.locator("div", { hasText: /^SIZE/ }).getByRole("slider").first();
    await size.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const after = await element<Framed>(page, id);
    expect(after.width).toBeLessThan(before.width);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 3);
    expect(after.x + after.width / 2).toBeCloseTo(canvas.width / 2, 3);

    await page.evaluate(`(async () => {
      const m = await import("/src/lib/mockups.ts");
      const s = S.getState();
      const el = s.elements.find((e) => e.id === ${JSON.stringify(id)});
      s.updateElement(el.id, m.rotatedTo(el, 30));
    })()`);
    const turned = await element<Framed & { rotation: number }>(page, id);
    const angle = (30 * Math.PI) / 180;
    const middleX = turned.x + (turned.width / 2) * Math.cos(angle) - (turned.height / 2) * Math.sin(angle);
    expect(middleX).toBeCloseTo(canvas.width / 2, 3);
    expect(errors).toEqual([]);
  });

  test("applying a crop starts zoom over, on what the screen was showing", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "macbook-pro", finish: "silver", zoom: 2 });
    const shown = await drawnPicture(page, id);

    await page.evaluate(`S.getState().selectElement(${JSON.stringify(id)}); S.getState().setCropId(${JSON.stringify(id)})`);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Apply crop" }).click();
    await page.waitForTimeout(200);

    const el = await element<Framed>(page, id);
    expect(el.deviceFrame?.zoom).toBe(1);
    const after = await drawnPicture(page, id);
    expect(Math.abs(after.crop.width - shown.crop.width)).toBeLessThan(2);
    expect(Math.abs(after.crop.x - shown.crop.x)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
});

test.describe("screens and windows", () => {
  for (const [kind, names] of [
    ["Screens", ["Plain", "Tint Light", "Tint Dark", "Shine", "Matte Light", "Matte Dark", "Line", "Edge", "Block", "Paper", "Pile", "Steps"]],
    ["Windows", ["Safari", "Safari Tablet", "Safari Mobile", "Edge", "Firefox", "Brave", "Chrome", "Chrome Tablet", "Chrome Mobile"]],
  ] as [string, string[]][]) {
    test(`the ${kind} tab offers each of its own and nothing else`, async ({ page }) => {
      const errors = await openApp(page, "Mockup");
      await addTwoToneImage(page);
      await page.getByRole("radio", { name: kind, exact: true }).click();
      for (const name of names) {
        await page.getByRole("button", { name, exact: true }).click();
        await page.waitForTimeout(60);
      }
      await expect(page.getByRole("button", { name: "MacBook Pro", exact: true })).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  for (const device of ["safari", "edge", "firefox", "brave", "chrome"]) {
    test(`${device}: wraps the whole picture under its bars`, async ({ page }) => {
      const errors = await openApp(page);
      const id = await addTwoToneImage(page);
      await frameOn(page, id, { device, finish: "dark" });
      const el = await element<Framed>(page, id);
      const picture = await drawnPicture(page, id);
      expect(picture.y).toBeGreaterThan(0);
      expect(picture.width).toBeCloseTo(el.width, 3);
      expect(picture.y + picture.height).toBeCloseTo(el.height, 3);
      expect(picture.width / picture.height).toBeCloseTo(2, 3);
      expect(errors).toEqual([]);
    });
  }

  test("a phone browser keeps its shape, and its bars don't cover the picture", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "safari-mobile", finish: "light" });
    const el = await element<Framed>(page, id);
    expect(el.width / el.height).toBeCloseTo(390 / 844, 3);
    const picture = await drawnPicture(page, id);
    expect(picture.y).toBeCloseTo((54 / 844) * el.height, 2);
    expect(el.height - picture.y - picture.height).toBeCloseTo((108 / 844) * el.height, 2);
    // Filled, not stretched.
    expect(picture.crop.width / picture.crop.height).toBeCloseTo(picture.width / picture.height, 3);
    expect(errors).toEqual([]);
  });

  test("a tablet browser turns", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "chrome-tablet", finish: "light", landscape: true });
    const wide = await element<Framed>(page, id);
    expect(wide.width / wide.height).toBeCloseTo(900 / 625, 3);
    await page.evaluate(`(() => {
      const s = S.getState();
      const el = s.elements.find((e) => e.id === ${JSON.stringify(id)});
      s.setDeviceFrame(el.id, { ...el.deviceFrame, landscape: false });
    })()`);
    const tall = await element<Framed>(page, id);
    expect(tall.width / tall.height).toBeCloseTo(625 / 900, 3);
    expect(errors).toEqual([]);
  });

  test("a browser's address can be changed from the panel", async ({ page }) => {
    const errors = await openApp(page, "Mockup");
    const id = await addTwoToneImage(page);
    await page.getByRole("radio", { name: "Windows", exact: true }).click();
    await page.getByRole("button", { name: "Chrome", exact: true }).click();
    await page.getByLabel("Address").fill("layer.app/pricing");
    await page.waitForTimeout(100);
    expect((await element<Framed>(page, id)).deviceFrame?.address).toBe("layer.app/pricing");
    const drawn = await page.evaluate<string[]>(`ST().findOne("#" + ${JSON.stringify(id)}).find("Text").map((t) => t.text())`);
    expect(drawn).toContain("layer.app/pricing");
    expect(errors).toEqual([]);
  });

  test("thicker frames keep the picture's shape, and corners can be squared off", async ({ page }) => {
    const errors = await openApp(page);
    const id = await addTwoToneImage(page);
    await frameOn(page, id, { device: "border", finish: "dark", thickness: 3, roundness: 0 });
    const thick = await drawnPicture(page, id);
    expect(thick.width / thick.height).toBeCloseTo(2, 3);
    const thin = thick.x;
    await frameOn(page, id, { device: "border", finish: "dark", thickness: 1 });
    expect((await drawnPicture(page, id)).x).toBeLessThan(thin);
    expect(errors).toEqual([]);
  });

  test("a picture's corners never poke out past its frame, however it's adjusted", async ({ page }) => {
    await openApp(page);
    const problems = await page.evaluate<string[]>(`(async () => {
      const m = await import("/src/lib/mockups.ts");
      const problems = [];
      for (const device of m.DEVICES.filter((d) => !d.width)) {
        for (const thickness of [0, 0.2, 1, 3]) {
          for (const roundness of [0, 1, 3]) {
            for (const landscape of [true, false]) {
              const frame = { ...m.newFrame(device, 1.5), landscape, thickness, roundness };
              const style = m.windowStyleOf(frame);
              const shape = m.frameShape(frame, 1.5);
              const longest = Math.max(1, 1 / shape.ratio);
              const screenBottom = (shape.screen.y + shape.screen.height) / shape.ratio;
              const bottomPad = 1 / shape.ratio - screenBottom;
              // The outer curve's centre and the screen curve's, measured in from a corner.
              [
                [style.left, shape.screen.y / shape.ratio, shape.corners[0]],
                [shape.screen.x, bottomPad, shape.corners[3]],
              ].forEach(([inX, inY, corner]) => {
                const r = corner * longest;
                const dx = style.radius - inX - r;
                const dy = style.radius - inY - r;
                if (dx > 0 && dy > 0 && Math.hypot(dx, dy) + r > style.radius + 1e-6) {
                  problems.push(device.id + " thickness " + thickness + " corners " + roundness);
                }
              });
            }
          }
        }
      }
      return problems;
    })()`);
    expect(problems).toEqual([]);
  });

  for (const [device, side] of [["retro", "below"], ["stack", "below"], ["stack-2", "before"]] as const) {
    test(`${device}: leaves room for what's behind the picture`, async ({ page }) => {
      const errors = await openApp(page);
      const id = await addTwoToneImage(page);
      await frameOn(page, id, { device, finish: "light" });
      const el = await element<Framed>(page, id);
      const picture = await drawnPicture(page, id);
      expect(picture.width / picture.height).toBeCloseTo(2, 3);
      if (side === "below") {
        expect(roomBelow(el, picture)).toBeGreaterThan(picture.y);
      } else {
        expect(picture.x).toBeGreaterThan(0);
        expect(picture.y).toBeGreaterThan(0);
        expect(roomBelow(el, picture)).toBeCloseTo(0, 3);
      }
      expect(errors).toEqual([]);
    });
  }
});
