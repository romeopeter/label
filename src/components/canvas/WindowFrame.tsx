import { Rect } from "react-konva";
import { windowStyleOf, type ScreenPath } from "@/lib/mockups";
import type { DeviceFrame, ImageElement } from "@/types";

/**
 * Screens: frames drawn here rather than from artwork, because they wrap a picture of
 * any shape. The back goes under the picture and the front goes over it. The colours
 * are artwork, so they export.
 */

interface Look {
  fill?: string;
  /** Corner to corner, for a rim that catches the light. */
  sheen?: (string | number)[];
  /** The outer edge. */
  edge?: string;
  /** A rim that catches the light, drawn instead of a plain edge. */
  edgeSheen?: (string | number)[];
  /** The line around the picture. */
  rim?: string;
}

const LOOKS: Record<string, Look> = {
  "glass-light": {
    sheen: [0, "rgba(255,255,255,0.46)", 1, "rgba(255,255,255,0.14)"],
    edge: "rgba(255,255,255,0.6)",
    rim: "rgba(255,255,255,0.35)",
  },
  "glass-dark": {
    sheen: [0, "rgba(34,34,44,0.66)", 1, "rgba(10,10,14,0.44)"],
    edge: "rgba(255,255,255,0.2)",
    rim: "rgba(0,0,0,0.35)",
  },
  liquid: {
    sheen: [0, "rgba(255,255,255,0.34)", 0.45, "rgba(255,255,255,0.08)", 1, "rgba(255,255,255,0.26)"],
    edgeSheen: [0, "rgba(255,255,255,0.95)", 0.35, "rgba(255,255,255,0.25)", 0.7, "rgba(255,255,255,0.2)", 1, "rgba(255,255,255,0.8)"],
    rim: "rgba(255,255,255,0.55)",
  },
  "inset-light": { fill: "#ECECF1", edge: "rgba(0,0,0,0.08)", rim: "rgba(0,0,0,0.16)" },
  "inset-dark": { fill: "#15151A", edge: "rgba(255,255,255,0.1)", rim: "rgba(255,255,255,0.16)" },
  "outline-light": { edge: "#FFFFFF" },
  "outline-dark": { edge: "#111116" },
  "border-light": { fill: "#FFFFFF" },
  "border-dark": { fill: "#111116" },
};

/** Sheets behind a picture: top sheet first, each a little further back. */
const PAPER: Record<string, { sheets: string[]; edge: string }> = {
  light: { sheets: ["#FFFFFF", "#F3F3F6", "#E7E7EC", "#DBDBE2"], edge: "rgba(0,0,0,0.1)" },
  dark: { sheets: ["#2A2A31", "#222228", "#1A1A20", "#131318"], edge: "rgba(255,255,255,0.1)" },
};

/** What sits behind a Retro frame, as a solid block rather than a soft shadow. */
const RETRO: Record<string, { fill: string; block: string }> = {
  light: { fill: "#FFFFFF", block: "#C9C9D2" },
  dark: { fill: "#111116", block: "#000000" },
};

/** An outline is the whole frame, so it's heavier than the other styles' edges. */
const OUTLINE_WEIGHT = 0.003;
/** How much of a Card's padding is left for the sheet turned behind it. */
const CARD_MARGIN = 0.25;
const CARD_TURN_MAX = 2;
const STACK_SHEETS = 3;
/** How far in each sheet of a Stack steps, as a fraction of the frame's width. */
const STACK_STEP_IN = 0.026;

const lookOf = (frame: DeviceFrame) =>
  LOOKS[frame.device] ?? LOOKS[`${frame.device}-${frame.finish}`] ?? {};

const paperOf = (frame: DeviceFrame) => PAPER[frame.finish] ?? PAPER.light;

interface Props {
  el: ImageElement;
  frame: DeviceFrame;
  shadow: object;
  path: ScreenPath;
}

/** Clear rather than absent, so the gap around a picture can still be clicked. */
const HitArea = ({ el, radius, shadow }: { el: ImageElement; radius: number; shadow?: object }) => (
  <Rect
    name="mockup-frame"
    width={el.width}
    height={el.height}
    cornerRadius={radius}
    fill="rgba(0,0,0,0)"
    {...shadow}
  />
);

const CardBack = ({ el, frame, shadow, radius }: Omit<Props, "path"> & { radius: number }) => {
  const paper = paperOf(frame);
  const margin = windowStyleOf(frame).left * el.width * CARD_MARGIN;
  const width = el.width - margin * 2;
  const height = el.height - margin * 2;
  // As far as it can turn and still stay inside the box.
  const reach = (Math.max(el.width, el.height) - margin * 2) / 2;
  const turn = Math.min(CARD_TURN_MAX, (Math.atan(margin / Math.max(reach, 1)) * 180) / Math.PI);
  return (
    <>
      <HitArea el={el} radius={radius} />
      <Rect
        x={el.width / 2}
        y={el.height / 2}
        offsetX={width / 2}
        offsetY={height / 2}
        width={width}
        height={height}
        rotation={turn}
        cornerRadius={radius}
        fill={paper.sheets[2]}
        stroke={paper.edge}
        strokeWidth={1}
        listening={false}
      />
      <Rect
        x={margin}
        y={margin}
        width={width}
        height={height}
        cornerRadius={radius}
        fill={paper.sheets[0]}
        stroke={paper.edge}
        strokeWidth={1}
        listening={false}
        {...shadow}
      />
    </>
  );
};

