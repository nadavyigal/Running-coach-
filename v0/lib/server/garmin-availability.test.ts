import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const warnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  logger: { warn: warnMock, error: vi.fn(), info: vi.fn() },
}))

async function loadModule() {
  return import('./garmin-availability')
}

describe('garmin availability', () => {
  beforeEach(() => {
    vi.resetModules()
    warnMock.mockClear()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
    vi.stubEnv('GARMIN_CLIENT_ID', 'test-client-id')
    vi.stubEnv('GARMIN_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('GARMIN_TEST_CLIENT_ID', '')
    vi.stubEnv('GARMIN_TEST_CLIENT_SECRET', '')
    vi.stubEnv('GARMIN_USE_TEST_CREDENTIALS', '')
    vi.stubEnv('GARMIN_CREDENTIAL_SET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports no configuration gap when Supabase and Garmin are set', async () => {
    const { getGarminConfigGap } = await loadModule()

    expect(getGarminConfigGap()).toBeNull()
  })

  it.each([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GARMIN_CLIENT_ID',
    'GARMIN_CLIENT_SECRET',
  ])('reports Garmin as not configured when %s is empty', async (name) => {
    vi.stubEnv(name, '  ')
    const { getGarminConfigGap } = await loadModule()

    expect(getGarminConfigGap()).toBe('garmin_not_configured')
  })

  it.each([
    'Failed to claim Garmin import jobs: Unregistered API key',
    'Failed to read garmin_connections: Invalid API key',
    'Legacy API keys are disabled',
  ])('recognises a rejected Supabase key: %s', async (message) => {
    const { getRejectedKeyReason } = await loadModule()

    expect(getRejectedKeyReason(new Error(message))).toBe('supabase_key_rejected')
    expect(getRejectedKeyReason({ message })).toBe('supabase_key_rejected')
  })

  it('leaves unrelated errors alone', async () => {
    const { getRejectedKeyReason } = await loadModule()

    expect(getRejectedKeyReason(new Error('connection timed out'))).toBeNull()
    expect(getRejectedKeyReason(undefined)).toBeNull()
  })

  it('logs each reason only once per server instance', async () => {
    const { logGarminUnavailableOnce } = await loadModule()

    logGarminUnavailableOnce('supabase_key_rejected')
    logGarminUnavailableOnce('supabase_key_rejected')
    logGarminUnavailableOnce('garmin_not_configured')

    expect(warnMock).toHaveBeenCalledTimes(2)
  })
})
