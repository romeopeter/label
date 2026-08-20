import { useCallback, type RefObject } from "react";

interface TiltExportNode {
  id: string;
  width: number;
  height: number;
}

export const useTiltExport = (
  overlayRef: RefObject<HTMLElement>,
  node: TiltExportNode | null,
) => {
  const exportTiltedImage = useCallback(async (): Promise<string> => {
    if (!node) {
      throw new Error("Cannot export tilted image without a selected image node.");
    }

    if (!overlayRef.current) {
      throw new Error(`Cannot export tilted image ${node.id}: overlay is missing.`);
    }

    try {
      const domtoimage = await import("dom-to-image-more");
      return await domtoimage.toPng(overlayRef.current, {
        width: overlayRef.current.offsetWidth,
        height: overlayRef.current.offsetHeight,
        bgcolor: "transparent",
        cacheBust: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to rasterize tilted image ${node.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }, [node, overlayRef]);

  return { exportTiltedImage };
};
