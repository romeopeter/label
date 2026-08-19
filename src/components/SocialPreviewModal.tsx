import { useState } from "react";
import { Linkedin, ChevronDown, Sun, Moon, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  previewDataUrl: string | null;
}

export const SocialPreviewModal = ({ open, onOpenChange, previewDataUrl }: Props) => {
  const [platform] = useState("LinkedIn");
  const [dark, setDark] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140 max-w-[calc(100vw-32px)] p-0">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-text-muted">Preview on</span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-p-200/10 px-2.5 py-1 text-xs font-medium text-text"
            >
              <Linkedin className="h-3 w-3" /> {platform} <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={dark ? "dark" : "light"}
              onValueChange={(v) => v && setDark(v === "dark")}
            >
              <ToggleGroupItem value="light" aria-label="Light"><Sun className="h-3 w-3" /></ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark"><Moon className="h-3 w-3" /></ToggleGroupItem>
            </ToggleGroup>
            <Button variant="icon" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="bg-chrome p-6">
          <div
            className={cn(
              "rounded-lg p-4 font-[var(--font-ui)]",
              dark ? "bg-[#1B1F23] text-[#E8E8E8]" : "bg-white text-[#1A1826]"
            )}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-p-500 to-t-400" />
              <div>
                <div className="text-[13px] font-semibold">Marina Castillo</div>
                <div className={cn("text-[11px]", dark ? "text-[#9B9B9B]" : "text-[#6F6A92]")}>
                  Founder · Vela Labs · 1d
                </div>
              </div>
            </div>
            <p className="my-2 text-[13px] leading-[1.55]">
              Shipping something we've been quietly cooking for months. It changes how we think
              about graphics. Sneak peek ↓
            </p>
            <div className="relative aspect-video overflow-hidden rounded-md bg-gradient-to-br from-[#2E1C5F] via-[#5F3DBD] to-t-400">
              {previewDataUrl ? (
                <img src={previewDataUrl} alt="design preview" className="block h-full w-full object-cover" />
              ) : (
                <>
                  <div className="absolute inset-4 rounded bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent)]" />
                  <div className="absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-[0.06em] text-white/60">
                    your design
                  </div>
                </>
              )}
            </div>
            <div className={cn("mt-3 flex gap-4 text-xs", dark ? "text-[#9B9B9B]" : "text-[#6F6A92]")}>
              <span>👍 142</span><span>💬 18</span><span>↗ 9</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
