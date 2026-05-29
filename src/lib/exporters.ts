import { getStage } from "../components/canvas/stageRef";
import { useEditor } from "../store/editor";
import { openLaybelFile } from "./importers";

const dataURLtoBlob = (dataUrl: string): Blob => {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+);/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

export const renderCanvasDataURL = (
  format: "png" | "jpg" | "webp" = "png",
  pixelRatio = 2
): string | null => {
  const stage = getStage();
  if (!stage) return null;
  // Stage is currently scaled to fit; export uses the canvas's intrinsic resolution
  const { canvas } = useEditor.getState();
  const scaleX = stage.scaleX();
  const scaleY = stage.scaleY();
  // Compensate: scale up the export so the result is at intrinsic resolution × pixelRatio
  return stage.toDataURL({
    pixelRatio: pixelRatio / scaleX,
    mimeType: format === "jpg" ? "image/jpeg" : `image/${format}`,
    quality: 0.95,
    x: 0,
    y: 0,
    width: canvas.width * scaleX,
    height: canvas.height * scaleY,
  });
};

export const exportCanvas = async (
  format: "png" | "jpg" | "webp" = "png",
  pixelRatio = 2
) => {
  const dataUrl = renderCanvasDataURL(format, pixelRatio);
  if (!dataUrl) return;
  const ext = format === "jpg" ? "jpg" : format;
  const blob = dataURLtoBlob(dataUrl);
  downloadBlob(blob, `laybel-design-${Date.now()}.${ext}`);
};

export const copyCanvasToClipboard = async () => {
  const dataUrl = renderCanvasDataURL("png", 2);
  if (!dataUrl) return;
  const blob = dataURLtoBlob(dataUrl);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    // Fallback: download
    downloadBlob(blob, `laybel-design-${Date.now()}.png`);
  }
};

export const downloadProject = () => {
  const project = useEditor.getState().toProject();
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `laybel-project-${Date.now()}.laybel`);
};

export const openProjectFile = async () => {
  await openLaybelFile();
};
