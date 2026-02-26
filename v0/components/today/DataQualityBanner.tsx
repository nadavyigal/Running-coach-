"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"
import { todayBannerVariants, todayStatusBadgeVariants } from "@/components/today/today-ui"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BannerTone = "info" | "warning" | "error" | "success"

interface DataQualityBannerProps {
  tone?: BannerTone | null
  title?: string
  description?: string
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
}

const toneMap: Record<
  BannerTone,
  {
    icon: typeof Info
    className: string
    label: string
    statusTone: "positive" | "caution" | "neutral" | "info"
  }
> = {
  info: {
    icon: Info,
    className: "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-sky-400/70",
    label: "Info",
    statusTone: "info",
  },
  warning: {
    icon: TriangleAlert,
    className: "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-amber-400/70",
    label: "Partial",
    statusTone: "caution",
  },
  error: {
    icon: AlertCircle,
    className: "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-rose-400/70",
    label: "Issue",
    statusTone: "caution",
  },
  success: {
    icon: CheckCircle2,
    className: "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-400/70",
    label: "Synced",
    statusTone: "positive",
  },
}

export function DataQualityBanner({
  tone,
  title,
  description,
  actionLabel,
  actionDisabled = false,
  onAction,
}: DataQualityBannerProps) {
  const prefersReducedMotion = useReducedMotion()
  if (!tone || !title || !description) return null

  const meta = toneMap[tone]
  const Icon = meta.icon

  return (
    <motion.aside
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.2 }}
      className={cn(todayBannerVariants({ tone }), meta.className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-background/75 p-1.5">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            <span className={todayStatusBadgeVariants({ tone: meta.statusTone })}>{meta.label}</span>
          </div>
          <p className="text-sm leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="mt-2">
        {actionLabel && onAction ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onAction}
            disabled={actionDisabled}
            className="h-9 rounded-lg border-current/30 bg-transparent text-current hover:bg-background/60"
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </motion.aside>
  )
}
