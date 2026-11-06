import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  expandPicture,
  healPicture,
  hidePicture,
  type Area,
  type ExpandFill,
  type HideStyle,
  type Sides,
  type Stroke,
} from "@/lib/fix/fixes";
import { LabeledSlider } from "../primitives";
import { choiceClass } from "../choice";

export type FixTool = "heal" | "hide" | "expand";

export interface FixResult {
  picture: HTMLCanvasElement;
  /** Set when Expand grew the picture, so the element can grow with it. */
  sides?: Sides;
}

const TITLES: Record<FixTool, string> = { heal: "Heal", hide: "Hide", expand: "Expand" };

const HINTS: Record<FixTool, string> = {
  heal: "Paint over what you want gone. Layer fills it in from around it when you let go.",
  hide: "Drag over anything private. It's covered for good, in exports and in the project.",
  expand: "Choose which sides grow, and how much.",
};

const SIDE_NAMES = ["top", "right", "bottom", "left"] as const;
type SideName = (typeof SIDE_NAMES)[number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Where the pointer is, as shares of the shown picture. */
const pointOf = (event: ReactPointerEvent, element: Element | null): [number, number] => {
  const box = element?.getBoundingClientRect();
  if (!box) return [0, 0];
  return [clamp01((event.clientX - box.left) / box.width), clamp01((event.clientY - box.top) / box.height)];
};

/** Lets the browser paint "Working…" before a long, blocking step. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * Heal, Hide and Expand, over the whole window: the picture large, the tool's
 * controls along the bottom, and Cancel or Apply. Nothing changes on the canvas
 * until Apply.
 */
export const FixEditor = ({
  tool,
  picture,
  onCancel,
  onApply,
}: {
  tool: FixTool;
  picture: HTMLCanvasElement;
  onCancel: () => void;
  onApply: (result: FixResult) => void;
}) => {
  // Heal works in steps, each on the last result, so each can be undone here.
  const [healed, setHealed] = useState<HTMLCanvasElement[]>([]);
  const [brush, setBrush] = useState(30);
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [drawing, setDrawing] = useState<Area | null>(null);
  const [hideStyle, setHideStyle] = useState<HideStyle>("pixels");
  const [sides, setSides] = useState<Record<SideName, boolean>>({ top: true, right: true, bottom: true, left: true });
  const [amount, setAmount] = useState(20);
  const [fill, setFill] = useState<ExpandFill>("fill");
  const [busy, setBusy] = useState(false);
  const shownRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<[number, number] | null>(null);

  const current = healed[healed.length - 1] ?? picture;
  const brushRadius = 0.005 + (0.1 * brush) / 100;
  const expandSides: Sides = useMemo(
    () => ({
      top: sides.top ? amount / 100 : 0,
      right: sides.right ? amount / 100 : 0,
      bottom: sides.bottom ? amount / 100 : 0,
      left: sides.left ? amount / 100 : 0,
    }),
    [sides, amount],
  );
  const grows = SIDE_NAMES.some((side) => sides[side]) && amount > 0;

  // Expand's preview is worked out small, once the settings stop changing.
  const [expanded, setExpanded] = useState<HTMLCanvasElement>(picture);
  useEffect(() => {
    if (tool !== "expand") return;
    const timer = setTimeout(() => setExpanded(grows ? expandPicture(picture, expandSides, fill, 256) : picture), 120);
    return () => clearTimeout(timer);
  }, [tool, picture, expandSides, fill, grows]);

  // What the picture looks like with the tool's settings.
  const preview = useMemo(() => {
    if (tool === "heal") return current;
    if (tool === "hide") return areas.length ? hidePicture(picture, areas, hideStyle) : picture;
    return expanded;
  }, [tool, current, picture, areas, hideStyle, expanded]);

  // The shown canvas copies the preview, at a size that fits the window.
  useEffect(() => {
    const shown = shownRef.current;
    if (!shown) return;
    shown.width = preview.width;
    shown.height = preview.height;
    shown.getContext("2d")?.drawImage(preview, 0, 0);
  }, [preview]);

  const apply = async () => {
    if (busy) return;
    if (tool === "heal") return onApply({ picture: current });
    if (tool === "hide") return onApply({ picture: hidePicture(picture, areas, hideStyle) });
    setBusy(true);
    await nextFrame();
    onApply({ picture: expandPicture(picture, expandSides, fill), sides: expandSides });
  };

  const canApply = tool === "heal" ? healed.length > 0 : tool === "hide" ? areas.length > 0 : grows;

  // Keys go to the editor alone while it's open.
  const keysRef = useRef({ apply, onCancel, canApply });
  useEffect(() => {
    keysRef.current = { apply, onCancel, canApply };
  });
  // Before the first paint, so no key can slip past while it's opening.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === "Escape") keysRef.current.onCancel();
      else if (event.key === "Enter" && keysRef.current.canApply) void keysRef.current.apply();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const heal = async (done: Stroke) => {
    setBusy(true);
    await nextFrame();
    try {
      setHealed((steps) => [...steps, healPicture(steps[steps.length - 1] ?? picture, [done])]);
    } finally {
      setStroke(null);
      setBusy(false);
    }
  };

  const onDown = (event: ReactPointerEvent) => {
    if (busy || tool === "expand") return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const point = pointOf(event, shownRef.current);
    gestureRef.current = point;
    if (tool === "heal") setStroke({ points: [point], radius: brushRadius });
    else setDrawing({ x: point[0], y: point[1], width: 0, height: 0 });
  };

  const onMove = (event: ReactPointerEvent) => {
    const from = gestureRef.current;
    if (!from) return;
    const point = pointOf(event, shownRef.current);
    if (tool === "heal") {
      setStroke((now) => now && { ...now, points: [...now.points, point] });
    } else {
      setDrawing({
        x: Math.min(from[0], point[0]),
        y: Math.min(from[1], point[1]),
        width: Math.abs(point[0] - from[0]),
        height: Math.abs(point[1] - from[1]),
      });
    }
  };

  const onUp = () => {
    if (!gestureRef.current) return;
    gestureRef.current = null;
    if (tool === "heal" && stroke) void heal(stroke);
    if (tool === "hide" && drawing) {
      // A click with no drag isn't an area.
      if (drawing.width * picture.width > 3 && drawing.height * picture.height > 3) setAreas((all) => [...all, drawing]);
      setDrawing(null);
    }
  };

  const ratio = preview.width / preview.height;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[tool]}
      className="fixed inset-0 z-50 flex flex-col items-center gap-3 bg-chrome px-6 pb-5 pt-12"
    >
      <p className="text-[12px] text-text-muted">{busy ? "Working…" : HINTS[tool]}</p>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className={cn(
            "relative max-h-full max-w-full touch-none select-none overflow-hidden rounded-md border border-hairline-strong",
            tool === "expand" ? "cursor-default" : "cursor-crosshair",
          )}
          style={{ aspectRatio: String(ratio) }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <canvas
            ref={shownRef}
            role="img"
            aria-label="Your picture"
            className="block max-h-[calc(100vh-11rem)] max-w-full"
            style={{ aspectRatio: String(ratio) }}
          />
          {tool === "heal" && stroke && (
            // In the picture's own pixels, so the brush is drawn at the size it heals.
            <svg
              viewBox={`0 0 ${preview.width} ${preview.height}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full"
            >
              <polyline
                points={stroke.points.map(([x, y]) => `${x * preview.width},${y * preview.height}`).join(" ")}
                className="fill-none stroke-primary/60"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={stroke.radius * 2 * Math.min(preview.width, preview.height)}
              />
            </svg>
          )}
          {tool === "hide" &&
            [...areas, ...(drawing ? [drawing] : [])].map((area, i) => (
              <div
                key={i}
                data-area
                className="absolute border border-white"
                style={{
                  left: `${area.x * 100}%`,
                  top: `${area.y * 100}%`,
                  width: `${area.width * 100}%`,
                  height: `${area.height * 100}%`,
                }}
              >
                {i < areas.length && (
                  <button
                    type="button"
                    aria-label="Remove this area"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setAreas((all) => all.filter((_, j) => j !== i))}
                    className="absolute -right-2 -top-2 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-hairline bg-chrome text-text-muted hover:text-text"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
        {tool === "heal" && (
          <>
            <div className="w-48">
              <LabeledSlider label="BRUSH" unit="%" min={1} max={100} value={brush} onChange={setBrush} />
            </div>
            <Button
              variant="ghost"
              className="cursor-pointer"
              disabled={!healed.length || busy}
              onClick={() => setHealed((steps) => steps.slice(0, -1))}
            >
              <Undo2 className="h-3 w-3" /> Undo
            </Button>
          </>
        )}
        {tool === "hide" && (
          <ToggleGroup
            type="single"
            value={hideStyle}
            onValueChange={(value) => value && setHideStyle(value as HideStyle)}
          >
            <ToggleGroupItem value="pixels" className="cursor-pointer">Pixels</ToggleGroupItem>
            <ToggleGroupItem value="blur" className="cursor-pointer">Blur</ToggleGroupItem>
            <ToggleGroupItem value="bar" className="cursor-pointer">Bar</ToggleGroupItem>
          </ToggleGroup>
        )}
        {tool === "expand" && (
          <>
            <div className="flex gap-1">
              {SIDE_NAMES.map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={sides[side]}
                  onClick={() => setSides((all) => ({ ...all, [side]: !all[side] }))}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 text-[11px] capitalize transition-colors",
                    choiceClass(sides[side]),
                    sides[side] ? "text-text" : "text-text-muted",
                  )}
                >
                  {side}
                </button>
              ))}
            </div>
            <div className="w-44">
              <LabeledSlider label="AMOUNT" unit="%" min={5} max={50} value={amount} onChange={setAmount} />
            </div>
            <ToggleGroup type="single" value={fill} onValueChange={(value) => value && setFill(value as ExpandFill)}>
              <ToggleGroupItem value="fill" className="cursor-pointer">Fill in</ToggleGroupItem>
              <ToggleGroupItem value="mirror" className="cursor-pointer">Mirror</ToggleGroupItem>
              <ToggleGroupItem value="edges" className="cursor-pointer">Edges</ToggleGroupItem>
            </ToggleGroup>
          </>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="cursor-pointer" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" className="cursor-pointer" disabled={!canApply || busy} onClick={() => void apply()}>
            Apply
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
