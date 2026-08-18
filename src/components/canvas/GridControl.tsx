import { ChevronUp, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GRID_MAX_SIZE, GRID_MIN_SIZE, useEditor } from "@/store/editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LabeledSlider, PanelHelp, SwitchRow } from "@/components/panels/primitives";

/**
 * Grid toggle for the canvas view chrome, next to zoom.
 *
 * The icon toggles directly rather than opening the popover: turning the grid
 * on and off is the frequent action, and burying it a click deep behind
 * settings you rarely touch gets old fast. The caret carries the settings.
 */
export const GridControl = () => {
  const grid = useEditor((s) => s.grid);
  const setGrid = useEditor((s) => s.setGrid);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const toggleSnap = useEditor((s) => s.toggleSnap);

  return (
    <div className="flex items-center">
      <button
        type="button"
        title="Show grid (⇧G)"
        aria-label="Show grid"
        aria-pressed={grid.enabled}
        onClick={toggleGrid}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded transition-colors",
          grid.enabled
            ? "bg-t-400/20 text-t-200"
            : "text-text-muted hover:bg-p-200/10 hover:text-text",
        )}
      >
        <Grid3x3 className="h-3 w-3" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="View settings"
            aria-label="View settings"
            className="flex h-6 w-3.5 items-center justify-center rounded text-text-faint hover:bg-p-200/10 hover:text-text"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-56 p-3">
          <div className="space-y-2.5">
            <LabeledSlider
              label="SPACING"
              unit="px"
              min={GRID_MIN_SIZE}
              max={GRID_MAX_SIZE}
              step={2}
              value={grid.size}
              onChange={(v) => setGrid({ size: v })}
            />
            <LabeledSlider
              label="OPACITY"
              unit="%"
              max={100}
              value={Math.round(grid.opacity * 100)}
              onChange={(v) => setGrid({ opacity: v / 100 })}
            />
            <SwitchRow
              label="SNAP TO OBJECTS"
              description="Show alignment guides and snap while dragging."
              checked={snapEnabled}
              onCheckedChange={toggleSnap}
            />
            <PanelHelp className="mb-0">
              Guides only — neither the grid nor the alignment guides appear in
              an export.
            </PanelHelp>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
