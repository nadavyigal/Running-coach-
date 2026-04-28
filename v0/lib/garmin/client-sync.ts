'use client'

import { db, type Run } from '@/lib/db'
import { updateRun } from '@/lib/dbUtils'

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

export async function mirrorRecentGarminRunsToDexie(userId: number): Promise<number> {
  const response = await fetch(`/api/devices/garmin/runs?userId=${encodeURIComponent(String(userId))}&limit=50`, {
    method: 'GET',
    headers: { 'x-user-id': String(userId) },
    credentials: 'include',
  })

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    runs?: Array<Record<string, unknown>>
    error?: string
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error ?? 'Failed to load Garmin runs from RunSmart')
  }

  let imported = 0

  for (const row of payload.runs ?? []) {
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

export async function triggerRunReportsForNewGarminRuns(userId: number): Promise<void> {
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
          console.warn('[garmin-client-sync] Failed to generate run report:', err)
        })
    }
  } catch (err) {
    console.warn('[garmin-client-sync] Failed to query Garmin runs for report generation:', err)
  }
}

export async function syncGarminRunsToClient(userId: number): Promise<{ imported: number }> {
  const imported = await mirrorRecentGarminRunsToDexie(userId)
  window.dispatchEvent(new CustomEvent('garmin-sync-complete', { detail: { userId, imported } }))
  window.dispatchEvent(new Event('garmin-run-synced'))
  window.dispatchEvent(new Event('garmin-dashboard-refresh'))
  window.dispatchEvent(new Event('garmin-readiness-refresh'))
  window.dispatchEvent(new Event('today-refresh'))
  window.dispatchEvent(new Event('recovery-refresh'))
  window.dispatchEvent(new Event('plan-updated'))
  void triggerRunReportsForNewGarminRuns(userId)
  return { imported }
}
