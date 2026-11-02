import { memo, useCallback, useMemo } from "react";
import Konva from "konva";
import { Circle, Group, Rect, Ellipse, Text as KText, Line, Path } from "react-konva";
import type { ShapeElement } from "../../types";
import { useEditor } from "../../store/editor";
import { EMOJI_FONT_FAMILY, MARK_FONT_FAMILY, badgeFontSize } from "../../lib/marks";
import { qrShape } from "../../lib/qr";
import { calloutGeometry } from "../../lib/callouts";
import { connectorGeometry } from "../../lib/connectors";
import { effectProps } from "../../lib/markTools";
import { isPathShape, shapePath } from "../../lib/shapePaths";
import { sameNodeProps } from "./nodeProps";

interface Props {
  el: ShapeElement;
  selected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

/** Lucide draws every icon in a 24×24 box. */
const ICON_BOX = 24;

const ShapeNodeBody = ({ el, onSelect }: Props) => {
  const update = useEditor((s) => s.updateElement);
  const setEditingId = useEditor((s) => s.setEditingId);
  const editing = useEditor((s) => s.editingId === el.id);
  const qr = useMemo(
    () => (el.shape === "qr-code" ? qrShape(el.text ?? "") : null),
    [el.shape, el.text],
  );
  const strokePoints = useMemo(
    () =>
      el.points?.map((value, index) =>
        value * (index % 2 === 0 ? el.width : el.height),
      ),
    [el.points, el.width, el.height],
  );
  const sp = el.shadow?.enabled
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: 1,
      }
    : {};

  // A straight stroke is legitimately 1px deep; anything else stays grabbable.
  const minSize = el.points ? 1 : 8;

  // A callout's selection box is the bubble, not the bubble plus wherever its
  // tail reaches. Konva asks for this rect when fitting the Transformer.
  const boxOnlyBounds = useCallback((group: Konva.Group | null) => {
    if (!group) return;
    group.getClientRect = (config) =>
      config?.skipTransform
        ? { x: 0, y: 0, width: group.width(), height: group.height() }
        : Konva.Group.prototype.getClientRect.call(group, config);
  }, []);

