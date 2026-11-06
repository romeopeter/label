import { Arrow, Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import { SYSTEM_FONTS } from "@/lib/constants";
import type { Arrangement, LayoutDecor } from "@/lib/layouts";

/** Konva name the exporter hides before capture. */
export const LAYOUT_SLOTS_LAYER_NAME = "layout-slots";

/* Artwork, so these are drawn into the export: the app's bad and good colours. */
const BAD_COLOR = "#dc2626";
const GOOD_COLOR = "#1d9e75";
const MARK_COLOR = "#ffffff";
const MARK_SHADOW = "rgba(0,0,0,0.45)";
const LABEL_FILL = "rgba(15,14,26,0.72)";
const SLOT_FILL = "rgba(255,255,255,0.08)";
const SLOT_STROKE = "rgba(255,255,255,0.55)";
const DROP_FILL = "rgba(29,158,117,0.3)";

const Decor = ({ item }: { item: LayoutDecor }) => {
  if (item.kind === "arrow") {
    return (
      <Arrow
        points={item.points}
        tension={0.5}
        stroke={MARK_COLOR}
        fill={MARK_COLOR}
        strokeWidth={item.width}
        pointerLength={item.width * 3}
        pointerWidth={item.width * 3}
        lineCap="round"
        shadowColor={MARK_SHADOW}
        shadowBlur={item.width * 2}
      />
    );
  }

  if (item.kind === "verdict") {
    const r = item.radius;
    return (
      <Group x={item.x} y={item.y}>
        <Circle radius={r} fill={item.good ? GOOD_COLOR : BAD_COLOR} stroke={MARK_COLOR} strokeWidth={r * 0.14} />
        {item.good ? (
          <Line
            points={[-r * 0.42, 0, -r * 0.1, r * 0.34, r * 0.46, -r * 0.34]}
            stroke={MARK_COLOR}
            strokeWidth={r * 0.2}
            lineCap="round"
            lineJoin="round"
          />
        ) : (
          <>
            <Line points={[-r * 0.34, -r * 0.34, r * 0.34, r * 0.34]} stroke={MARK_COLOR} strokeWidth={r * 0.2} lineCap="round" />
            <Line points={[r * 0.34, -r * 0.34, -r * 0.34, r * 0.34]} stroke={MARK_COLOR} strokeWidth={r * 0.2} lineCap="round" />
          </>
        )}
      </Group>
    );
  }

  const pillWidth = Math.min(item.text.length * item.size * 0.62 + item.size * 1.4, item.width);
  const pillHeight = item.size * 1.9;
  return (
    <Group x={item.x} y={item.y}>
      <Rect
        x={(item.width - pillWidth) / 2}
        width={pillWidth}
        height={pillHeight}
        fill={LABEL_FILL}
        cornerRadius={pillHeight / 2}
      />
      <Text
        text={item.text}
        width={item.width}
        height={pillHeight}
        align="center"
        verticalAlign="middle"
        wrap="none"
        ellipsis
        fontFamily={SYSTEM_FONTS[0]}
        fontStyle="bold"
        fontSize={item.size}
        fill={MARK_COLOR}
      />
    </Group>
  );
};

/** Badges, arrows and labels. Part of the artwork, so it lives with the content. */
export const LayoutDecorNodes = ({ arrangement }: { arrangement: Arrangement }) => (
  <Group listening={false}>
    {arrangement.decor.map((item, i) => (
      <Decor key={i} item={item} />
    ))}
  </Group>
);

/** Empty slots and the drop highlight: editing aids, hidden from exports. */
export const LayoutSlotsLayer = ({
  arrangement,
  dropSlot,
  scale,
  onAdd,
}: {
  arrangement: Arrangement;
  dropSlot: number | null;
  scale: number;
  onAdd: (slot: number) => void;
}) => (
  <Layer name={LAYOUT_SLOTS_LAYER_NAME}>
    {arrangement.slots.map((slot, i) =>
      slot.id ? null : (
        <Group
          key={i}
          name="layout-empty-slot"
          x={slot.x}
          y={slot.y}
          rotation={slot.rotation}
          onClick={() => onAdd(i)}
          onTap={() => onAdd(i)}
        >
          <Rect
            width={slot.width}
            height={slot.height}
            fill={SLOT_FILL}
            stroke={SLOT_STROKE}
            strokeWidth={1.5 / scale}
            dash={[8 / scale, 6 / scale]}
            cornerRadius={8}
          />
          <Text
            text="Add image"
            width={slot.width}
            height={slot.height}
            align="center"
            verticalAlign="middle"
            fontFamily={SYSTEM_FONTS[0]}
            fontSize={13 / scale}
            fill={MARK_COLOR}
            listening={false}
          />
        </Group>
      ),
    )}
    {dropSlot !== null && arrangement.slots[dropSlot] && (
      <Rect
        name="layout-drop-target"
        x={arrangement.slots[dropSlot].x}
        y={arrangement.slots[dropSlot].y}
        width={arrangement.slots[dropSlot].width}
        height={arrangement.slots[dropSlot].height}
        rotation={arrangement.slots[dropSlot].rotation}
        fill={DROP_FILL}
        stroke={GOOD_COLOR}
        strokeWidth={2 / scale}
        listening={false}
      />
    )}
  </Layer>
);
