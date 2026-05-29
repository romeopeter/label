import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const KeyBadge = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center justify-center rounded border border-hairline bg-p-50/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-p-100",
      className
    )}
  >
    {children}
  </span>
);
