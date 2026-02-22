"use client"

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { formatShortDate, type GarminAcwrTimelinePoint } from "@/lib/garminDashboardData"
import type { GarminAcwrMetrics } from "@/lib/garminAcwr"

interface GarminAcwrChartProps {
  data: GarminAcwrTimelinePoint[]
  acwr: GarminAcwrMetrics
  confidenceBadge?: string
  lastSyncAt: Date | null
  onRefresh?: () => Promise<void> | void
  isRefreshing?: boolean
}

export function GarminAcwrChart({
  data,
  acwr,
  confidenceBadge,
  lastSyncAt,
  onRefresh,
  isRefreshing = false,
}: GarminAcwrChartProps) {
  const resolvedConfidenceBadge =
    confidenceBadge ??
    (acwr.evidence.confidence === "low"
      ? `Low confidence: missing training data for ${acwr.evidence.missingDays} days`
      : `Confidence: ${acwr.evidence.confidence}`)

  const zoneLabel =
    acwr.zone === "sweet_zone"
      ? "Sweet zone"
      : acwr.zone === "underload"
        ? "Underload"
        : acwr.zone === "elevated"
          ? "Elevated"
          : "High"

  return (
    <Card className="mx-auto w-full max-w-md" data-testid="garmin-acwr-chart">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Training Load (ACWR)</CardTitle>
          <Badge variant="outline">{zoneLabel}</Badge>
        </div>

        <GarminSyncStatusBar lastSyncAt={lastSyncAt} onRefresh={onRefresh} isRefreshing={isRefreshing} />

        <p className="text-xs text-muted-foreground">
          Acute vs chronic load may indicate current strain, based on 4 weeks of data.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800" data-testid="garmin-acwr-danger-zone">
            Danger zone &gt; 1.5
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {resolvedConfidenceBadge}
          </Badge>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 11 }}
                interval={6}
                minTickGap={10}
              />
              <YAxis
                yAxisId="load"
                tick={{ fontSize: 11 }}
                width={36}
                domain={[0, "auto"]}
              />
              <YAxis
                yAxisId="ratio"
                orientation="right"
                tick={{ fontSize: 11 }}
                width={34}
                domain={[0, 2.2]}
              />

              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "acwr") return [value?.toFixed?.(2) ?? value, "ACWR"]
                  return [Math.round(value ?? 0), name === "acute" ? "Acute" : "Chronic"]
                }}
                labelFormatter={(label) => `Week of ${formatShortDate(String(label))}`}
              />

              <ReferenceArea yAxisId="ratio" y1={0} y2={0.8} fill="#dbeafe" fillOpacity={0.3} />
              <ReferenceArea yAxisId="ratio" y1={0.8} y2={1.3} fill="#dcfce7" fillOpacity={0.3} />
              <ReferenceArea yAxisId="ratio" y1={1.3} y2={1.5} fill="#fef3c7" fillOpacity={0.35} />
              <ReferenceArea yAxisId="ratio" y1={1.5} y2={2.2} fill="#fee2e2" fillOpacity={0.35} />
              <ReferenceLine yAxisId="ratio" y={1.5} stroke="#dc2626" strokeDasharray="4 4" />

              <Line
                yAxisId="load"
                type="monotone"
                dataKey="acute"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="acute"
              />
              <Line
                yAxisId="load"
                type="monotone"
                dataKey="chronic"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
                name="chronic"
              />
              <Line
                yAxisId="ratio"
                type="monotone"
                dataKey="acwr"
                stroke="#7c3aed"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
                name="acwr"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <summary className="cursor-pointer font-medium">Load disclaimer</summary>
          <p className="mt-2">
            This chart may indicate load risk, not injury certainty. Consider easier training when ACWR stays high.
            This is not medical advice.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}
