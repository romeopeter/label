import { expect, test } from "@playwright/test";
import { fakeShell, openApp, PNG_2X2, shellCalls } from "./helpers";

const BUTTON = { name: "Add screenshot", exact: true };
const images = (page: import("@playwright/test").Page) =>
  page.evaluate<string[]>(`S.getState().elements.filter((e) => e.type === "image").map((e) => e.src.slice(0, 15))`);

const pngBytes = `Uint8Array.from(atob("${PNG_2X2}"), (c) => c.charCodeAt(0)).buffer`;

test.describe("on the macOS desktop", () => {
  test.skip(process.platform !== "darwin", "The native path is chosen on macOS");

  test("adds to the canvas without cropping, and becomes a background", async ({ page }) => {
    await fakeShell(page, `() => ${pngBytes}`);
    const errors = await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect.poll(() => images(page)).toEqual(["data:image/png;"]);
    expect(await shellCalls(page, "capture_screen")).toHaveLength(1);
    expect(await page.evaluate(`S.getState().cropId`)).toBeNull();

    await page.getByRole("button", { name: "Background", exact: true }).click();
    await page.getByRole("radio", { name: "Image" }).click();
    await page.getByRole("button", BUTTON).click();
    await expect
      .poll(() => page.evaluate(`S.getState().background.imageSrc?.slice(0, 15)`))
      .toBe("data:image/png;");
    expect(await images(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("a cancel adds nothing and says nothing", async ({ page }) => {
    await fakeShell(page, `() => new ArrayBuffer(0)`);
    await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect(page.getByRole("button", BUTTON)).toBeEnabled();
    expect(await images(page)).toEqual([]);
  });

  test("a refused permission explains what to do, and can be retried", async ({ page }) => {
    await fakeShell(page, `() => { throw "Allow Layer under Screen Recording in System Settings."; }`);
    await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect(page.getByText("Allow Layer under Screen Recording")).toBeVisible();
    await expect(page.getByRole("button", BUTTON)).toBeEnabled();
  });
});

test.describe("with the browser's picker", () => {
  const useFrame = (page: import("@playwright/test").Page) =>
    page.addInitScript(`
      Object.defineProperty(navigator, "mediaDevices", { value: {
        getDisplayMedia: async () => {
          const c = document.createElement("canvas");
          c.width = 640; c.height = 360;
          const g = c.getContext("2d");
          const draw = () => { g.fillStyle = "#33aa66"; g.fillRect(0, 0, 640, 360); };
          draw(); setInterval(draw, 50);
          window.STREAM = c.captureStream(30);
          return window.STREAM;
        },
      } });
    `);

  test("takes one frame, stops sharing, and goes straight to Crop", async ({ page }) => {
    await useFrame(page);
    const errors = await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect.poll(() => images(page)).toEqual(["data:image/png;"]);

    expect(await page.evaluate(`S.getState().cropId === S.getState().elements[0].id`)).toBe(true);
    expect(await page.evaluate(`STREAM.getTracks().every((t) => t.readyState === "ended")`)).toBe(true);
    const size = await page.evaluate<number[]>(`(async () => {
      const i = new Image(); i.src = S.getState().elements[0].src; await i.decode();
      return [i.width, i.height];
    })()`);
    expect(size).toEqual([640, 360]);
    expect(errors).toEqual([]);
  });

  test("closing the picker is silent; no support explains", async ({ page }) => {
    await page.addInitScript(`
      Object.defineProperty(navigator, "mediaDevices", { value: {
        getDisplayMedia: async () => { throw new DOMException("no", window.PICKER_ERROR); },
      } });
      window.PICKER_ERROR = "NotAllowedError";
    `);
    await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect(page.getByRole("button", BUTTON)).toBeEnabled();
    await expect(page.getByText("aren't available")).toHaveCount(0);

    await page.evaluate(`window.PICKER_ERROR = "NotSupportedError"`);
    await page.getByRole("button", BUTTON).click();
    await expect(page.getByText("aren't available")).toBeVisible();
  });
});
