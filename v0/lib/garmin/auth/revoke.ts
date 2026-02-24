import 'server-only'

import { revokeGarminConnection } from '@/lib/server/garmin-oauth-store'

export interface GarminRevokeResult {
  revokedUpstream: boolean
  hadStoredTokens: boolean
}

export async function revokeGarminForUser(userId: number): Promise<GarminRevokeResult> {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Valid userId is required to revoke Garmin connection')
  }

  return revokeGarminConnection(userId)
}

