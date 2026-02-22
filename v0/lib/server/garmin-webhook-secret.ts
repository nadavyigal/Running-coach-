const GARMIN_WEBHOOK_SECRET_KEYS = [
  'GARMIN_WEBHOOK_SECRET',
  'GARMIN_WEBHOOK_TOKEN',
  'NEXT_PUBLIC_GARMIN_WEBHOOK_SECRET',
] as const

function normalizeSecret(rawValue: string | undefined): string | null {
  if (!rawValue) return null
  const trimmed = rawValue.trim().replace(/^['"]|['"]$/g, '')
  return trimmed.length > 0 ? trimmed : null
}

export function getGarminWebhookSecret(): { value: string | null; source: string | null } {
  for (const key of GARMIN_WEBHOOK_SECRET_KEYS) {
    const value = normalizeSecret(process.env[key])
    if (value) {
      return { value, source: key }
    }
  }

  return { value: null, source: null }
}
