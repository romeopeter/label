import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
import { isImageTiltActive, parseImageTilt } from "@/lib/tilt";
import { isTiltSupported, renderTilt, tiltBoxOf, tiltCorners, type TiltLook } from "@/lib/tiltRender";
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

/** A tilted picture is drawn at twice its size, so it's sharp in a 2× export too. */
const TILT_SCALE = 2;

/**
 * The picture drawn tilted, and where it goes, when the image has a 3D tilt and
 * no frame. Null otherwise. Kept in step with every change to the image.
 */
const useTiltedPicture = (
  el: ImageElement,
  picture: CanvasImageSource | undefined,
  edited: boolean,
  crop: ReturnType<typeof visibleCrop>,
  onDraw: () => void,
) => {
  const active = !el.deviceFrame && isImageTiltActive(el.transform) && isTiltSupported();
  const out = useMemo(() => document.createElement("canvas"), []);
  const look = useMemo<TiltLook>(
    () => ({
      tilt: parseImageTilt(el.transform),
      width: el.width,
      height: el.height,
      cornerRadius: el.cornerRadius,
      border: el.border?.enabled ? el.border : null,
    }),
    [el.transform, el.width, el.height, el.cornerRadius, el.border],
  );
  // Where the tilted picture goes, worked out from the tilt alone.
  const box = useMemo(() => tiltBoxOf(tiltCorners(look)), [look]);
  const drawRef = useRef(onDraw);
  useEffect(() => {
    drawRef.current = onDraw;
  });

  useLayoutEffect(() => {
    if (!active || !picture) return;
    // The part that shows, as the texture: an edited picture already has its crop.
    let source: TexImageSource = picture as TexImageSource;
    if (!edited && crop && picture instanceof HTMLImageElement) {
      const part = document.createElement("canvas");
      part.width = Math.max(1, Math.round(crop.width * picture.naturalWidth));
      part.height = Math.max(1, Math.round(crop.height * picture.naturalHeight));
      part.getContext("2d")?.drawImage(
        picture,
        crop.x * picture.naturalWidth,
        crop.y * picture.naturalHeight,
        part.width,
        part.height,
        0,
        0,
        part.width,
        part.height,
      );
      source = part;
    }
    renderTilt(source, look, TILT_SCALE, out);
    drawRef.current();
  }, [active, picture, edited, crop, look, out]);

  return active ? { canvas: out, box } : null;
};

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
  const cropping = useEditor((s) => s.cropId === el.id);
  const tilted = useTiltedPicture(el, picture, edited, crop, () => pictureRef.current?.getLayer()?.batchDraw());

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
        {tilted ? (
          <>
            {/* The element's own box, for selecting and handles; the tilt can spill past it. */}
            <Rect width={el.width} height={el.height} opacity={0} />
            <KImage
              ref={pictureRef}
              name="tilted-picture"
              image={tilted.canvas}
              {...tilted.box}
              visible={!cropping}
              listening={false}
              {...sp}
            />
          </>
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
            cornerRadius={Math.min(el.cornerRadius, el.width / 2, el.height / 2)}
          />
        )}
        {!tilted && el.border?.enabled && el.border.width > 0 && (
          // Inside the edge, so the image keeps its size and the border follows its corners.
          <Rect
            x={el.border.width / 2}
            y={el.border.width / 2}
            width={Math.max(0, el.width - el.border.width)}
            height={Math.max(0, el.height - el.border.width)}
            cornerRadius={Math.max(0, Math.min(el.cornerRadius, el.width / 2, el.height / 2) - el.border.width / 2)}
            stroke={el.border.color}
            strokeWidth={el.border.width}
            visible={!cropping}
            listening={false}
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
