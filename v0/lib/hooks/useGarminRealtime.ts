'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/db'
import { updateRun } from '@/lib/dbUtils'
import { syncGarminEnabledData } from '@/lib/garminSync'
import { createClient } from '@/lib/supabase/client'

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

async function triggerRunReportsForNewGarminRuns(userId: number): Promise<void> {
  try {
    const garminRuns = await db.runs
      .where('userId')
      .equals(userId)
      .filter((run) => run.importSource === 'garmin' && !run.runReport)
      .toArray()

    const recentRuns = garminRuns
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 3)

    for (const run of recentRuns) {
      if (!run.id) continue

      fetch('/api/run-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: {
            id: run.id,
            type: run.type,
            distanceKm: run.distance,
            durationSeconds: run.duration,
            completedAt: run.completedAt,
            heartRateBpm: run.heartRate ?? null,
            calories: run.calories ?? null,
          },
        }),
      })
        .then((r) => r.json())
        .then(async (data: { report: unknown; source: string }) => {
          if (!run.id) return
          await updateRun(run.id, {
            runReport: JSON.stringify(data.report),
            runReportSource: data.source as 'ai' | 'fallback',
            runReportCreatedAt: new Date(),
          })
          window.dispatchEvent(new CustomEvent('run-report-ready', { detail: { runId: run.id } }))
        })
        .catch((err) => {
          console.warn('[useGarminRealtime] Failed to generate run report:', err)
        })
    }
  } catch (err) {
    console.warn('[useGarminRealtime] Failed to query Garmin runs for report generation:', err)
  }
}

export function useGarminRealtime(userId: number | null) {
  const { toast } = useToast()
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const hostname = window.location.hostname
    const hasWebSocket = typeof window.WebSocket !== 'undefined'
    const secureEnough = window.isSecureContext || isLocalDevelopmentHost(hostname)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const hasMixedContentRisk = window.location.protocol === 'https:' && /^http:\/\//i.test(supabaseUrl)

    if (!hasWebSocket || !secureEnough || hasMixedContentRisk) {
      console.warn(
        '[useGarminRealtime] Skipping realtime subscription due to unsupported browser context',
        {
          hasWebSocket,
          secureEnough,
          hasMixedContentRisk,
          protocol: window.location.protocol,
        }
      )
      return
    }

    let supabase: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    try {
      supabase = createClient()
      channel = supabase
        .channel('garmin-activities')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'garmin_activities',
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            if (syncInFlightRef.current) return

            syncInFlightRef.current = true
            try {
              await syncGarminEnabledData(userId)
              toast({
                title: 'New Garmin run synced',
                description: 'Your latest activity is now in RunSmart.',
              })
              window.dispatchEvent(new Event('garmin-run-synced'))
              window.dispatchEvent(new Event('plan-updated'))

              // Auto-generate run reports for newly imported Garmin runs that don't have one yet
              void triggerRunReportsForNewGarminRuns(userId)
            } catch (error) {
              console.warn('[useGarminRealtime] Failed to sync Garmin activity:', error)
            } finally {
              syncInFlightRef.current = false
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useGarminRealtime] Supabase realtime channel error')
          }
        })
    } catch (error) {
      console.warn('[useGarminRealtime] Failed to initialize realtime subscription:', error)
      return
    }

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [toast, userId])
}

