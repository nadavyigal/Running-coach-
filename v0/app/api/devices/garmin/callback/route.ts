import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { verifyAndParseState } from '../oauth-state';
import { logger } from '@/lib/logger';

// POST - Handle Garmin OAuth callback (SECURED via signed state)
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

    if (!state || typeof state !== 'string' || state.length > 512) {
      return NextResponse.json({
        success: false,
        error: 'Invalid state parameter format'
      }, { status: 400 });
    }

    // Security: Retrieve OAuth state from signed payload rather than in-memory storage
    const storedState = verifyAndParseState(state);
    if (!storedState) {
      return NextResponse.json({
        success: false,
        error: 'OAuth state not found or expired',
      }, { status: 400 });
    }

    // Security: Extract userId from secure storage (not from client)
    const userId = storedState.userId;

    // Security: Optionally verify authenticated user matches the OAuth state
    const authUserId = req.headers.get('x-user-id');
    if (authUserId && parseInt(authUserId) !== userId) {
      return NextResponse.json({
        success: false,
        error: 'User mismatch in OAuth flow',
      }, { status: 403 });
    }

    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      clientSecret: process.env.GARMIN_CLIENT_SECRET,
      baseUrl: 'https://connect.garmin.com'
    };

    // Security: Server-side validation only
    if (!garminConfig.clientId || !garminConfig.clientSecret) {
      logger.error('❌ Garmin API credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // Security: Exchange authorization code for access token (server-side only)
    try {
      const tokenResponse = await fetch(`${garminConfig.baseUrl}/oauth-service/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${garminConfig.clientId}:${garminConfig.clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: storedState.redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('❌ Token exchange failed:', errorText);
        throw new Error(`Token exchange failed with status ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();

      // Get user profile from Garmin
      const profileResponse = await fetch(`${garminConfig.baseUrl}/userprofile-service/userprofile`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userProfile = profileResponse.ok ? await profileResponse.json() : null;

      // Return device data to client for Dexie.js storage (PWA "thin backend" pattern)
      // Tokens are stored client-side in IndexedDB (browser sandbox isolation)
      const deviceData = {
        userId,
        type: 'garmin' as const,
        deviceId: userProfile?.userId
          ? `garmin-${userProfile.userId}`
          : `garmin-${userId}-${Date.now()}`,
        name: userProfile?.displayName || 'Garmin Device',
        connectionStatus: 'connected' as const,
        lastSync: new Date(),
        authTokens: {
          accessToken: tokenData.access_token as string,
          refreshToken: (tokenData.refresh_token as string | undefined),
          expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000),
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
        error: 'Failed to exchange authorization code'
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

// Export secured handler — OAuth security is provided by the signed state token
export const POST = withApiSecurity(handleGarminCallback);
