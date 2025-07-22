import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Initiate Garmin OAuth flow
export async function POST(req: Request) {
  try {
    const { userId, redirectUri } = await req.json();

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Garmin Connect OAuth 2.0 configuration
    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      clientSecret: process.env.GARMIN_CLIENT_SECRET,
      redirectUri: redirectUri || `${req.headers.get('origin')}/garmin/callback`,
      scope: 'activities workouts heart_rate training_data',
      baseUrl: 'https://connect.garmin.com'
    };

    if (!garminConfig.clientId || !garminConfig.clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Garmin Connect API credentials not configured'
      }, { status: 503 });
    }

    // Generate OAuth authorization URL
    const state = `${userId}-${Date.now()}`;
    const authUrl = new URL(`${garminConfig.baseUrl}/oauth-service/oauth/preauthorized`);
    
    authUrl.searchParams.append('oauth_client_id', garminConfig.clientId);
    authUrl.searchParams.append('oauth_response_type', 'code');
    authUrl.searchParams.append('oauth_redirect_uri', garminConfig.redirectUri);
    authUrl.searchParams.append('oauth_scope', garminConfig.scope);
    authUrl.searchParams.append('oauth_state', state);

    // Store OAuth state temporarily (in production, use Redis or secure storage)
    // For now, we'll store it in the database with an expiration
    const oauthState = {
      userId: parseInt(userId),
      state,
      redirectUri: garminConfig.redirectUri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    // Clean up old OAuth states
    await db.wearableDevices
      .where('userId')
      .equals(parseInt(userId))
      .and(device => device.type === 'garmin' && device.settings?.oauthState)
      .modify(device => {
        delete device.settings.oauthState;
      });

    // Store OAuth state
    const existingGarminDevice = await db.wearableDevices
      .where({ userId: parseInt(userId), type: 'garmin' })
      .first();

    if (existingGarminDevice) {
      await db.wearableDevices.update(existingGarminDevice.id!, {
        settings: { 
          ...existingGarminDevice.settings, 
          oauthState 
        },
        updatedAt: new Date()
      });
    } else {
      await db.wearableDevices.add({
        userId: parseInt(userId),
        type: 'garmin',
        deviceId: `garmin-${userId}-${Date.now()}`,
        name: 'Garmin Device',
        connectionStatus: 'disconnected',
        lastSync: null,
        capabilities: [],
        settings: { oauthState },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state
    });

  } catch (error) {
    console.error('Garmin OAuth initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate Garmin connection'
    }, { status: 500 });
  }
}