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
import type { ImageElement } from "@/types";

/** Konva name the exporter hides before capture. */
export const CROP_LAYER_NAME = "crop-overlay";

export interface CropOverlayHandle {
  apply: () => void;
  reset: () => void;
}

const MIN_CROP_SIZE = 20;
const WHOLE_IMAGE_SLOP = 0.5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Crop mode: the whole original shows dimmed, with a movable, resizable window
 * onto it. Crops are stored as fractions of the original and never change the
 * pixels, so cropping again can always reach back out to the full image.
 */
export const CropOverlay = forwardRef<
  CropOverlayHandle,
  { el: ImageElement; scale: number }
>(({ el, scale }, ref) => {
  const [img] = useImage(el.src, "anonymous");
  const update = useEditor((s) => s.updateElement);
  const setCropId = useEditor((s) => s.setCropId);
  const rectRef = useRef<Konva.Rect>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const crop = el.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const fullWidth = el.width / crop.width;
  const fullHeight = el.height / crop.height;
  const [box, setBox] = useState({
    x: crop.x * fullWidth,
    y: crop.y * fullHeight,
    width: el.width,
    height: el.height,
  });

  // The group sits where the uncropped image's corner would be, so everything
  // inside can work in the original's coordinates, whatever the rotation.
  const angle = (el.rotation * Math.PI) / 180;
  const toWorld = (x: number, y: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  const offset = toWorld(crop.x * fullWidth, crop.y * fullHeight);
  const originX = el.x - offset.x;
  const originY = el.y - offset.y;

  useEffect(() => {
    if (!img || !rectRef.current || !transformerRef.current) return;
    transformerRef.current.nodes([rectRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [img]);

  useImperativeHandle(
    ref,
    () => ({
      apply: () => {
        const corner = toWorld(box.x, box.y);
        // Handle maths leaves float noise, so "the whole image" allows for it.
        const isWhole =
          fullWidth - box.width < WHOLE_IMAGE_SLOP &&
          fullHeight - box.height < WHOLE_IMAGE_SLOP;
        update(el.id, {
          x: originX + corner.x,
          y: originY + corner.y,
          width: box.width,
          height: box.height,
          crop: isWhole
            ? undefined
            : {
                x: box.x / fullWidth,
                y: box.y / fullHeight,
                width: box.width / fullWidth,
                height: box.height / fullHeight,
              },
        });
        setCropId(null);
      },
      reset: () => {
        setBox({ x: 0, y: 0, width: fullWidth, height: fullHeight });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt as the box moves
    [box, el, fullWidth, fullHeight],
  );

  if (!img) return null;

  const imageScaleX = img.naturalWidth / fullWidth;
  const imageScaleY = img.naturalHeight / fullHeight;

  return (
    <Layer name={CROP_LAYER_NAME}>
      <Group x={originX} y={originY} rotation={el.rotation}>
        <KImage
          image={img}
          width={fullWidth}
          height={fullHeight}
          opacity={0.3}
          listening={false}
        />
        <KImage
          image={img}
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
        keepRatio={false}
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

CropOverlay.displayName = "CropOverlay";
