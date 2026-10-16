import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CANONICAL_POSTHOG_HOST_ENV,
  CANONICAL_POSTHOG_KEY_ENV,
  DEFAULT_POSTHOG_HOST,
  LEGACY_POSTHOG_KEY_ENV,
  SERVER_POSTHOG_HOST_ENV,
  SERVER_POSTHOG_KEY_ENV,
  isValidPosthogKeyFormat,
  resetPosthogConfigWarningsForTests,
  resolvePosthogHost,
  resolvePublicPosthogKey,
  resolveServerPosthogKey,
  warnMissingPosthogKey,
} from './posthog-config'

const ENV_KEYS = [
  CANONICAL_POSTHOG_KEY_ENV,
  LEGACY_POSTHOG_KEY_ENV,
  SERVER_POSTHOG_KEY_ENV,
  CANONICAL_POSTHOG_HOST_ENV,
  SERVER_POSTHOG_HOST_ENV,
] as const

function clearPosthogEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
}

describe('posthog-config', () => {
  afterEach(() => {
    clearPosthogEnv()
    resetPosthogConfigWarningsForTests()
    vi.unstubAllEnvs()
  })

  it('prefers the canonical public key env var', () => {
    vi.stubEnv(CANONICAL_POSTHOG_KEY_ENV, 'phc_canonical')
    vi.stubEnv(LEGACY_POSTHOG_KEY_ENV, 'phc_legacy')

    expect(resolvePublicPosthogKey()).toBe('phc_canonical')
  })

  it('falls back to the legacy public key env var', () => {
    vi.stubEnv(LEGACY_POSTHOG_KEY_ENV, 'phc_legacy')

    expect(resolvePublicPosthogKey()).toBe('phc_legacy')
  })

  it('returns null when no public key is configured', () => {
    expect(resolvePublicPosthogKey()).toBeNull()
  })

  it('treats placeholder keys as missing', () => {
    vi.stubEnv(CANONICAL_POSTHOG_KEY_ENV, 'your_posthog_api_key_here')

    expect(resolvePublicPosthogKey()).toBeNull()
  })

  it('resolves server key from POSTHOG_API_KEY with public fallback', () => {
    vi.stubEnv(SERVER_POSTHOG_KEY_ENV, 'phc_server')
    vi.stubEnv(CANONICAL_POSTHOG_KEY_ENV, 'phc_public')

    expect(resolveServerPosthogKey()).toBe('phc_server')
  })

  it('defaults the host to the US PostHog cloud endpoint', () => {
    expect(resolvePosthogHost()).toBe(DEFAULT_POSTHOG_HOST)
  })

  it('prefers server host when requested', () => {
    vi.stubEnv(SERVER_POSTHOG_HOST_ENV, 'https://custom.posthog.example/')
    vi.stubEnv(CANONICAL_POSTHOG_HOST_ENV, 'https://public.posthog.example')

    expect(resolvePosthogHost({ preferServerHost: true })).toBe('https://custom.posthog.example')
  })

  it('validates PostHog key format', () => {
    expect(isValidPosthogKeyFormat('phc_test')).toBe(true)
    expect(isValidPosthogKeyFormat('invalid')).toBe(false)
  })

  it('warns once in development when the key is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubEnv('NODE_ENV', 'development')
    warnMissingPosthogKey('client')
    warnMissingPosthogKey('client')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain(CANONICAL_POSTHOG_KEY_ENV)
  })
})
