import 'server-only'

import { refreshGarminAccessToken } from '@/lib/server/garmin-oauth-store'

export interface GarminRefreshResult {
  accessToken: string
  refreshToken: string | null
  expiresAt: string
}

export async function refreshGarminTokenForUser(userId: number): Promise<GarminRefreshResult> {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Valid userId is required to refresh Garmin token')
  }

  return refreshGarminAccessToken(userId)
}

