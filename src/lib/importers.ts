import { useEditor } from "../store/editor";
import type { LaybelProject } from "../types";

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

export const importProjectFile = async (file: File): Promise<LaybelProject> => {
  const text = await file.text();
  const project = JSON.parse(text) as LaybelProject;
  if (project.version !== 1) {
    throw new Error("Unsupported .laybel file version");
  }
  return project;
};

// Convenience: opens a file picker for .laybel and loads it into the store.
export const openLaybelFile = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".laybel,application/json";
  await new Promise<void>((resolve) => {
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const project = await importProjectFile(file);
        useEditor.getState().loadProject(project);
      }
      resolve();
    };
    input.click();
  });
};
