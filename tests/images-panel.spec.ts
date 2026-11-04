import { expect, test } from "@playwright/test";
import { addTwoToneImage, openApp, solidPng } from "./helpers";

test("there's no Edit tool; editing appears in Images once there's an image", async ({ page }) => {
  await openApp(page, "Images");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  const section = page.locator("#image-edit");
  await expect(section).toHaveCount(0);

  await page.setInputFiles('input[aria-label="Upload image to canvas"]', solidPng());
  for (const tab of ["Fix", "Style", "Adjust"]) {
    await expect(section.getByText(tab, { exact: true })).toBeVisible();
  }

  await page.evaluate(`S.getState().selectElement(null)`);
  await expect(section.getByText("Select an image to edit it.")).toBeVisible();
});

test("the toolbar's Edit button opens the section, past a long list", async ({ page }) => {
  await openApp(page);
  await addTwoToneImage(page);
  await page.evaluate(`(() => {
    const s = S.getState();
    const src = s.elements[0].src;
    S.setState({ uploadedImages: Array.from({ length: 40 }, (_, i) => ({ id: "u" + i, src, naturalWidth: 800, naturalHeight: 400, createdAt: i })) });
    s.setActiveTool("annotation");
  })()`);

  await page.getByRole("button", { name: "Edit", exact: true }).click();

  await expect.poll(() => page.evaluate(`S.getState().activeTool`)).toBe("images");
  await expect(page.locator("#image-edit").getByText("Style", { exact: true })).toBeInViewport();
});
