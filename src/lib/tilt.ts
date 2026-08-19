export interface ImageTilt {
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  perspective: number;
  scale: number;
  innerShadow: boolean;
}

export const DEFAULT_IMAGE_TILT: ImageTilt = {
  tiltX: 0,
  tiltY: 0,
  tiltZ: 0,
  perspective: 800,
  scale: 1,
  innerShadow: true,
};

const readNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseImageTilt = (transformStr: string): ImageTilt => {
  const tilt = { ...DEFAULT_IMAGE_TILT };

  if (!transformStr) return tilt;

  const r3d = transformStr.match(
    /rotate3d\((-?\d+(?:\.\d+)?)deg,\s*(-?\d+(?:\.\d+)?)deg,\s*(-?\d+(?:\.\d+)?)deg\)/,
  );
  if (r3d) {
    tilt.tiltX = readNumber(r3d[1], tilt.tiltX);
    tilt.tiltY = readNumber(r3d[2], tilt.tiltY);
    tilt.tiltZ = readNumber(r3d[3], tilt.tiltZ);
  }

  const rx = transformStr.match(/rotateX\((-?\d+(?:\.\d+)?)deg\)/);
  const ry = transformStr.match(/rotateY\((-?\d+(?:\.\d+)?)deg\)/);
  const rz = transformStr.match(/rotateZ\((-?\d+(?:\.\d+)?)deg\)/);
  const pers = transformStr.match(/perspective\((-?\d+(?:\.\d+)?)(?:px|%)\)/);
  const scale = transformStr.match(/scale\((-?\d+(?:\.\d+)?)\)/);
  const shadow = transformStr.match(/innerShadow\((true|false)\)/);

  tilt.tiltX = readNumber(rx?.[1], tilt.tiltX);
  tilt.tiltY = readNumber(ry?.[1], tilt.tiltY);
  tilt.tiltZ = readNumber(rz?.[1], tilt.tiltZ);
  tilt.perspective = readNumber(pers?.[1], tilt.perspective);
  tilt.scale = readNumber(scale?.[1], tilt.scale);
  if (shadow) tilt.innerShadow = shadow[1] === "true";

  return tilt;
};

export const serializeImageTilt = (tilt: ImageTilt) =>
  `rotateX(${tilt.tiltX}deg) rotateY(${tilt.tiltY}deg) rotateZ(${tilt.tiltZ}deg) perspective(${tilt.perspective}px) scale(${tilt.scale}) innerShadow(${tilt.innerShadow})`;

export const isImageTiltActive = (transformStr: string) => {
  const tilt = parseImageTilt(transformStr);
  return (
    tilt.tiltX !== 0 ||
    tilt.tiltY !== 0 ||
    tilt.tiltZ !== 0 ||
    tilt.scale !== 1
  );
};
