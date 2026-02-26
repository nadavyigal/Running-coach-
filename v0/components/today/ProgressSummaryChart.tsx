"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

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
  if (isLoading) {
    return (
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <section aria-labelledby="today-progress-heading">
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle id="today-progress-heading" className="text-sm font-semibold text-foreground">
            Weekly progress
          </CardTitle>
          <p className="text-xs text-muted-foreground">{summaryLabel}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion</span>
              <span className="font-medium text-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={Math.max(0, Math.min(100, progressPercent))} className="h-2" />
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "oklch(var(--muted))", opacity: 0.2 }}
                  formatter={(value) => [`${value}%`, "Completion"]}
                />
                <Bar dataKey="completion" fill="oklch(var(--primary))" radius={[8, 8, 2, 2]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
