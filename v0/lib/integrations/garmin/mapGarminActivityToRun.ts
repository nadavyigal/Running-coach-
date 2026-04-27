import type { GarminNormalizedActivity } from '@/lib/integrations/garmin/types'

export interface CanonicalGarminRunInput {
  profileId: string
  sourcePayloadRef?: string | null
}

export interface CanonicalGarminRun {
  profile_id: string
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'recovery' | 'race' | 'other'
  distance: number
  duration: number
  pace: number | null
  heart_rate: number | null
  calories: number | null
  notes: string | null
  route: Record<string, unknown>[] | null
  completed_at: string
  source_provider: 'garmin'
  source_activity_id: string
  source_external_id: string | null
  source_payload_ref: string | null
}

function mapActivityType(typeKey: string): CanonicalGarminRun['type'] {
  const normalized = typeKey.toLowerCase()
  if (normalized.includes('race')) return 'race'
  if (normalized.includes('interval')) return 'intervals'
  if (normalized.includes('tempo') || normalized.includes('threshold')) return 'tempo'
  if (normalized.includes('recovery')) return 'recovery'
  if (normalized.includes('hill')) return 'hill'
  if (normalized.includes('time_trial')) return 'time-trial'
  if (normalized.includes('long')) return 'long'
  if (normalized.includes('run') || normalized.includes('treadmill')) return 'easy'
  return 'other'
}

export function isGarminRunLikeActivity(activity: GarminNormalizedActivity): boolean {
  const normalized = activity.typeKey.toLowerCase()
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean)
  const compact = tokens.join('')

  if (tokens.some((token) => token === 'run' || token === 'running' || token.endsWith('running') || token.endsWith('run'))) {
    return true
  }

  return [
    'race',
    'treadmill',
    'trailrun',
    'obstaclerun',
    'ultrarun',
    'marathon',
    'halfmarathon',
    '5k',
    '10k',
  ].some((token) => compact.includes(token))
}

export function mapGarminActivityToRun(
  activity: GarminNormalizedActivity,
  input: CanonicalGarminRunInput
): CanonicalGarminRun {
  return {
    profile_id: input.profileId,
    type: mapActivityType(activity.typeKey),
    distance: Number((activity.distanceMeters / 1000).toFixed(3)),
    duration: activity.movingDurationSeconds ?? activity.durationSeconds,
    pace: activity.averagePaceSecondsPerKm ?? null,
    heart_rate: activity.averageHeartRate ?? null,
    calories: activity.calories != null ? Math.round(activity.calories) : null,
    notes: activity.name && activity.name !== 'Garmin Activity' ? activity.name : null,
    route: activity.routePoints.length > 0 ? activity.routePoints : null,
    completed_at: activity.startTime,
    source_provider: 'garmin',
    source_activity_id: activity.activityId,
    source_external_id: activity.sourceExternalId ?? null,
    source_payload_ref: input.sourcePayloadRef ?? activity.sourcePayloadRef ?? null,
  }
}
