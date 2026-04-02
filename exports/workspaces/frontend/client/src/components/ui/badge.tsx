import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ts-orange/70 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-tsCard text-tsText hover:bg-white/5",
        secondary:
          "border-transparent bg-white/5 text-white/70 hover:bg-tsCard",
        success:
          "border-transparent bg-tsSuccess text-tsOnSuccess",
        warning:
          "border-transparent bg-tsWarning text-tsOnWarning",
        error:
          "border-transparent bg-red-500 text-text-black",
        outline: "text-tsText border-white/10 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }