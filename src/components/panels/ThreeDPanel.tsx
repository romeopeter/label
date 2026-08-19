import { useEditor } from "@/store/editor";
import type { ImageElement } from "@/types";
import {
  DEFAULT_IMAGE_TILT,
  parseImageTilt,
  serializeImageTilt,
  type ImageTilt,
} from "@/lib/tilt";
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

type TransformValue = ImageTilt[keyof ImageTilt];

export const ThreeDPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const selectedEl = elements.find((e) => e.id === selectedIds[0]);
  const isImage = selectedEl?.type === "image";
  const imageEl = isImage ? (selectedEl as ImageElement) : null;

  const currentTransform = imageEl
    ? parseImageTilt(imageEl.transform || "")
    : DEFAULT_IMAGE_TILT;

  const updateTransform = (key: keyof ImageTilt, val: TransformValue) => {
    if (imageEl) {
      const next = { ...currentTransform, [key]: val };
      update(imageEl.id, { transform: serializeImageTilt(next) });
    }
  };

  const set3Drotation = (x: number, y: number, z: number) => {
    if (imageEl) {
      const next = { ...currentTransform, tiltX: x, tiltY: y, tiltZ: z };
      update(imageEl.id, { transform: serializeImageTilt(next) });
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
          label="VERTICAL TILT"
          value={currentTransform.tiltX}
          unit="°"
          min={-45}
          max={45}
          onChange={(v) => updateTransform("tiltX", v)}
        />
        <LabeledSlider
          label="HORIZONTAL TILT"
          value={currentTransform.tiltY}
          unit="°"
          min={-45}
          max={45}
          onChange={(v) => updateTransform("tiltY", v)}
        />
        <LabeledSlider
          label="PERSPECTIVE"
          value={currentTransform.perspective}
          unit="px"
          min={400}
          max={1200}
          step={10}
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
