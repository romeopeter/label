import { useRef } from "react";
import type Konva from "konva";
import { Image as KImage, Group, Rect, Shape } from "react-konva";
import useImage from "use-image";
import type { ImageElement, DeviceFrame } from "../../types";
import { useEditor } from "../../store/editor";

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

const drawMockup2D = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  el: ImageElement,
  w: number,
  h: number
) => {
  ctx.clearRect(0, 0, w, h);

  if (!el.deviceFrame) {
    ctx.save();
    if (el.cornerRadius > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, el.cornerRadius);
      ctx.clip();
    }
    ctx.drawImage(img, 0, 0, w, h);
    if (el.border?.enabled) {
      ctx.strokeStyle = el.border.color;
      ctx.lineWidth = el.border.width;
      ctx.strokeRect(0, 0, w, h);
    }
    ctx.restore();
  } else {
    const inset = FRAME_INSET[el.deviceFrame];
    const screenX = inset.left;
    const screenY = inset.top;
    const screenW = w - inset.left - inset.right;
    const screenH = h - inset.top - inset.bottom;

    const ratio = Math.max(screenW / img.width, screenH / img.height);
    const iw = img.width * ratio;
    const ih = img.height * ratio;
    const ix = screenX + (screenW - iw) / 2;
    const iy = screenY + (screenH - ih) / 2;

    const isBrowser = el.deviceFrame.startsWith("browser");
    const isPhone = el.deviceFrame.startsWith("iphone");
    const cornerR = isPhone ? 56 : isBrowser ? 12 : 18;

    // Frame body
    ctx.fillStyle = inset.chromeColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, cornerR);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Browser dots
    if (isBrowser) {
      ctx.fillStyle = "#FF6B5B";
      ctx.beginPath();
      ctx.arc(12 + 5, 12 + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#F8C24A";
      ctx.beginPath();
      ctx.arc(28 + 5, 12 + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#54C56A";
      ctx.beginPath();
      ctx.arc(44 + 5, 12 + 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Screen
    ctx.save();
    ctx.beginPath();
    const r = isBrowser ? 0 : 8;
    ctx.roundRect(screenX, screenY, screenW, screenH, r);
    ctx.clip();

    ctx.fillStyle = "#0F0E1A";
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    // MacBook hinge
    if (el.deviceFrame.startsWith("macbook")) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 60, h - 14, 120, 6, 3);
      ctx.fill();
    }

    // iPhone notch
    if (isPhone) {
      ctx.fillStyle = "#0F0E1A";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 50, 20, 100, 26, 13);
      ctx.fill();
    }
  }
};

const applyInner3DShadow = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tiltX: number,
  tiltY: number
) => {
  if (tiltY !== 0) {
    const gradY = ctx.createLinearGradient(0, 0, w, 0);
    if (tiltY < 0) {
      gradY.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradY.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.25, Math.abs(tiltY) / 120)})`);
    } else {
      gradY.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.25, Math.abs(tiltY) / 120)})`);
      gradY.addColorStop(1, "rgba(0, 0, 0, 0)");
    }
    ctx.fillStyle = gradY;
    ctx.fillRect(0, 0, w, h);
  }

  if (tiltX !== 0) {
    const gradX = ctx.createLinearGradient(0, 0, 0, h);
    if (tiltX > 0) {
      gradX.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.2, Math.abs(tiltX) / 150)})`);
      gradX.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      gradX.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradX.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.2, Math.abs(tiltX) / 150)})`);
    }
    ctx.fillStyle = gradX;
    ctx.fillRect(0, 0, w, h);
  }
};

const getProjectedPoint = (
  x: number,
  y: number,
  radX: number,
  radY: number,
  radZ: number,
  D: number,
  w: number,
  h: number
) => {
  const cx = x - w / 2;
  const cy = y - h / 2;
  const cz = 0;

  // Rotate X
  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);
  const x1 = cx;
  const y1 = cy * cosX - cz * sinX;
  const z1 = cy * sinX + cz * cosX;

  // Rotate Y
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);
  const x2 = x1 * cosY + z1 * sinY;
  const y2 = y1;
  const z2 = -x1 * sinY + z1 * cosY;

  // Rotate Z
  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);
  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;
  const z3 = z2;

  // Project
  const px = (x3 * D) / (D - z3);
  const py = (y3 * D) / (D - z3);

  return {
    x: px + w / 2,
    y: py + h / 2,
    z: z3,
  };
};

