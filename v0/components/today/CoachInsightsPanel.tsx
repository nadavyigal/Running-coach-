"use client"

import { motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
    icon: typeof CheckCircle2
  }
> = {
  good: {
    label: "Good",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    icon: CheckCircle2,
  },
  caution: {
    label: "Caution",
    className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    icon: AlertCircle,
  },
  action: {
    label: "Action",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    icon: Lightbulb,
  },
}

export function CoachInsightsPanel({ insights, isLoading = false }: CoachInsightsPanelProps) {
  if (isLoading) {
    return (
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-2 rounded-xl border border-border/60 p-3">
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
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle id="today-coach-insights-heading" className="text-sm font-semibold">
            Coach insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.slice(0, 3).map((insight, idx) => {
            const meta = severityMeta[insight.severity]
            const Icon = meta.icon
            return (
              <motion.article
                key={insight.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="rounded-xl border border-border/60 bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{insight.message}</p>
              </motion.article>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}
