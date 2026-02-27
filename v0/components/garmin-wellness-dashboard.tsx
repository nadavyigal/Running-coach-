"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Loader2 } from "lucide-react"

import { GarminBodyBatteryCard } from "@/components/garmin-body-battery-card"
import { GarminSleepAnalytics } from "@/components/garmin-sleep-analytics"
import { GarminSpO2Card } from "@/components/garmin-spo2-card"
import { GarminStressChart } from "@/components/garmin-stress-chart"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatShortDate,
  loadGarminDashboardData,
  type DailyValuePoint,
  type GarminDashboardData,
  type GarminSleepStagePoint,
  type GarminStressPoint,
} from "@/lib/garminDashboardData"
import { syncGarminEnabledData } from "@/lib/garminSync"

type RangeDays = 7 | 28 | 90

interface GarminWellnessDashboardProps {
  userId: number
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(base + deltaDays * dayMs).toISOString().slice(0, 10)
}

function buildDateRange(endDateIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftIsoDate(endDateIso, -(days - 1 - index)))
}

function getTrend(values: Array<number | null>): "up" | "down" | "flat" {
  const valid = values.filter((value): value is number => value != null)
  if (valid.length < 2) return "flat"
  const first = valid.at(0)
  const last = valid.at(-1)
  if (first == null || last == null) return "flat"
  if (last > first + 1) return "up"
  if (last < first - 1) return "down"
  return "flat"
}

function buildWindowedData(data: GarminDashboardData, rangeDays: RangeDays): {
  bodyBattery: DailyValuePoint[]
  sleepStages: GarminSleepStagePoint[]
  sleepScores: DailyValuePoint[]
  spo2: DailyValuePoint[]
  stressActive: GarminStressPoint[]
} {
  const dates = buildDateRange(data.endDateIso, rangeDays)
  const byDate = new Map(data.timeline.map((entry) => [entry.date, entry]))

  return {
    bodyBattery: dates.map((date) => ({
      date,
      value: byDate.get(date)?.bodyBattery ?? null,
      source: byDate.get(date)?.bodyBatterySource ?? "none",
      fallbackBalance: byDate.get(date)?.bodyBatteryBalance ?? null,
    })),
    sleepStages: dates.map((date) => ({
      date,
      deep: byDate.get(date)?.deepSleep ?? 0,
      light: byDate.get(date)?.lightSleep ?? 0,
      rem: byDate.get(date)?.remSleep ?? 0,
      awake: byDate.get(date)?.awakeSleep ?? 0,
      score: byDate.get(date)?.sleepScore ?? null,
    })),
    sleepScores: dates.map((date) => ({
      date,
      value: byDate.get(date)?.sleepScore ?? null,
    })),
    spo2: dates.map((date) => ({
      date,
      value: byDate.get(date)?.spo2 ?? null,
    })),
    stressActive: dates.map((date) => ({
      date,
      stress: byDate.get(date)?.stress ?? null,
      activeMinutes: byDate.get(date)?.activeMinutes ?? null,
    })),
  }
}

