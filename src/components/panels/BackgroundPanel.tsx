import { useRef, useState } from "react";
import { LayoutDashboard, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { fileToDataURL } from "@/lib/importers";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PanelTitle,
  SectionLabel,
  LabeledSlider,
  ColorRow,
  Linebreak,
} from "./primitives";

const SWATCHES = [
  "#6E5BFF",
  "#A06FFF",
  "#3FCBA6",
  "#1D9E75",
  "#EF9F27",
  "#FF7A59",
  "#0F0E1A",
  "#1A1826",
  "#3C3489",
  "#534AB7",
  "#AFA9EC",
  "#EEEDFE",
];

const GRADIENTS = [
  { from: "#6E5BFF", to: "#3FCBA6" },
  { from: "#EF9F27", to: "#FF5577" },
  { from: "#0F0E1A", to: "#534AB7" },
  { from: "#FAEEDA", to: "#EF9F27" },
  { from: "#1D9E75", to: "#085041" },
  { from: "#AFA9EC", to: "#3C3489" },
];

export const BackgroundPanel = () => {
  const bg = useEditor((s) => s.background);
  const setBg = useEditor((s) => s.setBackground);
  const [tab, setTab] = useState("Settings");
  const fileRef = useRef<HTMLInputElement>(null);

  const onUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(file);
    setBg({ mode: "image", imageSrc: dataUrl });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PanelTitle>
        <div className="flex items-center gap-1">
          <span>BACKGROUND</span> <LayoutDashboard className="h-4.5 w-4.5" />
        </div>
      </PanelTitle>

      <div className="w-full max-w-full space-y-2.5">
        <SectionLabel>TYPE</SectionLabel>
        <ToggleGroup
          type="single"
          value={bg.mode}
          onValueChange={(v) => v && setBg({ mode: v as typeof bg.mode })}
          className="w-full"
        >
          <ToggleGroupItem value="solid" className="cursor-pointer">Solid</ToggleGroupItem>
          <ToggleGroupItem value="gradient" className="cursor-pointer">Gradient</ToggleGroupItem>
          <ToggleGroupItem value="image" className="cursor-pointer">Image</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2.5">
        {bg.mode === "solid" && (
          <div className="w-full space-x-2.5">
            <SectionLabel>COLOR</SectionLabel>
            <ColorRow value={bg.color} onChange={(v) => setBg({ color: v })} />

            <div id="solid-swatches">
              <SectionLabel>SOLID SWATCHES</SectionLabel>
              <div className="grid grid-cols-6 gap-1.5">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={s}
                    onClick={() => setBg({ mode: "solid", color: s })}
                    className="aspect-square cursor-pointer rounded-md border border-hairline transition-transform hover:scale-110 hover:border-p-300"
                    style={{ background: s }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {bg.mode === "gradient" && (
          <div className="w-full space-y-2.5">
            <SectionLabel>GRADIENT</SectionLabel>
            <div
              className="h-3 rounded border border-hairline"
              style={{
                background: `linear-gradient(90deg, ${bg.gradient.from}, ${bg.gradient.to})`,
              }}
            />
            <ColorRow
              value={bg.gradient.from}
              label="FROM"
              onChange={(v) => setBg({ gradient: { ...bg.gradient, from: v } })}
            />
            <ColorRow
              value={bg.gradient.to}
              label="TO"
              onChange={(v) => setBg({ gradient: { ...bg.gradient, to: v } })}
            />
            <LabeledSlider
              label="ANGLE"
              unit="°"
              min={0}
              max={360}
              value={bg.gradient.angle}
              onChange={(v) =>
                setBg({ gradient: { ...bg.gradient, angle: v } })
              }
            />

            <div id="gradient-present">
              <SectionLabel>GRADIENT PRESETS</SectionLabel>
              <div className="grid grid-cols-6 gap-1.5">
                {GRADIENTS.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Gradient ${i + 1}`}
                    onClick={() =>
                      setBg({
                        mode: "gradient",
                        gradient: { ...g, angle: 135 },
                      })
                    }
                    className="aspect-square cursor-pointer rounded-md border border-hairline transition-transform hover:scale-110 hover:border-p-300"
                    style={{
                      background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {bg.mode === "image" && (
          <>
            <SectionLabel>BACKGROUND IMAGE</SectionLabel>
            <Button
              variant="primary"
              size="block"
              className="cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" /> Upload background
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onUploadImage}
              aria-label="Upload background image"
            />
            {bg.imageSrc && (
              <>
                <LabeledSlider
                  label="BLUR"
                  unit="px"
                  max={40}
                  value={bg.imageBlur}
                  onChange={(v) => setBg({ imageBlur: v })}
                />
                <LabeledSlider
                  label="OPACITY"
                  unit="%"
                  max={100}
                  value={Math.round(bg.imageOpacity * 100)}
                  onChange={(v) => setBg({ imageOpacity: v / 100 })}
                />
              </>
            )}
          </>
        )}
      </div>

      <Linebreak />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList >
          {/* <TabsTrigger value="Saved">Saved</TabsTrigger> */}
          <TabsTrigger value="Settings" disabled className="disabled:cursor-not-allowed">
            Settings
          </TabsTrigger>
          <TabsTrigger value="Effects" className="cursor-pointer" defaultChecked>Effects</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
