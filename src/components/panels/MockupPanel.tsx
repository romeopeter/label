import { useState } from "react";
import { Crop, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  browserLookOf,
  canvasShareOf,
  centredOn,
  DEVICES,
  frameThumbUrl,
  hasArtwork,
  isScreenFrame,
  kindOfDevice,
  MOCKUP_KINDS,
  newFrame,
  pictureRatioOf,
  resizedTo,
  rotatedTo,
  ROUNDNESS_MAX,
  THICKNESS_MAX,
  wrapsPicture,
  ZOOM_MAX,
} from "@/lib/mockups";
import type { DeviceDef } from "@/lib/mockups";
import { cn } from "@/lib/utils";
import { useEditor } from "@/store/editor";
import type { DeviceFrame, ImageElement } from "@/types";
import { BrowserThumb, ScreenThumb } from "./MockupThumbs";
import { ColorRow, LabeledSlider, PanelDesc, PanelHelp, PanelTitle, SectionLabel } from "./primitives";
import { choiceClass } from "./choice";

const cellClass = (active: boolean, disabled: boolean) =>
  cn(
    "flex flex-col items-center gap-1 rounded-md border bg-chrome/50 p-1.5 text-center text-[9.5px] leading-tight transition-colors",
    disabled ? "border-hairline opacity-50" : choiceClass(active),
    active ? "text-text" : "text-text-muted",
    !disabled && "hover:text-text",
  );

const THUMB_CLASS =
  "flex aspect-[1.4] w-full items-center justify-center overflow-hidden rounded-sm border border-hairline-strong bg-p-200/30 p-1";

const SHADOWS = {
  none: null,
  // What a new image starts with.
  soft: { color: "rgba(0,0,0,0.45)", blur: 60, offsetX: 0, offsetY: 30 },
  deep: { color: "rgba(0,0,0,0.6)", blur: 110, offsetX: 0, offsetY: 56 },
};
type ShadowName = keyof typeof SHADOWS;

const shadowNameOf = (el: ImageElement): ShadowName | "" => {
  if (!el.shadow?.enabled) return "none";
  if (el.shadow.blur === SHADOWS.soft.blur && el.shadow.offsetY === SHADOWS.soft.offsetY) return "soft";
  if (el.shadow.blur === SHADOWS.deep.blur && el.shadow.offsetY === SHADOWS.deep.offsetY) return "deep";
  return "";
};

const percent = (share: number) => Math.round(share * 100);

const PictureControls = ({
  image,
  frame,
  change,
}: {
  image: ImageElement;
  frame: DeviceFrame;
  change: (patch: Partial<DeviceFrame>) => void;
}) => {
  const setCropId = useEditor((s) => s.setCropId);
  const moved = frame.zoom !== 1 || frame.panX !== 0 || frame.panY !== 0;
  return (
    <>
      <SectionLabel>PICTURE</SectionLabel>
      {!wrapsPicture(frame) && (
        <>
          <ToggleGroup
            type="single"
            value={frame.fit}
            onValueChange={(value) => value && change({ fit: value as DeviceFrame["fit"] })}
          >
            <ToggleGroupItem value="fill">Fill</ToggleGroupItem>
            <ToggleGroupItem value="fit">Fit</ToggleGroupItem>
          </ToggleGroup>
          <PanelHelp>
            {frame.fit === "fill"
              ? "Covers the whole screen, trimming what doesn't fit."
              : "Shows the whole picture, with bars if its shape differs."}
          </PanelHelp>
          {frame.fit === "fit" && (
            <ColorRow label="BARS" value={frame.barColor} onChange={(barColor) => change({ barColor })} />
          )}
        </>
      )}
      <LabeledSlider
        label="ZOOM"
        unit="%"
        min={100}
        max={ZOOM_MAX * 100}
        value={percent(frame.zoom)}
        onChange={(value) => change({ zoom: value / 100 })}
      />
      <LabeledSlider
        label="LEFT / RIGHT"
        min={-100}
        max={100}
        value={percent(frame.panX)}
        onChange={(value) => change({ panX: value / 100 })}
      />
      <LabeledSlider
        label="UP / DOWN"
        min={-100}
        max={100}
        value={percent(frame.panY)}
        onChange={(value) => change({ panY: value / 100 })}
      />
      <PanelHelp>Or hold Alt and drag the mockup to move its picture.</PanelHelp>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="ghost" size="block" onClick={() => setCropId(image.id)}>
          <Crop className="h-3 w-3" /> Crop
        </Button>
        <Button
          variant="ghost"
          size="block"
          disabled={!moved}
          onClick={() => change({ zoom: 1, panX: 0, panY: 0 })}
        >
          Reset picture
        </Button>
      </div>
    </>
  );
};

