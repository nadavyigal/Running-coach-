import { GARMIN_ACTIVITY_DATASET_KEYS, GARMIN_WELLNESS_DATASET_KEYS } from './datasets'

type GarminAccessEnv = Record<string, string | undefined>

// Configuration is a second boundary, not evidence of Garmin approval.
// Unknown or legacy tiers retain the least-privileged Starter behavior.
export function isGarminPullEnabled(env: GarminAccessEnv = process.env): boolean {
  return env.GARMIN_ACCESS_TIER?.trim().toLowerCase() === 'enterprise'
}

export function isGarminHistoryAllowed(permissions: readonly string[], env: GarminAccessEnv = process.env): boolean {
  return isGarminPullEnabled(env) && permissions.includes('HISTORICAL_DATA_EXPORT')
}

export function isGarminHealthEnabled(env: GarminAccessEnv = process.env): boolean {
  return env.GARMIN_HEALTH_ENABLED?.trim().toLowerCase() === 'true'
}

export function isGarminDatasetAllowed(key: string, env: GarminAccessEnv = process.env): boolean {
  if (key === 'activityFiles' || GARMIN_ACTIVITY_DATASET_KEYS.some((value) => value === key)) return true
  return isGarminHealthEnabled(env) && GARMIN_WELLNESS_DATASET_KEYS.some((value) => value === key)
}

export function filterGarminWebhookPayload(payload: Record<string, unknown>, env: GarminAccessEnv = process.env): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) =>
    key === 'deregistrations' || key === 'userPermissionsChange' || isGarminDatasetAllowed(key, env)
  ))
}
