import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-primary to-primary-dark text-primary-foreground shadow-md hover:shadow-purple-glow hover:scale-105",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-sm hover:scale-105",
        accent: "bg-gradient-to-r from-accent to-accent-dark text-accent-foreground shadow-md hover:shadow-cyan-glow hover:scale-105",
        success: "bg-gradient-to-r from-success to-green-600 text-success-foreground shadow-md hover:shadow-lg hover:scale-105",
        danger: "bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-md hover:shadow-lg hover:scale-105",
        warning: "bg-gradient-to-r from-warning to-orange-600 text-warning-foreground shadow-md hover:shadow-lg hover:scale-105",
        ghost: "hover:bg-gray-100 hover:text-gray-900",
        outline: "border-2 border-gray-300 bg-transparent hover:bg-gray-50 hover:border-gray-400",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-8 px-3 text-xs rounded-md",
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-6",
        lg: "h-14 px-8 text-base rounded-xl",
        icon: "h-10 w-10 rounded-full",
        iconLg: "h-14 w-14 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
