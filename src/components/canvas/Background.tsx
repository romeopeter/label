import { useEffect, useRef } from "react";
import { Rect, Image as KImage, Group } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import type { BackgroundState } from "../../types";

interface Props {
  bg: BackgroundState;
  width: number;
  height: number;
}

export const Background = ({ bg, width, height }: Props) => {
  if (bg.mode === "solid") {
    return <Rect x={0} y={0} width={width} height={height} fill={bg.color} listening={false} />;
  }

  if (bg.mode === "gradient") {
    const rad = (bg.gradient.angle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.max(width, height);
    const dx = Math.cos(rad) * len * 0.6;
    const dy = Math.sin(rad) * len * 0.6;
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: cx - dx, y: cy - dy }}
        fillLinearGradientEndPoint={{ x: cx + dx, y: cy + dy }}
        fillLinearGradientColorStops={[0, bg.gradient.from, 1, bg.gradient.to]}
        listening={false}
      />
    );
  }

  return <BackgroundImage bg={bg} width={width} height={height} />;
};

const BackgroundImage = ({ bg, width, height }: Props) => {
  const [img] = useImage(bg.imageSrc || "", "anonymous");
  const ref = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !img) return;
    if (bg.imageBlur > 0) {
      node.cache();
      node.filters([Konva.Filters.Blur]);
      node.blurRadius(bg.imageBlur);
    } else {
      node.clearCache();
      node.filters([]);
    }
    node.getLayer()?.batchDraw();
  }, [img, bg.imageBlur]);

  if (!img || !bg.imageSrc) {
    return <Rect x={0} y={0} width={width} height={height} fill="#1A1826" listening={false} />;
  }

  // Cover-fit the image
  const ratio = Math.max(width / img.width, height / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  const x = (width - w) / 2;
  const y = (height - h) / 2;

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={width} height={height} fill="#1A1826" />
      <KImage
        ref={ref}
        image={img}
        x={x}
        y={y}
        width={w}
        height={h}
        opacity={bg.imageOpacity}
        listening={false}
      />
    </Group>
  );
};
