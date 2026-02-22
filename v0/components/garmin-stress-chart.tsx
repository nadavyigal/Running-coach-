"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { formatShortDate, type GarminStressPoint } from "@/lib/garminDashboardData"

interface GarminStressChartProps {
  stressActive7d: GarminStressPoint[]
  confidenceBadge: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminStressChart({
  stressActive7d,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminStressChartProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="text-base">Stress vs Active Minutes</CardTitle>
        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <p className="text-xs text-muted-foreground">
          Stress and movement together may indicate whether load is manageable across the week.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <Badge variant="secondary" className="text-xs">
          {confidenceBadge}
        </Badge>

        <div className="h-48 w-full" data-testid="garmin-stress-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stressActive7d} margin={{ top: 8, right: 0, left: -16, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis yAxisId="stress" orientation="left" domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
              <YAxis yAxisId="active" orientation="right" tick={{ fontSize: 11 }} width={34} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value: number, key: string) => {
                  if (key === "activeMinutes") return [Math.round(value ?? 0), "Active min"]
                  return [Math.round(value ?? 0), "Stress"]
                }}
              />
              <Bar yAxisId="stress" dataKey="stress" fill="#f97316" name="Stress" radius={[4, 4, 0, 0]} />
              <Bar
                yAxisId="active"
                dataKey="activeMinutes"
                fill="#0ea5e9"
                name="Active minutes"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
