import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./dbUtils', () => ({
  getCurrentUser: vi.fn(async () => null),
}))

// Test the real analytics implementation (it is mocked globally in vitest.setup.ts)
vi.unmock('@/lib/analytics')

describe('trackActivationOnce', () => {
  const capture = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    ;(window as any).posthog = { capture }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
  })

  const activationCalls = () => capture.mock.calls.filter(([event]) => event === 'first_run_recorded')

  it('emits first_run_recorded once for the first completed run', async () => {
    const { trackActivationOnce } = await import('@/lib/analytics')

    const emitted = await trackActivationOnce(7, 1, { distanceKm: 3.2, durationSeconds: 1200 })

    expect(emitted).toBe(true)
    expect(activationCalls()).toHaveLength(1)
    expect(activationCalls()[0][1]).toMatchObject({
      funnel_stage: 'first_run',
      distance_km: 3.2,
      duration_seconds: 1200,
      $set_once: { activated_at: expect.any(String) },
    })
  })

  it('is idempotent per user: repeat calls for the same user do not emit again', async () => {
    const { trackActivationOnce } = await import('@/lib/analytics')

    await trackActivationOnce(7, 1)
    const second = await trackActivationOnce(7, 1)

    expect(second).toBe(false)
    expect(activationCalls()).toHaveLength(1)
  })

  it('does not emit for a run that is not the user\'s first', async () => {
    const { trackActivationOnce } = await import('@/lib/analytics')

    const emitted = await trackActivationOnce(7, 2)

    expect(emitted).toBe(false)
    expect(activationCalls()).toHaveLength(0)
  })

  it('tracks each user separately on a shared device', async () => {
    const { trackActivationOnce } = await import('@/lib/analytics')

    await trackActivationOnce(7, 1)
    await trackActivationOnce(8, 1)
    await trackActivationOnce(8, 1)

    expect(activationCalls()).toHaveLength(2)
  })

  it('stays silent when storage is unavailable, rather than risking repeats', async () => {
    const { trackActivationOnce } = await import('@/lib/analytics')
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const emitted = await trackActivationOnce(9, 1)

    expect(emitted).toBe(false)
    expect(activationCalls()).toHaveLength(0)
    getItem.mockRestore()
  })
})
