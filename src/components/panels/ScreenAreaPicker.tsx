import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** An area of the screenshot, as shares of its width and height. */
interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };

type Gesture =
  | { kind: "draw"; from: [number, number] }
  | { kind: "move"; from: [number, number]; area: Area }
  | { kind: "resize"; edges: Edges; area: Area };

/** Smaller than this, in screenshot pixels, and a drag was only a click. */
const MIN_SIDE = 4;

const HANDLES: { name: string; edges: Edges; className: string }[] = [
  { name: "top-left", edges: { top: true, left: true }, className: "left-0 top-0 cursor-nwse-resize" },
  { name: "top", edges: { top: true }, className: "left-1/2 top-0 cursor-ns-resize" },
  { name: "top-right", edges: { top: true, right: true }, className: "left-full top-0 cursor-nesw-resize" },
  { name: "right", edges: { right: true }, className: "left-full top-1/2 cursor-ew-resize" },
  { name: "bottom-right", edges: { bottom: true, right: true }, className: "left-full top-full cursor-nwse-resize" },
  { name: "bottom", edges: { bottom: true }, className: "left-1/2 top-full cursor-ns-resize" },
  { name: "bottom-left", edges: { bottom: true, left: true }, className: "left-0 top-full cursor-nesw-resize" },
  { name: "left", edges: { left: true }, className: "left-0 top-1/2 cursor-ew-resize" },
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const areaBetween = ([ax, ay]: [number, number], [bx, by]: [number, number]): Area => ({
  x: Math.min(ax, bx),
  y: Math.min(ay, by),
  w: Math.abs(bx - ax),
  h: Math.abs(by - ay),
});

/** The part of the picture to keep, cut out at its own resolution. */
const cropTo = async (picture: HTMLImageElement, area: Area | null): Promise<Blob> => {
  const { naturalWidth: width, naturalHeight: height } = picture;
  const sx = Math.round((area?.x ?? 0) * width);
  const sy = Math.round((area?.y ?? 0) * height);
  const sw = Math.max(1, Math.round((area?.w ?? 1) * width));
  const sh = Math.max(1, Math.round((area?.h ?? 1) * height));
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d")?.drawImage(picture, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Layer couldn't keep that area.");
  return blob;
};

/**
 * Shows a screenshot over the whole window to choose the part to keep. Drag to
 * choose an area, then move it or pull its sides and corners. Capture keeps it,
 * or the whole screenshot if no area was chosen.
 */
