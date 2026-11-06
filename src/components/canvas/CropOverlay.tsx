import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type Konva from "konva";
import { Group, Image as KImage, Layer, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import { useEditor } from "@/store/editor";
import {
  FRAME_DEFAULTS,
  frameShape,
  frameShapeOf,
  largestIn,
  pictureRatioOf,
  pictureView,
  screenBoxOf,
  screenRatioOf,
  sourceOf,
  wrapsPicture,
} from "@/lib/mockups";
import type { ImageElement } from "@/types";
import { useEditedImage } from "./useEditedImage";

/** Konva name the exporter hides before capture. */
export const CROP_LAYER_NAME = "crop-overlay";

export interface CropOverlayHandle {
  apply: () => void;
  reset: () => void;
}

const MIN_CROP_SIZE = 20;
const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [
  ...CORNER_ANCHORS,
  "top-center",
  "middle-left",
  "middle-right",
  "bottom-center",
];
const WHOLE_IMAGE_SLOP = 0.5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Crop mode: the whole original shows dimmed, with a movable, resizable window
 * onto it. Crops are stored as fractions of the original and never change the
 * pixels, so cropping again can always reach back out to the full image.
 *
 * A tilted image crops flat, and is tilted again afterwards. A framed image's
 * frame keeps its size, and so does an image in a layout, whose slot decides its
 * box. Those show the original fitted inside that box, and applying changes only
 * what the picture shows.
 *
 * A device showing its picture in fill keeps the window to the screen's shape, so
 * what's chosen here is exactly what the screen shows. A window takes any crop,
 * and changes height to wrap it. Zoom and moving are a finer version of the same thing,
 * so the window opens on what the screen shows, and applying it starts them over.
 */
const CropWindow = forwardRef<
  CropOverlayHandle,
  { el: ImageElement; img: HTMLImageElement; scale: number }
>(({ el, img, scale }, ref) => {
  const update = useEditor((s) => s.updateElement);
  const setCropId = useEditor((s) => s.setCropId);
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  // Edited but not cropped: this window is what reaches back out to the whole image.
  const { picture } = useEditedImage(img, el.edit, undefined, () =>
    layerRef.current?.batchDraw(),
  );

  const inLayout = useEditor((s) => !!s.layout?.slots.some((slot) => slot.id === el.id));
  const keepsBox = !!el.deviceFrame || inLayout;
  const crop = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const frameFit = Math.min(el.width / img.naturalWidth, el.height / img.naturalHeight);
  const fullWidth = keepsBox ? img.naturalWidth * frameFit : el.width / crop.width;
  const fullHeight = keepsBox ? img.naturalHeight * frameFit : el.height / crop.height;
  const frame = el.deviceFrame;
  const lockedRatio =
    frame && !wrapsPicture(frame) && frame.fit === "fill" ? screenRatioOf(el) : null;
  const whole = { x: 0, y: 0, width: fullWidth, height: fullHeight };
  const [box, setBox] = useState(() => {
    const moved = !!frame && (frame.zoom !== 1 || frame.panX !== 0 || frame.panY !== 0);
    const trims = !!frame && (wrapsPicture(frame) || frame.fit !== "fit");
    const shape = moved && trims ? frameShapeOf(el) : null;
    // What the screen shows now, as a share of the original.
    const seen = shape && frame
      ? (() => {
          const { shown } = pictureView(
            sourceOf(el.crop, img.naturalWidth, img.naturalHeight),
            screenBoxOf(el, shape),
            frame,
          );
          return {
            x: shown.x / img.naturalWidth,
            y: shown.y / img.naturalHeight,
            width: shown.width / img.naturalWidth,
            height: shown.height / img.naturalHeight,
          };
        })()
      : crop;
    const current = {
      x: seen.x * fullWidth,
      y: seen.y * fullHeight,
      width: seen.width * fullWidth,
      height: seen.height * fullHeight,
    };
    return lockedRatio ? largestIn(current, lockedRatio) : current;
  });

  // The group sits where the uncropped image's corner would be, so everything
  // inside can work in the original's coordinates, whatever the rotation.
  const angle = (el.rotation * Math.PI) / 180;
  const toWorld = (x: number, y: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  const offset = keepsBox
    ? toWorld((fullWidth - el.width) / 2, (fullHeight - el.height) / 2)
    : toWorld(crop.x * fullWidth, crop.y * fullHeight);
  const originX = el.x - offset.x;
  const originY = el.y - offset.y;

  useEffect(() => {
    if (!rectRef.current || !transformerRef.current) return;
    transformerRef.current.nodes([rectRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      apply: () => {
        const corner = toWorld(box.x, box.y);
        // Handle maths leaves float noise, so "the whole image" allows for it.
        const largest = lockedRatio ? largestIn(whole, lockedRatio) : whole;
        const isWhole =
          Math.abs(box.x - largest.x) < WHOLE_IMAGE_SLOP &&
          Math.abs(box.y - largest.y) < WHOLE_IMAGE_SLOP &&
          largest.width - box.width < WHOLE_IMAGE_SLOP &&
          largest.height - box.height < WHOLE_IMAGE_SLOP;
        const nextCrop = isWhole
          ? undefined
          : {
              x: box.x / fullWidth,
              y: box.y / fullHeight,
              width: box.width / fullWidth,
              height: box.height / fullHeight,
            };
        update(
          el.id,
          keepsBox
            ? {
                crop: nextCrop,
                ...(frame
                  ? {
                      deviceFrame: {
                        ...frame,
                        zoom: FRAME_DEFAULTS.zoom,
                        panX: FRAME_DEFAULTS.panX,
                        panY: FRAME_DEFAULTS.panY,
                      },
                    }
                  : {}),
                ...(frame && wrapsPicture(frame) && !inLayout
                  ? {
                      height:
                        el.width /
                        frameShape(frame, pictureRatioOf({ ...el, crop: nextCrop })).ratio,
                    }
                  : {}),
              }
            : {
                x: originX + corner.x,
                y: originY + corner.y,
                width: box.width,
                height: box.height,
                crop: nextCrop,
              },
        );
        setCropId(null);
      },
      reset: () => {
        setBox(lockedRatio ? largestIn(whole, lockedRatio) : whole);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt as the box moves
    [box, el, fullWidth, fullHeight],
  );

  if (!picture) return null;

  // An edited picture can be smaller than the original, over the renderer's size limit.
  const pictureWidth = picture === img ? img.naturalWidth : picture.width;
  const pictureHeight = picture === img ? img.naturalHeight : picture.height;
  const imageScaleX = pictureWidth / fullWidth;
  const imageScaleY = pictureHeight / fullHeight;

  return (
    <Layer ref={layerRef} name={CROP_LAYER_NAME}>
      <Group x={originX} y={originY} rotation={el.rotation}>
        <KImage
          image={picture}
          width={fullWidth}
          height={fullHeight}
          opacity={0.3}
          listening={false}
        />
        <KImage
          image={picture}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          crop={{
            x: box.x * imageScaleX,
            y: box.y * imageScaleY,
            width: box.width * imageScaleX,
            height: box.height * imageScaleY,
          }}
          listening={false}
        />
        <Rect
          ref={rectRef}
          name="crop-window"
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="transparent"
          draggable
          onDragMove={(event) => {
            const node = event.target;
            const x = clamp(node.x(), 0, fullWidth - box.width);
            const y = clamp(node.y(), 0, fullHeight - box.height);
            node.position({ x, y });
            setBox((current) => ({ ...current, x, y }));
          }}
          onTransform={(event) => {
            const node = event.target;
            if (lockedRatio) {
              const anchor = transformerRef.current?.getActiveAnchor() ?? "";
              const fromLeft = anchor.endsWith("left");
              const fromTop = anchor.startsWith("top");
              const right = box.x + box.width;
              const bottom = box.y + box.height;
              const roomX = fromLeft ? right : fullWidth - box.x;
              const roomY = fromTop ? bottom : fullHeight - box.y;
              const width = clamp(
                box.width * node.scaleX(),
                Math.min(MIN_CROP_SIZE, roomX),
                Math.min(roomX, roomY * lockedRatio),
              );
              const height = width / lockedRatio;
              const x = fromLeft ? right - width : box.x;
              const y = fromTop ? bottom - height : box.y;
              node.scaleX(1);
              node.scaleY(1);
              node.position({ x, y });
              setBox({ x, y, width, height });
              return;
            }
            const right = node.x() + box.width * node.scaleX();
            const bottom = node.y() + box.height * node.scaleY();
            const x = clamp(node.x(), 0, fullWidth - MIN_CROP_SIZE);
            const y = clamp(node.y(), 0, fullHeight - MIN_CROP_SIZE);
            const width = clamp(right, x + MIN_CROP_SIZE, fullWidth) - x;
            const height = clamp(bottom, y + MIN_CROP_SIZE, fullHeight) - y;
            node.scaleX(1);
            node.scaleY(1);
            node.position({ x, y });
            setBox({ x, y, width, height });
          }}
        />
      </Group>
      <Transformer
        ref={transformerRef}
        rotateEnabled={false}
        keepRatio={!!lockedRatio}
        enabledAnchors={lockedRatio ? CORNER_ANCHORS : ALL_ANCHORS}
        flipEnabled={false}
        borderStroke="#FFFFFF"
        borderStrokeWidth={1.5}
        anchorFill="#FFFFFF"
        anchorStroke="#534AB7"
        anchorSize={10}
        anchorStrokeWidth={1.5 / Math.max(scale, 1)}
      />
    </Layer>
  );
});

CropWindow.displayName = "CropWindow";

export const CropOverlay = forwardRef<
  CropOverlayHandle,
  { el: ImageElement; scale: number }
>(({ el, scale }, ref) => {
  const [img] = useImage(el.src, "anonymous");
  // Its starting box comes from the picture's size, so it waits for the picture.
  return img ? <CropWindow ref={ref} el={el} img={img} scale={scale} /> : null;
});

CropOverlay.displayName = "CropOverlay";
