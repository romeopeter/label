/**
 * The one boundary between the UI and the desktop shell. Everything here works
 * in a plain browser too, and `@tauri-apps/*` is only ever imported dynamically
 * so the web build never needs it.
 */
export const isTauri = "__TAURI__" in window;

/** On macOS the OS window buttons sit on top of the app's top bar. */
export const hasOverlayTitleBar = isTauri && navigator.userAgent.includes("Mac");

/** On macOS, screenshots use the system's own picker rather than the webview's. */
export const hasNativeScreenshot = hasOverlayTitleBar;

const invokeCore = () => import("@tauri-apps/api/core");

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

export const saveExport = async (blob: Blob, filename: string) => {
  if (!isTauri) return downloadBlob(blob, filename);

  const { invoke } = await invokeCore();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await invoke("export_static", bytes, {
    headers: { "x-layer-filename": filename },
  });
};

export const saveProject = async (json: string, filename: string) => {
  if (!isTauri) {
    return downloadBlob(new Blob([json], { type: "application/json" }), filename);
  }

  const { invoke } = await invokeCore();
  await invoke("save_project", { json, suggestedName: filename });
};

/** Resolves to the chosen project's text, or null if the user cancelled. */
export const pickProjectText = async (): Promise<string | null> => {
  if (isTauri) {
    const { invoke } = await invokeCore();
    return invoke<string | null>("open_project");
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".layer,.laybel,application/json";
  return new Promise((resolve, reject) => {
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) file.text().then(resolve, reject);
      else resolve(null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
};

/** One frame of a screen, window or tab, chosen in the browser's own picker. */
const captureWithPicker = async (): Promise<Blob | null> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screenshots aren't available here. Try uploading an image instead.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (error) {
    // Closing the picker is reported the same way as refusing it.
    if (error instanceof DOMException && error.name === "NotAllowedError") return null;
    throw new Error("Screenshots aren't available here. Try uploading an image instead.", {
      cause: error,
    });
  }

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    // The first frame can be blank until one has really been drawn.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
};

/** Resolves to a PNG of what the user chose, or null if they cancelled. */
export const captureScreen = async (): Promise<Blob | null> => {
  if (!hasNativeScreenshot) return captureWithPicker();

  const { invoke } = await invokeCore();
  let bytes: ArrayBuffer;
  try {
    bytes = await invoke<ArrayBuffer>("capture_screen");
  } catch (error) {
    // Commands report failures as a message that's already written for the user.
    throw new Error(String(error), { cause: error });
  }
  return bytes.byteLength ? new Blob([bytes], { type: "image/png" }) : null;
};

export interface StockImage {
  id: number;
  tags: string;
  previewUrl: string;
  largeImageUrl: string;
}

/**
 * Image search needs an API key, which can only stay private on the Rust side,
 * so the web build has no image search.
 */
export const hasStockImages = isTauri;

export const searchStockImages = async (query: string, page: number) => {
  const { invoke } = await invokeCore();
  return invoke<{ images: StockImage[]; hasMore: boolean }>("search_images", { query, page });
};

export const downloadStockImage = async (url: string): Promise<Blob> => {
  const { invoke } = await invokeCore();
  const bytes = await invoke<ArrayBuffer>("download_image", { url });
  return new Blob([bytes], { type: url.endsWith(".png") ? "image/png" : "image/jpeg" });
};
