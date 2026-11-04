import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Crop, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import useImage from "use-image";
import { useEditor } from "@/store/editor";
import type {
  ImageAdjust,
  ImageEdit,
  ImageElement,
  ImageStyleId,
  LensBlurMode,
} from "@/types";
import { cn } from "@/lib/utils";
import { importImageFile } from "@/lib/importers";
import { isImageTiltActive } from "@/lib/tilt";
import {
  COLORS,
  DEFAULT_STYLE_STRENGTH,
  GRADES,
  hasEdit,
  IMAGE_EDIT_SECTION_ID,
  LENS_MODES,
  NO_ADJUST,
  QUICK_FIXES,
  STYLES,
  styleOf,
  type StyleVariant,
} from "@/lib/imageEdit/presets";
import { isImageEditSupported, renderEdit } from "@/lib/imageEdit/renderer";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LabeledSlider,
  Linebreak,
  PanelDesc,
  PanelHelp,
  PanelTitle,
  SectionLabel,
} from "./primitives";

/* ------------------------------------------------------------------------------------------- */

const THUMB_WIDTH = 132;
const THUMB_HEIGHT = 94;
const DEFAULT_GRADE_STRENGTH = 80;
const DEFAULT_LENS_AMOUNT = 50;
const FOCUS_MAX_WIDTH = 256;
const FOCUS_MAX_HEIGHT = 160;

type Tab = "fix" | "style" | "adjust";
type SetEdit = (patch: Partial<ImageEdit>) => void;

const Title = () => (
  <PanelTitle>
    <div className="flex items-center gap-1">
      <span>EDIT</span> <SlidersHorizontal className="h-4.5 w-4.5" />
    </div>
  </PanelTitle>
);

/** A small copy of the picture, so every option previews on the user's own image. */
const useThumbSource = (src: string) => {
  const [image] = useImage(src, "anonymous");

  return useMemo(() => {
    if (!image) return null;
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const scale = Math.max(
      THUMB_WIDTH / image.naturalWidth,
      THUMB_HEIGHT / image.naturalHeight,
    );
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        (THUMB_WIDTH - width) / 2,
        (THUMB_HEIGHT - height) / 2,
        width,
        height,
      );
    return canvas;
  }, [image]);
};

const OptionThumb = ({
  source,
  edit,
  overlay,
  label,
  active,
  onClick,
}: {
  source: HTMLCanvasElement | null;
  edit: ImageEdit;
  overlay?: HTMLCanvasElement | null;
  label: string;
  active: boolean;
  onClick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (source && canvasRef.current) renderEdit(source, edit, canvasRef.current, overlay);
  }, [source, edit, overlay]);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-md border bg-chrome/50 p-1.5 text-center text-[9.5px] leading-tight transition-colors hover:border-p-500 hover:text-text",
        active ? "border-primary text-text" : "border-hairline text-text-muted",
      )}
    >
      <canvas
        ref={canvasRef}
        className="aspect-[1.4] w-full rounded-sm border border-hairline-strong"
      />
      <span>{label}</span>
    </button>
  );
};

/* Preview edits are built once: a new object per render would redraw every thumbnail. */
const STYLE_PREVIEWS = STYLES.map((style) => ({
  style,
  edit: {
    style: {
      id: style.id,
      variant: style.variants[0].id,
      // An even mix, or the double exposure thumbnail shows mostly the mirrored copy.
      strength: style.id === "double" ? 50 : DEFAULT_STYLE_STRENGTH,
    },
  } as ImageEdit,
}));
const COLOR_PREVIEWS = COLORS.map((color) => ({
  color,
  edit: { color: { id: color.id, strength: color.strength } } as ImageEdit,
}));
const GRADE_PREVIEWS = GRADES.map((grade) => ({
  grade,
  edit: { grade: { id: grade.id, strength: DEFAULT_GRADE_STRENGTH } } as ImageEdit,
}));
const ORIGINAL: ImageEdit = {};

/* ------------------------------------------------------------------------------------------- */

