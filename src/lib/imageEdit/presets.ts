import type { ImageAdjust, ImageEdit, ImageStyleId, LensBlurMode } from "@/types";

/*
  Every choice in the Images panel's edit section, as plain data. The shader only understands
  numbers, so each option carries the numbers it stands for. Meaning of `p` and
  `q` per style is documented next to its branch in shader.ts.
*/

/** Lets the image toolbar's Edit button scroll this section into view. */
export const IMAGE_EDIT_SECTION_ID = "image-edit";

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

export interface StyleVariant {
  id: string;
  label: string;
  p: Vec4;
  q?: Vec4;
  /** One line on what this variant does, for variants that aren't self-evident. */
  help?: string;
}

export interface StyleDef {
  id: ImageStyleId;
  label: string;
  help: string;
  /** The shader's branch for this style. */
  code: number;
  variants: StyleVariant[];
}

export const DEFAULT_STYLE_STRENGTH = 70;

export const STYLES: StyleDef[] = [
  {
    id: "bloom",
    label: "Glow",
    help: "Bright areas softly glow.",
    code: 1,
    variants: [
      { id: "soft", label: "Soft", p: [0.7, 10, 0.8, 0], q: [1, 1, 1, 0] },
      { id: "dreamy", label: "Dreamy", p: [0.6, 18, 0.75, 0], q: [1, 0.96, 0.94, 0] },
      { id: "neon", label: "Neon", p: [0.72, 6, 1.5, 0], q: [1, 1, 1, 0] },
    ],
  },
  {
    id: "motion",
    label: "Motion",
    help: "Makes the picture look like it's moving.",
    code: 2,
    variants: [
      { id: "sideways", label: "Sideways", p: [0, 1, 0, 0.08] },
      { id: "upward", label: "Upward", p: [0, 0, 1, 0.08] },
      { id: "zoom", label: "Zoom", p: [1, 0, 0, 0.16] },
      { id: "spin", label: "Spin", p: [2, 0, 0, 0.14] },
    ],
  },
  {
    id: "chromatic",
    label: "Color split",
    help: "Shifts red and blue apart, like an old lens.",
    code: 3,
    variants: [
      { id: "subtle", label: "Subtle", p: [0, 0.008, 0, 0] },
      { id: "strong", label: "Strong", p: [0, 0.024, 0, 0] },
      { id: "sideways", label: "Sideways", p: [1, 0.012, 0, 0] },
    ],
  },
  {
    id: "double",
    label: "Double exposure",
    help: "Blends a second image into this one.",
    code: 4,
    // p.x: how the two images combine.
    variants: [
      { id: "default", label: "Default", p: [0, 0, 0, 0], help: "The second image shows through evenly." },
      { id: "lighten", label: "Lighten", p: [1, 0, 0, 0], help: "Keeps the brighter of the two images." },
      { id: "darken", label: "Darken", p: [2, 0, 0, 0], help: "Keeps the darker of the two images." },
      { id: "add", label: "Add", p: [3, 0, 0, 0], help: "Adds their light together, so it gets brighter." },
      { id: "subtract", label: "Subtract", p: [4, 0, 0, 0], help: "Takes the second image's light away, so it gets darker." },
      { id: "overlay", label: "Overlay", p: [5, 0, 0, 0], help: "Mixes in the second image and deepens the contrast." },
    ],
  },
  {
    id: "fisheye",
    label: "Fish-eye",
    help: "Bends the picture around its centre.",
    code: 5,
    variants: [
      { id: "subtle", label: "Subtle", p: [0.35, 0, 0, 0] },
      { id: "strong", label: "Strong", p: [0.6, 0, 0, 0] },
      { id: "round", label: "Round", p: [0.5, 1, 0, 0] },
    ],
  },
  {
    id: "halation",
    label: "Halo",
    help: "A colored halo around bright areas, like cinema film.",
    code: 6,
    variants: [
      { id: "warm", label: "Warm", p: [0.65, 5, 1.6, 0], q: [1, 0.42, 0.18, 0] },
      { id: "red", label: "Red", p: [0.65, 5, 1.6, 0], q: [1, 0.14, 0.08, 0] },
      { id: "gold", label: "Gold", p: [0.6, 7, 1.4, 0], q: [1, 0.72, 0.28, 0] },
    ],
  },
  {
    id: "grunge",
    label: "Grunge",
    help: "Adds dirt and wear, like an old print.",
    code: 7,
    variants: [
      { id: "dust", label: "Dust", p: [1, 0.25, 0.25, 0] },
      { id: "scratches", label: "Scratches", p: [0.35, 1, 0.3, 0] },
      { id: "worn", label: "Worn", p: [0.4, 0.3, 1, 0] },
    ],
  },
  {
    id: "film",
    label: "Film",
    help: "The grain and color of a film photo.",
    code: 8,
    // p: grain, faded blacks, warmth, saturation. q: edge darkening, black and white.
    variants: [
      { id: "classic", label: "Classic", p: [0.07, 0.04, 0.04, 0.95], q: [0.3, 0, 0, 0] },
      { id: "faded", label: "Faded", p: [0.06, 0.14, 0.02, 0.72], q: [0.1, 0, 0, 0] },
      { id: "vintage", label: "Vintage", p: [0.08, 0.08, 0.12, 0.8], q: [0.45, 0, 0, 0] },
      { id: "mono", label: "Black & white", p: [0.11, 0.03, 0, 1], q: [0.3, 1, 0, 0] },
    ],
  },
];

