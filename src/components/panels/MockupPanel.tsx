import { useEditor } from "@/store/editor";
import { DEVICE_FRAMES } from "@/lib/constants";
import type { DeviceFrame, ImageElement } from "@/types";
import { cn } from "@/lib/utils";
import { PanelTitle, SectionLabel, PanelDesc } from "./primitives";

export const MockupPanel = () => {
  const selectedIds = useEditor((s) => s.selectedIds);
  const elements = useEditor((s) => s.elements);
  const update = useEditor((s) => s.updateElement);

  const selectedImage = elements.find(
    (e) => e.id === selectedIds[0] && e.type === "image"
  ) as ImageElement | undefined;

  const apply = (frame: DeviceFrame) => {
    if (!selectedImage) return;
    update(selectedImage.id, { deviceFrame: frame });
  };

  const cell = (active: boolean, disabled: boolean) =>
    cn(
      "flex flex-col items-center gap-1 rounded-md border bg-chrome/50 p-1.5 text-[9.5px] transition-colors",
      active ? "border-t-400 text-text" : "border-hairline text-text-muted",
      disabled ? "opacity-50" : "hover:border-p-500 hover:text-text"
    );

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>MOCKUP</PanelTitle>
      {!selectedImage && (
        <PanelDesc>Select an image element to wrap it in a device frame.</PanelDesc>
      )}

      <SectionLabel>DEVICE FRAME</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={!selectedImage}
          onClick={() => apply(null)}
          className={cell(selectedImage?.deviceFrame == null, !selectedImage)}
        >
          <div className="mockup-thumb aspect-[1.4] w-full rounded-sm border border-hairline-strong" />
          <span>None</span>
        </button>
        {DEVICE_FRAMES.map((m) => (
          <button
            key={m.key}
            type="button"
            disabled={!selectedImage}
            onClick={() => apply(m.key)}
            className={cell(selectedImage?.deviceFrame === m.key, !selectedImage)}
          >
            <div className="mockup-thumb aspect-[1.4] w-full rounded-sm border border-hairline-strong" />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
