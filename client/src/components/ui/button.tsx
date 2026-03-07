import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent-primary)] focus-visible:border-[color:var(--theme-accent-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--theme-accent-primary)] text-black hover:brightness-110 shadow-[0_14px_30px_-18px_rgba(249,115,22,0.95)] hover:shadow-[0_18px_36px_-18px_rgba(249,115,22,1)]",
        destructive: "bg-red-500 text-white hover:bg-red-500/90",
        outline:
          "border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-white hover:bg-[color:var(--surface-card)] hover:text-white",
        secondary:
          "border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-white hover:bg-[color:var(--surface-card)] hover:text-white",
        ghost: "bg-transparent text-white hover:bg-white/5 hover:text-white",
        link: "text-[color:var(--theme-accent-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-2.5",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
