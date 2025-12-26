import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-tsBorder bg-tsField px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-tsText placeholder:text-tsTextMuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tsAccent focus-visible:border-tsAccent focus-visible:ring-offset-2 text-tsText disabled:cursor-not-allowed disabled:bg-tsCardMuted disabled:text-tsTextMuted disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
