import { NextResponse } from 'next/server'
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware'
import { verifyAndParseState } from '../oauth-state'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/server'
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

    const authUserId = req.headers.get('x-user-id')
    if (authUserId && Number.parseInt(authUserId, 10) !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User mismatch in OAuth flow',
        },
        { status: 403 }
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
      logger.error('Garmin token exchange failed:', tokenResponse.status, errorText)
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

    if (!tokenData.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'No access token in Garmin response',
        },
        { status: 502 }
      )
    }

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
    }

    const authUserIdFromSession = await resolveAuthUserId()
    const nowIso = new Date().toISOString()
    const expiresAtIso = new Date(Date.now() + (tokenData.expires_in ?? 7776000) * 1000).toISOString()

    await upsertGarminConnection({
      userId,
      authUserId: authUserIdFromSession,
      garminUserId: profileUserId != null ? String(profileUserId) : null,
      scopes,
      status: 'connected',
      connectedAt: nowIso,
      revokedAt: null,
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

    const deviceData = {
      userId,
      type: 'garmin' as const,
      deviceId: profileUserId ? `garmin-${profileUserId}` : `garmin-${userId}-${Date.now()}`,
      name: 'Garmin Device',
      connectionStatus: 'connected' as const,
      lastSync: nowIso,
      capabilities: ['heart_rate', 'activities', 'advanced_metrics', 'running_dynamics'],
      settings: {
        garminUserId: profileUserId != null ? String(profileUserId) : null,
        scopes,
        oauth: {
          tokensStoredServerSide: true,
          expiresAt: expiresAtIso,
        },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    return NextResponse.json({
      success: true,
      userId,
      device: deviceData,
      message: 'Garmin authorized successfully',
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
