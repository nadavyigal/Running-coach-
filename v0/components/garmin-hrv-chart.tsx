"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { formatShortDate, type DailyValuePoint } from "@/lib/garminDashboardData"

interface GarminHrvChartProps {
  hrvTrend7d: DailyValuePoint[]
  hrvBaseline28: number | null
  confidenceBadge: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminHrvChart({
  hrvTrend7d,
  hrvBaseline28,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminHrvChartProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="text-base">HRV Trend</CardTitle>
        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <p className="text-xs text-muted-foreground">
          HRV changes may indicate recovery shifts. Compare your 7-day trend with your 28-day baseline.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <Badge variant="secondary" className="text-xs">
          {confidenceBadge}
        </Badge>

        <div className="h-52 w-full" data-testid="garmin-hrv-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hrvTrend7d} margin={{ top: 10, right: 8, left: -8, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} width={36} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value: number) => [value?.toFixed?.(1) ?? value, "HRV"]}
              />

              {hrvBaseline28 != null ? (
                <ReferenceLine
                  y={hrvBaseline28}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: `28d baseline ${hrvBaseline28.toFixed(1)}`,
                    position: "insideTopRight",
                    fontSize: 10,
                  }}
                />
              ) : null}

              <Line
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#0ea5e9" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
