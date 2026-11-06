import type { CanvasSize } from "../types";

export const CANVAS_SIZES: CanvasSize[] = [
  { label: "LinkedIn post", width: 1200, height: 628 },
  { label: "Twitter / X card", width: 1200, height: 675 },
  { label: "Instagram square", width: 1080, height: 1080 },
  { label: "Instagram story", width: 1080, height: 1920 },
  { label: "Facebook post", width: 1200, height: 630 },
  { label: "YouTube thumbnail", width: 1280, height: 720 },
  { label: "Open Graph", width: 1200, height: 630 },
  { label: "Square HD", width: 2400, height: 2400 },
  { label: "Wide HD", width: 2400, height: 1350 },
  { label: "Custom", width: 800, height: 600 },
];

/** The smallest a framed image can be resized to by hand. */
export const MIN_FRAME_SIZE = { width: 120, height: 80 };

export const SYSTEM_FONTS = [
  "DM Sans",
  "Bricolage Grotesque",
  "Inter",
  "SF Pro Text",
  "Segoe UI",
  "JetBrains Mono",
];

export const PALETTE = [
  "#FFFFFF",
  "#0F0E1A",
  "#534AB7",
  "#8B82DE",
  "#AFA9EC",
  "#1D9E75",
  "#EF9F27",
  "#E7E5F5",
  "#9D98C2",
];
