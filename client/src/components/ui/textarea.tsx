import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement | null,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "ts-control flex min-h-[88px] w-full px-3 py-2 text-sm placeholder:text-white/40 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-60",
        className
      )}
      ref={ref as React.Ref<HTMLTextAreaElement>}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
