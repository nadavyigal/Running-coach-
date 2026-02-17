import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET - List Garmin activities
// The client reads the access token from its local Dexie.js store and passes it
// via Authorization: Bearer <token> — the server proxies the request to Garmin.
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

    // Token is provided by the client (stored in client-side Dexie.js / IndexedDB)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Authorization token required — please reconnect your Garmin device',
        needsReauth: true
      }, { status: 401 });
    }

    const accessToken = authHeader.slice(7); // Remove "Bearer " prefix

    const garminConfig = {
      baseUrl: 'https://connect.garmin.com'
    };

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
          // Token expired — signal client to reconnect (client updates Dexie.js)
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
      logger.error('Garmin API error:', apiError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch activities from Garmin Connect'
      }, { status: 502 });
    }

  } catch (error) {
    logger.error('Error fetching Garmin activities:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Garmin activities'
    }, { status: 500 });
  }
}
