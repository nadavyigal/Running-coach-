import { NextResponse } from 'next/server'
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware'
import { verifyAndParseState } from '../oauth-state'
import { logger } from '@/lib/logger'
import { getCurrentProfile, getCurrentUser } from '@/lib/supabase/server'
import { enqueueGarminBackfillJob } from '@/lib/integrations/garmin/service'
import {
  upsertGarminConnection,
  upsertGarminTokens,
} from '@/lib/server/garmin-oauth-store'

const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token'
const GARMIN_PROFILE_URL = 'https://apis.garmin.com/wellness-api/rest/user/id'
const GARMIN_PERMISSIONS_URL = 'https://apis.garmin.com/wellness-api/rest/user/permissions'

async function resolveAuthUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser()
    return user?.id ?? null
  } catch (error) {
    logger.warn('Unable to resolve Supabase auth user in Garmin callback:', error)
    return null
  }
}

async function resolveCurrentProfileId(): Promise<string | null> {
  try {
    const profile = await getCurrentProfile()
    return typeof profile?.id === 'string' ? profile.id : null
  } catch (error) {
    logger.warn('Unable to resolve Supabase profile in Garmin callback:', error)
    return null
  }
}

async function handleGarminCallback(req: ApiRequest) {
  try {
    const { code, state, error } = await req.json()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Garmin OAuth error: ${error}`,
        },
        { status: 400 }
      )
    }

    if (!code || typeof code !== 'string' || code.length > 512) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authorization code format',
        },
        { status: 400 }
      )
    }

    if (!state || typeof state !== 'string' || state.length > 4096) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid state parameter format',
        },
        { status: 400 }
      )
    }

    const storedState = verifyAndParseState(state)
    if (!storedState) {
      return NextResponse.json(
        {
          success: false,
          error: 'OAuth state not found or expired',
        },
        { status: 400 }
      )
    }

    const { userId, redirectUri, codeVerifier } = storedState
    if (!codeVerifier) {
      logger.error('Missing codeVerifier in OAuth state - state may be from an outdated flow')
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid OAuth state: missing PKCE verifier',
        },
        { status: 400 }
      )
    }

    const clientId = process.env.GARMIN_CLIENT_ID
    const clientSecret = process.env.GARMIN_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      logger.error('Garmin API credentials not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error',
        },
        { status: 503 }
      )
    }

    logger.info('Garmin token exchange starting', {
      redirectUri,
      codeLength: code.length,
      codeVerifierLength: codeVerifier.length,
    })

    const tokenResponse = await fetch(GARMIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Garmin token exchange failed', {
        status: tokenResponse.status,
        body: errorText.slice(0, 500),
        redirectUri,
      })
      return NextResponse.json(
        {
          success: false,
          error: `Token exchange failed with status ${tokenResponse.status}`,
        },
        { status: 502 }
      )
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    if (!tokenData.access_token || tokenData.access_token.trim().length < 10) {
      logger.error('Garmin token exchange returned invalid access token', {
        hasToken: Boolean(tokenData.access_token),
        tokenLength: tokenData.access_token?.length ?? 0,
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Garmin returned an invalid access token',
        },
        { status: 502 }
      )
    }

    logger.info('Garmin token exchange successful', {
      tokenLength: tokenData.access_token.length,
      hasRefreshToken: Boolean(tokenData.refresh_token),
      expiresIn: tokenData.expires_in,
    })

    const [profileResponse, permissionsResponse] = await Promise.all([
      fetch(GARMIN_PROFILE_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      }),
      fetch(GARMIN_PERMISSIONS_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      }),
    ])

    const warnings: string[] = []

    if (!profileResponse.ok) {
      const profileErrorText = await profileResponse.text()
      logger.warn('Garmin profile fetch failed during callback', {
        status: profileResponse.status,
        body: profileErrorText.slice(0, 500),
      })
      warnings.push(`Profile fetch failed (${profileResponse.status})`)
    }

    const userProfile = profileResponse.ok ? await profileResponse.json() : null
    const profileUserId =
      (typeof userProfile === 'object' &&
        userProfile !== null &&
        ((userProfile as { userId?: string | number }).userId ??
          (userProfile as { id?: string | number }).id)) ??
      (typeof userProfile === 'string' ? userProfile : null)

    let scopes: string[] = []
    if (permissionsResponse.ok) {
      const permissionsPayload = (await permissionsResponse.json()) as unknown
      if (Array.isArray(permissionsPayload)) {
        scopes = permissionsPayload.filter((scope): scope is string => typeof scope === 'string')
      }
    } else {
      const permErrorText = await permissionsResponse.text()
      logger.warn('Garmin permissions fetch failed during callback', {
        status: permissionsResponse.status,
        body: permErrorText.slice(0, 500),
      })
      warnings.push(`Permissions fetch failed (${permissionsResponse.status})`)
    }

    const [authUserIdFromSession, profileIdFromSession] = await Promise.all([
      resolveAuthUserId(),
      resolveCurrentProfileId(),
    ])
    const nowIso = new Date().toISOString()
    const expiresAtIso = new Date(Date.now() + (tokenData.expires_in ?? 7776000) * 1000).toISOString()

    await upsertGarminConnection({
      userId,
      authUserId: authUserIdFromSession,
      profileId: profileIdFromSession,
      garminUserId: profileUserId != null ? String(profileUserId) : null,
      providerUserId: profileUserId != null ? String(profileUserId) : null,
      scopes,
      status: 'connected',
      connectedAt: nowIso,
      revokedAt: null,
      lastSyncError: null,
      errorState: null,
    })

    await upsertGarminTokens({
      userId,
      authUserId: authUserIdFromSession,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: expiresAtIso,
      rotatedAt: nowIso,
    })

    try {
      await enqueueGarminBackfillJob({
        userId,
        profileId: profileIdFromSession,
        providerUserId: profileUserId != null ? String(profileUserId) : null,
      })
    } catch (backfillError) {
      // Non-fatal: the OAuth connection is established. Log and continue.
      warnings.push('Garmin connected. Initial sync queue was unavailable; use Sync Garmin to import data now.')
      logger.warn('Failed to enqueue Garmin backfill job after connect (non-fatal)', {
        userId,
        error: backfillError instanceof Error ? backfillError.message : 'unknown',
      })
    }

    const deviceData = {
      userId,
      type: 'garmin' as const,
      deviceId: profileUserId ? `garmin-${profileUserId}` : `garmin-${userId}-${Date.now()}`,
      name: 'Garmin Device',
      connectionStatus: 'syncing' as const,
      lastSync: null,
      capabilities: ['heart_rate', 'activities', 'advanced_metrics', 'running_dynamics'],
      settings: {
        garminUserId: profileUserId != null ? String(profileUserId) : null,
        scopes,
        oauth: {
          tokensStoredServerSide: true,
          expiresAt: expiresAtIso,
        },
        syncState: 'syncing',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    return NextResponse.json({
      success: true,
      userId,
      device: deviceData,
      message: 'Garmin authorized successfully',
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (error) {
    logger.error('Garmin callback error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete Garmin connection',
      },
      { status: 500 }
    )
  }
}

export const POST = withApiSecurity(handleGarminCallback)
