import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUsers = vi.hoisted(() => vi.fn())
const getState = vi.hoisted(() => vi.fn())
const upsertConnection = vi.hoisted(() => vi.fn())
const deleteTokens = vi.hoisted(() => vi.fn())
const upsertTokens = vi.hoisted(() => vi.fn())

vi.mock('@/lib/server/garmin-oauth-store', () => ({
  findRunSmartUserIdsByGarminUserId: findUsers,
  getGarminOAuthState: getState,
  upsertGarminConnection: upsertConnection,
  deleteGarminTokens: deleteTokens,
  upsertGarminTokens: upsertTokens,
}))

import { handleGarminUserPermissionChanges } from './permission-changes'

function notification(overrides: Record<string, unknown> = {}) {
  return { userPermissionsChange: [{
    userId: 'garmin-user', summaryId: 'summary-2', permissions: [], changeTimeInSeconds: 200,
    ...overrides,
  }] }
}

describe('Garmin permission change notifications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    findUsers.mockResolvedValue([42])
    getState.mockResolvedValue({
      userId: 42, scopes: ['ACTIVITY_EXPORT'], status: 'connected',
      errorState: { reason: 'prior-sync-error', garminPermissionChange: {
        changeTimeInSeconds: 100, summaryId: 'summary-1', extra: 'retain',
      } },
    })
    upsertConnection.mockResolvedValue(undefined)
  })

  it('removes every grant for an empty permissions array without revoking tokens or changing status', async () => {
    expect(await handleGarminUserPermissionChanges(notification())).toEqual({
      permissionChanges: 1, affectedUsers: 1, ignored: 0,
    })
    expect(upsertConnection).toHaveBeenCalledWith({
      userId: 42, scopes: [], errorState: {
        reason: 'prior-sync-error', garminPermissionChange: {
          changeTimeInSeconds: 200, summaryId: 'summary-2', extra: 'retain',
        },
      },
    })
    expect(deleteTokens).not.toHaveBeenCalled()
    expect(upsertTokens).not.toHaveBeenCalled()
  })

  it.each([
    { permissions: undefined }, { permissions: null }, { permissions: 'ACTIVITY_EXPORT' },
    { permissions: ['ACTIVITY_EXPORT', null] }, { permissions: [''] },
    { userId: '' }, { userId: 42 }, { changeTimeInSeconds: '200' },
    { changeTimeInSeconds: -1 }, { changeTimeInSeconds: null }, { summaryId: 42 },
  ])('ignores malformed rows without replacing known scopes: %j', async (row) => {
    await handleGarminUserPermissionChanges(notification(row))
    expect(findUsers).not.toHaveBeenCalled()
    expect(upsertConnection).not.toHaveBeenCalled()
    expect(deleteTokens).not.toHaveBeenCalled()
  })

  it.each([99, 100])('ignores older/equal timestamp %s', async (time) => {
    const result = await handleGarminUserPermissionChanges(notification({ changeTimeInSeconds: time }))
    expect(result.ignored).toBe(1)
    expect(upsertConnection).not.toHaveBeenCalled()
  })

  it('updates grants and preserves a disconnected status by omitting status from the update', async () => {
    getState.mockResolvedValue({ status: 'disconnected', scopes: [], errorState: null })
    await handleGarminUserPermissionChanges(notification({ permissions: ['ACTIVITY_EXPORT'] }))
    expect(upsertConnection).toHaveBeenCalledWith({
      userId: 42, scopes: ['ACTIVITY_EXPORT'], errorState: {
        garminPermissionChange: { changeTimeInSeconds: 200, summaryId: 'summary-2' },
      },
    })
    expect(deleteTokens).not.toHaveBeenCalled()
  })

  it('accepts a timestamp-free change without erasing the last known ordering metadata', async () => {
    const payload = notification()
    delete (payload.userPermissionsChange[0] as Record<string, unknown>).changeTimeInSeconds
    await handleGarminUserPermissionChanges(payload)
    expect(upsertConnection.mock.calls[0]?.[0].errorState.garminPermissionChange).toEqual({
      changeTimeInSeconds: 100, summaryId: 'summary-2', extra: 'retain',
    })
  })

  it('skips unknown connections instead of creating them', async () => {
    getState.mockResolvedValue(null)
    const result = await handleGarminUserPermissionChanges(notification())
    expect(result.affectedUsers).toBe(0)
    expect(upsertConnection).not.toHaveBeenCalled()
  })

  it('preserves sequential event ordering within one payload', async () => {
    let current = { scopes: ['ACTIVITY_EXPORT'], errorState: {} as Record<string, unknown> }
    getState.mockImplementation(async () => current)
    upsertConnection.mockImplementation(async (input) => { current = input })
    await handleGarminUserPermissionChanges({ userPermissionsChange: [
      { userId: 'garmin-user', permissions: [], changeTimeInSeconds: 200 },
      { userId: 'garmin-user', permissions: ['ACTIVITY_EXPORT'], changeTimeInSeconds: 199 },
    ] })
    expect(upsertConnection).toHaveBeenCalledTimes(1)
    expect(current.scopes).toEqual([])
  })

  it('ignores absent or non-array event containers', async () => {
    for (const payload of [{}, { userPermissionsChange: {} }, { userPermissionsChange: [null] }]) {
      await handleGarminUserPermissionChanges(payload)
    }
    expect(findUsers).not.toHaveBeenCalled()
  })
})
