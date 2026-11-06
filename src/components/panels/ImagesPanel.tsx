import { useRef } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { importImageFile } from "@/lib/importers";
import { ImageEditSection } from "./ImageEditSection";
import { ScreenshotButton } from "./ScreenshotButton";
import { StockImages } from "./StockImages";
import { PanelHelp, PanelTitle, SectionLabel, Linebreak } from "./primitives";

export const ImagesPanel = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const addImage = useEditor((s) => s.addImage);
  const uploadedImages = useEditor((s) => s.uploadedImages);

  // The area was chosen before it got here, so it goes on as it is.
  const onScreenshot = (blob: Blob) => importImageFile(blob, addImage);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    for (const file of Array.from(input.files ?? [])) {
      await importImageFile(file, addImage);
    }
    input.value = "";
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
          multiple
          className="hidden"
          onChange={onPick}
          aria-label="Upload image to canvas"
        />

        <ScreenshotButton onCapture={onScreenshot} />
      </div>

      <Linebreak />

      <StockImages onPick={(blob) => importImageFile(blob, addImage)} />

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
                  className="aspect-square rounded-md border border-hairline bg-canvas bg-cover bg-center transition-colors hover:border-secondary"
                  style={{ backgroundImage: `url(${image.src})` }}
                  onClick={() =>
                    addImage(image.src, image.naturalWidth, image.naturalHeight)
                  }
                />
              ))}
          </div>
        )}
      </div>

      <ImageEditSection />
    </div>
  );
};
