import { useEditor } from "../store/editor";
import type { LayerProject } from "../types";
import { pickProjectText } from "./host";

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

const parseProject = (text: string): LayerProject => {
  const project = JSON.parse(text) as LayerProject;
  if (project.version !== 1) {
    throw new Error("Unsupported .layer file version");
  }
  return project;
};

// Convenience: opens a file picker for .layer and loads it into the store.
export const openLayerFile = async () => {
  const text = await pickProjectText();
  if (text !== null) useEditor.getState().loadProject(parseProject(text));
};
