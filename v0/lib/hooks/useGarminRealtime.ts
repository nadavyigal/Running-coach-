'use client'

import { useEffect, useRef } from 'react'

import { useToast } from '@/hooks/use-toast'
import { db, type Run } from '@/lib/db'
import { updateRun } from '@/lib/dbUtils'
import { createClient } from '@/lib/supabase/client'

function isLocalDevelopmentHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function asDate(value: string | null | undefined): Date {
  const parsed = value ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function mapSupabaseRunToDexie(userId: number, row: Record<string, unknown>): Omit<Run, 'id'> {
  const route = Array.isArray(row.route) ? JSON.stringify(row.route) : undefined
  const completedAt = typeof row.completed_at === 'string' ? row.completed_at : null
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null

  return {
    userId,
    type: typeof row.type === 'string' ? (row.type as Run['type']) : 'easy',
    distance: Number(row.distance ?? 0),
    duration: Number(row.duration ?? 0),
    importSource: 'garmin',
    completedAt: asDate(completedAt),
    createdAt: asDate(typeof row.created_at === 'string' ? row.created_at : completedAt),
    updatedAt: asDate(updatedAt ?? completedAt),
    ...(typeof row.pace === 'number' ? { pace: row.pace } : {}),
    ...(typeof row.heart_rate === 'number' ? { heartRate: row.heart_rate } : {}),
    ...(typeof row.calories === 'number' ? { calories: row.calories } : {}),
    ...(typeof row.notes === 'string' ? { notes: row.notes } : {}),
    ...(route ? { route, gpsPath: route } : {}),
    ...(typeof row.source_activity_id === 'string' ? { importRequestId: row.source_activity_id } : {}),
  }
}

async function mirrorRecentGarminRunsToDexie(userId: number): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('source_provider', 'garmin')
    .order('completed_at', { ascending: false })
    .limit(10)

  if (error) {
    throw error
  }

  let imported = 0

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const importRequestId = typeof row.source_activity_id === 'string' ? row.source_activity_id : null
    if (!importRequestId) continue

    const mappedRun = mapSupabaseRunToDexie(userId, row)
    const existing = await db.runs
      .where('[userId+importRequestId]' as never)
      .equals([userId, importRequestId] as never)
      .first()

    if (existing?.id) {
      await updateRun(existing.id, mappedRun)
    } else {
      await db.runs.add(mappedRun as Run)
      imported += 1
    }
  }

  return imported
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
      console.warn('[useGarminRealtime] Skipping realtime subscription due to unsupported browser context')
      return
    }

    let supabase: ReturnType<typeof createClient> | null = null
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    const refreshFromServer = async () => {
      if (syncInFlightRef.current) return

      syncInFlightRef.current = true
      try {
        const imported = await mirrorRecentGarminRunsToDexie(userId)
        if (imported > 0) {
          toast({
            title: 'New Garmin run synced',
            description: 'Your latest Garmin Connect activity is now in RunSmart.',
          })
        }
        window.dispatchEvent(new Event('garmin-run-synced'))
        window.dispatchEvent(new Event('plan-updated'))
        void triggerRunReportsForNewGarminRuns(userId)
      } catch (error) {
        console.warn('[useGarminRealtime] Failed to refresh Garmin runs from Supabase:', error)
      } finally {
        syncInFlightRef.current = false
      }
    }

    try {
      supabase = createClient()
      channel = supabase
        .channel('garmin-runs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'runs',
            filter: 'source_provider=eq.garmin',
          },
          async () => {
            await refreshFromServer()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'garmin_connections',
            filter: `user_id=eq.${userId}`,
          },
          async () => {
            await refreshFromServer()
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

    void refreshFromServer()

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [toast, userId])
}
