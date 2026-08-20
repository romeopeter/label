import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const AppModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: AppModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showCloseButton
      className={cn("max-w-md rounded-lg", className)}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {description && (
        <DialogDescription className="px-4 pt-3">
          {description}
        </DialogDescription>
      )}
      <div className="px-4 pb-4 pt-3">{children}</div>
    </DialogContent>
  </Dialog>
);
