import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const processPendingGarminJobsMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/integrations/garmin/service', () => ({
  processPendingGarminJobs: processPendingGarminJobsMock,
}))

vi.mock('@/lib/logger', () => ({ logger: loggerMock }))

async function loadRoute() {
  return import('./route')
}

function workerRequest(secret = 'test-cron-secret') {
  return new Request('http://localhost/api/internal/jobs/garmin', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('/api/internal/jobs/garmin', () => {
  beforeEach(() => {
    vi.resetModules()
    processPendingGarminJobsMock.mockReset()
    loggerMock.warn.mockClear()
    loggerMock.error.mockClear()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('INTERNAL_JOBS_SECRET', '')
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

  it('still rejects a request with the wrong secret', async () => {
    const { POST } = await loadRoute()

    const res = await POST(workerRequest('wrong'))

    expect(res.status).toBe(401)
    expect(processPendingGarminJobsMock).not.toHaveBeenCalled()
  })

  it('returns early with 200 when Garmin is not configured', async () => {
    vi.stubEnv('GARMIN_CLIENT_SECRET', '')
    const { POST } = await loadRoute()

    const res = await POST(workerRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: false, skipped: true, reason: 'garmin_not_configured' })
    expect(processPendingGarminJobsMock).not.toHaveBeenCalled()
  })

  it('returns 200 skipped and logs once when the Supabase key is rejected', async () => {
    processPendingGarminJobsMock.mockRejectedValue(
      new Error('Failed to claim Garmin import jobs: Unregistered API key')
    )
    const { POST } = await loadRoute()

    const first = await POST(workerRequest())
    const second = await POST(workerRequest())

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ success: false, skipped: true, reason: 'supabase_key_rejected' })
    expect(loggerMock.warn).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).not.toHaveBeenCalled()
  })

  it('keeps returning 500 for other failures', async () => {
    processPendingGarminJobsMock.mockRejectedValue(new Error('connection timed out'))
    const { POST } = await loadRoute()

    const res = await POST(workerRequest())

    expect(res.status).toBe(500)
    expect(loggerMock.error).toHaveBeenCalled()
  })
})
