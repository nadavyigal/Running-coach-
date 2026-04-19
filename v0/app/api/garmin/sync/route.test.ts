import { describe, expect, it, vi } from 'vitest'

const canonicalPostMock = vi.hoisted(() => vi.fn())

vi.mock('@/app/api/devices/garmin/sync/manual/route', () => ({
  POST: canonicalPostMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/garmin/sync', () => {
  it('forwards to the canonical Garmin manual sync handler without changing the response', async () => {
    canonicalPostMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, trigger: 'manual' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const req = new Request('http://localhost/api/garmin/sync?userId=42', {
      method: 'POST',
      headers: { 'x-user-id': '42' },
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(canonicalPostMock).toHaveBeenCalledWith(req)
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, trigger: 'manual' })
  })
})
