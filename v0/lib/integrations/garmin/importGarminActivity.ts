import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { mapGarminActivityToRun, isGarminRunLikeActivity } from '@/lib/integrations/garmin/mapGarminActivityToRun'
import type { GarminImportResult, GarminNormalizedActivity, GarminOAuthConnection } from '@/lib/integrations/garmin/types'

const START_TIME_TOLERANCE_MS = 10 * 60 * 1000
const DISTANCE_TOLERANCE_KM = 0.2
const DURATION_TOLERANCE_S = 120

async function findHeuristicDuplicate(params: {
  profileId: string
  completedAt: string
  distanceKm: number
  durationSeconds: number
}) {
  const supabase = createAdminClient()
  const center = new Date(params.completedAt).getTime()
  const from = new Date(center - START_TIME_TOLERANCE_MS).toISOString()
  const to = new Date(center + START_TIME_TOLERANCE_MS).toISOString()

  const { data, error } = await supabase
    .from('runs')
    .select('id,distance,duration,completed_at,source_provider,source_activity_id')
    .eq('profile_id', params.profileId)
    .gte('completed_at', from)
    .lte('completed_at', to)
    .limit(20)

  if (error) {
    throw new Error(`Failed to query runs for Garmin dedupe: ${error.message}`)
  }

  return (data ?? []).find((row) => {
    const distanceMatches = Math.abs(Number(row.distance ?? 0) - params.distanceKm) <= DISTANCE_TOLERANCE_KM
    const durationMatches = Math.abs(Number(row.duration ?? 0) - params.durationSeconds) <= DURATION_TOLERANCE_S
    return distanceMatches && durationMatches
  }) ?? null
}

export async function importGarminActivity(params: {
  connection: GarminOAuthConnection
  activity: GarminNormalizedActivity
  webhookEventId?: string | null
}): Promise<GarminImportResult> {
  if (!params.connection.profileId) {
    throw new Error(`Garmin connection ${params.connection.userId} is missing profile_id`)
  }

  if (!isGarminRunLikeActivity(params.activity)) {
    return {
      imported: false,
      duplicate: false,
      skipped: true,
      runId: null,
      sourceActivityId: params.activity.activityId,
      reason: 'non_run_activity',
    }
  }

  const supabase = createAdminClient()
  const runRow = mapGarminActivityToRun(params.activity, {
    profileId: params.connection.profileId,
    sourcePayloadRef:
      params.activity.sourcePayloadRef ??
      (params.webhookEventId ? `garmin_webhook_events:${params.webhookEventId}` : null),
  })

  const { error: activityError } = await supabase
    .from('garmin_activities')
    .upsert(
      {
        user_id: params.connection.userId,
        auth_user_id: params.connection.authUserId,
        activity_id: params.activity.activityId,
        start_time: new Date(params.activity.startTime).toISOString(),
        sport: params.activity.typeKey,
        duration_s: params.activity.durationSeconds,
        distance_m: params.activity.distanceMeters,
        avg_hr: params.activity.averageHeartRate,
        max_hr: params.activity.maxHeartRate,
        avg_pace: params.activity.averagePaceSecondsPerKm,
        elevation_gain_m: params.activity.elevationGainMeters,
        calories: params.activity.calories,
        source: 'garmin_auto_sync',
        raw_json: params.activity.raw,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,activity_id' }
    )

  if (activityError) {
    throw new Error(`Failed to upsert garmin_activities: ${activityError.message}`)
  }

  const heuristicDuplicate = await findHeuristicDuplicate({
    profileId: params.connection.profileId,
    completedAt: runRow.completed_at,
    distanceKm: runRow.distance,
    durationSeconds: runRow.duration,
  })

  if (
    heuristicDuplicate?.id &&
    (heuristicDuplicate.source_provider !== 'garmin' || heuristicDuplicate.source_activity_id !== params.activity.activityId)
  ) {
    return {
      imported: false,
      duplicate: true,
      skipped: true,
      runId: String(heuristicDuplicate.id),
      sourceActivityId: params.activity.activityId,
      reason: 'heuristic_duplicate',
    }
  }

  const { data, error } = await supabase
    .from('runs')
    .upsert(
      {
        ...runRow,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'source_provider,source_activity_id',
      }
    )
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to upsert runs for Garmin import: ${error.message}`)
  }

  return {
    imported: true,
    duplicate: false,
    skipped: false,
    runId: data?.id ? String(data.id) : null,
    sourceActivityId: params.activity.activityId,
    reason: null,
  }
}
