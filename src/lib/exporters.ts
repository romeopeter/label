import Konva from "konva";
import { getStage } from "../components/canvas/stageRef";
import { useEditor } from "../store/editor";
import { openLaybelFile } from "./importers";
import { isImageTiltActive } from "./tilt";
import { prepareExportTiles } from "./export/prepareExportTiles";
import { GRID_LAYER_NAME } from "../components/canvas/GridOverlay";

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

const loadHtmlImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Hide everything that is editor chrome rather than artwork, run the capture,
 * then restore. Selection handles and the layout grid both live in the stage
 * but must never reach the output — any future viewport aid (rulers, safe-area
 * guides) belongs in this list too.
 */
const withOverlaysHidden = async <T,>(
  stage: Konva.Stage,
  fn: () => Promise<T>,
) => {
  const overlays = [
    ...stage.find("Transformer"),
    ...stage.find(`.${GRID_LAYER_NAME}`),
  ];
  const visible = overlays.map((node) => node.visible());
  overlays.forEach((node) => node.visible(false));

  try {
    return await fn();
  } finally {
    overlays.forEach((node, index) => node.visible(visible[index]));
    stage.batchDraw();
  }
};

const renderTiltedImageIntoStage = async (stage: Konva.Stage) => {
  const { elements, selectedIds } = useEditor.getState();
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const image = elements.find((el) => el.id === selectedId);

  if (
    !image ||
    image.type !== "image" ||
    image.deviceFrame ||
    !isImageTiltActive(image.transform)
  ) {
    return null;
  }

  const overlay = document.querySelector<HTMLElement>(
    `[data-tilted-image-id="${image.id}"]`,
  );
  const originalNode = stage.findOne(`#${image.id}`);
  const layer = originalNode?.getLayer();

  if (!overlay || !originalNode || !layer) return null;

  try {
    const domtoimage = await import("dom-to-image-more");
    const dataUrl = await domtoimage.toPng(overlay, {
      width: overlay.offsetWidth,
      height: overlay.offsetHeight,
      bgcolor: "transparent",
      cacheBust: true,
    });
    const flatImage = await loadHtmlImage(dataUrl);
    const temporaryNode = new Konva.Image({
      image: flatImage,
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height,
      rotation: image.rotation,
      listening: false,
    });

    layer.add(temporaryNode);
    temporaryNode.zIndex(originalNode.getZIndex());
    layer.batchDraw();

    return () => {
      temporaryNode.destroy();
      layer.batchDraw();
    };
  } catch (error) {
    throw new Error(
      `Failed to rasterize CSS 3D image ${image.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
};

export const renderCanvasDataURL = (
  format: "png" | "jpg" | "webp" = "png",
  pixelRatio = 2
): Promise<string | null> => {
  const stage = getStage();
  if (!stage) return Promise.resolve(null);

  return withOverlaysHidden(stage, async () => {
    const cleanupTiltedImage = await renderTiltedImageIntoStage(stage);
    // The stage is scaled to fit, and the pixelRatio below compensates for that,
    // so the background pattern is rasterized at `pixelRatio` device pixels per
    // canvas unit regardless of the current zoom.
    const cleanupPatternTiles = await prepareExportTiles(stage, pixelRatio);

    try {
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
    } finally {
      cleanupTiltedImage?.();
      cleanupPatternTiles?.();
    }
  });
};

export const exportCanvas = async (
  format: "png" | "jpg" | "webp" = "png",
  pixelRatio = 2
) => {
  const dataUrl = await renderCanvasDataURL(format, pixelRatio);
  if (!dataUrl) return;
  const ext = format === "jpg" ? "jpg" : format;
  const blob = dataURLtoBlob(dataUrl);
  downloadBlob(blob, `laybel-design-${Date.now()}.${ext}`);
};

export const copyCanvasToClipboard = async () => {
  const dataUrl = await renderCanvasDataURL("png", 2);
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