export const styleOf = (id: ImageStyleId) => STYLES.find((s) => s.id === id);

export const variantOf = (style: StyleDef, id: string) =>
  style.variants.find((v) => v.id === id) ?? style.variants[0];

export interface ColorDef {
  id: string;
  label: string;
  tint: Vec3;
  /** Where the strength starts: a full-strength tint is a lot for most pictures. */
  strength: number;
}

export const COLORS: ColorDef[] = [
  { id: "mono", label: "Black & white", tint: [1, 1, 1], strength: 100 },
  { id: "sepia", label: "Sepia", tint: [1, 0.82, 0.6], strength: 80 },
  { id: "blue", label: "Blue", tint: [0.5, 0.72, 1], strength: 55 },
  { id: "teal", label: "Teal", tint: [0.45, 1, 0.88], strength: 55 },
  { id: "green", label: "Green", tint: [0.62, 1, 0.55], strength: 55 },
  { id: "gold", label: "Gold", tint: [1, 0.86, 0.35], strength: 55 },
  { id: "rose", label: "Rose", tint: [1, 0.58, 0.68], strength: 55 },
  { id: "violet", label: "Violet", tint: [0.72, 0.56, 1], strength: 55 },
];

export const colorOf = (id: string) => COLORS.find((c) => c.id === id);

export interface GradeDef {
  id: string;
  label: string;
  /** Added to the dark and bright parts of the picture. */
  shadows: Vec3;
  highlights: Vec3;
  contrast: number;
  saturation: number;
  /** Lifts the blacks, for a faded look. */
  lift: number;
}

export const GRADES: GradeDef[] = [
  { id: "sunset", label: "Warm sunset", shadows: [0.06, 0.01, -0.04], highlights: [0.1, 0.03, -0.06], contrast: 0.05, saturation: 1.05, lift: 0.01 },
  { id: "teal-orange", label: "Teal & orange", shadows: [-0.06, 0.02, 0.08], highlights: [0.1, 0.03, -0.07], contrast: 0.12, saturation: 1.1, lift: 0 },
  { id: "golden", label: "Golden hour", shadows: [0.05, 0.02, -0.03], highlights: [0.12, 0.07, -0.08], contrast: 0.02, saturation: 1.12, lift: 0 },
  { id: "cool", label: "Cool morning", shadows: [-0.03, 0.01, 0.07], highlights: [-0.02, 0.02, 0.08], contrast: 0.02, saturation: 0.92, lift: 0 },
  { id: "moody", label: "Moody", shadows: [-0.02, 0, 0.03], highlights: [-0.04, -0.03, -0.03], contrast: 0.2, saturation: 0.72, lift: 0 },
  { id: "matte", label: "Matte", shadows: [0.01, 0.01, 0.02], highlights: [0, 0, 0], contrast: -0.12, saturation: 0.88, lift: 0.08 },
  { id: "vivid", label: "Vivid", shadows: [0, 0, 0], highlights: [0, 0, 0], contrast: 0.12, saturation: 1.35, lift: 0 },
  { id: "noir", label: "Noir", shadows: [0, 0, 0], highlights: [0, 0, 0], contrast: 0.3, saturation: 0, lift: 0 },
];

export const gradeOf = (id: string) => GRADES.find((g) => g.id === id);

export const LENS_MODES: { id: LensBlurMode; label: string; code: number }[] = [
  { id: "background", label: "Edges", code: 1 },
  { id: "band", label: "Top & bottom", code: 2 },
  { id: "whole", label: "Everything", code: 3 },
];

export const NO_ADJUST: ImageAdjust = {
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  ambience: 0,
  saturation: 0,
  warmth: 0,
};

export const QUICK_FIXES: { id: string; label: string; adjust: Partial<ImageAdjust> }[] = [
  { id: "brighter", label: "Brighter", adjust: { brightness: 25, shadows: 20 } },
  { id: "punchy", label: "Punchy", adjust: { contrast: 20, ambience: 25, saturation: 15 } },
  { id: "soft", label: "Soft", adjust: { contrast: -18, highlights: -15, shadows: 15 } },
  { id: "clear", label: "Clear", adjust: { ambience: 45, contrast: 8 } },
  { id: "warmer", label: "Warmer", adjust: { warmth: 30 } },
  { id: "cooler", label: "Cooler", adjust: { warmth: -30 } },
];

/** False means the picture would come out unchanged, so it can skip the renderer. */
export const hasEdit = (edit: ImageEdit | undefined) => {
  if (!edit) return false;
  return (
    Object.values(edit.adjust ?? {}).some((value) => value !== 0) ||
    !!edit.color?.strength ||
    !!edit.grade?.strength ||
    !!edit.lensBlur?.amount ||
    !!edit.style?.strength
  );
};
