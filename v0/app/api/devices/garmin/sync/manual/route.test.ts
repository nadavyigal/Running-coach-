import { describe, expect, it, vi } from 'vitest'

const syncPostMock = vi.hoisted(() => vi.fn())

vi.mock('@/app/api/devices/garmin/sync/route', () => ({
  POST: syncPostMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/sync/manual', () => {
  it('forwards manual sync through Garmin sync route and annotates trigger metadata', async () => {
    syncPostMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, activities: [], sleep: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const req = new Request('http://localhost/api/devices/garmin/sync/manual?userId=42', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.trigger).toBe('manual')
    expect(typeof body.triggeredAt).toBe('string')
    expect(syncPostMock).toHaveBeenCalledTimes(1)
  })
})
