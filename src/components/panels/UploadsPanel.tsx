import { useRef } from "react";
import { Upload, Info } from "lucide-react";
import { useEditor } from "@/store/editor";
import { importImageFile } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { KeyBadge } from "@/components/ui/key-badge";
import { PanelTitle, SectionLabel, PanelHelp, PanelLink, LinkMini } from "./primitives";

export const UploadsPanel = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const addImage = useEditor((s) => s.addImage);
  const elements = useEditor((s) => s.elements);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importImageFile(file, addImage);
    e.target.value = "";
  };

  const recents = elements.filter((el) => el.type === "image").slice(-9).reverse();

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>UPLOADS</PanelTitle>
      <Button variant="primary" size="block" onClick={() => fileRef.current?.click()}>
        <Upload className="h-3 w-3" /> Upload from device
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={onPick}
        aria-label="Upload image"
      />
      <PanelHelp>
        PNG, JPG, WebP, SVG · drag onto canvas or paste <KeyBadge>⌘V</KeyBadge>
      </PanelHelp>
      <PanelLink>
        <Info className="h-3 w-3" /> How to use the copy/paste feature
      </PanelLink>

      <SectionLabel right={<LinkMini>In project</LinkMini>}>RECENT</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {recents.length === 0
          ? Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={
                  "aspect-square rounded-md border border-hairline bg-canvas " +
                  ["upload-thumb-0", "upload-thumb-1", "upload-thumb-2"][i % 3]
                }
              />
            ))
          : recents.map((el) => (
              <div
                key={el.id}
                className="aspect-square rounded-md border border-hairline bg-canvas bg-cover bg-center"
                style={{ backgroundImage: `url(${(el as any).src})` }}
              />
            ))}
      </div>
    </div>
  );
};
