import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// POST - Trigger manual sync for device
// Returns success; client manages sync state in Dexie.js (PWA local storage)
// Actual data fetching happens via /api/devices/garmin/activities (client sends Bearer token)
export async function POST(req: Request, { params }: { params: { deviceId: string } }) {
  try {
    const deviceId = parseInt(params.deviceId);

    if (!deviceId || isNaN(deviceId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid device ID'
      }, { status: 400 });
    }

    // Device state is managed client-side in Dexie.js
    // Client is responsible for updating connectionStatus to 'syncing' → 'connected'
    // and calling /api/devices/garmin/activities with its stored Bearer token
    return NextResponse.json({
      success: true,
      message: 'Sync initiated successfully'
    });

  } catch (error) {
    logger.error('Device sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to sync device'
    }, { status: 500 });
  }
}
