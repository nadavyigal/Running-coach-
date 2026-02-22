'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type PmcPoint = {
  date: string
  atl: number | null
  ctl: number | null
  tsb: number | null
}

type PmcApiResponse = {
  points?: PmcPoint[]
}

function getFormStatus(tsb: number | null): string {
  if (tsb == null) return 'Unknown'
  if (tsb >= 10) return 'Fresh'
  if (tsb >= 0) return 'Optimal'
  if (tsb >= -10) return 'Tired'
  return 'Very Tired'
}

export function PerformanceManagementChart({ userId, days = 90 }: { userId: number; days?: number }) {
  const [points, setPoints] = useState<PmcPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/garmin/pmc?userId=${encodeURIComponent(String(userId))}&days=${encodeURIComponent(String(days))}`
        )

        if (!response.ok) {
          if (!cancelled) setPoints([])
          return
        }

        const data = (await response.json()) as PmcApiResponse
        if (!cancelled) {
          setPoints(Array.isArray(data.points) ? data.points : [])
        }
      } catch (error) {
        console.warn('[PerformanceManagementChart] Failed to load data:', error)
        if (!cancelled) setPoints([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [days, userId])

  const latest = useMemo(() => points.at(-1) ?? null, [points])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Performance Management Chart (PMC)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-foreground/60">Loading training load...</p>
        ) : points.length === 0 ? (
          <p className="text-sm text-foreground/60">No Garmin-derived load history available yet.</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip
                    formatter={(value: number | null, name: string) => {
                      const numeric = typeof value === 'number' ? value : null
                      if (name === 'ctl') return [numeric?.toFixed(1) ?? '--', 'Fitness (CTL)']
                      if (name === 'atl') return [numeric?.toFixed(1) ?? '--', 'Fatigue (ATL)']
                      return [numeric?.toFixed(1) ?? '--', 'Form (TSB)']
                    }}
                    labelFormatter={(label, payload) => {
                      const point = (payload?.[0]?.payload as PmcPoint | undefined) ?? null
                      const status = getFormStatus(point?.tsb ?? null)
                      return `${label} - ${status}`
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      if (value === 'ctl') return 'Fitness (CTL)'
                      if (value === 'atl') return 'Fatigue (ATL)'
                      return 'Form (TSB)'
                    }}
                  />
                  <Line type="monotone" dataKey="ctl" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="atl" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tsb" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-foreground/70">
              CTL shows long-term fitness, ATL shows short-term fatigue, and TSB (CTL - ATL) indicates readiness.
              {latest ? ` Current form: ${getFormStatus(latest.tsb)}.` : ''}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

