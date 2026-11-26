import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listConnectedGarminUserIdsMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  listConnectedGarminUserIds: listConnectedGarminUserIdsMock,
}))

vi.mock('@/lib/server/garmin-sync-queue', () => ({
  enqueueGarminSyncJob: vi.fn(),
}))

vi.mock('@/app/api/devices/garmin/sync/route', () => ({
  runGarminSyncForUser: vi.fn(),
  buildExecutionOptions: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

async function loadRoute() {
  return import('./route')
}

function cronRequest() {
  return new Request('http://localhost/api/cron/garmin-nightly', {
    headers: { authorization: 'Bearer test-cron-secret' },
  })
}

describe('/api/cron/garmin-nightly', () => {
  beforeEach(() => {
    vi.resetModules()
    listConnectedGarminUserIdsMock.mockReset()
    loggerMock.warn.mockClear()
    loggerMock.error.mockClear()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
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

  it('returns early with 200 when Garmin is not configured', async () => {
    vi.stubEnv('GARMIN_CLIENT_ID', '')
    const { GET } = await loadRoute()

    const res = await GET(cronRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: false, skipped: true, reason: 'garmin_not_configured' })
    expect(listConnectedGarminUserIdsMock).not.toHaveBeenCalled()
  })

  it('returns 200 skipped when the Supabase key is rejected', async () => {
    listConnectedGarminUserIdsMock.mockRejectedValue(
      new Error('Failed to list connected Garmin users: Unregistered API key')
    )
    const { GET } = await loadRoute()

    const res = await GET(cronRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: false, skipped: true, reason: 'supabase_key_rejected' })
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('keeps returning 500 for other failures', async () => {
    listConnectedGarminUserIdsMock.mockRejectedValue(new Error('connection timed out'))
    const { GET } = await loadRoute()

    const res = await GET(cronRequest())

    expect(res.status).toBe(500)
  })
})
