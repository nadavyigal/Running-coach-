import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { generateSignedState, generateCodeVerifier, generateCodeChallenge } from '../oauth-state';

// POST - Initiate Garmin OAuth 2.0 PKCE flow (SECURED)
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

    const clientId = process.env.GARMIN_CLIENT_ID;
    if (!clientId) {
      logger.error('Garmin client ID not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // PKCE: Generate code_verifier (kept server-side in signed state) and code_challenge (sent to Garmin)
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Embed code_verifier securely in the signed state so callback can retrieve it
    const state = generateSignedState(userId, parsedRedirectUri.toString(), codeVerifier);

    // Garmin Connect OAuth 2.0 PKCE authorization URL
    // Ref: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_1.pdf
    const authUrl = new URL('https://connect.garmin.com/oauth2Confirm');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', parsedRedirectUri.toString());
    // NOTE: Garmin OAuth2 PKCE does not use a scope parameter in the authorization request.
    // Data access is controlled via API Configuration in the Garmin Developer Portal.
    // Ref: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE_2.pdf
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    });

  } catch (error) {
    logger.error('Garmin OAuth initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate Garmin connection'
    }, { status: 500 });
  }
}

export const POST = withApiSecurity(handleGarminConnect);
