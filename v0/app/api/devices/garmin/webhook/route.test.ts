import { afterEach, describe, expect, it, vi } from 'vitest'

const recordGarminWebhookDeliveryMock = vi.hoisted(() => vi.fn())
const enqueueGarminImportJobsForEventMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/integrations/garmin/service', () => ({
  recordGarminWebhookDelivery: recordGarminWebhookDeliveryMock,
  enqueueGarminImportJobsForEvent: enqueueGarminImportJobsForEventMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/webhook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    recordGarminWebhookDeliveryMock.mockReset()
    enqueueGarminImportJobsForEventMock.mockReset()
    delete process.env.GARMIN_WEBHOOK_SECRET
  })

  it('requires webhook secret configuration', async () => {
    const req = new Request('http://localhost/api/devices/garmin/webhook')
    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
  })

  it('returns 200 fast and persists event without inline processing', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    recordGarminWebhookDeliveryMock.mockResolvedValue({
      duplicate: false,
      event: {
        id: 'evt-1',
      },
    })
    enqueueGarminImportJobsForEventMock.mockResolvedValue({
      queuedJobs: 1,
      jobs: [{ id: 'job-1' }],
    })

    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activities: [{ userId: 'garmin-user-1', activityId: 'run-1' }],
      }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      duplicate: false,
      queuedJobs: 1,
      webhookEventId: 'evt-1',
    })
    expect(recordGarminWebhookDeliveryMock).toHaveBeenCalledTimes(1)
    expect(enqueueGarminImportJobsForEventMock).toHaveBeenCalledTimes(1)
  })

  it('ignores duplicate webhook deliveries', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    recordGarminWebhookDeliveryMock.mockResolvedValue({
      duplicate: true,
      event: {
        id: 'evt-1',
      },
    })

    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activities: [{ userId: 'garmin-user-1', activityId: 'run-1' }],
      }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      duplicate: true,
      queuedJobs: 0,
      webhookEventId: 'evt-1',
    })
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
  })

  it('rejects unauthorized requests when webhook secret is configured', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'

    const req = new Request('http://localhost/api/devices/garmin/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activities: [] }),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(recordGarminWebhookDeliveryMock).not.toHaveBeenCalled()
  })
})
