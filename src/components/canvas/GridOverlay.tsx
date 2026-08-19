import { useMemo } from "react";
import { Line } from "react-konva";
import type { GridState } from "@/types";

/**
 * Konva name the exporter looks up to hide this layer before capture.
 *
 * The grid is a viewport aid, so it must never reach the output. Export hides
 * it by name the same way it hides Transformers — see `withOverlaysHidden`.
 */
export const GRID_LAYER_NAME = "grid-overlay";

const LINE_COLOR = "#AFA9EC";

interface Props {
  grid: GridState;
  width: number;
  height: number;
}

/**
 * Line positions along one axis, laid out from the centre outward.
 *
 * Going centre-out rather than origin-out is what keeps the centre guide on the
 * grid for *any* canvas size, custom ones included. Laying out from 0 means the
 * centre only lands on a line when half the dimension happens to be a multiple
 * of the spacing — 2400/2 does, 1350/2 doesn't — so the centre guide had to be
 * drawn as an extra line, which chopped one band into uneven pieces and broke
 * the rhythm the grid exists to provide.
 *
 * The leftover partial cells now fall at the canvas edges, where a grid is
 * expected to run out, instead of in the middle where the eye is measuring.
 */
const axisLines = (extent: number, spacing: number) => {
  const centre = extent / 2;
  const out = [{ pos: centre, major: true }];
  if (spacing <= 0) return out; // guard: a non-positive step would never terminate

  for (let d = spacing; centre - d > 0 || centre + d < extent; d += spacing) {
    if (centre - d > 0) out.push({ pos: centre - d, major: false });
    if (centre + d < extent) out.push({ pos: centre + d, major: false });
  }
  return out;
};

export const GridOverlay = ({ grid, width, height }: Props) => {
  const lines = useMemo(() => {
    const out: { key: string; points: number[]; major: boolean }[] = [];

    for (const { pos, major } of axisLines(width, grid.size)) {
      out.push({ key: `v${pos}`, points: [pos, 0, pos, height], major });
    }
    for (const { pos, major } of axisLines(height, grid.size)) {
      out.push({ key: `h${pos}`, points: [0, pos, width, pos], major });
    }

    return out;
  }, [grid.size, width, height]);

  return (
    <>
      {lines.map(({ key, points, major }) => (
        <Line
          key={key}
          points={points}
          stroke={LINE_COLOR}
          strokeWidth={major ? 1.5 : 1}
          opacity={major ? Math.min(1, grid.opacity * 1.6) : grid.opacity}
          // Keeps lines a constant hairline on screen instead of thickening
          // with the stage's fit-to-viewport scale.
          strokeScaleEnabled={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
};
