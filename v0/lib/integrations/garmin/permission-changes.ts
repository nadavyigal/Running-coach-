import 'server-only'

import {
  findRunSmartUserIdsByGarminUserId,
  getGarminOAuthState,
  upsertGarminConnection,
} from '@/lib/server/garmin-oauth-store'

interface PermissionChange {
  userId: string
  permissions: string[]
  summaryId?: string
  changeTimeInSeconds?: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function isEventTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function parsePermissionChange(value: unknown): PermissionChange | null {
  const row = asRecord(value)
  if (typeof row.userId !== 'string' || !row.userId.trim()) return null
  if (!Array.isArray(row.permissions) || !row.permissions.every(
    (permission): permission is string => typeof permission === 'string' && permission.trim().length > 0
  )) return null
  if (row.changeTimeInSeconds !== undefined && !isEventTime(row.changeTimeInSeconds)) return null
  if (row.summaryId !== undefined && (typeof row.summaryId !== 'string' || !row.summaryId.trim())) return null

  return {
    userId: row.userId.trim(),
    permissions: row.permissions.map((permission) => permission.trim()),
    ...(typeof row.summaryId === 'string' ? { summaryId: row.summaryId } : {}),
    ...(isEventTime(row.changeTimeInSeconds) ? { changeTimeInSeconds: row.changeTimeInSeconds } : {}),
  }
}

/** Permission changes retain valid OAuth tokens and the existing connection status.
 * Timestamp comparisons order sequential deliveries, not concurrent database writers.
 */
export async function handleGarminUserPermissionChanges(payload: Record<string, unknown>): Promise<{
  permissionChanges: number
  affectedUsers: number
  ignored: number
}> {
  const rows = Array.isArray(payload.userPermissionsChange) ? payload.userPermissionsChange : []
  const affectedUsers = new Set<number>()
  let permissionChanges = 0
  let ignored = 0

  for (const row of rows) {
    const change = parsePermissionChange(row)
    if (!change) {
      ignored += 1
      continue
    }
    permissionChanges += 1

    const userIds = await findRunSmartUserIdsByGarminUserId(change.userId)
    for (const userId of userIds) {
      const state = await getGarminOAuthState(userId)
      if (!state) {
        ignored += 1
        continue
      }
      const metadata = asRecord(state.errorState?.garminPermissionChange)
      const previousTime = metadata.changeTimeInSeconds
      if (change.changeTimeInSeconds !== undefined && isEventTime(previousTime)
        && change.changeTimeInSeconds <= previousTime) {
        ignored += 1
        continue
      }

      await upsertGarminConnection({
        userId,
        scopes: change.permissions,
        errorState: {
          ...state.errorState,
          garminPermissionChange: {
            ...metadata,
            ...(change.summaryId !== undefined ? { summaryId: change.summaryId } : {}),
            ...(change.changeTimeInSeconds !== undefined ? { changeTimeInSeconds: change.changeTimeInSeconds } : {}),
          },
        },
      })
      affectedUsers.add(userId)
    }
  }

  return { permissionChanges, affectedUsers: affectedUsers.size, ignored }
}
