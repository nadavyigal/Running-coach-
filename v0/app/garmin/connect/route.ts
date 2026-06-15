import { NextResponse, type NextRequest } from 'next/server'
import { generateCodeChallenge, generateCodeVerifier, generateSignedState } from '@/app/api/devices/garmin/oauth-state'
import { logger } from '@/lib/logger'
import { GARMIN_OAUTH_AUTHORIZE_URL } from '@/lib/server/garmin-endpoints'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const NATIVE_REDIRECT_URI = 'runsmart://garmin/connected'

function asPositiveUserId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const token = requestUrl.searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing native session token',
        },
        { status: 401 }
      )
    }

    const clientId = process.env.GARMIN_CLIENT_ID
    if (!clientId) {
      logger.error('Garmin client ID not configured for native gateway')
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error',
        },
        { status: 503 }
      )
    }

    const supabase = createAdminClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user?.id) {
      logger.warn('Garmin native gateway rejected invalid Supabase token', {
        hasError: Boolean(userError),
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid native session token',
        },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profile?.id) {
      logger.warn('Garmin native gateway could not resolve profile', {
        authUserId: user.id,
        hasError: Boolean(profileError),
      })
      return NextResponse.json(
        {
          success: false,
          error: 'RunSmart profile not found',
        },
        { status: 404 }
      )
    }

    const userId = asPositiveUserId((profile as { id: unknown }).id)
    if (!userId) {
      logger.error('Garmin native gateway requires a numeric profile ID for Garmin ownership', {
        authUserId: user.id,
        profileId: (profile as { id: unknown }).id,
      })
      return NextResponse.json(
        {
          success: false,
          error: 'RunSmart profile is not compatible with Garmin OAuth ownership',
        },
        { status: 409 }
      )
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const profileId = String((profile as { id: unknown }).id)
    const state = generateSignedState(userId, NATIVE_REDIRECT_URI, codeVerifier, user.id, profileId)

    const authUrl = new URL(GARMIN_OAUTH_AUTHORIZE_URL)
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', NATIVE_REDIRECT_URI)
    authUrl.searchParams.append('state', state)
    authUrl.searchParams.append('code_challenge', codeChallenge)
    authUrl.searchParams.append('code_challenge_method', 'S256')

    return NextResponse.redirect(authUrl)
  } catch (error) {
    logger.error('Garmin native gateway error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start Garmin connection',
      },
      { status: 500 }
    )
  }
}
