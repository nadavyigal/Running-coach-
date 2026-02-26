"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Activity, CalendarDays, Play, ShieldPlus, Sparkles } from "lucide-react"
import { todayCardVariants, todayStatusBadgeVariants } from "@/components/today/today-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Action = {
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: ReactNode
}

type HeroTone = "positive" | "caution" | "neutral" | "info"

interface DailyFocusCardProps {
  isLoading?: boolean
  dateLabel: string
  statusLabel: string
  statusTone?: HeroTone
  headline: string
  coachInsight: string
  primaryAction: Action
  secondaryActions?: Action[]
}

export function DailyFocusCard({
  isLoading = false,
  dateLabel,
  statusLabel,
  statusTone = "info",
  headline,
  coachInsight,
  primaryAction,
  secondaryActions = [],
}: DailyFocusCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const accentClassName = {
    positive: "from-emerald-200/70 via-emerald-100/40 to-transparent",
    caution: "from-amber-200/75 via-amber-100/45 to-transparent",
    neutral: "from-slate-200/70 via-slate-100/45 to-transparent",
    info: "from-sky-200/75 via-sky-100/45 to-transparent",
  }[statusTone]

  const signalClassName = {
    positive: "from-emerald-500 to-emerald-300",
    caution: "from-amber-500 to-amber-300",
    neutral: "from-slate-500 to-slate-300",
    info: "from-sky-500 to-sky-300",
  }[statusTone]

  if (isLoading) {
    return (
      <Card className={todayCardVariants({ level: "hero" })}>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.24 }}
      aria-labelledby="today-daily-focus-heading"
    >
      <Card className={todayCardVariants({ level: "hero", interactive: true })}>
        <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b", accentClassName)} />
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {dateLabel}
              </p>
              <h1 id="today-daily-focus-heading" className="mt-1 text-[1.85rem] font-semibold leading-tight tracking-tight text-foreground">
                {headline}
              </h1>
            </div>
            <Badge variant="outline" className={todayStatusBadgeVariants({ tone: statusTone })}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-border/65 bg-background/75 p-3.5">
            <div className="flex items-start gap-2">
              <ShieldPlus className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">Coach signal</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{coachInsight}</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative h-12 w-12 rounded-full border border-border/70 bg-background/90 p-[3px]">
                <div className="h-full w-full rounded-full bg-muted/50" />
                <div className={cn("absolute inset-[3px] rounded-full bg-gradient-to-tr opacity-80", signalClassName)} />
                <Sparkles className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="h-11 w-full justify-center gap-2 rounded-xl text-sm font-semibold"
              aria-label={primaryAction.label}
            >
              {primaryAction.icon ?? <Play className="h-4 w-4" />}
              {primaryAction.label}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {secondaryActions.slice(0, 2).map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="h-11 rounded-xl border-border/70 bg-background/85 text-xs sm:text-sm"
                  aria-label={action.label}
                >
                  {action.icon ? <span className="mr-1">{action.icon}</span> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Updated in real time as runs and recovery data sync.
          </p>
        </CardContent>
      </Card>
    </motion.section>
  )
}
