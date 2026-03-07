import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[88px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange/70 focus-visible:border-ts-orange focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
