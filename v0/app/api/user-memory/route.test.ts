import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.hoisted(() => vi.fn())
const upsertMock = vi.hoisted(() => vi.fn())
const createAdminClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

import { GET, PUT } from './route'

const UUID_DEVICE_ID = '3f2b8c1a-9d4e-4f7a-b2c6-1a5e8d0f9b34'
// lib/userMemory.ts builds this shape when crypto.randomUUID is missing.
const FALLBACK_DEVICE_ID = '1764150000000-9f3a1c77b2e41'

const REJECTED_DEVICE_IDS = [
  'garmin_export:12345:activities:abc123',
  'garmin_export:12345:dailies:0',
  'test-device',
  `${UUID_DEVICE_ID}:extra`,
  '%',
]

function getRequest(deviceId: string) {
  return new Request(`http://localhost/api/user-memory?deviceId=${encodeURIComponent(deviceId)}`)
}

function putRequest(body: unknown) {
  return new Request('http://localhost/api/user-memory', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/user-memory', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset()
    maybeSingleMock.mockResolvedValue({ data: { snapshot: { version: 1 } }, error: null })
    upsertMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    createAdminClientMock.mockReset()
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
        upsert: upsertMock,
      }),
    })
  })

  it.each(REJECTED_DEVICE_IDS)('does not read the row for device id %s', async (deviceId) => {
    const res = await GET(getRequest(deviceId))

    expect(res.status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it.each(REJECTED_DEVICE_IDS)('does not write the row for device id %s', async (deviceId) => {
    const res = await PUT(putRequest({ deviceId, snapshot: { version: 1 } }))

    expect(res.status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('rejects a device id that is not a string', async () => {
    const res = await PUT(putRequest({ deviceId: 42, snapshot: { version: 1 } }))

    expect(res.status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it.each([UUID_DEVICE_ID, FALLBACK_DEVICE_ID])('restores the backup for app device id %s', async (deviceId) => {
    const res = await GET(getRequest(deviceId))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ snapshot: { version: 1 } })
  })

  it('saves a backup without storing the client-sent userId', async () => {
    const res = await PUT(putRequest({ deviceId: UUID_DEVICE_ID, userId: 7, snapshot: { version: 1 } }))

    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    const [row] = upsertMock.mock.calls[0] ?? []
    expect(row.device_id).toBe(UUID_DEVICE_ID)
    expect(row).not.toHaveProperty('user_id')
  })
})
