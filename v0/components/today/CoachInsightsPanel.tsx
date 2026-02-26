"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AlertCircle, CheckCircle2, Lightbulb, Sparkles } from "lucide-react"
import { todayCardVariants, todayStatusBadgeVariants } from "@/components/today/today-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type InsightSeverity = "good" | "caution" | "action"

export type CoachInsight = {
  id: string
  title: string
  message: string
  severity: InsightSeverity
}

interface CoachInsightsPanelProps {
  insights: CoachInsight[]
  isLoading?: boolean
}

const severityMeta: Record<
  InsightSeverity,
  {
    label: string
    className: string
    tone: "positive" | "caution" | "neutral" | "info"
    icon: typeof CheckCircle2
  }
> = {
  good: {
    label: "Good",
    className: "border-emerald-200/75 bg-emerald-50/70 text-emerald-900",
    tone: "positive",
    icon: CheckCircle2,
  },
  caution: {
    label: "Caution",
    className: "border-amber-200/80 bg-amber-50/75 text-amber-900",
    tone: "caution",
    icon: AlertCircle,
  },
  action: {
    label: "Action",
    className: "border-sky-200/80 bg-sky-50/75 text-sky-900",
    tone: "info",
    icon: Lightbulb,
  },
}

export function CoachInsightsPanel({ insights, isLoading = false }: CoachInsightsPanelProps) {
  const prefersReducedMotion = useReducedMotion()

  if (isLoading) {
    return (
      <Card className={todayCardVariants({ level: "primary" })}>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-2 rounded-2xl border border-border/60 p-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <section aria-labelledby="today-coach-insights-heading">
      <Card className={todayCardVariants({ level: "primary" })}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="today-coach-insights-heading" className="text-sm font-semibold">
              Coach insights
            </CardTitle>
            <span className={todayStatusBadgeVariants({ tone: "info" })}>AI guided</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length > 0 ? (
            insights.slice(0, 3).map((insight, idx) => {
              const meta = severityMeta[insight.severity]
              const Icon = meta.icon
              return (
                <motion.article
                  key={insight.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={prefersReducedMotion ? undefined : { duration: 0.2, delay: idx * 0.04 }}
                  className={cn("rounded-2xl border p-3.5", meta.className)}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <h3 className="text-sm font-semibold">{insight.title}</h3>
                    </div>
                    <Badge variant="outline" className={todayStatusBadgeVariants({ tone: meta.tone })}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{insight.message}</p>
                </motion.article>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border/65 bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Insights will appear after your next workout
              </p>
              <p className="mt-1.5">Record a run or sync your wearable data to unlock personalized coach guidance.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
