"use client"

import { motion } from "framer-motion"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type MetricTone = "default" | "positive" | "caution"

export type KeyMetric = {
  id: string
  label: string
  value: string
  helper: string
  tone?: MetricTone
}

interface KeyMetricsGridProps {
  metrics: KeyMetric[]
  isLoading?: boolean
}

const toneClassName: Record<MetricTone, string> = {
  default: "text-foreground",
  positive: "text-emerald-700",
  caution: "text-amber-700",
}

export function KeyMetricsGrid({ metrics, isLoading = false }: KeyMetricsGridProps) {
  if (isLoading) {
    return (
      <section aria-label="Key metrics snapshot" className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="border-border/70">
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </section>
    )
  }

  return (
    <section aria-labelledby="today-key-metrics-heading" className="space-y-2">
      <h2 id="today-key-metrics-heading" className="text-sm font-semibold text-foreground">
        Key metrics
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.04 * index }}
          >
            <Card className="border-border/70 bg-card shadow-sm">
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
                <p className={cn("text-xl font-semibold", toneClassName[metric.tone ?? "default"])}>{metric.value}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{metric.helper}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
