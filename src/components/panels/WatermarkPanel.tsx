import { Lock } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelTitle, SectionLabel, LabeledSlider, SwitchRow } from "./primitives";
import { choiceClass } from "./choice";

export const WatermarkPanel = () => {
  const watermark = useEditor((s) => s.watermark);
  const setWatermark = useEditor((s) => s.setWatermark);
  const isPro = useEditor((s) => s.isPro);

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>WATERMARK</PanelTitle>
      <SwitchRow
        label="SHOW WATERMARK"
        description={isPro ? "Toggle the Layer watermark." : "Free plan shows the Layer logo watermark."}
        checked={watermark}
        onCheckedChange={isPro ? setWatermark : undefined}
      />

      <SectionLabel>POSITION</SectionLabel>
      <div className="grid w-[110px] grid-cols-3 gap-[3px] rounded-md border border-hairline bg-chrome/60 p-[3px]">
        {Array.from({ length: 9 }).map((_, i) => {
          const active = i === 8;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Position ${i}`}
              aria-pressed={active}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm border transition-colors",
                choiceClass(active),
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-secondary" : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      <LabeledSlider label="OPACITY" unit="%" value={80} />
      {!isPro && (
        <Button variant="ghost" size="block">
          <Lock className="h-3 w-3" /> Remove watermark (PRO)
        </Button>
      )}
    </div>
  );
};
