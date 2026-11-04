import { memo, useRef } from "react";
import type Konva from "konva";
import { Image as KImage, Group, Rect } from "react-konva";
import useImage from "use-image";
import type { ImageElement, DeviceFrame } from "../../types";
import { useEditor } from "../../store/editor";
import { MIN_FRAME_SIZE } from "@/lib/constants";
import { isImageTiltActive } from "@/lib/tilt";
import { sameNodeProps } from "./nodeProps";
import { useEditedImage } from "./useEditedImage";

/* ----------------------------------------------------------------- */

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
const FRAME_INSET: Record<
  NonNullable<DeviceFrame>,
  {
    top: number;
    right: number;
    bottom: number;
    left: number;
    outerPad: number;
    chromeColor: string;
  }
> = {
  "macbook-light": {
    top: 24,
    right: 28,
    bottom: 60,
    left: 28,
    outerPad: 0,
    chromeColor: "#E7E5F5",
  },
  "macbook-dark": {
    top: 24,
    right: 28,
    bottom: 60,
    left: 28,
    outerPad: 0,
    chromeColor: "#1A1826",
  },
  "iphone-light": {
    top: 60,
    right: 16,
    bottom: 60,
    left: 16,
    outerPad: 0,
    chromeColor: "#E7E5F5",
  },
  "iphone-dark": {
    top: 60,
    right: 16,
    bottom: 60,
    left: 16,
    outerPad: 0,
    chromeColor: "#0F0E1A",
  },
  "browser-light": {
    top: 36,
    right: 0,
    bottom: 0,
    left: 0,
    outerPad: 0,
    chromeColor: "#EEEDFE",
  },
  "browser-dark": {
    top: 36,
    right: 0,
    bottom: 0,
    left: 0,
    outerPad: 0,
    chromeColor: "#1A1826",
  },
};

const ImageNodeBody = ({ el, onSelect }: Props) => {
  const [img] = useImage(el.src, "anonymous");
  const pictureRef = useRef<Konva.Image>(null);
  const { picture, edited } = useEditedImage(
    img,
    el.edit,
    el.crop,
    () => pictureRef.current?.getLayer()?.batchDraw(),
  );
  const update = useEditor((s) => s.updateElement);
  const sp = shadowProps(el);
  const selectedIds = useEditor((s) => s.selectedIds);
  const cropping = useEditor((s) => s.cropId === el.id);
  const showTiltPlaceholder =
    selectedIds.includes(el.id) && !el.deviceFrame && isImageTiltActive(el.transform);

  // Holds the node while the image loads: a new image is selected straight away,
  // and the Transformer only attaches to nodes that already exist.
  if (!img || !picture) {
    return (
      <Group id={el.id} x={el.x} y={el.y} rotation={el.rotation} visible={!el.hidden}>
        <Rect width={el.width} height={el.height} opacity={0} />
      </Group>
    );
  }

  // A frame's insets stop fitting below its minimum. A plain image needs no
  // floor here: flooring one side alone would break its proportions.
  const minWidth = el.deviceFrame ? MIN_FRAME_SIZE.width : 0;
  const minHeight = el.deviceFrame ? MIN_FRAME_SIZE.height : 0;

  const onTransform = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX(); const sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    update(el.id, {
      x: node.x(), y: node.y(),
      width: Math.max(minWidth, el.width * sx),
      height: Math.max(minHeight, el.height * sy),
      rotation: node.rotation(),
    });
  };

  if (!el.deviceFrame) {
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
        onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
        onTransform={onTransform}
      >
        {showTiltPlaceholder ? (
          <Rect width={el.width} height={el.height} opacity={0} />
        ) : (
          <KImage
            ref={pictureRef}
            image={picture}
            width={el.width}
            height={el.height}
            visible={!cropping}
            // An edited picture has the crop baked in.
            crop={
              !edited && el.crop ? {
                x: el.crop.x * img.naturalWidth,
                y: el.crop.y * img.naturalHeight,
                width: el.crop.width * img.naturalWidth,
                height: el.crop.height * img.naturalHeight,
              } : undefined
            }
            cornerRadius={el.cornerRadius}
            stroke={el.border?.enabled ? el.border.color : undefined}
            strokeWidth={el.border?.enabled ? el.border.width : 0}
          />
        )}
      </Group>
    );
  }

  // Device frame overlay: draw chrome rect + clip image to screen area
  const inset = FRAME_INSET[el.deviceFrame];
  const screenX = inset.left;
  const screenY = inset.top;
  const screenW = el.width - inset.left - inset.right;
  const screenH = el.height - inset.top - inset.bottom;

  // Cover-fit what's left of the screenshot inside the screen
  const visibleW = img.width * (el.crop?.width ?? 1);
  const visibleH = img.height * (el.crop?.height ?? 1);
  const ratio = Math.max(screenW / visibleW, screenH / visibleH);
  const iw = visibleW * ratio;
  const ih = visibleH * ratio;
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
      draggable={!el.locked}
      visible={!el.hidden}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => update(el.id, { x: e.target.x(), y: e.target.y() })}
      onTransform={onTransform}
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
        <KImage
          ref={pictureRef}
          image={picture}
          x={ix}
          y={iy}
          width={iw}
          height={ih}
          visible={!cropping}
          // An edited picture has the crop baked in.
          crop={
            !edited && el.crop ? {
              x: el.crop.x * img.naturalWidth,
              y: el.crop.y * img.naturalHeight,
              width: el.crop.width * img.naturalWidth,
              height: el.crop.height * img.naturalHeight,
            } : undefined
          }
        />
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

export const ImageNode = memo(ImageNodeBody, sameNodeProps);
