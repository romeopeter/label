import { expect, test } from "@playwright/test";
import { fakeShell, openApp, PNG_2X2, shellCalls } from "./helpers";

const BUTTON = { name: "Add screenshot", exact: true };
const images = (page: import("@playwright/test").Page) =>
  page.evaluate<string[]>(`S.getState().elements.filter((e) => e.type === "image").map((e) => e.src.slice(0, 15))`);

const pngBytes = `Uint8Array.from(atob("${PNG_2X2}"), (c) => c.charCodeAt(0)).buffer`;

test.describe("on the macOS desktop", () => {
  test.skip(process.platform !== "darwin", "The native path is chosen on macOS");

  test("adds to the canvas once captured, and becomes a background", async ({ page }) => {
    await fakeShell(page, `(command) => command === "capture_screen" ? ${pngBytes} : null`);
    const errors = await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await page.getByRole("dialog", { name: "Choose an area" }).getByRole("button", { name: "Capture" }).click();
    await expect.poll(() => images(page)).toEqual(["data:image/png;"]);
    expect(await shellCalls(page, "capture_screen")).toHaveLength(1);
    expect(await page.evaluate(`S.getState().cropId`)).toBeNull();

    await page.getByRole("button", { name: "Background", exact: true }).click();
    await page.getByRole("radio", { name: "Image" }).click();
    await page.getByRole("button", BUTTON).click();
    await page.keyboard.press("Space");
    await expect
      .poll(() => page.evaluate(`S.getState().background.imageSrc?.slice(0, 15)`))
      .toBe("data:image/png;");
    expect(await images(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("a cancel adds nothing and says nothing", async ({ page }) => {
    await fakeShell(page, `(command) => command === "capture_screen" ? new ArrayBuffer(0) : null`);
    await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    await expect(page.getByRole("button", BUTTON)).toBeEnabled();
    expect(await images(page)).toEqual([]);
  });

  test("a refused permission explains what to do, and can be retried", async ({ page }) => {
    await fakeShell(page, `(command) => { if (command === "capture_screen") throw "Allow Layer under Screen Recording in System Settings."; return null; }`);
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

  /** Size of the image the screenshot added. */
  const addedSize = (page: import("@playwright/test").Page) =>
    page.evaluate<number[]>(`(async () => {
      const i = new Image(); i.src = S.getState().elements[0].src; await i.decode();
      return [i.width, i.height];
    })()`);

  /** A point on the screenshot in the picker, as shares of its size. */
  const onPicture = async (page: import("@playwright/test").Page, x: number, y: number) => {
    const box = await page.getByRole("img", { name: "Your screen" }).boundingBox();
    if (!box) throw new Error("The picker isn't showing");
    return { x: box.x + box.width * x, y: box.y + box.height * y };
  };

  const drag = async (page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  };

  test("takes one frame, stops sharing, and keeps the whole screen if no area is chosen", async ({ page }) => {
    await useFrame(page);
    const errors = await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();
    const picker = page.getByRole("dialog", { name: "Choose an area" });
    await expect(picker).toBeVisible();
    expect(await page.evaluate(`STREAM.getTracks().every((t) => t.readyState === "ended")`)).toBe(true);
    expect(await images(page)).toEqual([]);

    await picker.getByRole("button", { name: "Capture" }).click();
    await expect.poll(() => images(page)).toEqual(["data:image/png;"]);
    await expect(picker).toHaveCount(0);
    expect(await page.evaluate(`S.getState().cropId`)).toBeNull();
    expect(await addedSize(page)).toEqual([640, 360]);
    expect(errors).toEqual([]);
  });

  test("an area can be chosen, then moved and resized, before it's kept", async ({ page }) => {
    await useFrame(page);
    const errors = await openApp(page, "Images");
    await page.getByRole("button", BUTTON).click();

    // A quarter of the screen, from the middle of the top-left quarter.
    await drag(page, await onPicture(page, 0.25, 0.25), await onPicture(page, 0.75, 0.75));
    await expect(page.getByText("320 × 180")).toBeVisible();

    // Its right side pulled in to three-fifths, then the whole box moved left.
    const right = await page.locator("[data-handle=right]").boundingBox();
    if (!right) throw new Error("No handle");
    await drag(page, { x: right.x + right.width / 2, y: right.y + right.height / 2 }, await onPicture(page, 0.6, 0.5));
    await expect(page.getByText("224 × 180")).toBeVisible();
    await drag(page, await onPicture(page, 0.4, 0.5), await onPicture(page, 0.2, 0.5));
    await expect(page.getByText("224 × 180")).toBeVisible();

    // Space captures, and the area's own pixels are what's kept.
    await page.keyboard.press("Space");
    await expect.poll(() => images(page)).toEqual(["data:image/png;"]);
    expect(await addedSize(page)).toEqual([224, 180]);
    expect(errors).toEqual([]);
  });

  test("Esc and Cancel keep nothing, and keys don't reach the editor", async ({ page }) => {
    await useFrame(page);
    await openApp(page, "Images");
    await page.evaluate(`S.getState().selectElement(S.getState().addShape("rect", { x: 10, y: 10, width: 100, height: 100 }))`);

    await page.getByRole("button", BUTTON).click();
    await expect(page.getByRole("dialog", { name: "Choose an area" })).toBeVisible();
    // Delete would remove the selected shape if it got through.
    await page.keyboard.press("Delete");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Choose an area" })).toHaveCount(0);

    await page.getByRole("button", BUTTON).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Choose an area" })).toHaveCount(0);
    expect(await images(page)).toEqual([]);
    expect(await page.evaluate(`S.getState().elements.length`)).toBe(1);
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
