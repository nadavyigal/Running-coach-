import { describe, expect, it, vi } from 'vitest'

const canonicalGetMock = vi.hoisted(() => vi.fn())

vi.mock('@/app/api/devices/garmin/status/route', () => ({
  GET: canonicalGetMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/garmin/status', () => {
  it('forwards to the canonical Garmin status handler without changing the response', async () => {
    canonicalGetMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, syncState: 'connected' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const req = new Request('http://localhost/api/garmin/status?userId=42')

    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(canonicalGetMock).toHaveBeenCalledWith(req)
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, syncState: 'connected' })
  })
})
