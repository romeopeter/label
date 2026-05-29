import { Info, X, GripVertical, Eye, EyeOff } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TOOLS } from "./LeftRail";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hiddenTools: Record<string, boolean>;
  toggleVisible: (k: string) => void;
}

export const CustomizeSidebarModal = ({ open, onOpenChange, hiddenTools, toggleVisible }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[420px] max-w-[calc(100vw-32px)] p-0">
      <DialogHeader>
        <div className="flex items-center gap-2.5">
          <DialogTitle>Customize Sidebar</DialogTitle>
          <Info className="h-3 w-3 text-text-faint" />
        </div>
        <Button variant="icon" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </DialogHeader>
      <DialogDescription>
        Drag to reorder. Hide tools you rarely use to keep the rail focused.
      </DialogDescription>
      <div className="flex flex-col gap-1 overflow-y-auto px-4 py-3">
        {TOOLS.map((t) => {
          const hidden = !!hiddenTools[t.key];
          return (
            <div
              key={t.key}
              className="flex items-center gap-2.5 rounded-lg border border-hairline bg-chrome/30 px-2.5 py-2 hover:bg-p-200/[0.06]"
            >
              <span className="flex cursor-grab items-center text-text-faint">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <span className="flex items-center text-p-200">{t.icon}</span>
              <span className="flex-1 text-[13px] text-text">{t.label}</span>
              {t.exclusive && (
                <span className="rounded-full bg-t-400/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.04em] text-t-400">
                  Laybel exclusive
                </span>
              )}
              <Button variant="icon" size="icon" onClick={() => toggleVisible(t.key)}>
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          );
        })}
      </div>
    </DialogContent>
  </Dialog>
);
