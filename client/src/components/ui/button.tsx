import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsAccent focus-visible:border-tsAccent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-tsAccent text-black hover:bg-ts-orange-dark shadow-[0_14px_30px_-18px_rgba(249,115,22,0.95)] hover:shadow-[0_18px_36px_-18px_rgba(249,115,22,1)]",
        destructive: "bg-tsError text-tsOnAccent hover:bg-tsError/90",
        outline:
          "border border-white/15 bg-white/5 text-tsTextMain hover:bg-white/10 hover:text-tsTextMain",
        secondary:
          "border border-white/10 bg-white/5 text-tsTextMain hover:bg-white/10 hover:text-tsTextMain",
        ghost: "bg-transparent text-tsTextMain hover:bg-white/5 hover:text-tsTextMain",
        link: "text-tsAccent underline-offset-4 hover:underline",
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
