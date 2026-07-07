import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ts-radius-control)] text-[13px] font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange focus-visible:border-ts-orange focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ts-action font-bold",
        destructive: "bg-red-500 text-white hover:bg-red-500/90 shadow-none",
        outline: "ts-secondary-action bg-transparent hover:text-white",
        secondary: "ts-secondary-action hover:text-white",
        ghost: "bg-transparent text-white hover:bg-white/5 hover:text-white",
        link: "text-ts-orange underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--ts-control-height)] px-3.5 py-2",
        sm: "h-[var(--ts-control-height-sm)] px-2.5",
        lg: "h-[var(--ts-control-height-lg)] px-6",
        icon: "h-[var(--ts-control-height)] w-[var(--ts-control-height)]",
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
