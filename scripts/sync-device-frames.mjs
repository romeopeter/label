/**
 * Regenerates public/frames/ and src/data/deviceFrames.json.
 *
 * Sources, all MIT, each device taken from one only:
 * - react-mockframe and Devices.css are CSS. Konva can't draw CSS, so each device is
 *   rendered here, in WebKit, to a PNG the app lays over the picture.
 * - Monkr's generic laptop is already a PNG, kept in scripts/frames/monkr/. It's the one
 *   Monkr frame Monkr drew itself. The rest are Apple's bezels, whose licence doesn't
 *   allow embedding them, or third-party art with no stated source, so don't add those.
 *
 * Screen areas are measured from the artwork, never typed in by hand, so they can't
 * drift from it.
 *
 * Each device is rendered twice: with a black screen and with a white one. A pixel
 * that differs between them is showing the screen, and how much it differs is how
 * much it shows. That gives a true transparent hole, soft corners included, and
 * keeps anything that sits over the screen, such as a notch.
 *
 * Re-run only to change the device list; the output is committed.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { webkit } from "@playwright/test";

const require = createRequire(import.meta.url);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { MockFrame } = require("react-mockframe");

/** Frames are drawn at up to this many times the Devices.css size, so 2× exports stay sharp. */
const SCALE = 4;
const THUMB_SIZE = 192;
/** Room around the device for buttons, which sit outside its box. */
const MARGIN = 40;
/** How far (in CSS px) the visible screen may fall short of the stylesheet's size. */
const MAX_OVERLAP = 12;
/** From Monkr's own mask for its laptop screen, in the PNG's pixels. */
const MONKR_CORNER = 3;

const OUTPUT_DIR = new URL("../public/frames/", import.meta.url);
const THUMB_DIR = new URL("thumbs/", OUTPUT_DIR);
const DATA_FILE = new URL("../src/data/deviceFrames.json", import.meta.url);
const DEVICES_CSS_DIR = new URL("../node_modules/devices.css/", import.meta.url);
const MOCKFRAME_DIR = new URL("../node_modules/react-mockframe/", import.meta.url);
const MONKR_DIR = new URL("frames/monkr/", import.meta.url);

const mockframe = (id, name, label, group, rotates, finishes) => ({
  id,
  name,
  label,
  group,
  rotates,
  finishes,
  source: "mockframe",
});
const devicesCss = (id, label, group, rotates, finishes) => ({
  id,
  label,
  group,
  rotates,
  finishes,
  source: "devices.css",
});

/** In the order the panel shows them, newest first. */
const DEVICES = [
  mockframe("iphone-18-pro", "iPhone 18 Pro", "iPhone 18 Pro", "Phones", true, [
    ["silver", "Silver"],
    ["black", "Black"],
    ["glacier", "Glacier"],
    ["burgundy", "Burgundy"],
  ]),
  mockframe("iphone-duo", "iPhone Duo", "iPhone Duo", "Phones", true, [
    ["night-sky", "Night Sky"],
    ["star-white", "Star White"],
  ]),
  mockframe("iphone-17", "iPhone 17", "iPhone 17", "Phones", true, [
    ["black", "Black"],
    ["white", "White"],
    ["mist-blue", "Mist Blue"],
    ["sage", "Sage"],
    ["lavender", "Lavender"],
    ["cosmic-orange", "Cosmic Orange"],
    ["deep-blue", "Deep Blue"],
  ]),
  devicesCss("iphone-14-pro", "iPhone 14 Pro", "Phones", true, [
    ["", "Purple"],
    ["black", "Black"],
    ["silver", "Silver"],
    ["gold", "Gold"],
  ]),
  mockframe("pixel-10", "Pixel 10", "Pixel 10", "Phones", true, [
    ["obsidian", "Obsidian"],
    ["frost", "Frost"],
    ["indigo", "Indigo"],
    ["lemongrass", "Lemongrass"],
  ]),
  devicesCss("google-pixel-6-pro", "Pixel 6 Pro", "Phones", true, [
    ["", "Silver"],
    ["black", "Black"],
    ["gold", "Gold"],
  ]),
  mockframe("galaxy-s25", "Galaxy S25", "Galaxy S25", "Phones", true, [
    ["blue-black", "Blue Black"],
    ["icy-blue", "Icy Blue"],
    ["navy", "Navy"],
    ["mint", "Mint"],
    ["silver-shadow", "Silver Shadow"],
    ["coral-red", "Coral Red"],
    ["pink-gold", "Pink Gold"],
  ]),
  devicesCss("galaxy-s8", "Galaxy S8", "Phones", true, [
    ["", "Black"],
    ["blue", "Blue"],
  ]),
  mockframe("ipad-pro", "iPad Pro", "iPad Pro", "Tablets", true, [
    ["silver", "Silver"],
    ["space-black", "Space Black"],
  ]),
  mockframe("ipad-mini", "iPad Mini", "iPad Mini", "Tablets", true, [
    ["silver", "Silver"],
    ["black", "Black"],
  ]),
  devicesCss("surface-pro-2017", "Surface Pro", "Tablets", true, [["", "Silver"]]),
  mockframe("macbook-pro", "MacBook Pro", "MacBook Pro", "Computers", false, [
    ["silver", "Silver"],
    ["space-black", "Space Black"],
  ]),
  devicesCss("macbook", "MacBook", "Computers", false, [
    ["", "Silver"],
    ["spacegray", "Space gray"],
    ["gold", "Gold"],
    ["rosegold", "Rose gold"],
  ]),
  {
    id: "laptop",
    label: "Laptop",
    group: "Computers",
    rotates: false,
    finishes: [
      ["dark", "Graphite"],
      ["silver", "Silver"],
    ],
    source: "monkr",
  },
  devicesCss("surface-book", "Surface Book", "Computers", false, [["", "Silver"]]),
  devicesCss("imac", "iMac", "Computers", false, [
    ["", "Silver"],
    ["blue", "Blue"],
    ["green", "Green"],
    ["pink", "Pink"],
    ["purple", "Purple"],
    ["orange", "Orange"],
    ["yellow", "Yellow"],
  ]),
  devicesCss("pro-display-xdr", "Pro Display", "Computers", false, [["", "Silver"]]),
  devicesCss("surface-studio", "Surface Studio", "Computers", false, [["", "Silver"]]),
  devicesCss("apple-watch-ultra", "Watch Ultra", "Watches", false, [["", "Titanium"]]),
  devicesCss("apple-watch-s8", "Watch Series 8", "Watches", false, [["", "Midnight"]]),
];

