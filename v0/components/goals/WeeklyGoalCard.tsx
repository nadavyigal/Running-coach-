'use client'

import { useEffect, useMemo, useState } from 'react'

import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'
import { recommendDailyGoal } from '@/lib/goals/recommendDailyGoal'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface WeeklyGoalCardProps {
  userId: number
  runsCompleted: number
  plannedRuns: number
}

export function WeeklyGoalCard({ userId, runsCompleted, plannedRuns }: WeeklyGoalCardProps) {
  const [readiness, setReadiness] = useState<ReadinessApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadReadiness = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/garmin/metrics/readiness?userId=${encodeURIComponent(String(userId))}`, {
          headers: {
            'x-user-id': String(userId),
          },
        })

        if (!response.ok) {
          if (!cancelled) setReadiness(null)
          return
        }

        const payload = (await response.json()) as ReadinessApiResponse
        if (!cancelled) setReadiness(payload)
      } catch {
        if (!cancelled) setReadiness(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadReadiness()

    return () => {
      cancelled = true
    }
  }, [userId])

  const recommendation = useMemo(
    () => recommendDailyGoal({ readiness, runsCompleted, plannedRuns }),
    [plannedRuns, readiness, runsCompleted]
  )

  return (
    <Card data-testid="weekly-goal-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{recommendation.title}</span>
          <Badge variant={recommendation.confidenceGateMet ? 'default' : 'secondary'}>
            {loading ? 'loading' : readiness?.confidence ?? 'low'}
          </Badge>
        </CardTitle>
        <CardDescription>{recommendation.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          Weekly target: <strong>{recommendation.targetRunsThisWeek}</strong> runs
        </p>
        <p>
          Remaining this week: <strong>{recommendation.remainingRunsThisWeek}</strong>
        </p>
        <p>
          Today focus: <span className="text-muted-foreground">{recommendation.todayFocus}</span>
        </p>
      </CardContent>
    </Card>
  )
}
