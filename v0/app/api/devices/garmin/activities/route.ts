import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decryptToken } from '../token-crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET - List Garmin activities
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const start = parseInt(searchParams.get('start') || '0');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Find user's Garmin device
    const garminDevice = await db.wearableDevices
      .where({ userId: parseInt(userId), type: 'garmin' })
      .and(d => d.connectionStatus === 'connected')
      .first();

    if (!garminDevice) {
      return NextResponse.json({
        success: false,
        error: 'No connected Garmin device found'
      }, { status: 404 });
    }

    if (!garminDevice.authTokens?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Garmin device not properly authenticated'
      }, { status: 401 });
    }

    const garminConfig = {
      baseUrl: 'https://connect.garmin.com'
    };

    let accessToken: string;

    try {
      accessToken = decryptToken(garminDevice.authTokens.accessToken);
    } catch (tokenError) {
      console.error('Failed to decrypt Garmin access token', tokenError);
      return NextResponse.json({
        success: false,
        error: 'Garmin device authentication invalid, please reconnect',
        needsReauth: true
      }, { status: 401 });
    }

    try {
      // Fetch activities from Garmin Connect
      const activitiesResponse = await fetch(
        `${garminConfig.baseUrl}/activitylist-service/activities/search/activities?start=${start}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!activitiesResponse.ok) {
        if (activitiesResponse.status === 401) {
          // Token expired, mark device as needing re-authentication
          await db.wearableDevices.update(garminDevice.id!, {
            connectionStatus: 'error',
            updatedAt: new Date()
          });
          
          return NextResponse.json({
            success: false,
            error: 'Authentication expired, please reconnect your Garmin device',
            needsReauth: true
          }, { status: 401 });
        }
        
        throw new Error(`Garmin API error: ${activitiesResponse.status}`);
      }

      const activities = await activitiesResponse.json();

      // Filter running activities and format data
      const runningActivities = activities.filter((activity: any) => 
        activity.activityType?.typeKey === 'running'
      ).map((activity: any) => ({
        activityId: activity.activityId,
        activityName: activity.activityName,
        startTimeGMT: activity.startTimeGMT,
        distance: activity.distance / 1000, // Convert to km
        duration: activity.duration / 1000, // Convert to seconds
        averageHR: activity.averageHR,
        maxHR: activity.maxHR,
        calories: activity.calories,
        averagePace: activity.averageSpeed ? (1000 / activity.averageSpeed) : null, // Convert to pace (s/km)
        elevationGain: activity.elevationGain,
        activityType: activity.activityType?.typeKey,
        sportType: activity.sportType?.sportTypeKey
      }));

      return NextResponse.json({
        success: true,
        activities: runningActivities,
        totalCount: activities.length,
        runningCount: runningActivities.length
      });

    } catch (apiError) {
      console.error('Garmin API error:', apiError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch activities from Garmin Connect'
      }, { status: 502 });
    }

  } catch (error) {
    console.error('Error fetching Garmin activities:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Garmin activities'
    }, { status: 500 });
  }
}