"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Activity, CalendarClock } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { todayCardVariants, todayStatusBadgeVariants, todayTrendBadgeVariants } from "@/components/today/today-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

export type ProgressPoint = {
  day: string
  completion: number
}

interface ProgressSummaryChartProps {
  data: ProgressPoint[]
  progressPercent: number
  summaryLabel: string
  isLoading?: boolean
}

export function ProgressSummaryChart({
  data,
  progressPercent,
  summaryLabel,
  isLoading = false,
}: ProgressSummaryChartProps) {
  const prefersReducedMotion = useReducedMotion()

  if (isLoading) {
    return (
      <Card className={todayCardVariants({ level: "primary" })}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  const normalizedProgress = Math.max(0, Math.min(100, progressPercent))
  const hasData = data.some((point) => point.completion > 0)
  const averageCompletion = data.length > 0 ? Math.round(data.reduce((sum, point) => sum + point.completion, 0) / data.length) : 0
  const isOnTrack = normalizedProgress >= 70

  return (
    <section aria-labelledby="today-progress-heading">
      <Card className={todayCardVariants({ level: "primary", interactive: true })}>
        <div className="pointer-events-none absolute -top-20 right-0 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle id="today-progress-heading" className="text-sm font-semibold text-foreground">
                Weekly progress
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{summaryLabel}</p>
            </div>
            <span className={todayStatusBadgeVariants({ tone: isOnTrack ? "positive" : "caution" })}>
              {isOnTrack ? "On track" : "Needs focus"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border/65 bg-background/70 p-3.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <span className="font-medium text-foreground">{Math.round(normalizedProgress)}%</span>
              </div>
              <Progress value={normalizedProgress} className="h-2.5" />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                {isOnTrack ? "Rhythm is healthy this week." : "One additional session gets you back on plan."}
              </p>
            </div>
            <div
              className="grid h-16 w-16 place-items-center rounded-full border border-border/70 bg-background"
              style={{
                backgroundImage: `conic-gradient(oklch(var(--primary)) ${normalizedProgress}%, oklch(var(--muted)) ${normalizedProgress}% 100%)`,
              }}
            >
              <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-xs font-semibold text-foreground">
                {Math.round(normalizedProgress)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className={todayTrendBadgeVariants({ tone: averageCompletion >= 60 ? "positive" : "neutral" })}>
              <Activity className="h-3 w-3" />
              Avg {averageCompletion}%
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              7-day trend
            </span>
          </div>

          {!hasData ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center">
              <p className="text-sm font-medium text-foreground">No completed sessions yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Start today&apos;s run to unlock your weekly trend chart.</p>
            </div>
          ) : (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { duration: 0.2 }}
              className="h-40 w-full rounded-2xl border border-border/65 bg-background/75 p-2"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 2 }}>
                  <defs>
                    <linearGradient id="todayProgressArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="oklch(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: "oklch(var(--muted-foreground))" }}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    cursor={{ stroke: "oklch(var(--primary))", strokeWidth: 1, strokeOpacity: 0.2 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-xl border border-border/80 bg-card px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-foreground">{label}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            Completion <span className="font-semibold text-foreground">{payload[0]?.value}%</span>
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completion"
                    stroke="oklch(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#todayProgressArea)"
                    activeDot={{ r: 4, strokeWidth: 0, fill: "oklch(var(--primary))" }}
                    dot={{ r: 2, strokeWidth: 0, fill: "oklch(var(--primary))" }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
