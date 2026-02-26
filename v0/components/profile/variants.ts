import { cva } from "class-variance-authority"

export const profileCardVariants = cva(
  "rounded-2xl border text-card-foreground shadow-sm transition-all motion-reduce:transition-none",
  {
    variants: {
      tone: {
        hero: "border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card shadow-[0_14px_30px_-20px_oklch(var(--primary)/0.9)]",
        primary: "border-primary/25 bg-card shadow-[0_12px_22px_-16px_oklch(var(--primary)/0.65)]",
        secondary: "border-border bg-card",
        muted: "border-border/70 bg-[oklch(var(--surface-2))]",
        warning: "border-amber-300 bg-amber-50/80",
        danger: "border-red-200 bg-red-50/80",
      },
    },
    defaultVariants: {
      tone: "secondary",
    },
  },
)

export const statusChipVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        active: "border-primary/30 bg-primary/10 text-primary",
        connected: "border-emerald-300 bg-emerald-50 text-emerald-700",
        warning: "border-amber-300 bg-amber-50 text-amber-700",
        caution: "border-red-300 bg-red-50 text-red-700",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

export const rowItemVariants = cva(
  "group flex items-center justify-between rounded-xl border px-3 py-3 transition-colors motion-reduce:transition-none",
  {
    variants: {
      tone: {
        default: "border-border/70 bg-card hover:bg-[oklch(var(--surface-2))]",
        subtle: "border-transparent bg-[oklch(var(--surface-2))] hover:bg-[oklch(var(--surface-3))]",
        warning: "border-amber-200 bg-amber-50/80 hover:bg-amber-100/70",
        danger: "border-red-200 bg-red-50/80 hover:bg-red-100/70",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
)
