/**
 * The one boundary between the UI and the desktop shell. Everything here works
 * in a plain browser too, and `@tauri-apps/*` is only ever imported dynamically
 * so the web build never needs it.
 */
export const isTauri = "__TAURI__" in window;

/** On macOS the OS window buttons sit on top of the app's top bar. */
export const hasOverlayTitleBar = isTauri && navigator.userAgent.includes("Mac");

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
