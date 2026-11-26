import { NextResponse } from 'next/server'
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware'
import { logger } from '@/lib/logger'
import { requireApiUser } from '@/lib/api-auth'
import { getGarminConnectionOwner, revokeGarminConnection } from '@/lib/server/garmin-oauth-store'

async function handleDisconnect(req: ApiRequest) {
  try {
    const auth = await requireApiUser(req)
    if (auth.response) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sign in to disconnect Garmin.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

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

    // `userId` comes from the client, so it only counts if that connection is
    // linked to the signed-in account.
    const owner = await getGarminConnectionOwner(userId)
    if (owner?.authUserId !== auth.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'This Garmin connection is not linked to your account.',
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
