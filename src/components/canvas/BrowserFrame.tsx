import { Group, Path, Rect, Text } from "react-konva";
import { browserLookOf, windowStyleOf, type ScreenPath } from "@/lib/mockups";
import type { DeviceFrame, ImageElement } from "@/types";

/**
 * Browsers, drawn as shapes so they stay sharp at any size and take any address. They
 * follow each browser's general layout, with no vendor's logo or artwork. Colours here
 * are artwork, so they export, and sizes are in the points of `BROWSER_LOOKS`.
 */

interface Palette {
  /** The strip behind the tabs. */
  strip: string;
  /** The row with the address in it. */
  bar: string;
  tab: string;
  field: string;
  ink: string;
  faint: string;
  line: string;
}

const PALETTES: Record<string, Record<string, Palette>> = {
  safari: {
    light: { strip: "#F5F5F7", bar: "#F5F5F7", tab: "#FFFFFF", field: "#E6E6EA", ink: "#3A3A3E", faint: "#8A8A90", line: "rgba(0,0,0,0.14)" },
    dark: { strip: "#2C2C2F", bar: "#2C2C2F", tab: "#3C3C40", field: "#414146", ink: "#E6E6EA", faint: "#9A9AA0", line: "rgba(255,255,255,0.12)" },
  },
  chrome: {
    light: { strip: "#DEE3EA", bar: "#FFFFFF", tab: "#FFFFFF", field: "#EEF1F6", ink: "#3C4043", faint: "#74787D", line: "rgba(0,0,0,0.12)" },
    dark: { strip: "#1F2023", bar: "#35363A", tab: "#35363A", field: "#202124", ink: "#E8EAED", faint: "#9AA0A6", line: "rgba(255,255,255,0.12)" },
  },
  edge: {
    light: { strip: "#E8EAEC", bar: "#F8F8F9", tab: "#F8F8F9", field: "#FFFFFF", ink: "#2B2B2B", faint: "#70757A", line: "rgba(0,0,0,0.12)" },
    dark: { strip: "#242526", bar: "#333436", tab: "#333436", field: "#1F2021", ink: "#EDEDED", faint: "#A0A2A5", line: "rgba(255,255,255,0.12)" },
  },
  firefox: {
    light: { strip: "#F0F0F4", bar: "#F9F9FB", tab: "#FFFFFF", field: "#EDEDF2", ink: "#2B2A33", faint: "#6E6D78", line: "rgba(0,0,0,0.12)" },
    dark: { strip: "#1C1B22", bar: "#2B2A33", tab: "#42414D", field: "#1C1B22", ink: "#FBFBFE", faint: "#A5A4AE", line: "rgba(255,255,255,0.12)" },
  },
  brave: {
    light: { strip: "#E4E6EB", bar: "#FFFFFF", tab: "#FFFFFF", field: "#F0F1F4", ink: "#30323A", faint: "#6E717B", line: "rgba(0,0,0,0.12)" },
    dark: { strip: "#17181D", bar: "#2A2B32", tab: "#2A2B32", field: "#1D1E24", ink: "#ECEDF0", faint: "#9FA1AA", line: "rgba(255,255,255,0.12)" },
  },
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MAC_DOTS = ["#FF6159", "#FFBD2E", "#28C840"];
const SHIELD_COLOR = "#E8622C";

/** Our own simple glyphs, on a 24 point grid. */
const GLYPHS = {
  back: "M15 18 9 12l6-6",
  forward: "m9 18 6-6-6-6",
  reload: "M20 12a8 8 0 1 1-2.3-5.7L20 8.6M20 4v4.6h-4.6",
  share: "M12 15V4M8 7.5 12 3.5l4 4M6 11v9h12v-9",
  plus: "M12 5v14M5 12h14",
  tabs: "M8 8h12v12H8zM4 16V4h12",
  sidebar: "M4 5h16v14H4zM10 5v14",
  menu: "M4 7h16M4 12h16M4 17h16",
  star: "m12 4 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z",
  lock: "M7 11h10v8H7zM9 11V8a3 3 0 0 1 6 0v3",
  shield: "M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z",
  book: "M5 5c3-1 5-.5 7 1 2-1.5 4-2 7-1v14c-3-1-5-.5-7 1-2-1.5-4-2-7-1zM12 6v14",
  close: "m7 7 10 10M17 7 7 17",
  minimise: "M6 12h12",
  maximise: "M7 7h10v10H7z",
};

type GlyphName = keyof typeof GLYPHS;

interface Scale {
  /** One point of the browser's design, in the image's box. */
  u: number;
  colors: Palette;
}

const Glyph = ({
  name,
  x,
  y,
  size = 18,
  color,
  fill,
  u,
}: {
  name: GlyphName;
  x: number;
  y: number;
  size?: number;
  color: string;
  fill?: string;
  u: number;
}) => {
  const scale = (size * u) / 24;
  return (
    <Path
      data={GLYPHS[name]}
      x={(x - size / 2) * u}
      y={(y - size / 2) * u}
      scaleX={scale}
      scaleY={scale}
      stroke={color}
      strokeWidth={1.8}
      lineCap="round"
      lineJoin="round"
      fill={fill}
      listening={false}
    />
  );
};

const Dot = ({ x, y, size, fill, u }: { x: number; y: number; size: number; fill: string; u: number }) => (
  <Rect
    x={(x - size / 2) * u}
    y={(y - size / 2) * u}
    width={size * u}
    height={size * u}
    cornerRadius={(size / 2) * u}
    fill={fill}
    listening={false}
  />
);

const Label = ({
  text,
  x,
  y,
  width,
  height,
  size = 13,
  align = "left",
  color,
  bold,
  u,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size?: number;
  align?: "left" | "center";
  color: string;
  bold?: boolean;
  u: number;
}) => (
  <Text
    text={text}
    x={x * u}
    y={y * u}
    width={width * u}
    height={height * u}
    fontSize={size * u}
    fontFamily={FONT}
    fontStyle={bold ? "600" : "normal"}
    fill={color}
    align={align}
    verticalAlign="middle"
    wrap="none"
    ellipsis
    listening={false}
  />
);

const MacDots = ({ y, u }: { y: number; u: number }) => (
  <>
    {MAC_DOTS.map((fill, i) => (
      <Dot key={fill} x={21 + i * 20} y={y} size={12} fill={fill} u={u} />
    ))}
  </>
);

/** A tab whose foot curves out into the row beneath it, as Chromium browsers draw it. */
const CurvedTab = ({
  x,
  top,
  width,
  bottom,
  fill,
  u,
}: {
  x: number;
  top: number;
  width: number;
  bottom: number;
  fill: string;
  u: number;
}) => {
  const round = 9;
  const right = x + width;
  return (
    <Path
      data={`M${x - round} ${bottom} Q${x} ${bottom} ${x} ${bottom - round} V${top + round} Q${x} ${top} ${x + round} ${top} H${right - round} Q${right} ${top} ${right} ${top + round} V${bottom - round} Q${right} ${bottom} ${right + round} ${bottom} Z`}
      scaleX={u}
      scaleY={u}
      fill={fill}
      listening={false}
    />
  );
};

const TabContent = ({
  x,
  y,
  width,
  height,
  title,
  colors,
  u,
}: Scale & { x: number; y: number; width: number; height: number; title: string }) => (
  <>
    <Dot x={x + 18} y={y + height / 2} size={14} fill={colors.faint} u={u} />
    <Label text={title} x={x + 32} y={y} width={width - 60} height={height} color={colors.ink} size={12.5} u={u} />
    <Glyph name="close" x={x + width - 16} y={y + height / 2} size={14} color={colors.faint} u={u} />
  </>
);

/** The row of back, forward and reload, with the address in a pill. */
const ToolRow = ({
  y,
  height,
  width,
  address,
  left = 12,
  round = 1,
  colors,
  u,
  glyphsRight,
  glyphsInField = [],
  fieldEnd,
}: Scale & {
  y: number;
  height: number;
  width: number;
  address: string;
  left?: number;
  /** How round the pill is, from 0 to 1. */
  round?: number;
  glyphsRight: GlyphName[];
  glyphsInField?: { name: GlyphName; color?: string; fill?: string }[];
  fieldEnd?: GlyphName;
}) => {
  const middle = y + height / 2;
  const fieldX = left + 104;
  const fieldWidth = width - fieldX - glyphsRight.length * 34 - 14;
  const fieldHeight = height - 12;
  const textX = fieldX + 14 + glyphsInField.length * 22;
  return (
    <>
      <Glyph name="back" x={left + 16} y={middle} color={colors.ink} u={u} />
      <Glyph name="forward" x={left + 50} y={middle} color={colors.faint} u={u} />
      <Glyph name="reload" x={left + 84} y={middle} size={17} color={colors.ink} u={u} />
      <Rect
        x={fieldX * u}
        y={(y + 6) * u}
        width={fieldWidth * u}
        height={fieldHeight * u}
        cornerRadius={((fieldHeight / 2) * round) * u}
        fill={colors.field}
        listening={false}
      />
      {glyphsInField.map((glyph, i) => (
        <Glyph
          key={glyph.name}
          name={glyph.name}
          x={fieldX + 20 + i * 22}
          y={middle}
          size={15}
          color={glyph.color ?? colors.faint}
          fill={glyph.fill}
          u={u}
        />
      ))}
      <Label text={address} x={textX} y={y + 6} width={fieldWidth - 60} height={fieldHeight} color={colors.ink} u={u} />
      {fieldEnd && (
        <Glyph
          name={fieldEnd}
          x={fieldX + fieldWidth - 20}
          y={middle}
          size={16}
          color={fieldEnd === "shield" ? SHIELD_COLOR : colors.faint}
          fill={fieldEnd === "shield" ? SHIELD_COLOR : undefined}
          u={u}
        />
      )}
      {glyphsRight.map((name, i) => (
        <Glyph key={name} name={name} x={width - 26 - i * 34} y={middle} color={colors.ink} u={u} />
      ))}
    </>
  );
};

const SafariDesktop = ({ width, address, colors, u }: Scale & { width: number; address: string }) => {
  const fieldWidth = Math.min(520, width * 0.4);
  const fieldX = (width - fieldWidth) / 2;
  return (
    <>
      <MacDots y={26} u={u} />
      <Glyph name="sidebar" x={92} y={26} color={colors.ink} u={u} />
      <Glyph name="back" x={136} y={26} color={colors.ink} u={u} />
      <Glyph name="forward" x={170} y={26} color={colors.faint} u={u} />
      <Rect x={fieldX * u} y={11 * u} width={fieldWidth * u} height={30 * u} cornerRadius={8 * u} fill={colors.field} listening={false} />
      <Label text={address} x={fieldX + 30} y={11} width={fieldWidth - 60} height={30} align="center" color={colors.ink} u={u} />
      <Glyph name="reload" x={fieldX + fieldWidth - 18} y={26} size={15} color={colors.faint} u={u} />
      <Glyph name="share" x={width - 110} y={26} color={colors.ink} u={u} />
      <Glyph name="plus" x={width - 68} y={26} color={colors.ink} u={u} />
      <Glyph name="tabs" x={width - 28} y={26} color={colors.ink} u={u} />
    </>
  );
};

const StatusRow = ({ width, y, height, colors, u }: Scale & { width: number; y: number; height: number }) => (
  <>
    <Label text="9:41" x={width > 500 ? 24 : 36} y={y} width={80} height={height} size={width > 500 ? 13 : 16} bold color={colors.ink} u={u} />
    <Rect
      x={(width - (width > 500 ? 24 : 36) - 26) * u}
      y={(y + height / 2 - 6) * u}
      width={26 * u}
      height={12 * u}
      cornerRadius={3.5 * u}
      fill={colors.ink}
      listening={false}
    />
  </>
);

const SafariTablet = ({ width, address, colors, u }: Scale & { width: number; address: string }) => {
  const fieldWidth = Math.min(460, width * 0.42);
  const fieldX = (width - fieldWidth) / 2;
  return (
    <>
      <StatusRow width={width} y={0} height={26} colors={colors} u={u} />
      <Glyph name="sidebar" x={32} y={50} color={colors.ink} u={u} />
      <Glyph name="back" x={76} y={50} color={colors.ink} u={u} />
      <Glyph name="forward" x={112} y={50} color={colors.faint} u={u} />
      <Rect x={fieldX * u} y={33 * u} width={fieldWidth * u} height={34 * u} cornerRadius={10 * u} fill={colors.field} listening={false} />
      <Label text={address} x={fieldX + 30} y={33} width={fieldWidth - 60} height={34} align="center" color={colors.ink} u={u} />
      <Glyph name="share" x={width - 112} y={50} color={colors.ink} u={u} />
      <Glyph name="plus" x={width - 72} y={50} color={colors.ink} u={u} />
      <Glyph name="tabs" x={width - 32} y={50} color={colors.ink} u={u} />
    </>
  );
};

const SafariMobile = ({
  width,
  address,
  bottomY,
  colors,
  u,
}: Scale & { width: number; address: string; bottomY: number }) => (
  <>
    <StatusRow width={width} y={10} height={36} colors={colors} u={u} />
    <Rect x={16 * u} y={(bottomY + 8) * u} width={(width - 32) * u} height={40 * u} cornerRadius={12 * u} fill={colors.tab} listening={false} />
    <Label text={address} x={50} y={bottomY + 8} width={width - 100} height={40} size={15} align="center" color={colors.ink} u={u} />
    {(["back", "forward", "share", "book", "tabs"] as GlyphName[]).map((name, i) => (
      <Glyph
        key={name}
        name={name}
        x={width * (0.1 + i * 0.2)}
        y={bottomY + 72}
        size={21}
        color={name === "forward" ? colors.faint : colors.ink}
        u={u}
      />
    ))}
    <Rect x={(width / 2 - 66) * u} y={(bottomY + 96) * u} width={132 * u} height={5 * u} cornerRadius={2.5 * u} fill={colors.ink} listening={false} />
  </>
);

const ChromiumDesktop = ({
  width,
  address,
  colors,
  u,
  shield,
}: Scale & { width: number; address: string; shield?: boolean }) => (
  <>
    <MacDots y={22} u={u} />
    <CurvedTab x={84} top={8} width={236} bottom={42} fill={colors.tab} u={u} />
    <TabContent x={84} y={8} width={236} height={34} title={address} colors={colors} u={u} />
    <Glyph name="plus" x={344} y={25} size={16} color={colors.ink} u={u} />
    <ToolRow
      y={42}
      height={shield ? 42 : 44}
      width={width}
      address={address}
      colors={colors}
      u={u}
      glyphsInField={[{ name: "lock" }]}
      fieldEnd={shield ? "shield" : "star"}
      glyphsRight={["menu", "tabs"]}
    />
  </>
);

const EdgeDesktop = ({ width, address, colors, u }: Scale & { width: number; address: string }) => (
  <>
    <Dot x={22} y={20} size={20} fill={colors.faint} u={u} />
    <Glyph name="tabs" x={54} y={20} size={17} color={colors.ink} u={u} />
    <Rect x={76 * u} y={6 * u} width={236 * u} height={30 * u} cornerRadius={7 * u} fill={colors.tab} listening={false} />
    <TabContent x={76} y={6} width={236} height={30} title={address} colors={colors} u={u} />
    <Glyph name="plus" x={332} y={21} size={16} color={colors.ink} u={u} />
    <Glyph name="minimise" x={width - 112} y={20} size={15} color={colors.ink} u={u} />
    <Glyph name="maximise" x={width - 68} y={20} size={13} color={colors.ink} u={u} />
    <Glyph name="close" x={width - 24} y={20} size={15} color={colors.ink} u={u} />
    <Rect x={0} y={40 * u} width={width * u} height={44 * u} fill={colors.bar} listening={false} />
    <ToolRow
      y={40}
      height={44}
      width={width}
      address={address}
      colors={colors}
      u={u}
      glyphsInField={[{ name: "lock" }]}
      fieldEnd="star"
      glyphsRight={["menu", "book"]}
    />
  </>
);

const FirefoxDesktop = ({ width, address, colors, u }: Scale & { width: number; address: string }) => (
  <>
    <MacDots y={22} u={u} />
    <Rect x={84 * u} y={6 * u} width={236 * u} height={32 * u} cornerRadius={6 * u} fill={colors.tab} stroke={colors.line} strokeWidth={u} listening={false} />
    <TabContent x={84} y={6} width={236} height={32} title={address} colors={colors} u={u} />
    <Glyph name="plus" x={342} y={22} size={16} color={colors.ink} u={u} />
    <Rect x={0} y={44 * u} width={width * u} height={44 * u} fill={colors.bar} listening={false} />
    <ToolRow
      y={44}
      height={44}
      width={width}
      address={address}
      round={0.45}
      colors={colors}
      u={u}
      glyphsInField={[{ name: "shield" }, { name: "lock" }]}
      fieldEnd="star"
      glyphsRight={["menu", "book"]}
    />
  </>
);

const ChromeTablet = ({ width, address, colors, u }: Scale & { width: number; address: string }) => (
  <>
    <StatusRow width={width} y={0} height={24} colors={colors} u={u} />
    <CurvedTab x={20} top={26} width={230} bottom={60} fill={colors.tab} u={u} />
    <TabContent x={20} y={26} width={230} height={34} title={address} colors={colors} u={u} />
    <Glyph name="plus" x={274} y={43} size={16} color={colors.ink} u={u} />
    <Rect x={0} y={60 * u} width={width * u} height={46 * u} fill={colors.bar} listening={false} />
    <ToolRow
      y={60}
      height={46}
      width={width}
      address={address}
      colors={colors}
      u={u}
      glyphsInField={[{ name: "lock" }]}
      fieldEnd="star"
      glyphsRight={["menu", "tabs"]}
    />
  </>
);

const ChromeMobile = ({ width, address, colors, u }: Scale & { width: number; address: string }) => (
  <>
    <StatusRow width={width} y={8} height={36} colors={colors} u={u} />
    <Rect x={0} y={50 * u} width={width * u} height={54 * u} fill={colors.bar} listening={false} />
    <Rect x={14 * u} y={57 * u} width={(width - 104) * u} height={40 * u} cornerRadius={20 * u} fill={colors.field} listening={false} />
    <Glyph name="lock" x={36} y={77} size={15} color={colors.faint} u={u} />
    <Label text={address} x={52} y={57} width={width - 170} height={40} size={15} color={colors.ink} u={u} />
    <Glyph name="tabs" x={width - 62} y={77} size={20} color={colors.ink} u={u} />
    <Glyph name="menu" x={width - 24} y={77} size={20} color={colors.ink} u={u} />
  </>
);

interface Props {
  el: ImageElement;
  frame: DeviceFrame;
  shadow: object;
  path: ScreenPath;
}

export const BrowserBack = ({ el, frame, shadow, path }: Props) => {
  const look = browserLookOf(frame);
  if (!look) return null;
  const family = frame.device.split("-")[0];
  const colors = PALETTES[family]?.[frame.finish] ?? PALETTES.safari.light;
  // A tablet turned upright is narrower than the width its points are measured on.
  const width = look.rotates && !frame.landscape ? look.height ?? look.width : look.width;
  const u = el.width / width;
  const outer = windowStyleOf(frame).radius * el.width;
  const bottomY = (path.y + path.height) / u;
  const scale = { colors, u };
  const barRow = family === "safari" ? colors.bar : colors.strip;
  const lower = look.bottom ? colors.bar : undefined;

  return (
    <>
      <Rect
        name="mockup-frame"
        width={el.width}
        height={el.height}
        cornerRadius={outer}
        fill={barRow}
        {...shadow}
      />
      <Group
        listening={false}
        clipFunc={(ctx) => {
          // Everything stays inside the window's rounded corners.
          ctx.beginPath();
          ctx.moveTo(outer, 0);
          ctx.arcTo(el.width, 0, el.width, el.height, outer);
          ctx.arcTo(el.width, el.height, 0, el.height, outer);
          ctx.arcTo(0, el.height, 0, 0, outer);
          ctx.arcTo(0, 0, el.width, 0, outer);
          ctx.closePath();
        }}
      >
        {lower && <Rect y={path.y + path.height} width={el.width} height={el.height - path.y - path.height} fill={lower} />}
        {frame.device === "safari" && <SafariDesktop width={width} address={frame.address} {...scale} />}
        {frame.device === "safari-tablet" && <SafariTablet width={width} address={frame.address} {...scale} />}
        {frame.device === "safari-mobile" && (
          <SafariMobile width={width} address={frame.address} bottomY={bottomY} {...scale} />
        )}
        {(frame.device === "chrome" || frame.device === "brave") && (
          <>
            <Rect y={42 * u} width={el.width} height={44 * u} fill={colors.bar} />
            <ChromiumDesktop width={width} address={frame.address} shield={frame.device === "brave"} {...scale} />
          </>
        )}
        {frame.device === "edge" && <EdgeDesktop width={width} address={frame.address} {...scale} />}
        {frame.device === "firefox" && <FirefoxDesktop width={width} address={frame.address} {...scale} />}
        {frame.device === "chrome-tablet" && <ChromeTablet width={width} address={frame.address} {...scale} />}
        {frame.device === "chrome-mobile" && <ChromeMobile width={width} address={frame.address} {...scale} />}
      </Group>
    </>
  );
};

/** A hairline around the window, over the picture's edge. */
export const BrowserFront = ({ el, frame }: Pick<Props, "el" | "frame">) => {
  const look = browserLookOf(frame);
  if (!look) return null;
  const family = frame.device.split("-")[0];
  const colors = PALETTES[family]?.[frame.finish] ?? PALETTES.safari.light;
  const outer = windowStyleOf(frame).radius * el.width;
  return (
    <Rect
      x={0.5}
      y={0.5}
      width={el.width - 1}
      height={el.height - 1}
      cornerRadius={Math.max(0, outer - 0.5)}
      stroke={colors.line}
      strokeWidth={1}
      listening={false}
    />
  );
};
