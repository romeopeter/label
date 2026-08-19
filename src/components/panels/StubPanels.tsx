import {
  Upload, Lock, Sparkles, Twitter, Image as ImageIcon, Figma, Chrome, Play,
} from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { KeyBadge } from "@/components/ui/key-badge";
import { Badge } from "@/components/ui/badge";
import { PanelTitle, SectionLabel, SwitchRow, PanelDesc, PanelHelp } from "./primitives";

const Phase2Tag = () => <Badge variant="phase2" size="sm">PHASE 2</Badge>;

export const AiPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle badge={<Phase2Tag />}>AI</PanelTitle>
    <SectionLabel>DESCRIBE WHAT YOU WANT</SectionLabel>
    <Textarea
      defaultValue="Make this screenshot pop with a teal gradient background and 3D tilt."
      disabled
    />
    <Button variant="primary" size="block" disabled>
      <Sparkles className="h-3 w-3" /> Generate (Phase 2)
    </Button>
    <SectionLabel>QUICK ACTIONS</SectionLabel>
    <div className="flex flex-wrap gap-1.5">
      {["Bg from image", "Caption it", "Match brand", "Add motion"].map((q) => (
        <button
          key={q}
          type="button"
          disabled
          className="rounded-full border border-hairline bg-p-200/10 px-2.5 py-1 text-[11px] text-text opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  </div>
);

export const TemplatesPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle badge={<Phase2Tag />}>TEMPLATES</PanelTitle>
    <input
      placeholder="Search templates…"
      disabled
      className="rounded-lg border border-hairline bg-chrome/50 px-2.5 py-2 text-xs text-text placeholder:text-text-faint"
    />
    <SectionLabel>CATEGORIES</SectionLabel>
    <div className="flex flex-wrap gap-1.5">
      {["Launches", "Quotes", "Tweets", "Stats", "Promos"].map((q) => (
        <button
          key={q}
          type="button"
          disabled
          className="rounded-full border border-hairline bg-p-200/10 px-2.5 py-1 text-[11px] text-text opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
    <SectionLabel right={<span className="font-mono text-[9.5px] text-text-faint">soon</span>}>
      FEATURED
    </SectionLabel>
    <div className="grid grid-cols-2 gap-1.5">
      {[
        "from-[#2C2151] to-[#6B4FE6]",
        "from-t-800 to-t-400",
        "from-[#1A1826] to-p-600",
        "from-a-400 to-a-200",
        "from-[#0F0E1A] to-t-400",
        "from-p-300 to-p-900",
      ].map((g, i) => (
        <div
          key={i}
          className={"aspect-[16/10] rounded-md border border-hairline bg-gradient-to-br " + g}
        />
      ))}
    </div>
  </div>
);

export const ImagesPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle>IMAGES</PanelTitle>
    <Button variant="primary" size="block">
      <Upload className="h-3.5 w-3.5" /> Upload Image
    </Button>
    <PanelHelp>Or paste <KeyBadge>⌘V</KeyBadge> from your clipboard</PanelHelp>

    <SectionLabel>MORE INTEGRATIONS</SectionLabel>
    <div className="flex flex-col gap-1.5">
      {[
        { Icon: Twitter, label: "Import Tweet", pro: true },
        { Icon: ImageIcon, label: "Screenshot Website", pro: true },
        { Icon: Figma, label: "Install Figma Plugin", pro: false },
        { Icon: Chrome, label: "Install Chrome Extension", pro: false },
      ].map(({ Icon, label, pro }) => (
        <button
          key={label}
          type="button"
          disabled
          className="flex items-center gap-2.5 rounded-md border border-hairline bg-white/[0.01] px-2.5 py-2 text-left text-xs text-text opacity-60 transition-colors hover:bg-p-200/[0.06]"
        >
          <span className="flex h-[22px] w-[22px] items-center justify-center text-p-200">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1">{label}</span>
          {pro && <Badge variant="pro" size="sm" />}
        </button>
      ))}
    </div>
  </div>
);

export const LayoutPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle badge={<Badge variant="pro" />}>LAYOUT</PanelTitle>
    <div className="pro-lock flex flex-col items-center gap-2.5 rounded-xl p-4 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-a-200/[0.12] text-a-200">
        <Lock className="h-5 w-5" />
      </div>
      <p className="m-0 text-[11.5px] leading-[1.5] text-text-muted">
        Arrange multiple images with smart layouts in Phase 2.
      </p>
      <Button variant="primary" size="block" disabled>
        <Lock className="h-3 w-3" /> Unlock Layouts
      </Button>
    </div>
  </div>
);

export const BrandsPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle badge={<Badge variant="pro" />}>BRANDS</PanelTitle>
    <PanelDesc>Save brand colors, logos, fonts as one-click presets in Phase 2.</PanelDesc>
    <div className="pro-lock flex flex-col items-center gap-2.5 rounded-xl p-4 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-a-200/[0.12] text-a-200">
        <Lock className="h-5 w-5" />
      </div>
      <Button variant="primary" size="block" disabled>
        <Lock className="h-3 w-3" /> Unlock Brands
      </Button>
    </div>
    <SectionLabel>SAMPLE BRANDS</SectionLabel>
    <div className="flex flex-col gap-1.5 opacity-55">
      {["Acme Co.", "Vela", "Northpeak"].map((n, i) => (
        <div
          key={n}
          className="flex items-center gap-2.5 rounded-lg border border-hairline bg-chrome/30 px-2.5 py-2"
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md font-display font-bold text-white"
            style={{ background: ["#534AB7", "#1D9E75", "#EF9F27"][i] }}
          >
            {n.slice(0, 1)}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-text">{n}</div>
            <div className="text-[10.5px] text-text-faint">3 colors · 2 fonts</div>
          </div>
          <Lock className="h-3 w-3 text-a-200" />
        </div>
      ))}
    </div>
  </div>
);

export const MotionPanel = () => (
  <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
    <PanelTitle badge={<Phase2Tag />}>MOTION</PanelTitle>
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-chrome/40 px-4 py-6 text-center text-[11.5px] text-text-faint">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-p-200/[0.08] text-p-300">
        <Play className="h-4 w-4" />
      </div>
      <p className="m-0 leading-[1.5]">Per-element animation, MP4 + Lottie export ship in Phase 2.</p>
    </div>
  </div>
);

export const CustomizePanel = ({ onOpenModal }: { onOpenModal: () => void }) => {
  const watermark = useEditor((s) => s.watermark);
  const setWatermark = useEditor((s) => s.setWatermark);
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-6 pt-4">
      <PanelTitle>CUSTOMIZE</PanelTitle>
      <PanelDesc>Tailor the sidebar and theme to fit your flow.</PanelDesc>
      <Button variant="ghost" size="block" onClick={onOpenModal}>Customize Sidebar</Button>

      <SectionLabel>APPEARANCE</SectionLabel>
      <SwitchRow label="DARK MODE" checked onCheckedChange={() => {}} />
      <SwitchRow label="SHOW DOTTED GRID" checked onCheckedChange={() => {}} />
      <SwitchRow label="REDUCE MOTION" onCheckedChange={() => {}} />
      <SwitchRow label="SHOW WATERMARK" checked={watermark} onCheckedChange={setWatermark} />

      <SectionLabel>HOTKEYS</SectionLabel>
      <div className="flex flex-col gap-1">
        {[
          ["Export", "⌘E"], ["Copy", "⌘C"], ["Paste", "⌘V"],
          ["Undo", "⌘Z"], ["Delete", "⌫"],
        ].map(([label, key]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-md bg-chrome/40 px-2 py-1.5 text-xs"
          >
            <span>{label}</span>
            <KeyBadge>{key}</KeyBadge>
          </div>
        ))}
      </div>
    </div>
  );
};
