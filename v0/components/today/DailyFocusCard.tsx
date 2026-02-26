"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { Play, ShieldPlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Action = {
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: ReactNode
}

interface DailyFocusCardProps {
  isLoading?: boolean
  dateLabel: string
  statusLabel: string
  headline: string
  coachInsight: string
  primaryAction: Action
  secondaryActions?: Action[]
}

export function DailyFocusCard({
  isLoading = false,
  dateLabel,
  statusLabel,
  headline,
  coachInsight,
  primaryAction,
  secondaryActions = [],
}: DailyFocusCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border/70 bg-card">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      aria-labelledby="today-daily-focus-heading"
    >
      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{dateLabel}</p>
              <h1 id="today-daily-focus-heading" className="mt-1 text-2xl font-semibold text-foreground">
                {headline}
              </h1>
            </div>
            <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {statusLabel}
            </Badge>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
            <div className="flex items-start gap-2">
              <ShieldPlus className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-emerald-900">{coachInsight}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="h-11 w-full justify-center gap-2 text-sm font-semibold"
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
                  className="h-11 text-xs sm:text-sm"
                  aria-label={action.label}
                >
                  {action.icon ? <span className="mr-1">{action.icon}</span> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  )
}
