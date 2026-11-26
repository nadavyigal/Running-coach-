import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getValidGarminAccessToken: vi.fn(async () => 'test-access-token'),
  markGarminAuthError: vi.fn(),
  refreshGarminAccessToken: vi.fn(),
}))

vi.mock('@/lib/server/garmin-export-store', () => ({
  GARMIN_HISTORY_DAYS: 30,
  groupRowsByDataset: () => ({}),
  lookbackStartIso: () => '2026-10-27T00:00:00.000Z',
  readGarminExportRows: vi.fn(async () => ({ ok: true, storeAvailable: true, rows: [] })),
}))

vi.mock('@/lib/integrations/garmin/service', () => ({
  getGarminSyncState: vi.fn(async () => ({
    connectionStatus: 'connected',
    pendingJobs: 0,
    lastSuccessfulSyncAt: null,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
  }),
}))

describe('/api/devices/garmin/diagnose', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GARMIN_WEBHOOK_SECRET', 'super-secret-webhook-value')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ permissions: [] }), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('never puts the webhook secret in the response', async () => {
    const { GET } = await import('./route')

    const res = await GET(new Request('http://localhost/api/devices/garmin/diagnose?userId=42'))
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).not.toContain('super-secret-webhook-value')
    expect(JSON.parse(text).webhook).toMatchObject({
      endpoint: 'http://localhost/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>',
      secretSource: 'GARMIN_WEBHOOK_SECRET',
    })
  })
})
