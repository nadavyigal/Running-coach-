"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react"
import { AnimatedMetricValue } from "@/components/today/AnimatedMetricValue"
import { todayCardVariants, todayTrendBadgeVariants } from "@/components/today/today-ui"
import { CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type MetricTone = "default" | "positive" | "caution"
export type MetricTrend = "up" | "down" | "stable"

export type MetricCardData = {
  id: string
  label: string
  value: string
  helper: string
  tone?: MetricTone
  trend?: MetricTrend
  trendLabel?: string
  unit?: string
  meterValue?: number
  animatedValue?: number
  formatAnimatedValue?: (value: number) => string
  animationDecimals?: number
}

interface MetricCardProps {
  metric: MetricCardData
  index: number
  isLoading?: boolean
}

const toneClassName: Record<MetricTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-700",
  caution: "text-amber-700",
}

const trendMeta: Record<
  MetricTrend,
  { icon: typeof TrendingUp; tone: "positive" | "caution" | "neutral" | "info" }
> = {
  up: { icon: TrendingUp, tone: "positive" },
  down: { icon: TrendingDown, tone: "caution" },
  stable: { icon: Minus, tone: "neutral" },
}

export function MetricCard({ metric, index, isLoading = false }: MetricCardProps) {
  const prefersReducedMotion = useReducedMotion()

  if (isLoading) {
    return (
      <article className={todayCardVariants({ level: "secondary" })}>
        <CardContent className="space-y-2.5 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </article>
    )
  }

  const trend = metric.trend ?? "stable"
  const trendConfig = trendMeta[trend]
  const TrendIcon = trendConfig.icon
  const meterValue = Math.max(0, Math.min(100, metric.meterValue ?? 0))
  const hasMeter = Number.isFinite(metric.meterValue)
  const animatedValue = metric.animatedValue
  const hasAnimatedValue = Number.isFinite(metric.animatedValue)

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.22, delay: 0.04 * index }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      className={todayCardVariants({ level: "secondary", interactive: true })}
    >
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
          <span className={todayTrendBadgeVariants({ tone: trendConfig.tone })}>
            <TrendIcon className="h-3 w-3" aria-hidden="true" />
            {metric.trendLabel ?? trend}
          </span>
        </div>

        <div className="flex items-end gap-1">
          <p className={cn("text-[1.55rem] font-semibold leading-none tracking-tight tabular-nums", toneClassName[metric.tone ?? "default"])}>
            {hasAnimatedValue ? (
              <AnimatedMetricValue
                value={Number(animatedValue)}
                decimals={metric.animationDecimals ?? 0}
                formatter={metric.formatAnimatedValue}
              />
            ) : (
              metric.value
            )}
          </p>
          {metric.unit ? <span className="pb-0.5 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{metric.unit}</span> : null}
        </div>

        {hasMeter ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${meterValue}%` }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, delay: 0.05 * index }}
              className={cn(
                "h-full rounded-full",
                metric.tone === "positive" ? "bg-emerald-500/90" : metric.tone === "caution" ? "bg-amber-500/90" : "bg-primary/85"
              )}
            />
          </div>
        ) : (
          <div className="h-1.5 rounded-full bg-muted/60" />
        )}

        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Activity className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{metric.helper}</span>
        </p>
      </CardContent>
    </motion.article>
  )
}
