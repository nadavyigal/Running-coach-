"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

import { GarminAcwrChart } from "@/components/garmin-acwr-chart"
import { GarminHrvChart } from "@/components/garmin-hrv-chart"
import { GarminSyncStatusBar } from "@/components/garmin-sync-status-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  buildReadinessWhyLine,
  getAverageValue,
  getDataCoverageLabel,
  getLatestValue,
  getReadinessTone,
  getRestingHrBaseline,
  loadGarminDashboardData,
  type GarminDashboardData,
} from "@/lib/garminDashboardData"
import { syncGarminEnabledData } from "@/lib/garminSync"

interface GarminReadinessCardProps {
  userId: number
}

export function GarminReadinessCard({ userId }: GarminReadinessCardProps) {
  const [data, setData] = useState<GarminDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const loadCard = useCallback(async () => {
    const nextData = await loadGarminDashboardData(userId)
    setData(nextData)
  }, [userId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      try {
        const nextData = await loadGarminDashboardData(userId)
        if (!cancelled) setData(nextData)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [userId])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncGarminEnabledData(userId)
      await loadCard()
    } finally {
      setIsRefreshing(false)
    }
  }, [loadCard, userId])

  const summary = useMemo(() => {
    if (!data) return null

    const latestHrv = getLatestValue(data.hrvTrend7d)
    const hrvBaseline = data.hrvBaseline28
    const todayRestingHr = data.readinessDays.at(-1)?.restingHr ?? null
    const restingHrBaseline = getRestingHrBaseline(data.readinessDays)

    return {
      tone: getReadinessTone(data.readiness.score),
      whyLine: buildReadinessWhyLine({
        sleepScore: data.readinessDays.at(-1)?.sleepScore ?? null,
        todayHrv: latestHrv,
        baselineHrv: hrvBaseline,
        restingHr: todayRestingHr,
        restingHrBaseline,
      }),
      coverage: getDataCoverageLabel(data.readinessDays, 28),
      avgHrv: getAverageValue(data.hrvTrend7d),
    }
  }, [data])

  if (isLoading || !data || !summary) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Garmin readiness...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`mx-auto w-full max-w-md border ${summary.tone.panel}`} data-testid="garmin-readiness-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Garmin Readiness</CardTitle>
          <Badge
            className={summary.tone.chip}
            data-testid={`garmin-readiness-tone-${summary.tone.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {summary.tone.label}
          </Badge>
        </div>

        <GarminSyncStatusBar
          lastSyncAt={data.lastSyncAt}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          testId="garmin-readiness-sync-status"
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Today</p>
            <p className={`text-4xl font-bold ${summary.tone.accent}`} data-testid="garmin-readiness-score">
              {data.readiness.score}
            </p>
          </div>

          <div className="text-right">
            <Badge variant="secondary" className="text-xs">
              {data.confidenceBadge}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">{summary.coverage}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
          <p className="text-sm font-medium">{summary.whyLine}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.readiness.label}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          Your body may indicate this readiness based on recent recovery signals. Consider adjusting intensity if
          confidence is low.
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowDetails((value) => !value)}
            data-testid="garmin-readiness-details-toggle"
          >
            {showDetails ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-4 w-4" />
                See details
              </>
            )}
          </Button>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Disclaimer</summary>
            <p className="mt-1 max-w-[22rem]">
              This card is for training guidance only and is not medical advice. Stop if you feel pain or dizziness,
              and consult a qualified professional.
            </p>
          </details>
        </div>

        {summary.avgHrv != null ? (
          <p className="text-xs text-muted-foreground">7d HRV average: {summary.avgHrv.toFixed(1)} ms</p>
        ) : null}

        {showDetails ? (
          <div className="space-y-3 pt-1" data-testid="garmin-readiness-details">
            <GarminHrvChart
              hrvTrend7d={data.hrvTrend7d}
              hrvBaseline28={data.hrvBaseline28}
              confidenceBadge={data.confidenceBadge}
              lastSyncAt={data.lastSyncAt}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
            <GarminAcwrChart
              data={data.acwrTimeline}
              acwr={data.acwr}
              confidenceBadge={data.confidenceBadge}
              lastSyncAt={data.lastSyncAt}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
