import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-input)] px-3 py-2 text-sm text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-[color:var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent-primary)]/70 focus-visible:border-[color:var(--theme-accent-primary)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40 disabled:opacity-60",
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