  const common = {
    ...sp,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: !el.hidden,
    draggable: !el.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      update(el.id, { x: e.target.x(), y: e.target.y() }),
    // The scale is cleared on every move and turned into a real size, so
    // strokes, corners and text stay true during a resize instead of stretching
    // and snapping back at the end.
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const sx = node.scaleX(); const sy = node.scaleY();
      node.scaleX(1); node.scaleY(1);
      update(el.id, {
        x: node.x(), y: node.y(),
        width: Math.max(minSize, el.width * sx),
        height: Math.max(minSize, el.height * sy),
        rotation: node.rotation(),
        ...(el.tail
          ? { tail: [el.tail[0] * sx, el.tail[1] * sy] as [number, number] }
          : {}),
      });
    },
  };

  const filled = el.filled !== false;
  const fill = filled ? el.fill : undefined;
  // An outline only hits on its line, so give it a width you can actually grab.
  const hitStrokeWidth = filled ? undefined : Math.max(el.strokeWidth, 16);
  const effect = effectProps(el);

  const dash = el.dashed ? [el.strokeWidth * 2, el.strokeWidth * 2] : undefined;
  const borderStroke = el.border?.enabled ? el.border.color : el.stroke;
  const borderWidth = el.border?.enabled ? el.border.width : el.strokeWidth;

  if (el.shape === "rect" || el.shape === "rounded-rect") {
    return (
      <Group {...common}>
        <Rect
          {...effect}
          width={el.width}
          height={el.height}
          fill={fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          dash={dash}
          cornerRadius={el.cornerRadius}
          hitStrokeWidth={hitStrokeWidth}
        />
      </Group>
    );
  }

  if (el.shape === "ellipse") {
    return (
      <Group {...common}>
        <Ellipse
          {...effect}
          x={el.width / 2}
          y={el.height / 2}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          dash={dash}
          hitStrokeWidth={hitStrokeWidth}
        />
      </Group>
    );
  }

  if (isPathShape(el.shape)) {
    return (
      <Group {...common}>
        <Path
          {...effect}
          data={shapePath(el.shape, el.width, el.height)}
          fill={fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          dash={dash}
          lineJoin="round"
          hitStrokeWidth={hitStrokeWidth}
        />
      </Group>
    );
  }

  if (el.connector) {
    const { shaft, heads } = connectorGeometry(
      el.connector,
      el.arrowHeadSize ?? 36,
    );
    return (
      <Group {...common}>
        <Path
          data={shaft}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          dash={dash}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(el.strokeWidth, 20)}
        />
        {heads.map((head) => (
          <Path
            key={head.path}
            data={head.path}
            fill={head.filled ? el.stroke : undefined}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            lineCap="round"
            lineJoin="round"
            listening={head.filled}
          />
        ))}
      </Group>
    );
  }

  if (el.shape === "callout") {
    const geometry = calloutGeometry(
      el.calloutKind ?? "speech",
      el.width,
      el.height,
      el.tail ?? [el.width / 2, el.height + 40],
      el.cornerRadius,
    );
    const openEditor = () => {
      if (!el.locked) setEditingId(el.id);
    };
    return (
      <Group
        {...common}
        ref={boxOnlyBounds}
        width={el.width}
        height={el.height}
        onDblClick={openEditor}
        onDblTap={openEditor}
      >
        {geometry.leader && (
          <>
            <Line
              points={[...geometry.leader.from, ...geometry.leader.to]}
              stroke={el.fill}
              strokeWidth={Math.max(el.strokeWidth, 4)}
              listening={false}
            />
            <Circle
              x={geometry.leader.to[0]}
              y={geometry.leader.to[1]}
              radius={Math.max(el.strokeWidth, 4) * 2}
              fill={el.fill}
              listening={false}
            />
          </>
        )}
        <Path
          {...effect}
          data={geometry.body}
          fill={el.fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          lineJoin="round"
        />
        <KText
          text={el.text ?? ""}
          x={geometry.textBox.x}
          y={geometry.textBox.y}
          width={geometry.textBox.width}
          height={geometry.textBox.height}
          fontSize={el.fontSize ?? Math.max(14, el.height / 3)}
          fontFamily={MARK_FONT_FAMILY}
          fontStyle="500"
          lineHeight={1.2}
          fill={el.textFill ?? "#FFFFFF"}
          align="center"
          verticalAlign="middle"
          visible={!editing}
          listening={false}
        />
      </Group>
    );
  }

  // Older projects hold highlights as a box; new ones hold a marker stroke.
  if (el.shape === "highlight" && !el.points) {
    return (
      <Group {...common}>
        <Rect
          width={el.width}
          height={el.height}
          fill={el.fill}
          cornerRadius={el.cornerRadius}
        />
      </Group>
    );
  }

  if (el.shape === "highlight") {
    return (
      <Group {...common}>
        {/* Multiply tints what's beneath, so text under the marker stays dark.
            It blends within this layer, which holds images and other marks, so
            over the background (its own layer) it's a plain translucent stroke. */}
        <Line
          points={strokePoints ?? []}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          tension={0.3}
          lineCap="butt"
          lineJoin="round"
          globalCompositeOperation="multiply"
          hitStrokeWidth={Math.max(el.strokeWidth, 16)}
        />
      </Group>
    );
  }

  if (el.shape === "pencil") {
    return (
      <Group {...common}>
        <Line
          points={strokePoints ?? []}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          dash={dash}
          tension={0.4}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(el.strokeWidth, 16)}
        />
      </Group>
    );
  }

  if (el.shape === "emoji") {
    return (
      <Group {...common}>
        <KText
          text={el.text ?? ""}
          width={el.width}
          height={el.height}
          fontSize={Math.min(el.width, el.height) * 0.85}
          fontFamily={EMOJI_FONT_FAMILY}
          align="center"
          verticalAlign="middle"
          wrap="none"
        />
      </Group>
    );
  }

  if (el.shape === "number") {
    return (
      <Group {...common}>
        <Ellipse
          x={el.width / 2}
          y={el.height / 2}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={el.fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          dash={dash}
        />
        <KText
          text={el.text ?? "1"}
          width={el.width}
          height={el.height}
          fontSize={Math.min(el.width, el.height) * 0.5}
          fontFamily={MARK_FONT_FAMILY}
          fontStyle="bold"
          fill={el.textFill ?? "#FFFFFF"}
          align="center"
          verticalAlign="middle"
          wrap="none"
          listening={false}
        />
      </Group>
    );
  }

  if (el.shape === "badge") {
    return (
      <Group {...common}>
        <Rect
          width={el.width}
          height={el.height}
          fill={el.fill}
          stroke={borderStroke}
          strokeWidth={borderWidth}
          dash={dash}
          cornerRadius={el.cornerRadius}
        />
        <KText
          text={el.text ?? ""}
          width={el.width}
          height={el.height}
          fontSize={badgeFontSize(el.height)}
          fontFamily={MARK_FONT_FAMILY}
          fontStyle="bold"
          fill={el.textFill ?? "#FFFFFF"}
          align="center"
          verticalAlign="middle"
          wrap="none"
          ellipsis
          listening={false}
        />
      </Group>
    );
  }

  if (el.shape === "icons") {
    const scale = Math.min(el.width, el.height) / ICON_BOX;
    return (
      <Group {...common}>
        {/* An outline only hits on its lines; this makes the whole box grabbable. */}
        <Rect width={el.width} height={el.height} fill="transparent" />
        <Path
          data={el.iconPath ?? ""}
          x={(el.width - ICON_BOX * scale) / 2}
          y={(el.height - ICON_BOX * scale) / 2}
          scaleX={scale}
          scaleY={scale}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          dash={el.dashed ? [el.strokeWidth * 2, el.strokeWidth * 2] : undefined}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      </Group>
    );
  }

  if (el.shape === "qr-code") {
    const side = Math.min(el.width, el.height);
    const scale = qr ? side / qr.size : 1;
    return (
      <Group {...common}>
        <Rect width={side} height={side} fill={el.backgroundFill ?? "#FFFFFF"} />
        {qr && (
          <Path
            data={qr.path}
            scaleX={scale}
            scaleY={scale}
            fill={el.fill}
            listening={false}
          />
        )}
      </Group>
    );
  }

  return null;
};

export const ShapeNode = memo(ShapeNodeBody, sameNodeProps);
