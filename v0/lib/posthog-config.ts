/**
 * Central PostHog configuration for RunSmart Web.
 *
 * Target project: PostHog "Running coach" (project id 171597, US region).
 * Keys must come from environment variables only — never hardcode fallbacks.
 */

export const CANONICAL_POSTHOG_KEY_ENV = 'NEXT_PUBLIC_POSTHOG_KEY'
export const CANONICAL_POSTHOG_HOST_ENV = 'NEXT_PUBLIC_POSTHOG_HOST'
export const SERVER_POSTHOG_KEY_ENV = 'POSTHOG_API_KEY'
export const SERVER_POSTHOG_HOST_ENV = 'POSTHOG_HOST'
export const LEGACY_POSTHOG_KEY_ENV = 'NEXT_PUBLIC_POSTHOG_API_KEY'

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
export const RUNSMART_POSTHOG_PROJECT_ID = 171597

const PLACEHOLDER_KEYS = new Set(['', 'your_posthog_api_key_here'])

let warnedMissingKey = false
let warnedLegacyKeyEnv = false

function isPlaceholderKey(key: string): boolean {
  return PLACEHOLDER_KEYS.has(key)
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  if (!value || isPlaceholderKey(value)) {
    return undefined
  }
  return value
}

/** Resolve the public (browser) PostHog project key from env. */
export function resolvePublicPosthogKey(): string | null {
  const canonical = readEnv(CANONICAL_POSTHOG_KEY_ENV)
  if (canonical) {
    return canonical
  }

  const legacy = readEnv(LEGACY_POSTHOG_KEY_ENV)
  if (legacy) {
    warnLegacyPosthogKeyEnv()
    return legacy
  }

  return null
}

/** Resolve the server-side PostHog key (falls back to the public key). */
export function resolveServerPosthogKey(): string | null {
  return readEnv(SERVER_POSTHOG_KEY_ENV) ?? resolvePublicPosthogKey()
}

/** Resolve the PostHog ingest host (US cloud by default). */
export function resolvePosthogHost(options?: { preferServerHost?: boolean }): string {
  const preferServerHost = options?.preferServerHost ?? false
  const host =
    (preferServerHost ? readEnv(SERVER_POSTHOG_HOST_ENV) : undefined) ??
    readEnv(CANONICAL_POSTHOG_HOST_ENV) ??
    (preferServerHost ? undefined : readEnv(SERVER_POSTHOG_HOST_ENV)) ??
    DEFAULT_POSTHOG_HOST

  return host.replace(/\/$/, '')
}

export function isValidPosthogKeyFormat(key: string): boolean {
  return key.startsWith('phc_')
}

/** Warn once in development when analytics is disabled due to a missing key. */
export function warnMissingPosthogKey(context: 'client' | 'server' = 'client'): void {
  if (process.env.NODE_ENV !== 'development' || warnedMissingKey) {
    return
  }

  warnedMissingKey = true
  const serverHint =
    context === 'server'
      ? ` Server-side capture also accepts ${SERVER_POSTHOG_KEY_ENV}.`
      : ''

  console.warn(
    `[RunSmart] PostHog analytics disabled: set ${CANONICAL_POSTHOG_KEY_ENV} in .env.local ` +
      `(project ${RUNSMART_POSTHOG_PROJECT_ID}, US). See v0/.env.example.${serverHint}`
  )
}

function warnLegacyPosthogKeyEnv(): void {
  if (process.env.NODE_ENV !== 'development' || warnedLegacyKeyEnv) {
    return
  }

  warnedLegacyKeyEnv = true
  console.warn(
    `[RunSmart] ${LEGACY_POSTHOG_KEY_ENV} is deprecated; migrate to ${CANONICAL_POSTHOG_KEY_ENV}.`
  )
}

/** Reset warning flags — test helper only. */
export function resetPosthogConfigWarningsForTests(): void {
  warnedMissingKey = false
  warnedLegacyKeyEnv = false
}
