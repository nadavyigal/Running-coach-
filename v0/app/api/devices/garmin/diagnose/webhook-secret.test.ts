import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/garmin-route-guard', () => ({ blockGarminRoute: () => null }))

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  getValidGarminAccessToken: vi.fn(async () => 'access-token'),
  refreshGarminAccessToken: vi.fn(),
  markGarminAuthError: vi.fn(),
}))

vi.mock('@/lib/integrations/garmin/service', () => ({
  getGarminSyncState: vi.fn(async () => ({ pendingJobs: 0, connectionStatus: 'connected' })),
}))

vi.mock('@/lib/server/garmin-export-store', () => ({
  GARMIN_HISTORY_DAYS: 30,
  lookbackStartIso: () => '2026-11-01T00:00:00.000Z',
  groupRowsByDataset: () => ({}),
  readGarminExportRows: vi.fn(async () => ({ ok: true, storeAvailable: true, rows: [] })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
  }),
}))

import { GET } from './route'

describe('/api/devices/garmin/diagnose webhook secret', () => {
  beforeEach(() => {
    vi.stubEnv('GARMIN_WEBHOOK_SECRET', 'super-secret-webhook-value')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ userId: 'garmin-user' }), { status: 200 }))
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('never returns the secret, only the webhook URL shape', async () => {
    const res = await GET(new Request('http://localhost/api/devices/garmin/diagnose?userId=1'))
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).not.toContain('super-secret-webhook-value')
    expect(JSON.parse(text).webhook.endpoint).toBe(
      'http://localhost/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>'
    )
  })
})
