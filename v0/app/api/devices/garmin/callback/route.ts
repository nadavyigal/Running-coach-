import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { verifyAndParseState } from '../oauth-state';
import { logger } from '@/lib/logger';

// Garmin OAuth 2.0 PKCE token endpoint
// Ref: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const GARMIN_PROFILE_URL = 'https://apis.garmin.com/wellness-api/rest/user/id';

// POST - Handle Garmin OAuth 2.0 PKCE callback (SECURED via signed state)
async function handleGarminCallback(req: ApiRequest) {
  try {
    const { code, state, error } = await req.json();

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Garmin OAuth error: ${error}`
      }, { status: 400 });
    }

    // Security: Validate input parameters
    if (!code || typeof code !== 'string' || code.length > 512) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authorization code format'
      }, { status: 400 });
    }

    // State is larger now (contains base64url-encoded PKCE code_verifier)
    if (!state || typeof state !== 'string' || state.length > 4096) {
      return NextResponse.json({
        success: false,
        error: 'Invalid state parameter format'
      }, { status: 400 });
    }

    // Security: Verify HMAC-signed state and extract payload
    const storedState = verifyAndParseState(state);
    if (!storedState) {
      return NextResponse.json({
        success: false,
        error: 'OAuth state not found or expired',
      }, { status: 400 });
    }

    // Security: Extract userId and codeVerifier from secure signed state (not from client)
    const { userId, redirectUri, codeVerifier } = storedState;

    if (!codeVerifier) {
      logger.error('Missing codeVerifier in OAuth state — state may be from old flow');
      return NextResponse.json({
        success: false,
        error: 'Invalid OAuth state: missing PKCE verifier'
      }, { status: 400 });
    }

    // Security: Optionally verify authenticated user matches the OAuth state
    const authUserId = req.headers.get('x-user-id');
    if (authUserId && parseInt(authUserId) !== userId) {
      return NextResponse.json({
        success: false,
        error: 'User mismatch in OAuth flow',
      }, { status: 403 });
    }

    const clientId = process.env.GARMIN_CLIENT_ID;
    const clientSecret = process.env.GARMIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('❌ Garmin API credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // Exchange authorization code for access token using OAuth 2.0 PKCE
    // POST to Garmin token endpoint with code_verifier (PKCE proof)
    try {
      const tokenResponse = await fetch(GARMIN_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('❌ Garmin token exchange failed:', tokenResponse.status, errorText);
        throw new Error(`Token exchange failed with status ${tokenResponse.status}: ${errorText}`);
      }

      const tokenData = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      };

      if (!tokenData.access_token) {
        throw new Error('No access_token in Garmin token response');
      }

      // Fetch Garmin user identifier from wellness API.
      const profileResponse = await fetch(GARMIN_PROFILE_URL, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userProfile = profileResponse.ok ? await profileResponse.json() : null;
      const profileUserId =
        (typeof userProfile === 'object' && userProfile !== null && (
          (userProfile as { userId?: string | number }).userId ??
          (userProfile as { id?: string | number }).id
        )) ??
        (typeof userProfile === 'string' ? userProfile : null);

      // Return device data to client for Dexie.js storage (PWA "thin backend" pattern)
      // Tokens are stored client-side in IndexedDB (browser sandbox isolation)
      const deviceData = {
        userId,
        type: 'garmin' as const,
        deviceId: profileUserId
          ? `garmin-${profileUserId}`
          : `garmin-${userId}-${Date.now()}`,
        name: 'Garmin Device',
        connectionStatus: 'connected' as const,
        lastSync: new Date(),
        authTokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          // Garmin access tokens expire after ~3 months; expires_in may be in seconds
          expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 7776000) * 1000),
        },
        capabilities: [
          'heart_rate',
          'activities',
          'advanced_metrics',
          'running_dynamics',
        ],
        settings: {
          userProfile,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return NextResponse.json({
        success: true,
        userId,
        device: deviceData,
        message: 'Garmin authorized successfully',
      });

    } catch (tokenError) {
      logger.error('Garmin token exchange error:', tokenError);
      return NextResponse.json({
        success: false,
        error: tokenError instanceof Error ? tokenError.message : 'Failed to exchange authorization code'
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('Garmin callback error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete Garmin connection'
    }, { status: 500 });
  }
}

// Export secured handler — OAuth security provided by HMAC-signed state token
export const POST = withApiSecurity(handleGarminCallback);