const FixTab = ({ image }: { image: ImageElement }) => {
  const setCropId = useEditor((s) => s.setCropId);
  const canCrop = !image.deviceFrame && !isImageTiltActive(image.transform);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="block"
        disabled={!canCrop}
        onClick={() => setCropId(image.id)}
      >
        <Crop className="h-3 w-3" /> Crop
      </Button>
      <PanelHelp>
        {canCrop
          ? "Trim the edges of the picture. You can always crop back out."
          : "Remove the device frame and 3D tilt to crop."}
      </PanelHelp>
    </div>
  );
};

/* What the overlap of the two circles looks like under each blend. */
const BLEND_OVERLAP: Record<string, string> = {
  default: "fill-mix-default",
  lighten: "fill-mix-lighten",
  darken: "fill-mix-darken",
  add: "fill-mix-add",
  subtract: "fill-mix-subtract",
  overlay: "fill-mix-overlay",
};

const BlendCircles = ({ blend }: { blend: string }) => {
  const clipId = useId();

  return (
    <svg viewBox="0 0 34 22" className="h-5.5 w-8.5 shrink-0" aria-hidden>
      <clipPath id={clipId}>
        <circle cx="11" cy="11" r="10" />
      </clipPath>
      <circle cx="11" cy="11" r="10" className="fill-primary" />
      <circle cx="23" cy="11" r="10" className="fill-secondary" />
      <circle cx="23" cy="11" r="10" clipPath={`url(#${clipId})`} className={BLEND_OVERLAP[blend]} />
      <circle cx="11" cy="11" r="10" className="fill-none stroke-white" />
      <circle cx="23" cy="11" r="10" className="fill-none stroke-white" />
    </svg>
  );
};

const BlendOption = ({
  variant,
  active,
  onClick,
}: {
  variant: StyleVariant;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    title={variant.help}
    onClick={onClick}
    className={cn(
      "flex h-11.25 cursor-pointer items-center gap-2 rounded-md border px-2 text-[10.5px] transition-colors hover:border-secondary hover:text-text",
      active ? "border-primary text-text" : "border-border text-text-muted",
    )}
  >
    <BlendCircles blend={variant.id} />
    <span>{variant.label}</span>
  </button>
);

const DoubleExposure = ({
  style,
  current,
  setEdit,
}: {
  style: NonNullable<ReturnType<typeof styleOf>>;
  current: NonNullable<ImageEdit["style"]>;
  setEdit: SetEdit;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploads = useEditor((s) => s.uploadedImages);
  const addUploadedImage = useEditor((s) => s.addUploadedImage);
  const chosen = style.variants.find((variant) => variant.id === current.variant);

  const chooseSecond = (overlaySrc: string | undefined) =>
    setEdit({ style: { ...current, overlaySrc } });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importImageFile(file, (src, width, height) => {
      chooseSecond(src);
      return addUploadedImage(src, width, height);
    });
    e.target.value = "";
  };

  return (
    <>
      <SectionLabel>SECOND IMAGE</SectionLabel>
      <Button variant="ghost" size="block" onClick={() => fileRef.current?.click()}>
        <Upload className="h-3 w-3" /> Add image
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={onPick}
        aria-label="Add second image"
      />
      {uploads.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {uploads.map((upload) => {
            const selected = current.overlaySrc === upload.src;
            return (
              <button
                key={upload.id}
                type="button"
                aria-label="Use this upload as the second image"
                aria-pressed={selected}
                onClick={() => chooseSecond(selected ? undefined : upload.src)}
                className={cn(
                  "aspect-square cursor-pointer overflow-hidden rounded-sm border",
                  selected ? "border-primary" : "border-hairline hover:border-p-500",
                )}
              >
                <img src={upload.src} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      )}

      {current.overlaySrc ? (
        <>
          <SectionLabel>BLEND</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {style.variants.map((variant) => (
              <BlendOption
                key={variant.id}
                variant={variant}
                active={(chosen ?? style.variants[0]).id === variant.id}
                onClick={() => setEdit({ style: { ...current, variant: variant.id } })}
              />
            ))}
          </div>
          <PanelDesc>{(chosen ?? style.variants[0]).help}</PanelDesc>
          <LabeledSlider
            label="STRENGTH"
            unit="%"
            value={current.strength}
            onChange={(strength) => setEdit({ style: { ...current, strength } })}
          />
        </>
      ) : (
        <PanelHelp>Add an image to blend it into this one.</PanelHelp>
      )}
    </>
  );
};

const StyleTab = ({
  image,
  source,
  setEdit,
}: {
  image: ImageElement;
  source: HTMLCanvasElement | null;
  setEdit: SetEdit;
}) => {
  const current = image.edit?.style;
  const style = current ? styleOf(current.id) : undefined;

  // There's no second image yet at this point, so the double exposure thumbnail
  // blends the picture with a mirrored copy of itself.
  const mirrored = useMemo(() => {
    if (!source) return null;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d");
    context?.translate(source.width, 0);
    context?.scale(-1, 1);
    context?.drawImage(source, 0, 0);
    return canvas;
  }, [source]);

  const choose = (id: ImageStyleId) => {
    const next = styleOf(id);
    if (!next) return;
    setEdit({
      style: {
        id,
        variant: next.variants[0].id,
        strength: current?.strength || DEFAULT_STYLE_STRENGTH,
      },
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        <OptionThumb
          source={source}
          edit={ORIGINAL}
          label="None"
          active={!current}
          onClick={() => setEdit({ style: undefined })}
        />
        {STYLE_PREVIEWS.map((preview) => (
          <OptionThumb
            key={preview.style.id}
            source={source}
            edit={preview.edit}
            overlay={preview.style.id === "double" ? mirrored : null}
            label={preview.style.label}
            active={current?.id === preview.style.id}
            onClick={() => choose(preview.style.id)}
          />
        ))}
      </div>

      {style && current && (
        <>
          <PanelDesc>{style.help}</PanelDesc>
          {style.id === "double" ? (
            <DoubleExposure style={style} current={current} setEdit={setEdit} />
          ) : (
            <>
              <ToggleGroup
                type="single"
                value={current.variant}
                onValueChange={(variant) =>
                  variant && setEdit({ style: { ...current, variant } })
                }
                className="w-full flex-wrap"
              >
                {style.variants.map((variant) => (
                  <ToggleGroupItem key={variant.id} value={variant.id} className="cursor-pointer">
                    {variant.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <LabeledSlider
                label="STRENGTH"
                unit="%"
                value={current.strength}
                onChange={(strength) => setEdit({ style: { ...current, strength } })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

/** The picture, as the image shows it: click or drag on it to choose what stays sharp. */
const FocusPicker = ({
  image,
  focus,
  onChange,
}: {
  image: ImageElement;
  focus: { x: number; y: number };
  onChange: (focus: { x: number; y: number }) => void;
}) => {
  const [picture] = useImage(image.src, "anonymous");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fit = Math.min(FOCUS_MAX_WIDTH / image.width, FOCUS_MAX_HEIGHT / image.height);
  const width = Math.round(image.width * fit);
  const height = Math.round(image.height * fit);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!picture || !canvas) return;
    const crop = image.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    canvas.width = width;
    canvas.height = height;
    canvas
      .getContext("2d")
      ?.drawImage(
        picture,
        crop.x * picture.naturalWidth,
        crop.y * picture.naturalHeight,
        crop.width * picture.naturalWidth,
        crop.height * picture.naturalHeight,
        0,
        0,
        width,
        height,
      );
  }, [picture, image.crop, width, height]);

  const place = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onChange({
      x: Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1),
    });
  };

  return (
    <div
      role="presentation"
      data-testid="lens-focus"
      className="relative mx-auto cursor-crosshair touch-none overflow-hidden rounded-sm border border-hairline-strong"
      style={{ width, height }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        place(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons) place(event);
      }}
    >
      <canvas ref={canvasRef} className="block size-full" />
      <span
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-primary"
        style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
      />
    </div>
  );
};

const LIGHT_SLIDERS: { key: keyof ImageAdjust; label: string }[] = [
  { key: "brightness", label: "BRIGHTNESS" },
  { key: "contrast", label: "CONTRAST" },
  { key: "highlights", label: "HIGHLIGHTS" },
  { key: "shadows", label: "SHADOWS" },
  { key: "ambience", label: "AMBIENCE" },
];

const COLOR_SLIDERS: { key: keyof ImageAdjust; label: string }[] = [
  { key: "saturation", label: "SATURATION" },
  { key: "warmth", label: "WARMTH" },
];

const AdjustTab = ({
  image,
  source,
  setEdit,
}: {
  image: ImageElement;
  source: HTMLCanvasElement | null;
  setEdit: SetEdit;
}) => {
  const edit = image.edit ?? {};
  const adjust = { ...NO_ADJUST, ...edit.adjust };

  const slider = ({ key, label }: { key: keyof ImageAdjust; label: string }) => (
    <LabeledSlider
      key={key}
      label={label}
      min={-100}
      max={100}
      value={adjust[key]}
      onChange={(value) => setEdit({ adjust: { ...adjust, [key]: value } })}
    />
  );

  const quickFixActive = (fix: (typeof QUICK_FIXES)[number]) =>
    (Object.keys(NO_ADJUST) as (keyof ImageAdjust)[]).every(
      (key) => adjust[key] === (fix.adjust[key] ?? 0),
    );

  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel>QUICK FIX</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_FIXES.map((fix) => (
          <button
            key={fix.id}
            type="button"
            aria-pressed={quickFixActive(fix)}
            onClick={() => setEdit({ adjust: { ...NO_ADJUST, ...fix.adjust } })}
            className={cn(
              "cursor-pointer rounded-md border bg-chrome/50 px-1 py-1.5 text-[10.5px] transition-colors hover:border-p-500 hover:text-text",
              quickFixActive(fix)
                ? "border-primary text-text"
                : "border-hairline text-text-muted",
            )}
          >
            {fix.label}
          </button>
        ))}
      </div>

      <SectionLabel>COLOR</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        <OptionThumb
          source={source}
          edit={ORIGINAL}
          label="Original"
          active={!edit.color}
          onClick={() => setEdit({ color: undefined })}
        />
        {COLOR_PREVIEWS.map((preview) => (
          <OptionThumb
            key={preview.color.id}
            source={source}
            edit={preview.edit}
            label={preview.color.label}
            active={edit.color?.id === preview.color.id}
            onClick={() =>
              setEdit({
                color: {
                  id: preview.color.id,
                  strength: preview.color.strength,
                },
              })
            }
          />
        ))}
      </div>
      {edit.color && (
        <LabeledSlider
          label="COLOR STRENGTH"
          unit="%"
          value={edit.color.strength}
          onChange={(strength) => edit.color && setEdit({ color: { ...edit.color, strength } })}
        />
      )}

      <SectionLabel>COLOR GRADE</SectionLabel>
      <PanelDesc>Ready-made looks, like a movie's color.</PanelDesc>
      <div className="grid grid-cols-3 gap-1.5">
        <OptionThumb
          source={source}
          edit={ORIGINAL}
          label="None"
          active={!edit.grade}
          onClick={() => setEdit({ grade: undefined })}
        />
        {GRADE_PREVIEWS.map((preview) => (
          <OptionThumb
            key={preview.grade.id}
            source={source}
            edit={preview.edit}
            label={preview.grade.label}
            active={edit.grade?.id === preview.grade.id}
            onClick={() =>
              setEdit({
                grade: {
                  id: preview.grade.id,
                  strength: edit.grade?.strength || DEFAULT_GRADE_STRENGTH,
                },
              })
            }
          />
        ))}
      </div>
      {edit.grade && (
        <LabeledSlider
          label="GRADE STRENGTH"
          unit="%"
          value={edit.grade.strength}
          onChange={(strength) => edit.grade && setEdit({ grade: { ...edit.grade, strength } })}
        />
      )}

      <SectionLabel>LENS BLUR</SectionLabel>
      <PanelDesc>Blurs part of the picture, like a camera's focus.</PanelDesc>
      <ToggleGroup
        type="single"
        value={edit.lensBlur?.mode ?? "off"}
        onValueChange={(mode) => {
          if (!mode) return;
          setEdit({
            lensBlur:
              mode === "off"
                ? undefined
                : {
                    mode: mode as LensBlurMode,
                    amount: edit.lensBlur?.amount || DEFAULT_LENS_AMOUNT,
                    focus: edit.lensBlur?.focus,
                  },
          });
        }}
        className="w-full flex-wrap"
      >
        <ToggleGroupItem value="off" className="cursor-pointer">Off</ToggleGroupItem>
        {LENS_MODES.map((mode) => (
          <ToggleGroupItem key={mode.id} value={mode.id} className="cursor-pointer">
            {mode.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {edit.lensBlur && edit.lensBlur.mode !== "whole" && (
        <>
          <PanelHelp>Click the picture to choose what stays sharp.</PanelHelp>
          <FocusPicker
            image={image}
            focus={edit.lensBlur.focus ?? { x: 0.5, y: 0.5 }}
            onChange={(focus) =>
              edit.lensBlur && setEdit({ lensBlur: { ...edit.lensBlur, focus } })
            }
          />
        </>
      )}
      {edit.lensBlur && (
        <LabeledSlider
          label="BLUR AMOUNT"
          unit="%"
          value={edit.lensBlur.amount}
          onChange={(amount) =>
            edit.lensBlur && setEdit({ lensBlur: { ...edit.lensBlur, amount } })
          }
        />
      )}

      <SectionLabel>LIGHT</SectionLabel>
      <div className="flex flex-col gap-3">{LIGHT_SLIDERS.map(slider)}</div>

      <SectionLabel>TONE</SectionLabel>
      <div className="flex flex-col gap-3">{COLOR_SLIDERS.map(slider)}</div>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------- */

/** Bottom of the Images panel: edits the selected image. */
export const ImageEditSection = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);
  const [tab, setTab] = useState<Tab>("style");

  const image = elements.find(
    (e) => e.id === selectedIds[0] && e.type === "image",
  ) as ImageElement | undefined;
  const source = useThumbSource(image?.src ?? "");

  // Nothing to edit yet: the panel stays about adding images.
  if (!elements.some((e) => e.type === "image")) return null;

  if (!image || !isImageEditSupported()) {
    return (
      <div id={IMAGE_EDIT_SECTION_ID} className="flex flex-col gap-2.5">
        <Linebreak />
        <Title />
        <PanelDesc>
          {image
            ? "This device's graphics can't run image editing."
            : "Select an image to edit it."}
        </PanelDesc>
      </div>
    );
  }

  const setEdit: SetEdit = (patch) =>
    update(image.id, { edit: { ...image.edit, ...patch } });

  return (
    <div id={IMAGE_EDIT_SECTION_ID} className="flex flex-col gap-4">
      <Linebreak />
      <Title />

      <ToggleGroup
        type="single"
        value={tab}
        onValueChange={(value) => value && setTab(value as Tab)}
        className="w-full"
      >
        <ToggleGroupItem value="fix" className="cursor-pointer">Fix</ToggleGroupItem>
        <ToggleGroupItem value="style" className="cursor-pointer">Style</ToggleGroupItem>
        <ToggleGroupItem value="adjust" className="cursor-pointer">Adjust</ToggleGroupItem>
      </ToggleGroup>

      {tab === "fix" && <FixTab image={image} />}
      {tab === "style" && <StyleTab image={image} source={source} setEdit={setEdit} />}
      {tab === "adjust" && <AdjustTab image={image} source={source} setEdit={setEdit} />}

      {hasEdit(image.edit) && (
        <Button
          variant="ghost"
          size="block"
          onClick={() => update(image.id, { edit: undefined })}
        >
          <RotateCcw className="h-3 w-3" /> Remove all edits
        </Button>
      )}
    </div>
  );
};
