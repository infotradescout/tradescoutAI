import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-tsBorder/80 bg-black/30 px-3 py-2 text-sm text-tsTextMain shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-tsTextMain placeholder:text-tsTextMuted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsAccent/70 focus-visible:border-tsAccent focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-tsCardMuted disabled:text-tsTextMuted disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
