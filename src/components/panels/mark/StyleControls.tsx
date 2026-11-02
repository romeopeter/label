import { patchConnector } from "@/lib/connectors";
import { badgeWidth, BADGE_PRESETS } from "@/lib/marks";
import { qrShape } from "@/lib/qr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  Connector,
  ConnectorHead,
  MarkEffect,
  ShapeElement,
  ShapeKind,
} from "@/types";
import {
  ColorRow,
  LabeledSlider,
  PanelHelp,
  SectionLabel,
  SwitchRow,
} from "../primitives";
import {
  ARROW_OPTIONS,
  CALLOUT_OPTIONS,
  LINE_OPTIONS,
  SHAPE_OPTIONS,
  type MarkOption,
} from "./options";

/* ------------------------------------------------------------------------------------------- */

const DRAWN_SHAPES = new Set<ShapeKind>(
  SHAPE_OPTIONS.flatMap(({ patch }) => (patch.shape ? [patch.shape] : [])),
);

const CORNER_SHAPES = new Set<ShapeKind>(["rect", "rounded-rect", "badge"]);

const HEADS: { value: ConnectorHead; label: string }[] = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "open", label: "Open" },
  { value: "dot", label: "Dot" },
];

const EFFECTS: { value: MarkEffect; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "hard", label: "Hard" },
  { value: "glow", label: "Glow" },
];

const MARKER_COLORS = ["#FFD23F", "#5CE1A5", "#FF8FB1", "#6FC3FF", "#FF9A3D"];

/** A row of big-icon choices; the same look as the Mark tool grid. */
export const OptionGrid = ({
  options,
  isActive,
  onPick,
  className,
}: {
  options: Pick<MarkOption, "icon" | "label">[];
  isActive?: (index: number) => boolean;
  onPick: (index: number) => void;
  className?: string;
}) => (
  <div className={cn("grid grid-cols-5 gap-1", className)}>
    {options.map((option, index) => (
      <button
        key={option.label}
        type="button"
        aria-pressed={isActive?.(index)}
        onClick={() => onPick(index)}
        className={cn(
          "group flex cursor-pointer flex-col items-center gap-1 rounded-md px-0.5 py-2 text-[9.5px] transition-colors hover:bg-p-200/10 hover:text-text [&:hover_.annot-ic]:text-t-400",
          isActive?.(index) ? "bg-p-200/10 text-text" : "text-text-muted",
        )}
      >
        <span
          className={cn(
            "annot-ic flex h-[30px] w-[30px] items-center justify-center rounded-md bg-p-50/[0.04]",
            isActive?.(index) && "text-t-400",
          )}
        >
          {option.icon}
        </span>
        <span className="leading-none">{option.label}</span>
      </button>
    ))}
  </div>
);

const LabeledToggle = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-p-200">
      {label}
    </span>
    <ToggleGroup
      type="single"
      className="w-full"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="cursor-pointer"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  </div>
);

/** Shows what the pen will draw, before there's anything on the canvas. */
const StrokeSample = ({ subject }: { subject: ShapeElement }) => (
  <div className="flex h-12 items-center justify-center rounded-md border border-hairline bg-chrome/40 px-3">
    <svg viewBox="0 0 200 40" className="h-full w-full" aria-hidden>
      <path
        d="M8 26C40 6 70 34 100 20s60-14 92 2"
        fill="none"
        stroke={subject.stroke}
        strokeOpacity={subject.opacity}
        // Canvas px are far smaller than panel px; this stays readable.
        strokeWidth={Math.max(1, Math.min(subject.strokeWidth * 0.5, 22))}
        strokeLinecap={subject.shape === "highlight" ? "butt" : "round"}
      />
    </svg>
  </div>
);

const optionsFor = (subject: ShapeElement): MarkOption[] | null => {
  if (subject.connector) {
    return subject.shape === "line" ? LINE_OPTIONS : ARROW_OPTIONS;
  }
  if (subject.shape === "callout") return CALLOUT_OPTIONS;
  return DRAWN_SHAPES.has(subject.shape) ? SHAPE_OPTIONS : null;
};

