import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-tsAccent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-tsCard text-tsText hover:bg-tsCardMuted",
        secondary:
          "border-transparent bg-tsCardMuted text-tsTextSecondary hover:bg-tsCard",
        success:
          "border-transparent bg-tsSuccess text-tsOnSuccess",
        warning:
          "border-transparent bg-tsWarning text-tsOnWarning",
        error:
          "border-transparent bg-tsError text-tsOnAccent",
        outline: "text-tsText border-tsBorder bg-transparent",
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