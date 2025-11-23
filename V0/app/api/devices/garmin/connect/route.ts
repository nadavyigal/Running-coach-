import { NextResponse } from 'next/server';
import { withAuthSecurity, ApiRequest } from '@/lib/security.middleware';
import { randomBytes } from 'crypto';

// Import the secure OAuth state storage from callback route
import { oauthStateStorage } from '../callback/route';

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

    // Garmin Connect OAuth 2.0 configuration
    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      redirectUri: redirectUri || `${req.headers.get('origin')}/garmin/callback`,
      scope: 'activities workouts heart_rate training_data',
      baseUrl: 'https://connect.garmin.com'
    };

    // Security: Never send client secret to client
    if (!garminConfig.clientId) {
      console.error('❌ Garmin client ID not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // Security: Generate cryptographically secure random state
    const state = randomBytes(32).toString('hex');

    // Security: Store state in server-side storage (not client-side IndexedDB)
    oauthStateStorage.set(state, {
      userId,
      state,
      redirectUri: garminConfig.redirectUri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

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
    console.error('Garmin OAuth initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate Garmin connection'
    }, { status: 500 });
  }
}

// Export secured handler with authentication
export const POST = withAuthSecurity(handleGarminConnect);