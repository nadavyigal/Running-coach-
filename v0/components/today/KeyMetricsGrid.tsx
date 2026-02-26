"use client"

import { MetricCard, type MetricCardData } from "@/components/today/MetricCard"
import { todayStatusBadgeVariants } from "@/components/today/today-ui"

export type KeyMetric = MetricCardData

interface KeyMetricsGridProps {
  metrics: MetricCardData[]
  isLoading?: boolean
}

export function KeyMetricsGrid({ metrics, isLoading = false }: KeyMetricsGridProps) {
  return (
    <section aria-labelledby="today-key-metrics-heading" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 id="today-key-metrics-heading" className="text-sm font-semibold text-foreground">
          Key metrics
        </h2>
        <span className={todayStatusBadgeVariants({ tone: "info" })}>Live snapshot</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(isLoading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `loading-${idx}`, label: "", value: "", helper: "" })) : metrics).map(
          (metric, index) => (
            <MetricCard key={metric.id} metric={metric} index={index} isLoading={isLoading} />
          )
        )}
      </div>
    </section>
  )
}
