import { Rect, Image as KImage, Group } from "react-konva";
import useImage from "use-image";
import type { BackgroundState } from "../../types";
import { PatternFillRect } from "./PatternFillRect";
import { BackgroundFill } from "./BackgroundFill";
import { isBackdropSupported } from "@/lib/backdrops/renderer";
import { changesPixels } from "@/lib/background/effects";
import { coverOf, gradientEnds, IMAGE_PLACEHOLDER } from "@/lib/background/drawSource";

interface Props {
  bg: BackgroundState;
  width: number;
  height: number;
}

/**
 * The background, under everything. Abstract backgrounds, and any type with
 * effects, go through Layer's renderer; the rest are plain Konva nodes. Opacity
 * is the one effect Konva does itself.
 */
export const Background = ({ bg, width, height }: Props) => {
  const rendered = bg.mode === "abstract" || (changesPixels(bg.effects) && isBackdropSupported());
  return (
    <Group opacity={bg.effects.opacity} listening={false}>
      {rendered ? (
        <BackgroundFill bg={bg} width={width} height={height} />
      ) : (
        <PlainBackground bg={bg} width={width} height={height} />
      )}
    </Group>
  );
};

const PlainBackground = ({ bg, width, height }: Props) => {
  if (bg.mode === "solid") {
    return <Rect x={0} y={0} width={width} height={height} fill={bg.color} listening={false} />;
  }

  if (bg.mode === "gradient") {
    const { start, end } = gradientEnds(bg.gradient, width, height);
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillLinearGradientStartPoint={start}
        fillLinearGradientEndPoint={end}
        fillLinearGradientColorStops={[0, bg.gradient.from, 1, bg.gradient.to]}
        listening={false}
      />
    );
  }

  if (bg.mode === "pattern") {
    return <PatternFillRect pattern={bg.pattern} width={width} height={height} />;
  }

  return <BackgroundImage bg={bg} width={width} height={height} />;
};

const BackgroundImage = ({ bg, width, height }: Props) => {
  const [img] = useImage(bg.imageSrc || "", "anonymous");

  return (
    <Group listening={false}>
      <Rect x={0} y={0} width={width} height={height} fill={IMAGE_PLACEHOLDER} />
      {img && bg.imageSrc && <KImage image={img} {...coverOf(img, width, height)} listening={false} />}
    </Group>
  );
};
