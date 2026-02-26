import { cva } from "class-variance-authority"

export const todayCardVariants = cva(
  "relative overflow-hidden border bg-card/95 text-card-foreground backdrop-blur supports-[backdrop-filter]:bg-card/90",
  {
    variants: {
      level: {
        hero: "rounded-[1.65rem] border-primary/20 shadow-[0_24px_60px_-38px_rgba(16,24,40,0.6)]",
        primary: "rounded-[1.45rem] border-border/75 shadow-[0_20px_48px_-34px_rgba(16,24,40,0.5)]",
        secondary: "rounded-[1.25rem] border-border/65 shadow-[0_14px_36px_-32px_rgba(16,24,40,0.45)]",
      },
      interactive: {
        true:
          "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_22px_56px_-34px_rgba(8,47,73,0.5)] active:translate-y-0",
        false: "",
      },
    },
    defaultVariants: {
      level: "primary",
      interactive: false,
    },
  }
)

export const todayStatusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        positive: "border-emerald-300/80 bg-emerald-100/90 text-emerald-800",
        caution: "border-amber-300/80 bg-amber-100/90 text-amber-800",
        neutral: "border-slate-300/80 bg-slate-100/90 text-slate-700",
        info: "border-sky-300/80 bg-sky-100/90 text-sky-800",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export const todayTrendBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
  {
    variants: {
      tone: {
        positive: "border-emerald-200 bg-emerald-100/80 text-emerald-700",
        caution: "border-amber-200 bg-amber-100/80 text-amber-700",
        neutral: "border-slate-200 bg-slate-100/90 text-slate-600",
        info: "border-sky-200 bg-sky-100/80 text-sky-700",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export const todayBannerVariants = cva(
  "relative overflow-hidden rounded-2xl border px-4 py-3 text-sm shadow-[0_16px_34px_-26px_rgba(16,24,40,0.55)]",
  {
    variants: {
      tone: {
        info: "border-sky-200/80 bg-sky-50/90 text-sky-900",
        warning: "border-amber-200/90 bg-amber-50/90 text-amber-900",
        error: "border-rose-200/90 bg-rose-50/90 text-rose-900",
        success: "border-emerald-200/90 bg-emerald-50/90 text-emerald-900",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  }
)
