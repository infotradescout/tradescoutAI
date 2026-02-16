import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-lg border border-tsBorder bg-tsField px-3 py-2 text-base ring-offset-background placeholder:text-tsTextMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsAccent focus-visible:border-tsAccent focus-visible:ring-offset-2 text-tsText disabled:cursor-not-allowed disabled:bg-tsCardMuted disabled:text-tsTextMuted disabled:opacity-50 md:text-sm",
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
