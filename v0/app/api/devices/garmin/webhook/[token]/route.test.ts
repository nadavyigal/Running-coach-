const webhookGetMock = vi.hoisted(() => vi.fn())
const webhookPostMock = vi.hoisted(() => vi.fn())

vi.mock('../route', () => ({
  GET: webhookGetMock,
  POST: webhookPostMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/webhook/[token]', () => {
  beforeEach(() => {
    webhookGetMock.mockReset()
    webhookPostMock.mockReset()
    webhookGetMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    webhookPostMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards GET requests with token secret injected as query parameter', async () => {
    const { GET } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/webhook/secret-123')

    await GET(req, { params: { token: 'secret-123' } })

    expect(webhookGetMock).toHaveBeenCalledTimes(1)
    const forwardedReq = webhookGetMock.mock.calls[0]?.[0] as Request
    const forwardedUrl = new URL(forwardedReq.url)
    expect(forwardedUrl.searchParams.get('secret')).toBe('secret-123')
  })

  it('forwards POST requests with token secret injected as query parameter', async () => {
    const { POST } = await loadRoute()
    const req = new Request('http://localhost/api/devices/garmin/webhook/secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activities: [] }),
    })

    await POST(req, { params: { token: 'secret-123' } })

    expect(webhookPostMock).toHaveBeenCalledTimes(1)
    const forwardedReq = webhookPostMock.mock.calls[0]?.[0] as Request
    const forwardedUrl = new URL(forwardedReq.url)
    expect(forwardedUrl.searchParams.get('secret')).toBe('secret-123')
  })
})
