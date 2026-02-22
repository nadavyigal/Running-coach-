import { NextResponse } from 'next/server'
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware'
import { logger } from '@/lib/logger'
import { revokeGarminConnection } from '@/lib/server/garmin-oauth-store'

async function handleDisconnect(req: ApiRequest) {
  try {
    const { userId } = await req.json()
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid userId is required',
        },
        { status: 400 }
      )
    }

    const authUserId = req.headers.get('x-user-id')
    if (authUserId && Number.parseInt(authUserId, 10) !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User mismatch',
        },
        { status: 403 }
      )
    }

    const result = await revokeGarminConnection(userId)
    return NextResponse.json({
      success: true,
      revokedUpstream: result.revokedUpstream,
      hadStoredTokens: result.hadStoredTokens,
    })
  } catch (error) {
    logger.error('Garmin disconnect error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect Garmin',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiSecurity(handleDisconnect)
