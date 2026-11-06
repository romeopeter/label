import type { BackgroundMode, BackgroundState, SavedBackground } from "@/types";
import { normalisePattern } from "@/types/pattern";
import { normaliseBackdrop } from "@/lib/backdrops/presets";
import { isHex } from "@/lib/backdrops/colors";
import { normaliseEffects } from "./effects";

const MODES: BackgroundMode[] = ["solid", "gradient", "image", "pattern", "abstract"];

export const DEFAULT_GRADIENT = { from: "#1C1F3B", to: "#534AB7", angle: 135 };

const clampAngle = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? ((value % 360) + 360) % 360 : fallback;

/**
 * A saved background, made safe to draw whatever the file says.
 *
 * Files from before background effects kept an image's blur and opacity, and an
 * abstract background's blur, frost and grain, on those types. They become the
 * background's effects, when that type was showing.
 */
export const normaliseBackground = (saved: unknown, fallback: BackgroundState): BackgroundState => {
  const value = (saved && typeof saved === "object" ? saved : {}) as Record<string, unknown>;
  const mode = MODES.includes(value.mode as BackgroundMode) ? (value.mode as BackgroundMode) : fallback.mode;
  const gradient = (value.gradient ?? {}) as Record<string, unknown>;
  const backdrop = (value.backdrop ?? {}) as Record<string, unknown>;

  const older =
    mode === "image"
      ? { blur: value.imageBlur, opacity: value.imageOpacity }
      : mode === "abstract"
        ? { blur: backdrop.blur, frost: backdrop.frost, grain: backdrop.grain }
        : {};

  return {
    mode,
    color: isHex(value.color) ? value.color : fallback.color,
    gradient: {
      from: isHex(gradient.from) ? gradient.from : DEFAULT_GRADIENT.from,
      to: isHex(gradient.to) ? gradient.to : DEFAULT_GRADIENT.to,
      angle: clampAngle(gradient.angle, DEFAULT_GRADIENT.angle),
    },
    imageSrc: typeof value.imageSrc === "string" && value.imageSrc.startsWith("data:image/") ? value.imageSrc : null,
    pattern: normalisePattern(value.pattern),
    backdrop: normaliseBackdrop(value.backdrop),
    effects: normaliseEffects(value.effects ?? older),
  };
};

/** The saved list, keeping only entries that are whole enough to show. */
export const normaliseSavedBackgrounds = (list: unknown[], fallback: BackgroundState): SavedBackground[] =>
  list.flatMap((entry) => {
    const value = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    if (typeof value.id !== "string" || !value.background || typeof value.background !== "object") return [];
    return [{ id: value.id, background: normaliseBackground(value.background, fallback) }];
  });
