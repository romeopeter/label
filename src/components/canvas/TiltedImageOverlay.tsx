import { forwardRef } from "react";
import type { ImageElement } from "@/types";
import { parseImageTilt } from "@/lib/tilt";

interface Props {
  image: ImageElement;
  scale: number;
}

export const TiltedImageOverlay = forwardRef<HTMLDivElement, Props>(
  ({ image, scale }, ref) => {
    const tilt = parseImageTilt(image.transform);
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
          <img
            src={image.src}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "fill",
              borderRadius: image.cornerRadius * scale,
              boxShadow: shadow,
              transform: `rotateX(${tilt.tiltX}deg) rotateY(${tilt.tiltY}deg) rotateZ(${tilt.tiltZ}deg) scale(${tilt.scale})`,
              transformStyle: "preserve-3d",
              transition: "transform 0.05s ease-out",
            }}
          />
        </div>
      </div>
    );
  },
);

TiltedImageOverlay.displayName = "TiltedImageOverlay";