export const ScreenAreaPicker = ({
  image,
  onCancel,
  onCapture,
}: {
  image: Blob;
  onCancel: () => void;
  onCapture: (image: Blob) => void;
}) => {
  const [url] = useState(() => URL.createObjectURL(image));
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const pictureRef = useRef<HTMLImageElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const captureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const doneRef = useRef(false);
  const capture = async () => {
    const picture = pictureRef.current;
    // Space on the focused Capture button would otherwise capture twice.
    if (!picture || !size || doneRef.current) return;
    doneRef.current = true;
    onCapture(await cropTo(picture, area));
  };

  // Keys go to the picker alone while it's open, or Space, Delete and the rest
  // would also reach the editor underneath.
  const keysRef = useRef({ capture, onCancel });
  useEffect(() => {
    keysRef.current = { capture, onCancel };
  });
  // Before the first paint, so no key can slip past while it's opening.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Nothing reaches the editor; Tab still moves between the buttons.
      event.stopImmediatePropagation();
      if (event.key === "Escape") keysRef.current.onCancel();
      else if (event.key === " " || event.key === "Enter") void keysRef.current.capture();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => captureRef.current?.focus(), []);

  /** Where the pointer is, as shares of the picture. */
  const pointOf = (event: ReactPointerEvent): [number, number] => {
    const box = pictureRef.current?.getBoundingClientRect();
    if (!box) return [0, 0];
    return [clamp01((event.clientX - box.left) / box.width), clamp01((event.clientY - box.top) / box.height)];
  };

  const begin = (event: ReactPointerEvent, gesture: Gesture) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    gestureRef.current = gesture;
  };

  const onMove = (event: ReactPointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const point = pointOf(event);
    if (gesture.kind === "draw") {
      setArea(areaBetween(gesture.from, point));
    } else if (gesture.kind === "move") {
      const { area: from } = gesture;
      setArea({
        ...from,
        x: Math.min(1 - from.w, Math.max(0, from.x + point[0] - gesture.from[0])),
        y: Math.min(1 - from.h, Math.max(0, from.y + point[1] - gesture.from[1])),
      });
    } else {
      const { area: from, edges } = gesture;
      const left = edges.left ? point[0] : from.x;
      const right = edges.right ? point[0] : from.x + from.w;
      const top = edges.top ? point[1] : from.y;
      const bottom = edges.bottom ? point[1] : from.y + from.h;
      // Pulled past the other side, it turns inside out rather than stopping.
      setArea(areaBetween([left, top], [right, bottom]));
    }
  };

  const onEnd = () => {
    gestureRef.current = null;
    setArea((now) =>
      now && size && (now.w * size.width < MIN_SIDE || now.h * size.height < MIN_SIDE) ? null : now,
    );
  };

  const pixels = area && size && {
    width: Math.round(area.w * size.width),
    height: Math.round(area.h * size.height),
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose an area"
      className="fixed inset-0 z-50 flex flex-col items-center gap-3 bg-chrome px-6 pb-5 pt-12"
    >
      <p className="text-[12px] text-text-muted">
        {area
          ? "Drag the box or its edges to adjust it."
          : "Drag over the area you want, or capture the whole screen."}
      </p>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative max-h-full max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md border border-hairline-strong"
          onPointerDown={(event) => {
            const point = pointOf(event);
            begin(event, { kind: "draw", from: point });
            setArea({ x: point[0], y: point[1], w: 0, h: 0 });
          }}
          onPointerMove={onMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
        >
          <img
            ref={pictureRef}
            src={url}
            alt="Your screen"
            draggable={false}
            onLoad={(event) =>
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
            className="block max-h-[calc(100vh-9rem)] max-w-full object-contain"
          />
          {area && (
            <div
              data-area
              className="screen-area-dim absolute cursor-move border border-white"
              style={{
                left: `${area.x * 100}%`,
                top: `${area.y * 100}%`,
                width: `${area.w * 100}%`,
                height: `${area.h * 100}%`,
              }}
              onPointerDown={(event) => begin(event, { kind: "move", from: pointOf(event), area })}
              onPointerMove={onMove}
              onPointerUp={onEnd}
              onPointerCancel={onEnd}
            >
              {pixels && (
                <span
                  className={cn(
                    "absolute left-0 whitespace-nowrap rounded-sm bg-chrome/80 px-1.5 py-0.5 font-mono text-[10px] text-text",
                    // Inside the box at the top edge, where above it would be cut off.
                    area.y < 0.05 ? "left-1 top-1" : "-top-6",
                  )}
                >
                  {pixels.width} × {pixels.height}
                </span>
              )}
              {HANDLES.map((handle) => (
                <span
                  key={handle.name}
                  data-handle={handle.name}
                  className={cn(
                    "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-secondary bg-white",
                    handle.className,
                  )}
                  onPointerDown={(event) => begin(event, { kind: "resize", edges: handle.edges, area })}
                  onPointerMove={onMove}
                  onPointerUp={onEnd}
                  onPointerCancel={onEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" className="cursor-pointer" onClick={onCancel}>
          Cancel
        </Button>
        <Button ref={captureRef} variant="primary" className="cursor-pointer" disabled={!size} onClick={capture}>
          Capture
        </Button>
        <span className="text-[11px] text-text-faint">Space captures · Esc cancels</span>
      </div>
    </div>,
    document.body,
  );
};