const devicesCssStyles = readFileSync(new URL("dist/devices.css", DEVICES_CSS_DIR), "utf8");
const mockframeStyles = readFileSync(new URL("dist/styles/mockframe.css", MOCKFRAME_DIR), "utf8");
/** The screen's own markup and rules for each CSS source. */
const SELECTORS = {
  "devices.css": { root: ".device", screen: ".device .device-screen" },
  mockframe: { root: ".mockframe", screen: ".mockframe .screen" },
};
/** Clear, so an <img> screen shows only its background colour. */
const NOTHING = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** React warns that a layout effect can't run on a server. It only sizes a pose we don't use. */
const renderQuietly = (element) => {
  const { error } = console;
  console.error = () => {};
  try {
    return renderToStaticMarkup(element);
  } finally {
    console.error = error;
  }
};

const markupFor = (device, finish) =>
  device.source === "mockframe"
    ? renderQuietly(createElement(MockFrame, { device: device.name, color: finish }))
    : `<div class="device device-${device.id}${finish ? ` device-${finish}` : ""}">
  <div class="device-frame"><img class="device-screen" src="${NOTHING}"></div>
  <div class="device-stripe"></div>
  <div class="device-header"></div>
  <div class="device-sensors"></div>
  <div class="device-btns"></div>
  <div class="device-power"></div>
  <div class="device-home"></div>
</div>`;

const pageFor = (device, finish, screenColor) => `<!doctype html>
<style>
  ${device.source === "mockframe" ? mockframeStyles : devicesCssStyles}
  html, body { margin: 0; background: transparent; }
  body { padding: 80px; width: max-content; }
  ${SELECTORS[device.source].screen} { background: ${screenColor} !important; }
</style>
${markupFor(device, finish)}`;

const capture = async (page, device, finish, screenColor) => {
  await page.setContent(pageFor(device, finish, screenColor));
  const rects = await page.evaluate((selectors) => {
    const root = document.querySelector(selectors.root).getBoundingClientRect();
    const screen = document.querySelector(selectors.screen);
    const box = screen.getBoundingClientRect();
    return {
      device: { x: root.x, y: root.y, width: root.width, height: root.height },
      screen: { x: box.x, y: box.y, width: box.width, height: box.height },
      // The hole is inside the screen's border, so its corners are tighter by that much.
      corners: ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map((corner) => {
        const style = getComputedStyle(screen);
        const radius = Number.parseFloat(style[`border${corner}Radius`]) || 0;
        const border = Number.parseFloat(style.borderTopWidth) || 0;
        return Math.max(0, radius - border);
      }),
    };
  }, SELECTORS[device.source]);
  const clip = {
    x: rects.device.x - MARGIN,
    y: rects.device.y - MARGIN,
    width: rects.device.width + MARGIN * 2,
    height: rects.device.height + MARGIN * 2,
  };
  const png = await page.screenshot({ clip, omitBackground: true, type: "png" });
  return { ...rects, clip, png };
};