const drawPerspectiveImage = (
  ctx: any,
  img: HTMLCanvasElement,
  w: number,
  h: number,
  tiltX: number,
  tiltY: number,
  tiltZ: number,
  perspective: number
) => {
  const radX = (tiltX * Math.PI) / 180;
  const radY = (tiltY * Math.PI) / 180;
  const radZ = (tiltZ * Math.PI) / 180;

  const D = Math.max(150, 1500 - (perspective * 12));

  const slices = 150;
  const sliceW = w / slices;

  for (let i = 0; i < slices; i++) {
    const sx = i * sliceW;

    const top = getProjectedPoint(sx + sliceW / 2, 0, radX, radY, radZ, D, w, h);
    const bottom = getProjectedPoint(sx + sliceW / 2, h, radX, radY, radZ, D, w, h);

    const tx = top.x;
    const ty = top.y;
    const bx = bottom.x;
    const by = bottom.y;

    const dx = bx - tx;
    const dy = by - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dx, dy);

    const zAvg = (top.z + bottom.z) / 2;
    const wScale = D / (D - zAvg);
    const dw = sliceW * wScale;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-angle);

    ctx.drawImage(
      img,
      sx,
      0,
      sliceW,
      h,
      -dw / 2,
      0,
      dw + 0.5,
      dist
    );
    ctx.restore();
  }
};

const parseTransform = (transformStr: string) => {
  let tiltX = 0;
  let tiltY = 0;
  let tiltZ = 0;
  let perspective = 60;
  let innerShadow = true;

  if (!transformStr) {
    return { tiltX, tiltY, tiltZ, perspective, innerShadow };
  }

  const r3d = transformStr.match(/rotate3d\((-?\d+)deg,\s*(-?\d+)deg,\s*(-?\d+)deg\)/);
  if (r3d) {
    tiltX = parseInt(r3d[1], 10) || 0;
    tiltY = parseInt(r3d[2], 10) || 0;
    tiltZ = parseInt(r3d[3], 10) || 0;
  }

  const rx = transformStr.match(/rotateX\((-?\d+)deg\)/);
  const ry = transformStr.match(/rotateY\((-?\d+)deg\)/);
  const rz = transformStr.match(/rotateZ\((-?\d+)deg\)/);
  const pers = transformStr.match(/perspective\((-?\d+)(?:px|%)\)/);
  const shadow = transformStr.match(/innerShadow\((true|false)\)/);

  if (rx) tiltX = parseInt(rx[1], 10) || 0;
  if (ry) tiltY = parseInt(ry[1], 10) || 0;
  if (rz) tiltZ = parseInt(rz[1], 10) || 0;
  if (pers) perspective = parseInt(pers[1], 10) || 60;
  if (shadow) innerShadow = shadow[1] === "true";

  return { tiltX, tiltY, tiltZ, perspective, innerShadow };
};

export const ImageNode = ({ el, onSelect }: Props) => {
  const [img] = useImage(el.src, "anonymous");
  const update = useEditor((s) => s.updateElement);
  const sp = shadowProps(el);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!img) return null;

  const { tiltX, tiltY, tiltZ, perspective, innerShadow } = parseTransform(el.transform || "");

  // If there's 3D rotation, render using custom 3D Shape
  if (tiltX !== 0 || tiltY !== 0 || tiltZ !== 0) {
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
        <Shape
          width={el.width}
          height={el.height}
          sceneFunc={(context, shape) => {
            const ctx = context.canvas.context;
            if (!offscreenCanvasRef.current) {
              offscreenCanvasRef.current = document.createElement("canvas");
            }
            const offscreen = offscreenCanvasRef.current;
            offscreen.width = el.width;
            offscreen.height = el.height;
            const offCtx = offscreen.getContext("2d");
            if (offCtx) {
              drawMockup2D(offCtx, img, el, el.width, el.height);
              if (innerShadow) {
                applyInner3DShadow(offCtx, el.width, el.height, tiltX, tiltY);
              }
              drawPerspectiveImage(ctx, offscreen, el.width, el.height, tiltX, tiltY, tiltZ, perspective);
            }
          }}
        />
      </Group>
    );
  }

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

