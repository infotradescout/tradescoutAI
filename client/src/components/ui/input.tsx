import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement | null,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "ts-control flex h-[var(--ts-control-height)] w-full px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/40 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-60",
        className
      )}
      ref={ref as React.Ref<HTMLInputElement>}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
