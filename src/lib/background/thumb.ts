import type { BackgroundState } from "@/types";
import type { PatternColorPair } from "@/types/pattern";
import { renderBackground } from "@/lib/backdrops/renderer";
import { changesPixels } from "./effects";
import { drawBackgroundSource } from "./drawSource";

/** Thumbnails show a landscape canvas, small. */
const THUMB_SIZE = { width: 1200, height: 900 };
const THUMB_SCALE = 0.14;

/** Made once per background object; a saved background never changes. */
const thumbs = new WeakMap<BackgroundState, Promise<string | null>>();

const decode = async (src: string) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
};

const make = async (bg: BackgroundState, customPairs: PatternColorPair[]): Promise<string | null> => {
  const out = document.createElement("canvas");
  if (bg.mode === "abstract" || changesPixels(bg.effects)) {
    const source =
      bg.mode === "abstract"
        ? { look: bg.backdrop }
        : {
            canvas: await drawBackgroundSource(bg, THUMB_SIZE, THUMB_SCALE, {
              image: bg.mode === "image" && bg.imageSrc ? await decode(bg.imageSrc) : null,
              customPairs,
            }),
          };
    if (!renderBackground(source, bg.effects, THUMB_SIZE, THUMB_SCALE, out)) return null;
  } else {
    const drawn = await drawBackgroundSource(bg, THUMB_SIZE, THUMB_SCALE, {
      image: bg.mode === "image" && bg.imageSrc ? await decode(bg.imageSrc) : null,
      customPairs,
    });
    out.width = drawn.width;
    out.height = drawn.height;
    out.getContext("2d")?.drawImage(drawn, 0, 0);
  }
  return out.toDataURL("image/png");
};

/** A small picture of a whole background, effects included. */
export const backgroundThumb = (bg: BackgroundState, customPairs: PatternColorPair[] = []) => {
  let made = thumbs.get(bg);
  if (!made) {
    made = make(bg, customPairs).catch(() => null);
    thumbs.set(bg, made);
  }
  return made;
};
