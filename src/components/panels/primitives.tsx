import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Slider as ShSlider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const PanelTitle = ({
  children,
  badge,
  className,
}: {
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "mb-0.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-p-200",
      className
    )}
  >
    <span>{children}</span>
    {badge}
  </div>
);

export const SectionLabel = ({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) => (
  <div className="mb-1 mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-p-200">
    <span>{children}</span>
    {right}
  </div>
);

export const PanelHelp = ({ children }: { children: ReactNode }) => (
  <p className="my-1 flex flex-wrap items-center gap-1.5 text-[11.5px] leading-[1.5] text-text-faint">
    {children}
  </p>
);

export const PanelDesc = ({ children }: { children: ReactNode }) => (
  <p className="m-0 text-[11.5px] leading-[1.5] text-text-muted">{children}</p>
);

export const PanelLink = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-1 mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] text-t-200 hover:text-t-400"
  >
    {children}
  </button>
);

export const MutedMini = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[9.5px] font-medium tracking-[0.08em] text-text-faint">
    {children}
  </span>
);

export const LinkMini = ({ children }: { children: ReactNode }) => (
  <button type="button" className="cursor-pointer text-[10px] text-t-200 hover:text-t-400">{children}</button>
);

interface LabeledSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  leftIcon?: ReactNode;
  onChange?: (v: number) => void;
}

export const LabeledSlider = ({
  label,
  value,
  unit = "",
  min = 0,
  max = 100,
  step = 1,
  leftIcon,
  onChange,
}: LabeledSliderProps) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-p-200">
        {leftIcon}
        {label}
      </span>
      <span className="rounded bg-p-50/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-text">
        {value}
        {unit}
      </span>
    </div>
    <ShSlider
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={([v]) => onChange?.(v)}
    />
  </div>
);

export const SwitchRow = ({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  children?: ReactNode;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-p-200">{label}</div>
      {description && (
        <div className="mt-1 text-[11px] tracking-normal text-text-faint normal-case">
          {description}
        </div>
      )}
    </div>
    {children}
    {onCheckedChange && !children && (
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    )}
  </label>
);

export const ColorRow = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange?: (v: string) => void;
  label?: ReactNode;
}) => (
  <div className="flex items-center gap-2 rounded-md border border-hairline bg-chrome/40 p-1.5">
    <input
      type="color"
      aria-label={typeof label === "string" ? label : "Color"}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-[22px] w-[22px] cursor-pointer rounded border border-hairline bg-transparent p-0"
    />
    <div className="flex-1 font-mono text-[11px] text-text">{value.toUpperCase()}</div>
    {label && <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint">{label}</span>}
  </div>
);
