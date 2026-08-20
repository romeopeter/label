import { useEffect, useMemo, useState } from "react";
import { Group, Rect } from "react-konva";
import type { PatternConfig } from "@/types/pattern";
import { useEditor } from "@/store/editor";
import { resolveColorPair } from "@/lib/patterns/resolveColorPair";
import { getPatternTile } from "@/lib/patterns/tileCache";

/** Konva name the exporter looks up to swap in a high-DPI tile before capture. */
export const PATTERN_FILL_NAME = "pattern-fill";

/** Tile density used for on-screen preview. Export regenerates at export DPI. */
const PREVIEW_DPI = 2;
const DRAG_DPI = 1;

interface Props {
  pattern: PatternConfig;
  width: number;
  height: number;
}

export const PatternFillRect = ({ pattern, width, height }: Props) => {
  const [tile, setTile] = useState<HTMLImageElement | null>(null);
  const [tileDpi, setTileDpi] = useState(PREVIEW_DPI);

  // Set by the panel sliders while they're held, so dragging doesn't rasterize
  // a full-DPI tile on every tick.
  const dragging = useEditor((s) => s.patternDragging);
  const customPairs = useEditor((s) => s.customPatternPairs);

  const pair = useMemo(
    () => resolveColorPair(pattern.colorPairId, customPairs),
    [pattern.colorPairId, customPairs],
  );

  const { type, size } = pattern;

  useEffect(() => {
    let cancelled = false;
    // Cheap during interaction, crisp on release — the same trade the tilt
    // controls make.
    const dpiScale = dragging ? DRAG_DPI : PREVIEW_DPI;

    getPatternTile({ type, size }, pair, dpiScale)
      .then((img) => {
        if (cancelled) return;
        setTile(img);
        setTileDpi(dpiScale);
      })
      .catch(() => {
        // A tile that won't rasterize leaves the base colour showing rather
        // than blanking the background out from under the user.
        if (!cancelled) setTile(null);
      });

    return () => {
      cancelled = true;
    };
    // Only `type`, `size` and the colour pair change the tile bitmap. Intensity
    // and rotation are Konva props below, so they must not retrigger a raster.
  }, [type, size, pair, dragging]);

  return (
    <Group listening={false}>
      {/*
        The base colour is painted opaque underneath and `intensity` fades only
        the patterned layer on top. Putting the opacity on a single rect would
        make the whole background translucent — and since this is the bottom
        layer, exported PNGs would come out semi-transparent.
      */}
      <Rect x={0} y={0} width={width} height={height} fill={pair.base} listening={false} />
      {tile && (
        <Rect
          name={PATTERN_FILL_NAME}
          x={0}
          y={0}
          width={width}
          height={height}
          fillPatternImage={tile}
          fillPatternRepeat="repeat"
          // The tile is rasterized `tileDpi` times oversized; scale it back down
          // so it keeps its intended on-canvas size but carries more pixels.
          fillPatternScaleX={1 / tileDpi}
          fillPatternScaleY={1 / tileDpi}
          // Rotates the whole pattern lattice rather than each tile's contents,
          // which is what keeps the repeat seamless at any angle.
          fillPatternRotation={pattern.rotation}
          opacity={pattern.intensity}
          listening={false}
        />
      )}
    </Group>
  );
};
