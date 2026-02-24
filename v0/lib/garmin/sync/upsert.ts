import 'server-only'

import type { GarminNormalizedActivity } from '@/lib/garmin/normalize/normalizeActivity'
import type { GarminNormalizedDailyMetric } from '@/lib/garmin/normalize/normalizeDaily'
import { createAdminClient } from '@/lib/supabase/admin'

export interface GarminSyncUpsertResult {
  activitiesUpserted: number
  dailyMetricsUpserted: number
}

export interface GarminUpsertRepository {
  upsertActivities(rows: GarminNormalizedActivity[]): Promise<number>
  upsertDailyMetrics(rows: GarminNormalizedDailyMetric[]): Promise<number>
}

function dedupeByKey<T>(rows: T[], keySelector: (row: T) => string): T[] {
  const deduped = new Map<string, T>()
  for (const row of rows) {
    deduped.set(keySelector(row), row)
  }
  return Array.from(deduped.values())
}

function chunk<T>(rows: T[], size: number): T[][] {
  const buckets: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    buckets.push(rows.slice(index, index + size))
  }
  return buckets
}

export class SupabaseGarminUpsertRepository implements GarminUpsertRepository {
  async upsertActivities(rows: GarminNormalizedActivity[]): Promise<number> {
    const supabase = createAdminClient()
    for (const activityChunk of chunk(rows, 500)) {
      if (activityChunk.length === 0) continue
      const { error } = await supabase
        .from('garmin_activities')
        .upsert(activityChunk, { onConflict: 'user_id,activity_id' })
      if (error) {
        throw new Error(`Failed to upsert garmin_activities: ${error.message}`)
      }
    }
    return rows.length
  }

  async upsertDailyMetrics(rows: GarminNormalizedDailyMetric[]): Promise<number> {
    const supabase = createAdminClient()
    for (const dailyChunk of chunk(rows, 500)) {
      if (dailyChunk.length === 0) continue
      const { error } = await supabase
        .from('garmin_daily_metrics')
        .upsert(dailyChunk, { onConflict: 'user_id,date' })
      if (error) {
        throw new Error(`Failed to upsert garmin_daily_metrics: ${error.message}`)
      }
    }
    return rows.length
  }
}

export function dedupeGarminActivityRows(rows: GarminNormalizedActivity[]): GarminNormalizedActivity[] {
  return dedupeByKey(rows, (row) => `${row.user_id}:${row.activity_id}`)
}

export function dedupeGarminDailyRows(rows: GarminNormalizedDailyMetric[]): GarminNormalizedDailyMetric[] {
  return dedupeByKey(rows, (row) => `${row.user_id}:${row.date}`)
}

export async function upsertGarminSyncRows(input: {
  repository?: GarminUpsertRepository
  activities: GarminNormalizedActivity[]
  dailyMetrics: GarminNormalizedDailyMetric[]
}): Promise<GarminSyncUpsertResult> {
  const repository = input.repository ?? new SupabaseGarminUpsertRepository()

  const dedupedActivities = dedupeGarminActivityRows(input.activities)
  const dedupedDaily = dedupeGarminDailyRows(input.dailyMetrics)

  const [activitiesUpserted, dailyMetricsUpserted] = await Promise.all([
    repository.upsertActivities(dedupedActivities),
    repository.upsertDailyMetrics(dedupedDaily),
  ])

  return {
    activitiesUpserted,
    dailyMetricsUpserted,
  }
}

