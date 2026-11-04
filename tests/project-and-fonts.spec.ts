import { expect, test, type Page } from "@playwright/test";
import { addTwoToneImage, elementCount, fakeShell, openApp, shellCalls } from "./helpers";

const VALID = {
  version: 1,
  canvas: { width: 1200, height: 800 },
  background: { mode: "solid", solid: "#102030" },
  elements: [],
  watermark: true,
};

const open = async (page: Page, contents: string) => {
  const dialog = new Promise<string | null>((resolve) => {
    page.once("dialog", async (d) => {
      const message = d.message();
      await d.dismiss();
      resolve(message);
    });
    setTimeout(() => resolve(null), 1500);
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByText("Open project (.layer)").click();
  await (await chooser).setFiles({
    name: "test.layer",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  return dialog;
};

const bad: [string, string, RegExp][] = [
  ["not JSON", "this is not json", /isn't a Layer project/],
  ["an empty object", "{}", /isn't a Layer project/],
  ["a JSON array", "[]", /isn't a Layer project/],
  ["a missing canvas", JSON.stringify({ ...VALID, canvas: undefined }), /isn't a Layer project/],
  ["a zero-size canvas", JSON.stringify({ ...VALID, canvas: { width: 0, height: 800 } }), /isn't a Layer project/],
  ["elements that aren't a list", JSON.stringify({ ...VALID, elements: "nope" }), /isn't a Layer project/],
  ["an unknown element", JSON.stringify({ ...VALID, elements: [{ id: "a", type: "video" }] }), /isn't a Layer project/],
  ["a newer version", JSON.stringify({ ...VALID, version: 2 }), /newer version/],
];

for (const [name, contents, message] of bad) {
  test(`opening ${name} explains why and keeps the canvas`, async ({ page }) => {
    const errors = await openApp(page);
    await addTwoToneImage(page);
    expect(await open(page, contents)).toMatch(message);
    expect(await elementCount(page)).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("a good project opens with no message", async ({ page }) => {
  const errors = await openApp(page);
  await addTwoToneImage(page);
  expect(await open(page, JSON.stringify(VALID))).toBeNull();
  expect(await elementCount(page)).toBe(0);
  expect(await page.evaluate(`S.getState().canvas.width`)).toBe(1200);
  expect(errors).toEqual([]);
});

test("a saved project opens again", async ({ page }) => {
  await openApp(page);
  await addTwoToneImage(page);
  const saved = await page.evaluate<string>(`JSON.stringify(S.getState().toProject())`);
  await page.evaluate(`S.getState().resetProject()`);
  expect(await open(page, saved)).toBeNull();
  expect(await elementCount(page)).toBe(1);
});

test("on the desktop the message goes through the shell", async ({ page }) => {
  await fakeShell(page, `(command) => command === "open_project" ? "not json" : undefined`);
  await openApp(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByText("Open project (.layer)").click();
  await expect.poll(() => shellCalls(page, "show_error")).toEqual([
    { message: "This file isn't a Layer project, or it's damaged." },
  ]);
});

test("fonts load with no network and nothing asks Google", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (/googleapis|gstatic/.test(request.url())) external.push(request.url());
  });
  await page.route(/googleapis|gstatic/, (route) => route.abort());
  await openApp(page);

  const loaded = await page.evaluate<string[]>(`(async () => {
    const wanted = ['500 14px "DM Sans"', '700 14px "Bricolage Grotesque"', '400 14px "JetBrains Mono"'];
    await Promise.all(wanted.map((font) => document.fonts.load(font)));
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', ""));
  })()`);

  for (const family of ["DM Sans", "Bricolage Grotesque", "JetBrains Mono"]) {
    expect(loaded).toContain(family);
  }
  expect(external).toEqual([]);
});
