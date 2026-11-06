import { memo, useEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import { Image as KImage, Group, Rect } from "react-konva";
import useImage from "use-image";
import type { ImageElement } from "../../types";
import { useEditor } from "../../store/editor";
import { visibleCrop } from "@/lib/layouts";
import {
  browserLookOf,
  frameArtUrl,
  frameShapeOf,
  hasArtwork,
  isFrameTurned,
  pictureView,
  screenBoxOf,
  screenPathOf,
  sourceOf,
} from "@/lib/mockups";
import { isImageTiltActive } from "@/lib/tilt";
import { sameNodeProps } from "./nodeProps";
import { BrowserBack, BrowserFront } from "./BrowserFrame";
import { useEditedImage } from "./useEditedImage";
import { useAltHeld } from "./usePictureDrag";
import { WindowBack, WindowFront } from "./WindowFrame";

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

const ImageNodeBody = ({ el, onSelect }: Props) => {
  const [img] = useImage(el.src, "anonymous");
  const frame = el.deviceFrame;
  const usesArt = !!frame && hasArtwork(frame);
  const [art] = useImage(usesArt ? frameArtUrl(frame) : "", "anonymous");
  const pictureRef = useRef<Konva.Image>(null);
  const crop = useMemo(() => visibleCrop(el), [el.crop, el.layoutCrop]); // eslint-disable-line react-hooks/exhaustive-deps -- only these two feed it
  const inLayout = useEditor((s) => !!s.layout?.slots.some((slot) => slot.id === el.id));
  const { picture, edited } = useEditedImage(
    img,
    el.edit,
    crop,
    () => pictureRef.current?.getLayer()?.batchDraw(),
  );
  const update = useEditor((s) => s.updateElement);
  const altHeld = useAltHeld();

  // Images saved before this was recorded learn their size on first load.
  useEffect(() => {
    if (img && el.naturalWidth === undefined) {
      useEditor.getState().setNaturalSize(el.id, img.naturalWidth, img.naturalHeight);
    }
  }, [img, el.id, el.naturalWidth]);

  const sp = shadowProps(el);
  const selectedIds = useEditor((s) => s.selectedIds);
  const cropping = useEditor((s) => s.cropId === el.id);
  const showTiltPlaceholder =
    selectedIds.includes(el.id) && !el.deviceFrame && isImageTiltActive(el.transform);

  // Holds the node while the image loads: a new image is selected straight away,
  // and the Transformer only attaches to nodes that already exist.
  if (!img || !picture || (usesArt && !art)) {
    return (
      <Group id={el.id} x={el.x} y={el.y} rotation={el.rotation} visible={!el.hidden}>
        <Rect width={el.width} height={el.height} opacity={0} />
      </Group>
    );
  }

  const onTransform = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX(); const sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    update(el.id, {
      x: node.x(), y: node.y(),
      width: el.width * sx,
      height: el.height * sy,
      rotation: node.rotation(),
    });
  };

  const nodeProps = {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    // Alt-dragging moves a mockup's picture instead; see usePictureDrag.
    draggable: !el.locked && !inLayout && !(frame && altHeld),
    visible: !el.hidden,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      update(el.id, { x: e.target.x(), y: e.target.y() }),
    onTransform,
  };

  const shape = frameShapeOf(el);
  if (!frame || !shape) {
    return (
      <Group {...sp} {...nodeProps}>
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
              !edited && crop ? {
                x: crop.x * img.naturalWidth,
                y: crop.y * img.naturalHeight,
                width: crop.width * img.naturalWidth,
                height: crop.height * img.naturalHeight,
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

  // The picture is drawn on the screen, and only ever the part that lands on it. Filling
  // means taking a part with the screen's shape, so it's never stretched.
  const screen = screenBoxOf(el, shape);
  // An edited picture has the crop baked in.
  const source = edited
    ? { x: 0, y: 0, width: picture.width as number, height: picture.height as number }
    : sourceOf(crop, img.naturalWidth, img.naturalHeight);
  const { drawn, shown } = pictureView(source, screen, frame);

  const path = screenPathOf(el, shape);
  const pictureNodes = (
    <Group
      clipFunc={(ctx) => {
        const { x, y, width, height, corners } = path;
        const [topLeft, topRight, bottomRight, bottomLeft] = corners;
        ctx.beginPath();
        ctx.moveTo(x + topLeft, y);
        ctx.arcTo(x + width, y, x + width, y + height, topRight);
        ctx.arcTo(x + width, y + height, x, y + height, bottomRight);
        ctx.arcTo(x, y + height, x, y, bottomLeft);
        ctx.arcTo(x, y, x + width, y, topLeft);
        ctx.closePath();
      }}
    >
      <Rect {...screen} fill={frame.barColor} listening={false} />
      <KImage ref={pictureRef} name="mockup-picture" image={picture} {...drawn} crop={shown} />
    </Group>
  );

  if (usesArt && art) {
    // Drawn twice: a shadow cast by the frame would otherwise fall across the screen.
    const artProps = isFrameTurned(frame)
      ? { x: 0, y: el.height, width: el.height, height: el.width, rotation: -90 }
      : { width: el.width, height: el.height };
    return (
      <Group {...nodeProps}>
        <Group visible={!cropping}>
          {el.shadow?.enabled && <KImage image={art} {...artProps} {...sp} listening={false} />}
          {pictureNodes}
          <KImage name="mockup-frame" image={art} {...artProps} />
        </Group>
      </Group>
    );
  }

  const isBrowser = !!browserLookOf(frame);
  return (
    <Group {...nodeProps}>
      <Group visible={!cropping}>
        {isBrowser ? (
          <BrowserBack el={el} frame={frame} shadow={sp} path={path} />
        ) : (
          <WindowBack el={el} frame={frame} shadow={sp} path={path} />
        )}
        {pictureNodes}
        {isBrowser ? (
          <BrowserFront el={el} frame={frame} />
        ) : (
          <WindowFront el={el} frame={frame} path={path} />
        )}
      </Group>
    </Group>
  );
};

export const ImageNode = memo(ImageNodeBody, sameNodeProps);
