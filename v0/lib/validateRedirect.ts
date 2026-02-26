// Allowed OAuth redirect destinations — extend when new providers are added
const GARMIN_OAUTH_ORIGINS = [
  'https://connect.garmin.com',
  'https://diauth.garmin.com',
]

/**
 * Validates that a redirect URL is safe before following it.
 * Blocks javascript:, data:, and other non-http(s) protocols.
 * Only allows known Garmin OAuth origins or the app's own origin.
 */
export function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      GARMIN_OAUTH_ORIGINS.some(o => parsed.origin === o) ||
      (appOrigin !== '' && parsed.origin === appOrigin)
    )
  } catch {
    return false
  }
}
