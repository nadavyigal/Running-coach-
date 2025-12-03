import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-700 border border-gray-200",
        primary: "bg-purple-100 text-purple-700 border border-purple-200",
        accent: "bg-cyan-100 text-cyan-700 border border-cyan-200",
        success: "bg-green-100 text-green-700 border border-green-200",
        warning: "bg-orange-100 text-orange-700 border border-orange-200",
        danger: "bg-red-100 text-red-700 border border-red-200",
        // Workout type badges with gradients
        "workout-easy": "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-tempo": "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-intervals": "bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-long": "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-time-trial": "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-hill": "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-sm font-bold uppercase tracking-wide",
        "workout-rest": "bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-sm font-bold uppercase tracking-wide",
        outline: "text-foreground border border-gray-300",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-xs",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
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
