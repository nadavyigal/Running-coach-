import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Handle Garmin OAuth callback
export async function POST(req: Request) {
  try {
    const { code, state, error } = await req.json();

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Garmin OAuth error: ${error}`
      }, { status: 400 });
    }

    if (!code || !state) {
      return NextResponse.json({
        success: false,
        error: 'Missing authorization code or state'
      }, { status: 400 });
    }

    // Parse state to get user ID
    const [userId] = state.split('-');
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid state parameter'
      }, { status: 400 });
    }

    // Find device with matching OAuth state
    const device = await db.wearableDevices
      .where({ userId: parseInt(userId), type: 'garmin' })
      .and(d => d.settings?.oauthState?.state === state)
      .first();

    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'OAuth state not found or expired'
      }, { status: 400 });
    }

    // Check if OAuth state is expired
    const oauthState = device.settings.oauthState;
    if (new Date() > new Date(oauthState.expiresAt)) {
      return NextResponse.json({
        success: false,
        error: 'OAuth state expired'
      }, { status: 400 });
    }

    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      clientSecret: process.env.GARMIN_CLIENT_SECRET,
      baseUrl: 'https://connect.garmin.com'
    };

    if (!garminConfig.clientId || !garminConfig.clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Garmin Connect API credentials not configured'
      }, { status: 503 });
    }

    // Exchange authorization code for access token
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
          redirect_uri: oauthState.redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Get user profile from Garmin
      const profileResponse = await fetch(`${garminConfig.baseUrl}/userprofile-service/userprofile`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userProfile = profileResponse.ok ? await profileResponse.json() : null;

      // Update device with connection info
      await db.wearableDevices.update(device.id!, {
        deviceId: userProfile?.userId ? `garmin-${userProfile.userId}` : device.deviceId,
        name: userProfile?.displayName || 'Garmin Device',
        connectionStatus: 'connected',
        lastSync: new Date(),
        authTokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000))
        },
        capabilities: [
          'heart_rate',
          'activities',
          'advanced_metrics',
          'running_dynamics'
        ],
        settings: {
          ...device.settings,
          userProfile,
          oauthState: undefined // Clear OAuth state
        },
        updatedAt: new Date()
      });

      // Trigger initial sync
      setTimeout(async () => {
        try {
          await syncGarminData(device.id!, tokenData.access_token);
        } catch (syncError) {
          console.error('Initial Garmin sync failed:', syncError);
        }
      }, 1000);

      return NextResponse.json({
        success: true,
        device: {
          id: device.id,
          name: userProfile?.displayName || 'Garmin Device',
          connectionStatus: 'connected'
        },
        message: 'Garmin device connected successfully'
      });

    } catch (tokenError) {
      console.error('Garmin token exchange error:', tokenError);
      return NextResponse.json({
        success: false,
        error: 'Failed to exchange authorization code'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Garmin callback error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete Garmin connection'
    }, { status: 500 });
  }
}

// Helper function to sync initial Garmin data
async function syncGarminData(deviceDbId: number, accessToken: string) {
  const garminConfig = {
    baseUrl: 'https://connect.garmin.com'
  };

  try {
    // Fetch recent activities (last 30 days)
    const activitiesResponse = await fetch(
      `${garminConfig.baseUrl}/activitylist-service/activities/search/activities?start=0&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!activitiesResponse.ok) {
      throw new Error('Failed to fetch Garmin activities');
    }

    const activities = await activitiesResponse.json();
    console.log(`Fetched ${activities.length} Garmin activities for initial sync`);

    // Process activities and store metrics
    // This is a simplified version - full implementation would process detailed activity data
    
    await db.wearableDevices.update(deviceDbId, {
      lastSync: new Date(),
      connectionStatus: 'connected',
      settings: {
        lastSyncActivities: activities.length,
        lastSyncDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Garmin data sync error:', error);
    await db.wearableDevices.update(deviceDbId, {
      connectionStatus: 'error'
    });
  }
}