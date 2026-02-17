import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { generateSignedState } from '../oauth-state';

// POST - Initiate Garmin OAuth flow (SECURED)
async function handleGarminConnect(req: ApiRequest) {
  try {
    const { userId, redirectUri } = await req.json();

    // Security: Validate userId
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Valid User ID is required'
      }, { status: 400 });
    }

    // Security: Verify authenticated user matches requested userId
    const authUserId = req.headers.get('x-user-id');
    if (authUserId && parseInt(authUserId) !== userId) {
      return NextResponse.json({
        success: false,
        error: 'User mismatch'
      }, { status: 403 });
    }

    // Security: Validate and sanitize redirectUri
    if (redirectUri && typeof redirectUri !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Invalid redirect URI'
      }, { status: 400 });
    }

    const envRedirectUri = process.env.GARMIN_OAUTH_REDIRECT_URI?.trim();
    const requestRedirectUri = typeof redirectUri === 'string' ? redirectUri.trim() : '';
    const origin = req.headers.get('origin')?.trim();
    const fallbackRedirectUri = origin ? `${origin}/garmin/callback` : '';
    const resolvedRedirectUri = envRedirectUri || requestRedirectUri || fallbackRedirectUri;

    if (!resolvedRedirectUri) {
      logger.error('Garmin redirect URI not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    let parsedRedirectUri: URL;
    try {
      parsedRedirectUri = new URL(resolvedRedirectUri);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid redirect URI'
      }, { status: 400 });
    }

    if (!['https:', 'http:'].includes(parsedRedirectUri.protocol)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid redirect URI protocol'
      }, { status: 400 });
    }

    // Garmin Connect OAuth 2.0 configuration
    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      redirectUri: parsedRedirectUri.toString(),
      scope: 'activities workouts heart_rate training_data',
      baseUrl: 'https://connect.garmin.com'
    };

    // Security: Never send client secret to client
    if (!garminConfig.clientId) {
      logger.error('Garmin client ID not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // Security: Generate cryptographically secure signed state (stateless verification)
    const state = generateSignedState(userId, garminConfig.redirectUri);

    // Generate OAuth authorization URL
    const authUrl = new URL(`${garminConfig.baseUrl}/oauth-service/oauth/preauthorized`);

    authUrl.searchParams.append('oauth_client_id', garminConfig.clientId);
    authUrl.searchParams.append('oauth_response_type', 'code');
    authUrl.searchParams.append('oauth_redirect_uri', garminConfig.redirectUri);
    authUrl.searchParams.append('oauth_scope', garminConfig.scope);
    authUrl.searchParams.append('oauth_state', state);

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
      // Security: Don't send state to client - it's stored server-side
    });

  } catch (error) {
    logger.error('Garmin OAuth initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate Garmin connection'
    }, { status: 500 });
  }
}

// Export secured handler with authentication
export const POST = withApiSecurity(handleGarminConnect);