/**
 * Runs in the page, where a canvas can read PNGs without a new dependency. Returns
 * the frame with its screen cut out, trimmed to the device's real edges.
 */
const matte = async ({ onBlack, onWhite, area, thumbSize }) => {
  const load = async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return { canvas, context, data: context.getImageData(0, 0, canvas.width, canvas.height) };
  };

  const black = await load(onBlack);
  const white = await load(onWhite);
  const { width, height } = black.canvas;
  const out = black.data.data;
  const light = white.data.data;

  const device = { left: width, top: height, right: -1, bottom: -1 };
  const hole = { left: width, top: height, right: -1, bottom: -1 };
  const grow = (box, x, y) => {
    box.left = Math.min(box.left, x);
    box.top = Math.min(box.top, y);
    box.right = Math.max(box.right, x);
    box.bottom = Math.max(box.bottom, y);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      // Two renders of a gradient can differ slightly anywhere, so only the screen counts.
      const inScreen =
        x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height;
      const shows = inScreen
        ? Math.max(light[i] - out[i], light[i + 1] - out[i + 1], light[i + 2] - out[i + 2])
        : 0;
      if (shows > 2) {
        // Over black, a pixel is its colour times its opacity: undo that to get the colour.
        const opacity = 1 - shows / 255;
        if (opacity > 0) {
          out[i] = Math.min(255, out[i] / opacity);
          out[i + 1] = Math.min(255, out[i + 1] / opacity);
          out[i + 2] = Math.min(255, out[i + 2] / opacity);
        }
        out[i + 3] = Math.round(opacity * 255);
        grow(hole, x, y);
      }
      if (out[i + 3] > 0 || shows > 2) grow(device, x, y);
    }
  }
  black.context.putImageData(black.data, 0, 0);

  const trimmed = {
    x: device.left,
    y: device.top,
    width: device.right - device.left + 1,
    height: device.bottom - device.top + 1,
  };
  const frame = document.createElement("canvas");
  frame.width = trimmed.width;
  frame.height = trimmed.height;
  frame.getContext("2d").drawImage(black.canvas, -trimmed.x, -trimmed.y);

  const shrink = thumbSize / Math.max(trimmed.width, trimmed.height);
  const thumb = document.createElement("canvas");
  thumb.width = Math.max(1, Math.round(trimmed.width * shrink));
  thumb.height = Math.max(1, Math.round(trimmed.height * shrink));
  const thumbContext = thumb.getContext("2d");
  thumbContext.imageSmoothingQuality = "high";
  thumbContext.drawImage(frame, 0, 0, thumb.width, thumb.height);

  return {
    trimmed,
    hole: {
      x: hole.left,
      y: hole.top,
      width: hole.right - hole.left + 1,
      height: hole.bottom - hole.top + 1,
    },
    frame: frame.toDataURL("image/png"),
    thumb: thumb.toDataURL("image/png"),
  };
};

/**
 * Runs in the page, for a frame that's already a PNG: its hole is what's see-through
 * going out from the middle.
 */
const measureHole = async ({ src, thumbSize }) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const alpha = (x, y) => data[(y * canvas.width + x) * 4 + 3];
  const middleX = Math.round(canvas.width / 2);
  const middleY = Math.round(canvas.height * 0.4);
  if (alpha(middleX, middleY) !== 0) throw new Error("No hole in the middle of this frame");

  let left = middleX;
  let right = middleX;
  let top = middleY;
  let bottom = middleY;
  while (left > 0 && alpha(left - 1, middleY) < 255) left -= 1;
  while (right < canvas.width - 1 && alpha(right + 1, middleY) < 255) right += 1;
  while (top > 0 && alpha(middleX, top - 1) < 255) top -= 1;
  while (bottom < canvas.height - 1 && alpha(middleX, bottom + 1) < 255) bottom += 1;

  const shrink = thumbSize / Math.max(canvas.width, canvas.height);
  const thumb = document.createElement("canvas");
  thumb.width = Math.round(canvas.width * shrink);
  thumb.height = Math.round(canvas.height * shrink);
  const thumbContext = thumb.getContext("2d");
  thumbContext.imageSmoothingQuality = "high";
  thumbContext.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return {
    width: canvas.width,
    height: canvas.height,
    hole: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 },
    thumb: thumb.toDataURL("image/png"),
  };
};

const toDataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;
const fromDataUrl = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
const fraction = (value) => Number(value.toFixed(5));

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(THUMB_DIR, { recursive: true });

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 2200, height: 1600 },
  deviceScaleFactor: SCALE,
});
const renderPage = await context.newPage();
const matteContext = await browser.newContext();
const mattePage = await matteContext.newPage();

const devices = [];
let totalBytes = 0;

