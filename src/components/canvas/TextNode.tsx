import { memo, useEffect, useRef } from "react";
import type Konva from "konva";
import { Text as KText, Group } from "react-konva";
import type { TextElement } from "../../types";
import { useEditor } from "../../store/editor";
import { sameNodeProps } from "./nodeProps";

interface Props {
  el: TextElement;
  selected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

const MIN_TEXT_WIDTH = 20;
const MIN_FONT_SIZE = 8;

const TextNodeBody = ({ el, onSelect }: Props) => {
  const update = useEditor((s) => s.updateElement);
  const measure = useEditor((s) => s.measureElement);
  const setEditingId = useEditor((s) => s.setEditingId);
  const editing = useEditor((s) => s.editingId === el.id);
  const textRef = useRef<Konva.Text>(null);
  const sp = el.shadow?.enabled
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: 1,
      }
    : {};

  // The box is as tall as its wrapped lines, so keep the stored height honest.
  useEffect(() => {
    const height = textRef.current?.height();
    if (height !== undefined && Math.abs(height - el.height) > 0.5) {
      measure(el.id, height);
    }
  });

  const startEditing = () => {
    if (!el.locked) setEditingId(el.id);
  };

  return (
    <Group
      {...sp}
      id={el.id}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      opacity={el.opacity}
      draggable={!el.locked}
      visible={!el.hidden}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={startEditing}
      onDblTap={startEditing}
      onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
      // Side handles set the width the text wraps to. Corner handles scale the
      // text itself. Either way the scale is cleared on every move and turned
      // into real values, so the letters are redrawn rather than stretched.
      onTransform={(e) => {
        const node = e.target;
        const factor = node.scaleX();
        const anchor = node
          .getStage()
          ?.findOne<Konva.Transformer>("Transformer")
          ?.getActiveAnchor();
        const rewrap = anchor === "middle-left" || anchor === "middle-right";
        node.scaleX(1);
        node.scaleY(1);
        update(el.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(MIN_TEXT_WIDTH, el.width * factor),
          rotation: node.rotation(),
          ...(rewrap
            ? {}
            : {
                fontSize: Math.max(MIN_FONT_SIZE, el.fontSize * factor),
                letterSpacing: el.letterSpacing * factor,
              }),
        });
      }}
      onTransformEnd={() => update(el.id, { fontSize: Math.round(el.fontSize) })}
    >
      <KText
        ref={textRef}
        text={el.text}
        width={el.width}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={
          el.fontWeight >= 700
            ? "bold"
            : el.fontWeight >= 500
              ? "500"
              : "normal"
        }
        fill={el.fill}
        align={el.align}
        lineHeight={el.lineHeight}
        letterSpacing={el.letterSpacing}
        visible={!editing}
      />
    </Group>
  );
};

export const TextNode = memo(TextNodeBody, sameNodeProps);
