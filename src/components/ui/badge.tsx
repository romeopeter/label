import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-0.5 rounded font-bold uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        pro:    "bg-a-200 text-a-900",
        free:   "bg-a-200 text-a-900 font-mono font-semibold tracking-[0.04em] rounded-full",
        phase2: "bg-p-600/20 text-p-200 normal-case tracking-[0.06em]",
        new:    "bg-t-800 text-t-200 tracking-[0.08em]",
        teal:   "bg-t-400/15 text-t-400 font-semibold tracking-[0.04em] rounded-full normal-case",
      },
      size: {
        default: "text-[9px] px-1.5 py-0.5",
        sm:      "text-[8.5px] px-1 py-0.5 gap-px",
        free:    "text-[9.5px] px-2 py-[3px]",
      },
    },
    defaultVariants: { variant: "pro", size: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, size, children, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
    {variant === "pro" && <Lock className="h-2 w-2" strokeWidth={2.5} />}
    {children ?? (variant === "pro" ? "PRO" : null)}
  </span>
);
