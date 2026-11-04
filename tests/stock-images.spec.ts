import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { fakeShell, openApp, PNG_2X2, shellCalls } from "./helpers";

const PORT = 5199;

/** Serves the page under the real app's CSP, so a blocked image would show. */
const useAppCsp = (page: Page) => {
  const config = JSON.parse(
    readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
  );
  const csp = config.app.security.devCsp.replaceAll("5173", String(PORT));
  return page.route(`http://127.0.0.1:${PORT}/`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
};

const shell = `(command, args) => {
  const hit = (i) => ({ id: i, tags: "flower, " + i, previewUrl: "data:image/png;base64,${PNG_2X2}", largeImageUrl: "https://pixabay.com/get/x" + i + "_1280.jpg" });
  if (command === "search_images") {
    if (window.MODE === "rate") throw "Too many searches right now. Try again in a minute.";
    if (args.query === "zzzz") return { images: [], hasMore: false };
    const wait = args.query === "slow" ? 1500 : 0;
    const shift = args.query === "slow" ? 1000 : 0;
    return new Promise((done) => setTimeout(() => done({
      images: Array.from({ length: 30 }, (_, i) => hit(i + (args.page - 1) * 30 + shift)),
      hasMore: args.page < 2,
    }), wait));
  }
  if (command === "download_image") {
    if (window.MODE === "download") throw "Layer couldn't reach Pixabay. Check your connection and try again.";
    return Uint8Array.from(atob("${PNG_2X2}"), (c) => c.charCodeAt(0)).buffer;
  }
}`;

test.describe("on the desktop", () => {
  test.beforeEach(async ({ page }) => {
    await fakeShell(page, shell);
  });

  const box = (page: Page) => page.getByRole("searchbox", { name: "Search free images" });
  const tiles = (page: Page) => page.getByRole("button", { name: /^Use image:/ });

  test("searches once typing pauses, credits Pixabay, and pages", async ({ page }) => {
    await useAppCsp(page);
    const errors = await openApp(page, "Images");
    await expect(page.getByText("Images from Pixabay")).toHaveCount(0);

    await box(page).pressSequentially("flower", { delay: 30 });
    expect(await shellCalls(page, "search_images")).toHaveLength(0);
    await expect(tiles(page)).toHaveCount(30);

    const calls = await shellCalls(page, "search_images");
    expect(calls).toEqual([{ query: "flower", page: 1 }]);
    await expect(page.getByText("Images from Pixabay")).toBeVisible();

    const rects = await tiles(page).evaluateAll((nodes) =>
      nodes.slice(0, 4).map((node) => {
        const r = node.getBoundingClientRect();
        return { width: r.width, height: r.height, top: r.top, bottom: r.bottom };
      }),
    );
    for (const r of rects) expect(Math.abs(r.width - r.height)).toBeLessThan(1);
    expect(rects[3].top).toBeGreaterThanOrEqual(rects[0].bottom);

    await page.getByRole("button", { name: "More images", exact: true }).click();
    await expect(tiles(page)).toHaveCount(60);
    await expect(page.getByRole("button", { name: "More images", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a chosen image is downloaded and embedded on the canvas", async ({ page }) => {
    await openApp(page, "Images");
    await box(page).fill("flower");
    await tiles(page).first().click();
    await expect
      .poll(() => page.evaluate(`S.getState().elements[0]?.src.slice(0, 11)`))
      .toBe("data:image/");
    expect(await shellCalls(page, "download_image")).toEqual([
      { url: "https://pixabay.com/get/x0_1280.jpg" },
    ]);
  });

  test("becomes the background from the Background panel", async ({ page }) => {
    await openApp(page, "Background");
    await page.getByRole("radio", { name: "Image" }).click();
    await box(page).fill("sky");
    await tiles(page).first().click();
    await expect
      .poll(() => page.evaluate(`S.getState().background.imageSrc?.slice(0, 11)`))
      .toBe("data:image/");
    expect(await page.evaluate(`S.getState().elements.length`)).toBe(0);
  });

  test("an older, slower search can't replace a newer one", async ({ page }) => {
    await openApp(page, "Images");
    await box(page).fill("slow");
    await expect.poll(async () => (await shellCalls(page, "search_images")).length).toBe(1);
    await box(page).fill("flower");
    await expect(tiles(page)).toHaveCount(30);
    await page.waitForTimeout(1600);
    await expect(tiles(page).first()).toHaveAttribute("aria-label", "Use image: flower, 0");
  });

  test("empty results and failures explain themselves", async ({ page }) => {
    await openApp(page, "Images");
    await box(page).fill("zzzz");
    await expect(page.getByText("No images found. Try another word.")).toBeVisible();
    await expect(page.getByText("Images from Pixabay")).toHaveCount(0);

    await box(page).fill("");
    await expect(page.getByText("No images found")).toHaveCount(0);

    await page.evaluate(`window.MODE = "rate"`);
    await box(page).fill("flower");
    await expect(page.getByText("Too many searches")).toBeVisible();

    await page.evaluate(`window.MODE = "download"`);
    await box(page).fill("flowers");
    await tiles(page).first().click();
    await expect(page.getByText("couldn't reach Pixabay")).toBeVisible();
    expect(await page.evaluate(`S.getState().elements.length`)).toBe(0);
    await expect(tiles(page).first()).toBeEnabled();
  });
});

test("the web build explains that search is desktop only", async ({ page }) => {
  await openApp(page, "Images");
  await expect(page.getByText("Searching free images works in the desktop app.")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search free images" })).toHaveCount(0);
});
