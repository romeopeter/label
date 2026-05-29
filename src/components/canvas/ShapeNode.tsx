import type Konva from "konva";
import { Group, Rect, Ellipse, Arrow, Text as KText, Tag, Label } from "react-konva";
import type { ShapeElement } from "../../types";
import { useEditor } from "../../store/editor";

interface Props {
  el: ShapeElement;
  selected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

export const ShapeNode = ({ el, onSelect }: Props) => {
  const update = useEditor((s) => s.updateElement);
  const sp = el.shadow?.enabled
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: 1,
      }
    : {};

  const common = {
    ...sp,
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      update(el.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const sx = node.scaleX(); const sy = node.scaleY();
      node.scaleX(1); node.scaleY(1);
      update(el.id, {
        x: node.x(), y: node.y(),
        width: Math.max(8, el.width * sx),
        height: Math.max(8, el.height * sy),
        rotation: node.rotation(),
      });
    },
  };

  const dash = el.dashed ? [el.strokeWidth * 2, el.strokeWidth * 2] : undefined;
  const borderStroke = el.border?.enabled ? el.border.color : el.stroke;
  const borderWidth = el.border?.enabled ? el.border.width : el.strokeWidth;

  if (el.shape === "rect" || el.shape === "rounded-rect" || el.shape === "highlight") {
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
      </Group>
    );
  }

  if (el.shape === "ellipse") {
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
      </Group>
    );
  }

  if (el.shape === "arrow") {
    return (
      <Group {...common}>
        <Arrow
          points={[0, el.height / 2, el.width, el.height / 2]}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          fill={el.stroke}
          pointerLength={el.arrowHeadSize ?? 18}
          pointerWidth={(el.arrowHeadSize ?? 18) * 0.9}
          dash={dash}
        />
      </Group>
    );
  }

  if (el.shape === "callout") {
    return (
      <Group {...common}>
        <Label x={0} y={0}>
          <Tag
            fill={el.fill}
            stroke={borderStroke}
            strokeWidth={borderWidth}
            pointerDirection="down"
            pointerWidth={20}
            pointerHeight={20}
            cornerRadius={12}
            lineJoin="round"
          />
          <KText
            text={el.text ?? "Callout"}
            fontSize={Math.max(14, el.height / 3)}
            fill="#FFFFFF"
            padding={16}
            align="center"
          />
        </Label>
      </Group>
    );
  }

  return null;
};
