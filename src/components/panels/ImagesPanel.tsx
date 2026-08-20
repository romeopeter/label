import { useRef } from "react";
import { Camera, Image as ImageIcon, Twitter, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { importImageFile } from "@/lib/importers";
import { PanelHelp, PanelTitle, SectionLabel, Linebreak } from "./primitives";

export const ImagesPanel = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const addImage = useEditor((s) => s.addImage);
  const uploadedImages = useEditor((s) => s.uploadedImages);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importImageFile(file, addImage);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex flex-col gap-2">
        <PanelTitle>
          <div className="flex items-center gap-1">
            <span>IMAGES</span> <ImageIcon className="h-4.5 w-4.5" />
          </div>
        </PanelTitle>

        <Button
          variant="primary"
          size="block"
          className="cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3 w-3" /> Upload image
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onPick}
          aria-label="Upload image to canvas"
        />

        <Button variant="outline" size="block" disabled>
          <Camera className="h-3 w-3" /> Screenshot website
        </Button>

        <Button variant="outline" size="block" disabled>
          <Twitter className="h-3 w-3" /> Import tweet
        </Button>
      </div>

      <Linebreak />

      <div className="space-y-2">
        <SectionLabel>FROM UPLOADS</SectionLabel>
        {uploadedImages.length === 0 ? (
          <PanelHelp>
            Upload images in Uploads, then add them to the canvas here.
          </PanelHelp>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {uploadedImages
              .slice()
              .reverse()
              .map((image) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label="Add uploaded image to canvas"
                  className="aspect-square rounded-md border border-hairline bg-canvas bg-cover bg-center transition-colors hover:border-p-300"
                  style={{ backgroundImage: `url(${image.src})` }}
                  onClick={() =>
                    addImage(image.src, image.naturalWidth, image.naturalHeight)
                  }
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
