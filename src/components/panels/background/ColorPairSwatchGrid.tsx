import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternColorPair } from "@/types/pattern";

interface SwatchProps {
  pair: PatternColorPair;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

/** Half-and-half split so both colours of the duotone read at swatch size. */
const PairSwatch = ({ pair, selected, onSelect, onDelete }: SwatchProps) => (
  <div className="group relative">
    <button
      type="button"
      title={pair.label ?? `${pair.base} / ${pair.accent}`}
      aria-label={pair.label ?? `${pair.base} and ${pair.accent}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "aspect-square w-full cursor-pointer overflow-hidden rounded-md border transition-transform hover:scale-110",
        // `border-primary` aliases t-400. Not `border-t-400` — Tailwind reads
        // that as border-top-width: 400px, not a colour.
        selected ? "border-primary ring-1 ring-primary/50" : "border-hairline hover:border-p-300",
      )}
      style={{
        background: `linear-gradient(135deg, ${pair.base} 0 50%, ${pair.accent} 50% 100%)`,
      }}
    />
    {onDelete && (
      <button
        type="button"
        aria-label="Delete colour pair"
        onClick={onDelete}
        className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full border border-hairline bg-chrome text-text-muted hover:text-text group-hover:flex"
      >
        <X className="h-2 w-2" />
      </button>
    )}
  </div>
);

interface Props {
  title: string;
  pairs: PatternColorPair[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
}

export const ColorPairSwatchGrid = ({
  title,
  pairs,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
}: Props) => {
  // A section with nothing to show and no way to add anything is just noise —
  // this is what keeps "From your brand" hidden until brand colours exist.
  if (pairs.length === 0 && !onAdd) return null;

  return (
    <div>
      <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-p-200">
        {title}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {pairs.map((pair) => (
          <PairSwatch
            key={pair.id}
            pair={pair}
            selected={pair.id === selectedId}
            onSelect={() => onSelect(pair.id)}
            onDelete={onDelete ? () => onDelete(pair.id) : undefined}
          />
        ))}
        {onAdd && (
          <button
            type="button"
            aria-label="Create a custom colour pair"
            onClick={onAdd}
            className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-hairline-strong text-text-faint transition-colors hover:border-p-300 hover:text-text"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};