/**
 * Every setting for a mark. `subject` is either a real selected element or a
 * stand-in holding an armed tool's style, so a tool and the layers it makes
 * can't drift apart in what they offer or how they respond.
 */
export const StyleControls = ({
  subject,
  onChange,
  showSample = false,
}: {
  subject: ShapeElement;
  onChange: (patch: Partial<ShapeElement>) => void;
  showSample?: boolean;
}) => {
  const { shape, connector } = subject;
  const options = optionsFor(subject);
  const isStroke = shape === "pencil" || shape === "highlight";
  const isCallout = shape === "callout";
  const isDrawnShape = DRAWN_SHAPES.has(shape);
  const usesFill = isDrawnShape || isCallout || shape === "number" || shape === "badge";
  const usesTextColor = isCallout || shape === "number" || shape === "badge";
  const usesBorder = isDrawnShape || isCallout || shape === "number" || shape === "badge";
  const usesCorner =
    CORNER_SHAPES.has(shape) ||
    (isCallout &&
      (subject.calloutKind === "speech" || subject.calloutKind === "label"));
  const filled = subject.filled !== false;

  const applyOption = ({ patch }: MarkOption) => {
    if (patch.connector && connector) {
      const { connector: changes, ...rest } = patch;
      onChange({ ...patchConnector(subject, connector, changes), ...rest });
    } else {
      onChange(patch);
    }
  };

  const setConnector = (patch: Partial<Connector>) => {
    if (connector) onChange(patchConnector(subject, connector, patch));
  };

  const setFilled = (next: boolean) =>
    onChange({
      filled: next,
      // An outline with no width would make the shape disappear.
      ...(next ? {} : { strokeWidth: Math.max(subject.strokeWidth, 6) }),
    });

  const setBadgeText = (text: string) =>
    onChange({ text, width: badgeWidth(text, subject.height) });

  return (
    <div className="flex flex-col gap-3">
      {options && (
        <OptionGrid
          options={options}
          className="grid-cols-5"
          isActive={(index) => options[index].matches(subject)}
          onPick={(index) => applyOption(options[index])}
        />
      )}

      {showSample && isStroke && <StrokeSample subject={subject} />}

      {isDrawnShape && (
        <SwitchRow label="Fill" checked={filled} onCheckedChange={setFilled} />
      )}
      {usesFill && filled && (
        <ColorRow
          label="Fill"
          value={subject.fill}
          onChange={(fill) => onChange({ fill })}
        />
      )}
      {usesTextColor && (
        <ColorRow
          label="Text"
          value={subject.textFill ?? "#FFFFFF"}
          onChange={(textFill) => onChange({ textFill })}
        />
      )}

      {shape === "qr-code" && (
        <>
          <ColorRow
            label="Code"
            value={subject.fill}
            onChange={(fill) => onChange({ fill })}
          />
          <ColorRow
            label="Background"
            value={subject.backgroundFill ?? "#FFFFFF"}
            onChange={(backgroundFill) => onChange({ backgroundFill })}
          />
          <PanelHelp>Dark on light scans best. Test it before you publish.</PanelHelp>
        </>
      )}

      {shape === "icons" && (
        <>
          <ColorRow
            label="Color"
            value={subject.stroke}
            onChange={(stroke) => onChange({ stroke })}
          />
          <LabeledSlider
            label="Thickness"
            min={0.5}
            max={4}
            step={0.25}
            value={subject.strokeWidth}
            onChange={(strokeWidth) => onChange({ strokeWidth })}
          />
        </>
      )}

      {(isStroke || connector) && (
        <>
          <ColorRow
            label="Color"
            value={subject.stroke}
            onChange={(stroke) => onChange({ stroke })}
          />
          {isStroke && (
            <div className="flex gap-1.5">
              {MARKER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color}`}
                  onClick={() => onChange({ stroke: color })}
                  className={cn(
                    "h-5.5 w-5.5 cursor-pointer rounded-full border transition-colors",
                    subject.stroke === color
                      ? "border-text"
                      : "border-hairline hover:border-p-300",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
          <LabeledSlider
            label="Width"
            unit="px"
            min={1}
            max={shape === "highlight" ? 120 : 40}
            value={subject.strokeWidth}
            onChange={(strokeWidth) => onChange({ strokeWidth })}
          />
        </>
      )}

      {connector && (
        <>
          <LabeledToggle
            label="Start"
            value={connector.headStart}
            options={HEADS}
            onChange={(headStart) => setConnector({ headStart })}
          />
          <LabeledToggle
            label="End"
            value={connector.headEnd}
            options={HEADS}
            onChange={(headEnd) => setConnector({ headEnd })}
          />
          <LabeledSlider
            label="Head size"
            unit="px"
            min={12}
            max={120}
            value={subject.arrowHeadSize ?? 36}
            onChange={(arrowHeadSize) => onChange({ arrowHeadSize })}
          />
        </>
      )}

      {(connector || shape === "pencil") && (
        <SwitchRow
          label="Dashed"
          checked={subject.dashed}
          onCheckedChange={(dashed) => onChange({ dashed })}
        />
      )}

      {shape !== "qr-code" && (
        <LabeledSlider
          label="Opacity"
          unit="%"
          min={0}
          max={100}
          value={Math.round(subject.opacity * 100)}
          onChange={(value) => onChange({ opacity: value / 100 })}
        />
      )}

      {usesBorder && (
        <>
          <SectionLabel>{filled ? "BORDER" : "OUTLINE"}</SectionLabel>
          <ColorRow
            label={filled ? "Border" : "Outline"}
            value={subject.stroke}
            onChange={(stroke) => onChange({ stroke })}
          />
          <LabeledSlider
            label="Width"
            unit="px"
            min={filled ? 0 : 1}
            max={32}
            value={subject.strokeWidth}
            onChange={(strokeWidth) => onChange({ strokeWidth })}
          />
          <SwitchRow
            label="Dashed"
            checked={subject.dashed}
            onCheckedChange={(dashed) => onChange({ dashed })}
          />
        </>
      )}

      {usesCorner && (
        <LabeledSlider
          label="Corner"
          unit="px"
          min={0}
          max={200}
          value={subject.cornerRadius}
          onChange={(cornerRadius) => onChange({ cornerRadius })}
        />
      )}

      {(isDrawnShape || isCallout) && (
        <LabeledToggle
          label="Effect"
          value={subject.effect ?? "none"}
          options={EFFECTS}
          onChange={(effect) => onChange({ effect })}
        />
      )}

      {isCallout && (
        <>
          <SectionLabel>TEXT</SectionLabel>
          <Textarea
            aria-label="Callout text"
            placeholder="Type here"
            rows={2}
            value={subject.text ?? ""}
            onChange={(event) => onChange({ text: event.target.value })}
          />
          <LabeledSlider
            label="Size"
            unit="px"
            min={12}
            max={160}
            value={Math.round(subject.fontSize ?? 40)}
            onChange={(fontSize) => onChange({ fontSize })}
          />
        </>
      )}

      {shape === "number" && (
        <>
          <SectionLabel>CONTENT</SectionLabel>
          <Input
            aria-label="Number"
            maxLength={3}
            value={subject.text ?? ""}
            onChange={(event) => onChange({ text: event.target.value })}
          />
        </>
      )}

      {shape === "badge" && (
        <>
          <SectionLabel>CONTENT</SectionLabel>
          <Input
            aria-label="Badge text"
            value={subject.text ?? ""}
            onChange={(event) => setBadgeText(event.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {BADGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBadgeText(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
        </>
      )}

      {shape === "qr-code" && (
        <>
          <SectionLabel>CONTENT</SectionLabel>
          <Input
            aria-label="QR code link or text"
            value={subject.text ?? ""}
            onChange={(event) => onChange({ text: event.target.value })}
          />
          {subject.text && !qrShape(subject.text) && (
            <PanelHelp>This is too long for a QR code. Try a shorter link.</PanelHelp>
          )}
        </>
      )}
    </div>
  );
};
