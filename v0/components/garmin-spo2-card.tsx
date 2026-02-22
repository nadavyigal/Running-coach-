"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { clampScore, formatShortDate, type DailyValuePoint } from "@/lib/garminDashboardData"

interface GarminSpO2CardProps {
  spo2LastNight: number | null
  spo2Trend7d: DailyValuePoint[]
  confidenceBadge: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminSpO2Card({
  spo2LastNight,
  spo2Trend7d,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminSpO2CardProps) {
  const value = clampScore(spo2LastNight)
  const hasAmberFlag = spo2LastNight != null && spo2LastNight < 95

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Night SpO2</CardTitle>
          <Badge className={hasAmberFlag ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
            {value}%
          </Badge>
        </div>

        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Overnight oxygen values may indicate recovery strain when they trend lower for multiple nights.
        </p>

        {hasAmberFlag ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            Consider recovery check: below 95%
          </Badge>
        ) : null}

        <Badge variant="secondary" className="text-xs">
          {confidenceBadge}
        </Badge>

        <div className="h-40 w-full" data-testid="garmin-spo2-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spo2Trend7d} margin={{ top: 8, right: 0, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis domain={[88, 100]} tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(entry: number) => [entry ?? "n/a", "SpO2"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#2563eb" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
