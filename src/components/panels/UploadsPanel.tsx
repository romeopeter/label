import { useRef } from "react";
import { Upload, Command, X } from "lucide-react";
import { useEditor } from "@/store/editor";
import { importImageFile } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { KeyBadge } from "@/components/ui/key-badge";
import {
  PanelTitle,
  SectionLabel,
  PanelHelp,
  // PanelLink,
  // LinkMini,
  Linebreak,
} from "./primitives";

export const UploadsPanel = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const addImage = useEditor((s) => s.addImage);
  const deleteImage = useEditor((s) => s.deleteElement);
  const elements = useEditor((s) => s.elements);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importImageFile(file, addImage);
    e.target.value = "";
  };

  const recents = elements
    .filter((el) => el.type === "image")
    .slice(-9)
    .reverse();

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex flex-col gap-2">
        <PanelTitle>
          <div className="flex items-center gap-1">
            <span>UPLOADS</span> <Upload className="h-4.5 w-4.5" />
          </div>
        </PanelTitle>

        <Button
          variant="primary"
          size="block"
          className="cursor-pointe"
          onClick={() => fileRef.current?.click()}
        >
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

        <div>
          <PanelHelp className="inline">
            PNG, JPG, WebP, SVG · drag onto canvas or paste{" "}
          </PanelHelp>
          <KeyBadge className="size-fit text-[10px]">
            <Command size={10} />V
          </KeyBadge>
        </div>
        {/* <PanelLink>
          <Info className="h-3 w-3" /> How to use the copy/paste feature
        </PanelLink> */}
      </div>

      <Linebreak />

      <div className="space-y-2">
        {recents.length !== 0 && <SectionLabel>RECENT</SectionLabel>}
        <div className="grid grid-cols-3 gap-1.5">
          {recents.length !== 0 &&
            recents.map((el) => (
              <div
                key={el.id}
                className="aspect-square rounded-md border border-hairline bg-canvas bg-cover bg-center relative"
                style={{ backgroundImage: `url(${(el as any).src})` }}
              >
                <div
                  className="size-fit absolute bg-primary/80 hover:bg-primary rounded-xl top-1 right-1 cursor-pointer"
                  onClick={() => deleteImage(el.id)}
                >
                  <X size={15} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
