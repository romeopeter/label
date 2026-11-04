import { useEditor } from "../store/editor";
import type { LayerProject } from "../types";
import { pickProjectText, showError } from "./host";

export const fileToDataURL = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export const importImageFile = async (
  file: File | Blob,
  addImage: (src: string, w: number, h: number) => string
) => {
  if (!file.type.startsWith("image/")) return;
  const dataUrl = await fileToDataURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });
  addImage(dataUrl, img.naturalWidth, img.naturalHeight);
};

const NOT_A_PROJECT = "This file isn't a Layer project, or it's damaged.";
const ELEMENT_TYPES = ["image", "text", "shape"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** Checks what the canvas would crash on, before the current work is replaced. */
export const parseProject = (text: string): LayerProject => {
  let project: unknown;
  try {
    project = JSON.parse(text);
  } catch (error) {
    throw new Error(NOT_A_PROJECT, { cause: error });
  }

  if (!isObject(project)) throw new Error(NOT_A_PROJECT);
  if (typeof project.version === "number" && project.version > 1) {
    throw new Error("This project was made with a newer version of Layer. Update Layer to open it.");
  }

  const { version, canvas, background, elements } = project;
  const valid =
    version === 1 &&
    isObject(canvas) &&
    isPositive(canvas.width) &&
    isPositive(canvas.height) &&
    isObject(background) &&
    Array.isArray(elements) &&
    elements.every(
      (element) =>
        isObject(element) &&
        typeof element.id === "string" &&
        typeof element.type === "string" &&
        ELEMENT_TYPES.includes(element.type),
    );
  if (!valid) throw new Error(NOT_A_PROJECT);

  return project as unknown as LayerProject;
};

// Convenience: opens a file picker for .layer and loads it into the store.
export const openLayerFile = async () => {
  const text = await pickProjectText();
  if (text === null) return;

  let project: LayerProject;
  try {
    project = parseProject(text);
  } catch (error) {
    await showError(error instanceof Error ? error.message : NOT_A_PROJECT);
    return;
  }
  useEditor.getState().loadProject(project);
};
