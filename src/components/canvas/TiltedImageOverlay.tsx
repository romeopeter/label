import { forwardRef, useEffect, useMemo, useRef } from "react";
import useImage from "use-image";
import type { ImageElement } from "@/types";
import { visibleCrop } from "@/lib/layouts";
import { parseImageTilt } from "@/lib/tilt";
import { useEditedImage } from "./useEditedImage";

interface Props {
  image: ImageElement;
  scale: number;
}

export const TiltedImageOverlay = forwardRef<HTMLDivElement, Props>(
  ({ image, scale }, ref) => {
    const tilt = parseImageTilt(image.transform);
    const [original] = useImage(image.src, "anonymous");
    const visible = useMemo(() => visibleCrop(image), [image.crop, image.layoutCrop]); // eslint-disable-line react-hooks/exhaustive-deps -- only these two feed it
    const { picture, edited } = useEditedImage(original, image.edit, visible);
    const editedHost = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const host = editedHost.current;
      if (!host || !edited || !(picture instanceof HTMLCanvasElement)) return;
      picture.style.cssText = "display:block;width:100%;height:100%";
      host.replaceChildren(picture);
    }, [edited, picture]);

    const crop = visible ?? { x: 0, y: 0, width: 1, height: 1 };
    const shadow = image.shadow?.enabled
      ? `${image.shadow.offsetX * scale}px ${image.shadow.offsetY * scale}px ${
          image.shadow.blur * scale
        }px ${image.shadow.color}`
      : undefined;

    return (
      <div
        className="pointer-events-none absolute left-0 top-0 z-20"
        style={{
          width: image.width * scale,
          height: image.height * scale,
          transform: `translate(${image.x * scale}px, ${image.y * scale}px) rotate(${image.rotation}deg)`,
          transformOrigin: "0 0",
        }}
      >
        <div
          ref={ref}
          data-tilted-image-id={image.id}
          style={{
            width: "100%",
            height: "100%",
            perspective: `${tilt.perspective}px`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              borderRadius: image.cornerRadius * scale,
              boxShadow: shadow,
              transform: `rotateX(${tilt.tiltX}deg) rotateY(${tilt.tiltY}deg) rotateZ(${tilt.tiltZ}deg) scale(${tilt.scale})`,
              transformStyle: "preserve-3d",
              transition: "transform 0.05s ease-out",
            }}
          >
            {edited && (
              <div ref={editedHost} className="absolute inset-0" />
            )}
            <img
              hidden={edited}
              src={image.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: `${(-crop.x / crop.width) * 100}%`,
                top: `${(-crop.y / crop.height) * 100}%`,
                width: `${100 / crop.width}%`,
                height: `${100 / crop.height}%`,
                maxWidth: "none",
                display: "block",
                objectFit: "fill",
              }}
            />
          </div>
        </div>
      </div>
    );
  },
);

TiltedImageOverlay.displayName = "TiltedImageOverlay";
