export const GARMIN_CONNECT_DISABLED_MESSAGE =
  "Garmin sync is temporarily unavailable while we complete Garmin production approval. Existing activity data remains in RunSmart. We'll notify you when reconnection is available."

type GarminConnectEnv = {
  GARMIN_CONNECT_ENABLED?: string
  NODE_ENV?: string
}

export function isGarminConnectEnabled(env: GarminConnectEnv = process.env): boolean {
  const rawValue = env.GARMIN_CONNECT_ENABLED?.trim().toLowerCase()

  if (rawValue) {
    return ['1', 'true', 'yes', 'on'].includes(rawValue)
  }

  return env.NODE_ENV !== 'production'
}