for (const device of DEVICES) {
  let geometry = null;
  const finishes = [];

  for (const [finish, label] of device.finishes) {
    const deviceClass = `${device.id} ${finish}`;
    const id = finish || "default";
    const name = `${device.id}-${id}.png`;

    if (device.source === "monkr") {
      const png = readFileSync(new URL(`${finish}.png`, MONKR_DIR));
      const result = await mattePage.evaluate(measureHole, {
        src: toDataUrl(png),
        thumbSize: THUMB_SIZE,
      });
      const next = {
        width: result.width,
        height: result.height,
        screen: {
          x: fraction(result.hole.x / result.width),
          y: fraction(result.hole.y / result.height),
          width: fraction(result.hole.width / result.width),
          height: fraction(result.hole.height / result.height),
        },
        corners: [0, 0, 0, 0].map(() => fraction(MONKR_CORNER / result.width)),
      };
      geometry = next;
      writeFileSync(new URL(name, OUTPUT_DIR), png);
      writeFileSync(new URL(name, THUMB_DIR), fromDataUrl(result.thumb));
      totalBytes += png.length;
      finishes.push({ id, label });
      continue;
    }

    const onBlack = await capture(renderPage, device, finish, "#000");
    const onWhite = await capture(renderPage, device, finish, "#fff");
    const result = await mattePage.evaluate(matte, {
      onBlack: toDataUrl(onBlack.png),
      onWhite: toDataUrl(onWhite.png),
      area: {
        x: Math.floor((onBlack.screen.x - onBlack.clip.x) * SCALE),
        y: Math.floor((onBlack.screen.y - onBlack.clip.y) * SCALE),
        width: Math.ceil(onBlack.screen.width * SCALE),
        height: Math.ceil(onBlack.screen.height * SCALE),
      },
      thumbSize: THUMB_SIZE,
    });

    // What's actually visible, not what the stylesheet says: on some devices the
    // frame overlaps the screen by a pixel or two. In CSS px from the frame's corner.
    const measured = {
      x: (result.hole.x - result.trimmed.x) / SCALE,
      y: (result.hole.y - result.trimmed.y) / SCALE,
      width: result.hole.width / SCALE,
      height: result.hole.height / SCALE,
    };
    const overlap = Math.max(
      Math.abs(measured.width - onBlack.screen.width),
      Math.abs(measured.height - onBlack.screen.height),
    );
    // Anything more than a sliver means the cut-out went wrong, not a design detail.
    if (overlap > MAX_OVERLAP) {
      throw new Error(
        `${deviceClass}: the visible screen is ${measured.width}×${measured.height}, but the stylesheet says ${onBlack.screen.width}×${onBlack.screen.height}`,
      );
    }

    const width = result.trimmed.width / SCALE;
    const height = result.trimmed.height / SCALE;
    const next = {
      width,
      height,
      screen: {
        x: fraction(measured.x / width),
        y: fraction(measured.y / height),
        width: fraction(measured.width / width),
        height: fraction(measured.height / height),
      },
      // Top left, top right, bottom right, bottom left, as fractions of the device's width.
      corners: onBlack.corners.map((corner) => fraction(corner / width)),
    };
    if (geometry && JSON.stringify(geometry) !== JSON.stringify(next)) {
      throw new Error(`${deviceClass}: finishes of one device have different shapes`);
    }
    geometry = next;

    const frame = fromDataUrl(result.frame);
    writeFileSync(new URL(name, OUTPUT_DIR), frame);
    writeFileSync(new URL(name, THUMB_DIR), fromDataUrl(result.thumb));
    totalBytes += frame.length;
    finishes.push({ id, label });
  }

  devices.push({
    id: device.id,
    label: device.label,
    group: device.group,
    rotates: device.rotates,
    ...geometry,
    finishes,
  });
  console.log(`${device.id}: ${geometry.width}×${geometry.height}, screen ${JSON.stringify(geometry.screen)}`);
}

await browser.close();

copyFileSync(new URL("LICENSE", DEVICES_CSS_DIR), new URL("LICENSE-devices.css.txt", OUTPUT_DIR));
copyFileSync(new URL("LICENSE", MOCKFRAME_DIR), new URL("LICENSE-react-mockframe.txt", OUTPUT_DIR));
copyFileSync(new URL("LICENSE", MONKR_DIR), new URL("LICENSE-monkr.txt", OUTPUT_DIR));
const labels = new Set(devices.map((device) => device.label));
if (labels.size !== devices.length) throw new Error("A device is listed twice");
writeFileSync(
  DATA_FILE,
  `${JSON.stringify({ devices }, null, 2)}\n`,
);
console.log(`Wrote ${devices.length} devices, ${(totalBytes / 1024 / 1024).toFixed(1)} MB of frames.`);