export function GarminWellnessDashboard({ userId }: GarminWellnessDashboardProps) {
  const [data, setData] = useState<GarminDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [rangeDays, setRangeDays] = useState<RangeDays>(7)
  const [weeklyInsightText, setWeeklyInsightText] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    const nextData = await loadGarminDashboardData(userId)
    setData(nextData)
  }, [userId])

  const loadWeeklyInsight = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai/garmin-insights?userId=${userId}&type=weekly`)
      if (!response.ok) {
        setWeeklyInsightText(null)
        return
      }
      const payload = (await response.json()) as {
        insight?: { text?: string | null } | null
      }
      const text = payload?.insight?.text?.trim()
      setWeeklyInsightText(text && text.length > 0 ? text : null)
    } catch {
      setWeeklyInsightText(null)
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      try {
        const [nextData] = await Promise.all([loadGarminDashboardData(userId), loadWeeklyInsight()])
        if (!cancelled) {
          setData(nextData)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [loadWeeklyInsight, userId])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncGarminEnabledData(userId)
      await Promise.all([loadDashboard(), loadWeeklyInsight()])
    } finally {
      setIsRefreshing(false)
    }
  }, [loadDashboard, loadWeeklyInsight, userId])

  const windowed = useMemo(() => {
    if (!data) return null
    return buildWindowedData(data, rangeDays)
  }, [data, rangeDays])

  const reportSummary = useMemo(() => {
    if (!windowed) return null
    const bodyBatteryTrend = getTrend(windowed.bodyBattery.map((point) => point.value))
    const sleepTrend = getTrend(windowed.sleepScores.map((point) => point.value))
    const spo2Trend = getTrend(windowed.spo2.map((point) => point.value))
    const stressTrend = getTrend(windowed.stressActive.map((point) => point.stress))

    const trendLabel = (trend: "up" | "down" | "flat", positiveWhenUp = true) => {
      if (trend === "flat") return "stable"
      if (positiveWhenUp) return trend === "up" ? "improving" : "declining"
      return trend === "up" ? "increasing" : "decreasing"
    }

    return {
      headline: `Wellness report (${rangeDays}d): body battery is ${trendLabel(bodyBatteryTrend)}, sleep is ${trendLabel(sleepTrend)}, and stress is ${trendLabel(stressTrend, false)}.`,
      details: [
        `SpO2 trend appears ${trendLabel(spo2Trend)} over this window.`,
        `Insights are based on ${rangeDays} days and may indicate trends rather than clinical outcomes.`,
        "Consider easy training if stress keeps increasing while sleep and body battery decline.",
      ],
    }
  }, [rangeDays, windowed])

  if (isLoading || !data || !windowed) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Garmin wellness metrics...
        </CardContent>
      </Card>
    )
  }

  const lastDate = formatShortDate(data.endDateIso)
  const bodyBatteryToday = data.bodyBatteryToday
  const bodyBatteryTodaySource = data.bodyBatteryTodaySource
  const bodyBatteryTodayBalance = data.bodyBatteryTodayBalance
  const spo2LastNight = windowed.spo2.at(-1)?.value ?? null

  return (
    <div className="mx-auto w-full max-w-md space-y-4" data-testid="garmin-wellness-dashboard">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Wellness Insights</CardTitle>
            <Badge variant="outline">Updated through {lastDate}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[7, 28, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days as RangeDays)}
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  rangeDays === days
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {reportSummary ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">Weekly report card (AI-generated)</summary>
          {weeklyInsightText ? (
            <p className="mt-2" data-testid="weekly-ai-insight-text">
              {weeklyInsightText}
            </p>
          ) : (
            <>
              <p className="mt-2">{reportSummary.headline}</p>
              {reportSummary.details.map((detail) => (
                <p key={detail} className="mt-1 text-xs">
                  {detail}
                </p>
              ))}
            </>
          )}
        </details>
      ) : null}

      <Tabs defaultValue="body-battery" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="body-battery">Body</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="spo2">SpO2</TabsTrigger>
          <TabsTrigger value="stress">Stress</TabsTrigger>
        </TabsList>

        <TabsContent value="body-battery" className="mt-3">
          <GarminBodyBatteryCard
            todayValue={bodyBatteryToday}
            todaySource={bodyBatteryTodaySource}
            fallbackBalance={bodyBatteryTodayBalance}
            trend7d={windowed.bodyBattery}
            confidenceBadge={data.confidenceBadge}
            lastSyncAt={data.lastSyncAt}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </TabsContent>

        <TabsContent value="sleep" className="mt-3">
          <GarminSleepAnalytics
            sleepStages7d={windowed.sleepStages}
            sleepScoreTrend7d={windowed.sleepScores}
            confidenceBadge={data.confidenceBadge}
            lastSyncAt={data.lastSyncAt}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </TabsContent>

        <TabsContent value="spo2" className="mt-3">
          <GarminSpO2Card
            spo2LastNight={spo2LastNight}
            spo2Trend7d={windowed.spo2}
            confidenceBadge={data.confidenceBadge}
            lastSyncAt={data.lastSyncAt}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </TabsContent>

        <TabsContent value="stress" className="mt-3">
          <GarminStressChart
            stressActive7d={windowed.stressActive}
            confidenceBadge={data.confidenceBadge}
            lastSyncAt={data.lastSyncAt}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