const MockupControls = ({ image }: { image: ImageElement }) => {
  const canvas = useEditor((s) => s.canvas);
  const update = useEditor((s) => s.updateElement);
  const inLayout = useEditor((s) => !!s.layout?.slots.some((slot) => slot.id === image.id));
  const share = canvasShareOf(image, canvas);

  const chooseShadow = (name: ShadowName) => {
    const preset = SHADOWS[name];
    update(image.id, {
      shadow: preset
        ? { enabled: true, ...preset }
        : image.shadow && { ...image.shadow, enabled: false },
    });
  };

  return (
    <>
      <SectionLabel>MOCKUP</SectionLabel>
      {inLayout ? (
        <PanelDesc>Its size and place come from its layout.</PanelDesc>
      ) : (
        <>
          <LabeledSlider
            label="SIZE"
            unit="%"
            min={10}
            max={200}
            value={Math.min(200, Math.max(10, percent(share)))}
            onChange={(value) => update(image.id, resizedTo(image, value / 100, canvas))}
          />
          <LabeledSlider
            label="ROTATION"
            unit="°"
            min={-180}
            max={180}
            value={Math.round(image.rotation)}
            onChange={(value) => update(image.id, rotatedTo(image, value))}
          />
          <Button variant="ghost" size="block" onClick={() => update(image.id, centredOn(image, canvas))}>
            <Crosshair className="h-3 w-3" /> Center on canvas
          </Button>
        </>
      )}
      <SectionLabel>SHADOW</SectionLabel>
      <ToggleGroup
        type="single"
        value={shadowNameOf(image)}
        onValueChange={(value) => value && chooseShadow(value as ShadowName)}
      >
        <ToggleGroupItem value="none">None</ToggleGroupItem>
        <ToggleGroupItem value="soft">Soft</ToggleGroupItem>
        <ToggleGroupItem value="deep">Deep</ToggleGroupItem>
      </ToggleGroup>
    </>
  );
};

