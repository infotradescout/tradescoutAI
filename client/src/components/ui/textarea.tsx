import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[88px] w-full rounded-xl border border-tsBorder/80 bg-black/30 px-3 py-2 text-sm text-tsTextMain shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors placeholder:text-tsTextMuted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsAccent/70 focus-visible:border-tsAccent focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-tsCardMuted disabled:text-tsTextMuted disabled:opacity-60",
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