const StackBack = ({ el, frame, shadow, path, radius }: Props & { radius: number }) => {
  const paper = paperOf(frame);
  const bottom = path.y + path.height;
  const step = (el.height - bottom) / STACK_SHEETS;
  const steps = Array.from({ length: STACK_SHEETS }, (_, i) => STACK_SHEETS - i);
  return (
    <>
      <HitArea el={el} radius={radius} />
      {steps.map((i) => {
        const inset = i * STACK_STEP_IN * el.width;
        return (
          <Rect
            key={i}
            x={inset}
            y={el.height * 0.5}
            width={el.width - inset * 2}
            height={bottom + i * step - el.height * 0.5}
            cornerRadius={radius}
            fill={paper.sheets[i]}
            stroke={paper.edge}
            strokeWidth={1}
            listening={false}
            {...(i === STACK_SHEETS ? shadow : {})}
          />
        );
      })}
      <Rect
        width={el.width}
        height={bottom}
        cornerRadius={radius}
        fill={paper.sheets[0]}
        listening={false}
        {...shadow}
      />
    </>
  );
};

const FannedBack = ({ el, frame, shadow, path, radius }: Props & { radius: number }) => {
  const paper = paperOf(frame);
  const steps = Array.from({ length: STACK_SHEETS }, (_, i) => STACK_SHEETS - i);
  return (
    <>
      <HitArea el={el} radius={radius} />
      {steps.map((i) => {
        const back = i / STACK_SHEETS;
        return (
          <Rect
            key={i}
            x={path.x * (1 - back)}
            y={path.y * (1 - back)}
            width={path.width}
            height={path.height}
            cornerRadius={radius}
            fill={paper.sheets[i]}
            stroke={paper.edge}
            strokeWidth={1}
            listening={false}
            {...(i === STACK_SHEETS ? shadow : {})}
          />
        );
      })}
      <Rect
        x={path.x}
        y={path.y}
        width={path.width}
        height={path.height}
        cornerRadius={path.corners}
        fill={paper.sheets[0]}
        listening={false}
        {...shadow}
      />
    </>
  );
};

const RetroBack = ({ el, frame, shadow, radius }: Omit<Props, "path"> & { radius: number }) => {
  const colors = RETRO[frame.finish] ?? RETRO.light;
  const style = windowStyleOf(frame);
  const drop = (style.bottom - style.top) * el.width;
  return (
    <>
      <HitArea el={el} radius={radius} />
      <Rect y={drop} width={el.width} height={el.height - drop} cornerRadius={radius} fill={colors.block} listening={false} {...shadow} />
      <Rect width={el.width} height={el.height - drop} cornerRadius={radius} fill={colors.fill} listening={false} />
    </>
  );
};

export const WindowBack = ({ el, frame, shadow, path }: Props) => {
  const look = lookOf(frame);
  const radius = windowStyleOf(frame).radius * el.width;

  if (frame.device === "card") return <CardBack el={el} frame={frame} shadow={shadow} radius={radius} />;
  if (frame.device === "stack") return <StackBack el={el} frame={frame} shadow={shadow} path={path} radius={radius} />;
  if (frame.device === "stack-2") return <FannedBack el={el} frame={frame} shadow={shadow} path={path} radius={radius} />;
  if (frame.device === "retro") return <RetroBack el={el} frame={frame} shadow={shadow} radius={radius} />;

  // With nothing solid to cast a shadow, the picture casts it.
  const castsOwnShadow = frame.device !== "outline" && frame.device !== "plain";

  return (
    <>
      <Rect
        name="mockup-frame"
        width={el.width}
        height={el.height}
        cornerRadius={radius}
        fill={look.fill ?? "rgba(0,0,0,0)"}
        {...(look.sheen
          ? {
              fillPriority: "linear-gradient",
              fillLinearGradientStartPoint: { x: 0, y: 0 },
              fillLinearGradientEndPoint: { x: el.width, y: el.height },
              fillLinearGradientColorStops: look.sheen,
            }
          : {})}
        {...(castsOwnShadow ? shadow : {})}
      />
      {!castsOwnShadow && (
        <Rect
          x={path.x}
          y={path.y}
          width={path.width}
          height={path.height}
          cornerRadius={path.corners}
          fill="#000000"
          listening={false}
          {...shadow}
        />
      )}
    </>
  );
};

export const WindowFront = ({ el, frame, path }: Omit<Props, "shadow">) => {
  const look = lookOf(frame);
  const radius = windowStyleOf(frame).radius * el.width;
  const weight = frame.device === "outline" ? Math.max(1, el.width * OUTLINE_WEIGHT) : look.edgeSheen ? 1.5 : 1;

  return (
    <>
      {look.rim && (
        <Rect
          x={path.x}
          y={path.y}
          width={path.width}
          height={path.height}
          cornerRadius={path.corners}
          stroke={look.rim}
          strokeWidth={1}
          listening={false}
        />
      )}
      {(look.edge || look.edgeSheen) && (
        // Kept inside the box, so the selection and exports match what's drawn.
        <Rect
          x={weight / 2}
          y={weight / 2}
          width={el.width - weight}
          height={el.height - weight}
          cornerRadius={Math.max(0, radius - weight / 2)}
          stroke={look.edge}
          strokeWidth={weight}
          listening={false}
          {...(look.edgeSheen
            ? {
                strokeLinearGradientStartPoint: { x: 0, y: 0 },
                strokeLinearGradientEndPoint: { x: el.width, y: el.height },
                strokeLinearGradientColorStops: look.edgeSheen,
              }
            : {})}
        />
      )}
    </>
  );
};