const Gallery = ({ image, frame }: { image?: ImageElement; frame: DeviceFrame | null }) => {
  const setDeviceFrame = useEditor((s) => s.setDeviceFrame);
  const current = frame ? DEVICES.find((candidate) => candidate.id === frame.device) : undefined;
  const [kindId, setKindId] = useState(() => kindOfDevice(current?.group));
  const kind = MOCKUP_KINDS.find((candidate) => candidate.id === kindId) ?? MOCKUP_KINDS[0];
  const showGroups = kind.groups.length > 1;

  const choose = (next: DeviceDef) => {
    if (image) setDeviceFrame(image.id, newFrame(next, pictureRatioOf(image), frame));
  };

  const finishOf = (candidate: DeviceDef) =>
    frame?.device === candidate.id ? frame.finish : candidate.finishes[0].id;

  return (
    <>
      <ToggleGroup
        type="single"
        value={kind.id}
        onValueChange={(value) => value && setKindId(value)}
        className="w-full"
      >
        {MOCKUP_KINDS.map((candidate) => (
          <ToggleGroupItem key={candidate.id} value={candidate.id}>
            {candidate.id}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto overscroll-contain rounded-md border border-hairline bg-chrome/30 p-1.5">
        {kind.groups.map((group, index) => (
          <div key={group} className="flex flex-col gap-1">
            {showGroups && <SectionLabel>{group}</SectionLabel>}
            <div className="grid grid-cols-3 gap-1.5">
              {index === 0 && (
                <button
                  type="button"
                  disabled={!image}
                  aria-pressed={!frame}
                  onClick={() => image && setDeviceFrame(image.id, null)}
                  className={cellClass(!!image && !frame, !image)}
                >
                  <div className={THUMB_CLASS} />
                  <span>None</span>
                </button>
              )}
              {DEVICES.filter((candidate) => candidate.group === group).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={!image}
                  aria-pressed={frame?.device === candidate.id}
                  onClick={() => choose(candidate)}
                  className={cellClass(frame?.device === candidate.id, !image)}
                >
                  <div className={THUMB_CLASS}>
                    {candidate.width ? (
                      <img
                        src={frameThumbUrl(candidate.id, finishOf(candidate))}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : candidate.group === "Screens" ? (
                      <ScreenThumb id={candidate.id} />
                    ) : (
                      <BrowserThumb id={candidate.id} />
                    )}
                  </div>
                  <span>{candidate.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export const MockupPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const setDeviceFrame = useEditor((s) => s.setDeviceFrame);

  const image = elements.find((e) => e.id === selectedIds[0] && e.type === "image") as
    | ImageElement
    | undefined;
  const frame = image?.deviceFrame ?? null;
  const device = frame ? DEVICES.find((candidate) => candidate.id === frame.device) : undefined;

  const change = (patch: Partial<DeviceFrame>) => {
    if (image && frame) setDeviceFrame(image.id, { ...frame, ...patch });
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>MOCKUP</PanelTitle>
      {!image && <PanelDesc>Select an image to put it in a mockup.</PanelDesc>}

      {/* A new image starts on the tab its own mockup is in. */}
      <Gallery key={image?.id ?? "none"} image={image} frame={frame} />

      {image && frame && device && (
        <>
          {device.finishes.length > 1 && (
            <>
              <SectionLabel>COLOR</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {device.finishes.map((finish) => (
                  <button
                    key={finish.id}
                    type="button"
                    aria-pressed={frame.finish === finish.id}
                    onClick={() => change({ finish: finish.id })}
                    className={cn(
                      "rounded-full border bg-p-200/10 px-2.5 py-1 text-[11px] text-text transition-colors",
                      choiceClass(frame.finish === finish.id),
                    )}
                  >
                    {finish.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {device.rotates && (
            <>
              <SectionLabel>ORIENTATION</SectionLabel>
              <ToggleGroup
                type="single"
                value={frame.landscape ? "landscape" : "portrait"}
                onValueChange={(value) => value && change({ landscape: value === "landscape" })}
              >
                <ToggleGroupItem value="portrait">Portrait</ToggleGroupItem>
                <ToggleGroupItem value="landscape">Landscape</ToggleGroupItem>
              </ToggleGroup>
            </>
          )}

          {browserLookOf(frame) && (
            <>
              <SectionLabel>ADDRESS</SectionLabel>
              <Input
                aria-label="Address"
                value={frame.address}
                onChange={(event) => change({ address: event.target.value })}
              />
            </>
          )}

          <PictureControls image={image} frame={frame} change={change} />

          {!hasArtwork(frame) && (
            <>
              <SectionLabel>FRAME</SectionLabel>
              {isScreenFrame(frame) && frame.device !== "plain" && (
                <LabeledSlider
                  label="THICKNESS"
                  unit="%"
                  max={THICKNESS_MAX * 100}
                  value={percent(frame.thickness)}
                  onChange={(value) => change({ thickness: value / 100 })}
                />
              )}
              <LabeledSlider
                label="CORNERS"
                unit="%"
                max={ROUNDNESS_MAX * 100}
                value={percent(frame.roundness)}
                onChange={(value) => change({ roundness: value / 100 })}
              />
            </>
          )}

          <MockupControls image={image} />
        </>
      )}
    </div>
  );
};
