import type Konva from "konva";
import { Text as KText, Group } from "react-konva";
import type { TextElement } from "../../types";
import { useEditor } from "../../store/editor";

interface Props {
  el: TextElement;
  selected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onRequestEdit: (el: TextElement) => void;
}

export const TextNode = ({ el, onSelect, onRequestEdit }: Props) => {
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

  return (
    <Group
      {...sp}
      id={el.id}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={() => onRequestEdit(el)}
      onDblTap={() => onRequestEdit(el)}
      onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        node.scaleX(1); node.scaleY(1);
        update(el.id, {
          x: node.x(), y: node.y(),
          width: Math.max(20, el.width * sx),
          fontSize: Math.max(8, el.fontSize * sx),
          rotation: node.rotation(),
        });
      }}
    >
      <KText
        text={el.text}
        width={el.width}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={el.fontWeight >= 700 ? "bold" : el.fontWeight >= 500 ? "500" : "normal"}
        fill={el.fill}
        align={el.align}
        lineHeight={el.lineHeight}
        letterSpacing={el.letterSpacing}
      />
    </Group>
  );
};
