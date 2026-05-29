import { Lock } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { PanelTitle, SectionLabel, LabeledSlider, SwitchRow } from "./primitives";

export const WatermarkPanel = () => {
  const watermark = useEditor((s) => s.watermark);
  const setWatermark = useEditor((s) => s.setWatermark);
  const isPro = useEditor((s) => s.isPro);

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>WATERMARK</PanelTitle>
      <SwitchRow
        label="SHOW WATERMARK"
        description={isPro ? "Toggle the Laybel watermark." : "Free plan shows 'Made with Laybel'."}
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
              className={
                "flex aspect-square items-center justify-center rounded-sm border transition-colors " +
                (active
                  ? "border-t-400 bg-t-400/[0.18]"
                  : "border-dashed border-p-200/25 hover:border-p-300")
              }
            >
              <span className={"h-1.5 w-1.5 rounded-full " + (active ? "bg-t-400" : "bg-transparent")} />
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
