import { afterEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => vi.fn())
const enqueue = vi.hoisted(() => vi.fn(async () => ({ queued: true, jobId: 'job1' })))
const sync = vi.hoisted(() => vi.fn())
vi.mock('@/lib/server/garmin-oauth-store', () => ({ getGarminOAuthState: state }))
vi.mock('@/lib/server/garmin-sync-queue', () => ({ enqueueGarminSyncJob: enqueue }))
vi.mock('@/lib/garmin/sync/syncUser', () => ({ syncGarminUser: sync }))
describe('explicit historical backfill', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
  it.each([
    { tier: 'starter', scopes: ['HISTORICAL_DATA_EXPORT'] },
    { tier: 'enterprise', scopes: [] },
  ])('rejects $tier with $scopes without scheduling or syncing', async ({ tier, scopes }) => {
    vi.stubEnv('GARMIN_ACCESS_TIER', tier)
    state.mockResolvedValue({ scopes })
    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/devices/garmin/backfill?userId=42', { method: 'POST' }))
    expect(response.status).toBe(403)
    expect(enqueue).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })
  it('queues only explicitly entitled Enterprise history with the conservative existing window', async () => {
    vi.stubEnv('GARMIN_ACCESS_TIER', 'enterprise')
    state.mockResolvedValue({ scopes: ['HISTORICAL_DATA_EXPORT'] })
    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/devices/garmin/backfill?userId=42', { method: 'POST' }))
    expect(response.status).toBe(202)
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'backfill', activityLookbackDays: 30 }))
  })
})
