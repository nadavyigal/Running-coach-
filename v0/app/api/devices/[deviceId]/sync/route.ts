import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST - Trigger manual sync for device
export async function POST(req: Request, { params }: { params: { deviceId: string } }) {
  try {
    const deviceId = parseInt(params.deviceId);

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid device ID'
      }, { status: 400 });
    }

    const device = await db.wearableDevices.get(deviceId);
    
    if (!device) {
      return NextResponse.json({
        success: false,
        error: 'Device not found'
      }, { status: 404 });
    }

    if (device.connectionStatus !== 'connected') {
      return NextResponse.json({
        success: false,
        error: 'Device is not connected'
      }, { status: 400 });
    }

    // Update sync status
    await db.wearableDevices.update(deviceId, {
      connectionStatus: 'syncing',
      updatedAt: new Date()
    });

    // Simulate sync process - in real implementation, this would:
    // 1. For Apple Watch: Query HealthKit data
    // 2. For Garmin: Call Garmin Connect API
    // 3. Process and store the data
    
    // For now, just update the last sync time
    setTimeout(async () => {
      try {
        await db.wearableDevices.update(deviceId, {
          connectionStatus: 'connected',
          lastSync: new Date(),
          updatedAt: new Date()
        });
      } catch (error) {
        logger.error('Error updating sync status:', error);
      }
    }, 2000);

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
