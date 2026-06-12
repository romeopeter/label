import { useEditor } from "@/store/editor";
import type { ImageElement } from "@/types";
import {
  PanelTitle,
  PanelDesc,
  LabeledSlider,
  SwitchRow,
  Linebreak,
} from "./primitives";
import { Box } from "lucide-react";

/* --------------------------------------------------------------------------------------- */
const presets = [
  { name: "Flat", x: 0, y: 0, z: 0 },
  { name: "Gentle Left", x: 10, y: -10, z: 0 },
  { name: "Gentle Right", x: 10, y: 10, z: 0 },
  { name: "Viewer", x: 20, y: 0, z: 0 },
  { name: "Iso Left", x: 25, y: -25, z: 0 },
  { name: "Iso Right", x: 25, y: 25, z: 0 },
  { name: "Twist Left", x: 20, y: -20, z: 5 },
  { name: "Twist Right", x: 20, y: 20, z: -5 },
  { name: "Table Left", x: 50, y: 0, z: -30 },
  { name: "Table Right", x: 50, y: 0, z: 30 },
  { name: "Hard Left", x: 45, y: -20, z: -15 },
  { name: "Hard Right", x: 45, y: 20, z: 15 },
];

interface TransformData {
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  perspective: number;
  innerShadow: boolean;
}

const parseTransform = (transformStr: string): TransformData => {
  let tiltX = 0;
  let tiltY = 0;
  let tiltZ = 0;
  let perspective = 60;
  let innerShadow = true;

  if (!transformStr) {
    return { tiltX, tiltY, tiltZ, perspective, innerShadow };
  }

  // Handle rotate3d(0deg, 0deg, 0deg)
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

const serializeTransform = (data: TransformData): string => {
  return `rotateX(${data.tiltX}deg) rotateY(${data.tiltY}deg) rotateZ(${data.tiltZ}deg) perspective(${data.perspective}px) innerShadow(${data.innerShadow})`;
};

export const ThreeDPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const selectedEl = elements.find((e) => e.id === selectedIds[0]);
  const isImage = selectedEl?.type === "image";
  const imageEl = isImage ? (selectedEl as ImageElement) : null;

  const currentTransform = imageEl
    ? parseTransform(imageEl.transform || "")
    : { tiltX: 0, tiltY: 0, tiltZ: 0, perspective: 60, innerShadow: true };

  const updateTransform = (key: keyof TransformData, val: any) => {
    if (imageEl) {
      const next = { ...currentTransform, [key]: val };
      update(imageEl.id, { transform: serializeTransform(next) });
    }
  };

  const set3Drotation = (x: number, y: number, z: number) => {
    if (imageEl) {
      const next = { ...currentTransform, tiltX: x, tiltY: y, tiltZ: z };
      update(imageEl.id, { transform: serializeTransform(next) });
    }
  };

  if (!selectedEl || !isImage || !imageEl) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>
          <div className="flex items-center gap-1">
            <span>3D EFFECT</span> <Box className="h-4.5 w-4.5" />
          </div>
        </PanelTitle>
        <PanelDesc>Select an element to add 3D effect.</PanelDesc>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PanelTitle>
        <div className="flex items-center gap-1">
          <span>3D EFFECT</span> <Box className="h-4.5 w-4.5" />
        </div>
      </PanelTitle>

      <Linebreak />

      <div>
        <PanelTitle className="mb-2">Selected Image</PanelTitle>

        <img
          src={imageEl.src}
          alt=""
          className="size-10 rounded-sm contain border border-border"
        />
      </div>

      <Linebreak />

      <div className="space-y-2">
        <PanelTitle className="">Tilt</PanelTitle>
        <PanelDesc className="mb-2">Tilt and depth presets.</PanelDesc>

        <LabeledSlider
          label="TILT-X"
          value={currentTransform.tiltX}
          unit="°"
          min={-45}
          max={45}
          onChange={(v) => updateTransform("tiltX", v)}
        />
        <LabeledSlider
          label="TILT-Y"
          value={currentTransform.tiltY}
          unit="°"
          min={-45}
          max={45}
          onChange={(v) => updateTransform("tiltY", v)}
        />
        <LabeledSlider
          label="PERSPECTIVE"
          value={currentTransform.perspective}
          unit="%"
          onChange={(v) => updateTransform("perspective", v)}
        />

        <SwitchRow
          label="INNER 3D SHADOW"
          checked={currentTransform.innerShadow}
          onCheckedChange={(v) => updateTransform("innerShadow", v)}
        />
      </div>

      <Linebreak />

      <div className="space-y-2">
        <PanelTitle className="mb-2">Select preset</PanelTitle>
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => {
            const rotationStyle: React.CSSProperties = {
              transform: `rotateX(${p.x}deg) rotateY(${p.y}deg) rotateZ(${p.z}deg)`,
            };

            return (
              <button
                key={p.name}
                style={{ perspective: "100px" }}
                className="w-15.25 h-11.25 flex items-center justify-center rounded-md border border-border hover:border-secondary cursor-pointer"
                title={p.name}
                onClick={() => set3Drotation(p.x, p.y, p.z)}
              >
                <div
                  className={`w-8.5 h-6.5 border border-white bg-primary rounded-sm`}
                  style={rotationStyle}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

