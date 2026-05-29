import type Konva from "konva";
import { Image as KImage, Group, Rect } from "react-konva";
import useImage from "use-image";
import type { ImageElement, DeviceFrame } from "../../types";
import { useEditor } from "../../store/editor";

interface Props {
  el: ImageElement;
  selected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

const shadowProps = (el: ImageElement) =>
  el.shadow?.enabled
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: 1,
      }
    : {};

// Inset for clipped screenshot area within each device frame
const FRAME_INSET: Record<NonNullable<DeviceFrame>, { top: number; right: number; bottom: number; left: number; outerPad: number; chromeColor: string }> = {
  "macbook-light":  { top: 24, right: 28, bottom: 60, left: 28, outerPad: 0,  chromeColor: "#E7E5F5" },
  "macbook-dark":   { top: 24, right: 28, bottom: 60, left: 28, outerPad: 0,  chromeColor: "#1A1826" },
  "iphone-light":   { top: 60, right: 16, bottom: 60, left: 16, outerPad: 0,  chromeColor: "#E7E5F5" },
  "iphone-dark":    { top: 60, right: 16, bottom: 60, left: 16, outerPad: 0,  chromeColor: "#0F0E1A" },
  "browser-light":  { top: 36, right: 0,  bottom: 0,  left: 0,  outerPad: 0,  chromeColor: "#EEEDFE" },
  "browser-dark":   { top: 36, right: 0,  bottom: 0,  left: 0,  outerPad: 0,  chromeColor: "#1A1826" },
};

export const ImageNode = ({ el, onSelect }: Props) => {
  const [img] = useImage(el.src, "anonymous");
  const update = useEditor((s) => s.updateElement);
  const sp = shadowProps(el);

  if (!img) return null;

  if (!el.deviceFrame) {
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
        onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
        onTransformEnd={(e) => {
          const node = e.target;
          const sx = node.scaleX(); const sy = node.scaleY();
          node.scaleX(1); node.scaleY(1);
          update(el.id, {
            x: node.x(), y: node.y(),
            width: Math.max(20, el.width * sx),
            height: Math.max(20, el.height * sy),
            rotation: node.rotation(),
          });
        }}
      >
        <KImage
          image={img}
          width={el.width}
          height={el.height}
          cornerRadius={el.cornerRadius}
          stroke={el.border?.enabled ? el.border.color : undefined}
          strokeWidth={el.border?.enabled ? el.border.width : 0}
        />
      </Group>
    );
  }

  // Device frame overlay: draw chrome rect + clip image to screen area
  const inset = FRAME_INSET[el.deviceFrame];
  const screenX = inset.left;
  const screenY = inset.top;
  const screenW = el.width - inset.left - inset.right;
  const screenH = el.height - inset.top - inset.bottom;

  // Cover-fit screenshot inside screen
  const ratio = Math.max(screenW / img.width, screenH / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  const ix = screenX + (screenW - iw) / 2;
  const iy = screenY + (screenH - ih) / 2;

  const isBrowser = el.deviceFrame.startsWith("browser");
  const isPhone = el.deviceFrame.startsWith("iphone");
  const cornerR = isPhone ? 56 : isBrowser ? 12 : 18;

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
      onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX(); const sy = node.scaleY();
        node.scaleX(1); node.scaleY(1);
        update(el.id, {
          x: node.x(), y: node.y(),
          width: Math.max(120, el.width * sx),
          height: Math.max(80, el.height * sy),
          rotation: node.rotation(),
        });
      }}
    >
      {/* Frame body */}
      <Rect
        x={0}
        y={0}
        width={el.width}
        height={el.height}
        fill={inset.chromeColor}
        cornerRadius={cornerR}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
      />
      {/* Browser dots */}
      {isBrowser && (
        <>
          <Rect x={12} y={12} width={10} height={10} fill="#FF6B5B" cornerRadius={5} />
          <Rect x={28} y={12} width={10} height={10} fill="#F8C24A" cornerRadius={5} />
          <Rect x={44} y={12} width={10} height={10} fill="#54C56A" cornerRadius={5} />
        </>
      )}
      {/* Screen */}
      <Group
        clipFunc={(ctx) => {
          const r = isBrowser ? 0 : 8;
          ctx.beginPath();
          ctx.moveTo(screenX + r, screenY);
          ctx.lineTo(screenX + screenW - r, screenY);
          ctx.quadraticCurveTo(screenX + screenW, screenY, screenX + screenW, screenY + r);
          ctx.lineTo(screenX + screenW, screenY + screenH - r);
          ctx.quadraticCurveTo(screenX + screenW, screenY + screenH, screenX + screenW - r, screenY + screenH);
          ctx.lineTo(screenX + r, screenY + screenH);
          ctx.quadraticCurveTo(screenX, screenY + screenH, screenX, screenY + screenH - r);
          ctx.lineTo(screenX, screenY + r);
          ctx.quadraticCurveTo(screenX, screenY, screenX + r, screenY);
          ctx.closePath();
        }}
      >
        <Rect x={screenX} y={screenY} width={screenW} height={screenH} fill="#0F0E1A" />
        <KImage image={img} x={ix} y={iy} width={iw} height={ih} />
      </Group>
      {/* MacBook hinge */}
      {el.deviceFrame.startsWith("macbook") && (
        <Rect
          x={el.width / 2 - 60}
          y={el.height - 14}
          width={120}
          height={6}
          fill="rgba(0,0,0,0.2)"
          cornerRadius={3}
        />
      )}
      {/* iPhone notch */}
      {isPhone && (
        <Rect
          x={el.width / 2 - 50}
          y={20}
          width={100}
          height={26}
          fill="#0F0E1A"
          cornerRadius={13}
        />
      )}
    </Group>
  );
};
