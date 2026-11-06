/**
 * Abstract backgrounds: drawn by Layer from a few colours and a seed, rather than
 * picked from stock. Saved as settings, so they stay sharp at any export size.
 */

export const BACKDROP_STYLES = ["soft", "waves", "streaks", "glow", "glass", "aurora", "silk", "marble"] as const;
export type BackdropStyle = (typeof BACKDROP_STYLES)[number];

export const BACKDROP_STYLE_LABELS: Record<BackdropStyle, string> = {
  soft: "Soft",
  waves: "Waves",
  streaks: "Streaks",
  glow: "Glow",
  glass: "Glass",
  aurora: "Aurora",
  silk: "Silk",
  marble: "Marble",
};

/** What Shuffle, the presets, and Back and Forward change. The effects stay as they are. */
export interface BackdropLook {
  style: BackdropStyle;
  /** Lays out the shapes, and chooses the colours when none was picked. */
  seed: number;
  /** The colour the palette is built around, or null to let Shuffle choose any. */
  color: string | null;
  /**
   * Deep, main, accent and highlight, worked out from `color` or the seed. Saved
   * rather than worked out again, so a file looks the same if the generator changes.
   */
  colors: [string, string, string, string];
}

export interface BackdropConfig extends BackdropLook {
  /** In canvas pixels. */
  blur: number;
  /** 0 to 1. */
  frost: number;
  /** 0 to 1. */
  grain: number;
}

export const BACKDROP_BLUR_MAX = 100;
