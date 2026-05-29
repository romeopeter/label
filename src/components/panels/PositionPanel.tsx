import { useEditor } from "@/store/editor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PanelTitle, SectionLabel, LabeledSlider, PanelDesc, SwitchRow } from "./primitives";

export const PositionPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const canvas = useEditor((s) => s.canvas);
  const update = useEditor((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedIds[0]);

  if (!el) {
    return (
      <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
        <PanelTitle>POSITION</PanelTitle>
        <PanelDesc>Select an element to adjust its position and scale.</PanelDesc>
      </div>
    );
  }

  const align = (h: number, v: number) => {
    const x = h === 0 ? 0 : h === 1 ? (canvas.width - el.width) / 2 : canvas.width - el.width;
    const y = v === 0 ? 0 : v === 1 ? (canvas.height - el.height) / 2 : canvas.height - el.height;
    update(el.id, { x, y });
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>POSITION</PanelTitle>
      <PanelDesc>Snap the selected layer to a position, or set X/Y manually.</PanelDesc>

      <div className="grid w-[110px] grid-cols-3 gap-[3px] rounded-md border border-hairline bg-chrome/60 p-[3px]">
        {Array.from({ length: 9 }).map((_, i) => {
          const h = i % 3;
          const v = Math.floor(i / 3);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Align ${i}`}
              onClick={() => align(h, v)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm border border-dashed border-p-200/25 bg-transparent transition-colors hover:border-p-300"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
            </button>
          );
        })}
      </div>

      <SectionLabel>POSITION</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">X</span>
          <input
            aria-label="X"
            value={Math.round(el.x)}
            onChange={(e) => update(el.id, { x: Number(e.target.value) || 0 })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">Y</span>
          <input
            aria-label="Y"
            value={Math.round(el.y)}
            onChange={(e) => update(el.id, { y: Number(e.target.value) || 0 })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
      </div>

      <SectionLabel>SIZE</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">W</span>
          <input
            aria-label="Width"
            value={Math.round(el.width)}
            onChange={(e) => update(el.id, { width: Math.max(10, Number(e.target.value) || 0) })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-md border border-hairline bg-chrome/40 px-2 py-1.5">
          <span className="font-mono text-[10px] font-semibold text-text-faint">H</span>
          <input
            aria-label="Height"
            value={Math.round(el.height)}
            onChange={(e) => update(el.id, { height: Math.max(10, Number(e.target.value) || 0) })}
            className="w-full bg-transparent font-mono text-[11px] text-text outline-none"
          />
        </label>
      </div>

      <LabeledSlider label="ROTATION" unit="°" min={-180} max={180}
                     value={Math.round(el.rotation)}
                     onChange={(v) => update(el.id, { rotation: v })} />
      <LabeledSlider label="OPACITY" unit="%" max={100}
                     value={Math.round(el.opacity * 100)}
                     onChange={(v) => update(el.id, { opacity: v / 100 })} />

      <SwitchRow label="LOCK ASPECT">
        <Switch />
      </SwitchRow>
    </div>
  );
};
