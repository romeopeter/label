import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[12.5px] font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform] duration-[120ms] active:translate-y-[0.5px] disabled:opacity-50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-t-500",
        active:  "bg-t-500 text-primary-foreground",
        ghost:   "border border-hairline-strong text-text-muted hover:border-p-300 hover:text-text hover:bg-p-200/5",
        teal:    "bg-t-400 text-white rounded-full shadow-[0_1px_0_rgba(255,255,255,.1)_inset,0_0_0_1px_color-mix(in_srgb,#1D9E75_40%,transparent)] hover:bg-t-500",
        text:    "text-t-200 hover:text-t-400 px-1.5 py-1",
        outline: "border border-hairline-strong text-text hover:bg-p-200/5",
        icon:    "rounded-md text-text-muted hover:bg-p-200/10 hover:text-text",
        soft:    "rounded-md text-text-muted hover:bg-p-200/10 hover:text-text",
        secondary: "bg-secondary text-secondary-foreground hover:bg-p-700",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "px-3 py-2",
        sm:      "px-2.5 py-1.5 text-[12px]",
        lg:      "px-4 py-2.5 text-sm",
        icon:    "h-[26px] w-[26px] p-0",
        iconSm:  "h-[22px] w-[22px] p-0",
        iconSoft:"h-6 w-6 p-0 text-sm",
        block:   "w-full px-3 py-2",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
