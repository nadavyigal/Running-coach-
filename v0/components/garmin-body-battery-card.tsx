"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { clampScore, formatShortDate, type DailyValuePoint } from "@/lib/garminDashboardData"

interface GarminBodyBatteryCardProps {
  todayValue: number | null
  todayStart: number | null
  todayPeak: number | null
  todayEnd: number | null
  todaySource: "direct" | "balance" | "none"
  fallbackBalance: number | null
  trend7d: DailyValuePoint[]
  confidenceBadge: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminBodyBatteryCard({
  todayValue,
  todayStart,
  todayPeak,
  todayEnd,
  todaySource,
  fallbackBalance,
  trend7d,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminBodyBatteryCardProps) {
  const score = todayEnd != null ? clampScore(todayEnd) : todayValue != null ? clampScore(todayValue) : null
  const hasDailySummary = todayStart != null || todayPeak != null || todayEnd != null
  const fallbackLabel =
    todaySource === "balance" && fallbackBalance != null
      ? `Net ${fallbackBalance >= 0 ? "+" : ""}${fallbackBalance.toFixed(0)}`
      : null

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Body Battery</CardTitle>
          <Badge className="bg-sky-100 text-sky-800">{score != null ? `${score} ⚡` : "n/a"}</Badge>
        </div>

        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Today&apos;s level may indicate available energy. Consider easier work if this stays low.
        </p>
        {hasDailySummary ? (
          <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Start</p>
              <p className="text-sm font-semibold">{todayStart ?? "n/a"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Peak</p>
              <p className="text-sm font-semibold">{todayPeak ?? "n/a"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">End</p>
              <p className="text-sm font-semibold">{todayEnd ?? score ?? "n/a"}</p>
            </div>
          </div>
        ) : null}
        {fallbackLabel ? (
          <p className="text-xs text-muted-foreground">
            Direct Body Battery was unavailable. Showing wellness balance fallback: {fallbackLabel}.
          </p>
        ) : null}

        <Badge variant="secondary" className="text-xs">
          {confidenceBadge}
        </Badge>
        <p className="text-[11px] text-muted-foreground">Body Battery metrics provided by Garmin.</p>

        <div className="h-24 w-full" data-testid="garmin-body-battery-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend7d} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="bodyBatteryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <Tooltip
                formatter={(value: number) => [value ?? "n/a", "Body Battery"]}
                labelFormatter={(value) => formatShortDate(String(value))}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#bodyBatteryGradient)"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
