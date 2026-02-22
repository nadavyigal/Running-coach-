"use client"

import {
  Bar,
  BarChart,
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
import { formatShortDate, type DailyValuePoint, type GarminSleepStagePoint } from "@/lib/garminDashboardData"

interface GarminSleepAnalyticsProps {
  sleepStages7d: GarminSleepStagePoint[]
  sleepScoreTrend7d: DailyValuePoint[]
  confidenceBadge: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminSleepAnalytics({
  sleepStages7d,
  sleepScoreTrend7d,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminSleepAnalyticsProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="text-base">Sleep Analytics</CardTitle>
        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <p className="text-xs text-muted-foreground">
          Sleep stage mix and score trend may indicate recovery quality over the last week.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <Badge variant="secondary" className="text-xs">
          {confidenceBadge}
        </Badge>

        <div className="h-44 w-full" data-testid="garmin-sleep-stages-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sleepStages7d} margin={{ top: 8, right: 0, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value: number, key: string) => [Math.round(value ?? 0), key]}
              />
              <Bar dataKey="deep" stackId="sleep" fill="#6366f1" name="Deep" />
              <Bar dataKey="light" stackId="sleep" fill="#22d3ee" name="Light" />
              <Bar dataKey="rem" stackId="sleep" fill="#a78bfa" name="REM" />
              <Bar dataKey="awake" stackId="sleep" fill="#fca5a5" name="Awake" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-36 w-full" data-testid="garmin-sleep-score-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sleepScoreTrend7d} margin={{ top: 8, right: 0, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} width={32} domain={[0, 100]} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value: number) => [value ?? "n/a", "Sleep score"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0f766e"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#0f766e" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
