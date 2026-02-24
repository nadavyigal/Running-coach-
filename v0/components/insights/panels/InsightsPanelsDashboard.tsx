'use client'

import { useEffect, useMemo, useState } from 'react'

import type { Run } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'
import type { ReadinessApiResponse } from '@/lib/garmin/metrics/readiness'

import { ConsistencyPanel } from '@/components/insights/panels/ConsistencyPanel'
import { DataQualityPanel } from '@/components/insights/panels/DataQualityPanel'
import { LoadPanel } from '@/components/insights/panels/LoadPanel'
import { PerformancePanel } from '@/components/insights/panels/PerformancePanel'
import { ReadinessPanel } from '@/components/insights/panels/ReadinessPanel'
import { RecentRunPanel } from '@/components/insights/panels/RecentRunPanel'
import { RecoveryPanel } from '@/components/insights/panels/RecoveryPanel'

interface InsightsPanelsDashboardProps {
  userId: number
  runsCompleted: number
  plannedRuns: number
  consistencyRate: number
  goalProgress: number
  goalTrajectory: string | null
}

export function InsightsPanelsDashboard({
  userId,
  runsCompleted,
  plannedRuns,
  consistencyRate,
  goalProgress,
  goalTrajectory,
}: InsightsPanelsDashboardProps) {
  const [readiness, setReadiness] = useState<ReadinessApiResponse | null>(null)
  const [recentRun, setRecentRun] = useState<Run | null>(null)
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingReadiness(true)
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
        if (!cancelled) setIsLoadingReadiness(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false

    const loadRecentRun = async () => {
      const runs = await dbUtils.getRunsByUser(userId)
      if (!cancelled) {
        setRecentRun(runs[0] ?? null)
      }
    }

    void loadRecentRun()

    return () => {
      cancelled = true
    }
  }, [userId])

  const normalizedConsistency = useMemo(() => Math.max(0, Math.min(100, consistencyRate)), [consistencyRate])

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ReadinessPanel readiness={readiness} loading={isLoadingReadiness} />
      <RecoveryPanel readiness={readiness} />
      <LoadPanel readiness={readiness} />
      <ConsistencyPanel
        runsCompleted={runsCompleted}
        plannedRuns={plannedRuns}
        consistencyRate={normalizedConsistency}
      />
      <PerformancePanel goalProgress={goalProgress} goalTrajectory={goalTrajectory} />
      <RecentRunPanel run={recentRun} />
      <DataQualityPanel readiness={readiness} />
    </div>
  )
}
