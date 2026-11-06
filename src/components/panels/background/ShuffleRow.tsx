import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import type { ShuffleMode } from "@/lib/background/looks";
import { MutedMini, PanelHelp, SectionLabel } from "../primitives";

/** Shuffle between Back and Forward, the same for every background type that has it. */
export const ShuffleRow = ({ mode }: { mode: ShuffleMode }) => {
  const trail = useEditor((s) => s.lookTrails[mode]);
  const showLook = useEditor((s) => s.showLook);
  const stepLook = useEditor((s) => s.stepLook);
  const at = trail?.at ?? -1;
  const length = trail?.looks.length ?? 0;

  return (
    <div className="space-y-2.5">
      <SectionLabel right={length > 1 && <MutedMini>{`${at + 1} OF ${length}`}</MutedMini>}>SHUFFLE</SectionLabel>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          title="Back"
          className="cursor-pointer"
          disabled={at <= 0}
          onClick={() => stepLook(mode, -1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="primary" size="sm" className="flex-1 cursor-pointer" onClick={() => showLook(mode)}>
          <Shuffle className="h-3 w-3" /> Shuffle
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Forward"
          title="Forward"
          className="cursor-pointer"
          disabled={at >= length - 1}
          onClick={() => stepLook(mode, 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <PanelHelp>Back and Forward return to ones you skipped.</PanelHelp>
    </div>
  );
};
