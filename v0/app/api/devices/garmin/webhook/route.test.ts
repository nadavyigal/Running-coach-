import { afterEach, describe, expect, it, vi } from 'vitest'

const permissionChangesMock = vi.hoisted(() => vi.fn(async () => ({ permissionChanges: 0, affectedUsers: 0, ignored: 0 })))
vi.mock('@/lib/integrations/garmin/permission-changes', () => ({ handleGarminUserPermissionChanges: permissionChangesMock }))

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void>>)

vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}))

const recordGarminWebhookDeliveryMock = vi.hoisted(() => vi.fn())
const enqueueGarminImportJobsForEventMock = vi.hoisted(() => vi.fn())
const handleGarminUserDeregistrationsMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/integrations/garmin/service', () => ({
  recordGarminWebhookDelivery: recordGarminWebhookDeliveryMock,
  enqueueGarminImportJobsForEvent: enqueueGarminImportJobsForEventMock,
  handleGarminUserDeregistrations: handleGarminUserDeregistrationsMock,
}))

async function loadRoute() {
  return import('./route')
}

describe('/api/devices/garmin/webhook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    permissionChangesMock.mockClear()
    afterCallbacks.length = 0
    recordGarminWebhookDeliveryMock.mockReset()
    enqueueGarminImportJobsForEventMock.mockReset()
    handleGarminUserDeregistrationsMock.mockReset()
    delete process.env.GARMIN_WEBHOOK_SECRET
  })

  it('handles permission-only notifications after acknowledgement without an activity job', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    const payload = { userPermissionsChange: [{ userId: 'g1', permissions: [], changeTimeInSeconds: 123 }] }
    recordGarminWebhookDeliveryMock.mockResolvedValue({ event: { id: 'evt-permission' }, duplicate: false })
    handleGarminUserDeregistrationsMock.mockResolvedValue({ deregistrations: 0, affectedUsers: 0 })
    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', { method: 'POST', body: JSON.stringify(payload) }))
    expect(response.status).toBe(200)
    expect(permissionChangesMock).not.toHaveBeenCalled()
    await afterCallbacks[0]!()
    expect(permissionChangesMock).toHaveBeenCalledWith(payload)
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
  })

  it('does not enqueue an activity error for a filtered Health-only notification', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    const payload = { sleeps: [{ userId: 'g1' }] }
    recordGarminWebhookDeliveryMock.mockResolvedValue({ event: { id: 'evt-health', raw_payload: {} }, duplicate: false })
    handleGarminUserDeregistrationsMock.mockResolvedValue({ deregistrations: 0, affectedUsers: 0 })
    const { processGarminWebhookPayload } = await loadRoute()
    const result = await processGarminWebhookPayload(JSON.stringify(payload), payload)
    expect(result.queuedJobs).toBe(0)
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
  })

  it('requires webhook secret configuration', async () => {
    const req = new Request('http://localhost/api/devices/garmin/webhook')
    const { GET } = await loadRoute()
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.ok).toBe(false)
  })

  it('acknowledges before persistence and tracks processing after the response', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    recordGarminWebhookDeliveryMock.mockReturnValue(new Promise(() => {}))
    handleGarminUserDeregistrationsMock.mockResolvedValue({
      deregistrations: 0,
      affectedUsers: 0,
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
    expect(body).toEqual({ status: 'ok' })
    expect(recordGarminWebhookDeliveryMock).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
    void afterCallbacks[0]!()
    expect(recordGarminWebhookDeliveryMock).toHaveBeenCalledTimes(1)
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
  })

  it('persists and queues a new activity in the tracked post-response callback', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    const event = { id: 'evt-new' }
    const payload = { activities: [{ userId: 'garmin-user-1', activityId: 'run-1' }] }
    recordGarminWebhookDeliveryMock.mockResolvedValue({ duplicate: false, event })
    handleGarminUserDeregistrationsMock.mockResolvedValue({ deregistrations: 0, affectedUsers: 0 })
    enqueueGarminImportJobsForEventMock.mockResolvedValue({ queuedJobs: 1 })

    const { POST } = await loadRoute()
    const res = await POST(new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      body: JSON.stringify(payload),
    }))

    expect(res.status).toBe(200)
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
    await afterCallbacks[0]!()
    expect(recordGarminWebhookDeliveryMock).toHaveBeenCalledWith({
      rawBody: JSON.stringify(payload), payload, eventType: 'garmin_push',
    })
    expect(handleGarminUserDeregistrationsMock).toHaveBeenCalledWith(payload)
    expect(enqueueGarminImportJobsForEventMock).toHaveBeenCalledWith(event)
  })

  it('logs post-response persistence failures without changing the acknowledgement', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    const failure = new Error('Persistence unavailable')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    recordGarminWebhookDeliveryMock.mockRejectedValue(failure)

    const { POST } = await loadRoute()
    const res = await POST(new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      body: JSON.stringify({ activities: [{ activityId: 'run-1' }] }),
    }))

    expect(res.status).toBe(200)
    await expect(afterCallbacks[0]!()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledWith('Garmin webhook processing error:', failure)
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
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
    await afterCallbacks[0]!()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
    expect(enqueueGarminImportJobsForEventMock).not.toHaveBeenCalled()
  })

  it('handles Garmin user deregistration payloads asynchronously', async () => {
    process.env.GARMIN_WEBHOOK_SECRET = 'secret-123'
    recordGarminWebhookDeliveryMock.mockResolvedValue({
      duplicate: false,
      event: {
        id: 'evt-2',
      },
    })
    handleGarminUserDeregistrationsMock.mockResolvedValue({
      deregistrations: 1,
      affectedUsers: 1,
    })

    const payload = {
      deregistrations: [{ userId: 'garmin-user-1', uploadStartTimeInSeconds: 1781520000 }],
    }
    const req = new Request('http://localhost/api/devices/garmin/webhook?secret=secret-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const { POST } = await loadRoute()
    const res = await POST(req)
    const body = await res.json()
    await afterCallbacks[0]!()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
    expect(handleGarminUserDeregistrationsMock).toHaveBeenCalledWith(payload)
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
    expect(afterCallbacks).toHaveLength(0)
  })
})
