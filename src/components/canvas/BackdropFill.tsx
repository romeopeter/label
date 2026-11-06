import { useLayoutEffect, useMemo, useRef } from "react";
import { Image as KImage, Rect } from "react-konva";
import type Konva from "konva";
import type { BackdropConfig } from "@/types/backdrop";
import { isBackdropSupported, renderBackdrop } from "@/lib/backdrops/renderer";

/** Found by name at export, which draws it again at the export's own scale. */
export const BACKDROP_FILL_NAME = "backdrop-fill";

/** The preview never needs more pixels than a large screen can show. */
const PREVIEW_SIDE = 2048;

const previewScaleOf = (width: number, height: number) =>
  Math.min(1, PREVIEW_SIDE / Math.max(width, height));

interface Props {
  backdrop: BackdropConfig;
  width: number;
  height: number;
}

export const BackdropFill = ({ backdrop, width, height }: Props) => {
  const ref = useRef<Konva.Image>(null);
  const picture = useMemo(() => document.createElement("canvas"), []);
  const supported = isBackdropSupported();

  useLayoutEffect(() => {
    if (!supported) return;
    renderBackdrop(backdrop, { width, height }, previewScaleOf(width, height), picture);
    // Konva can't see a canvas change, so it's told.
    ref.current?.getLayer()?.batchDraw();
  }, [supported, backdrop, width, height, picture]);

  if (!supported) {
    // Without WebGL2, its colours as a plain gradient.
    const [deep, main, accent] = backdrop.colors;
    return (
      <Rect
        name={BACKDROP_FILL_NAME}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: width, y: height }}
        fillLinearGradientColorStops={[0, deep, 0.55, main, 1, accent]}
        listening={false}
      />
    );
  }

  return (
    <KImage
      ref={ref}
      name={BACKDROP_FILL_NAME}
      image={picture}
      width={width}
      height={height}
      listening={false}
    />
  );
};
