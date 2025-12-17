import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const { userId, deviceType, deviceId, name, model, capabilities } = await req.json();

    if (!userId || !deviceType || !deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, deviceType, deviceId'
      }, { status: 400 });
    }

    // Check if device is already connected
    const existingDevice = await db.wearableDevices
      .where({ userId, deviceId })
      .first();

    if (existingDevice) {
      // Update existing device
      await db.wearableDevices.update(existingDevice.id!, {
        connectionStatus: 'connected',
        lastSync: new Date(),
        name,
        model,
        capabilities: capabilities || [],
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        device: { ...existingDevice, connectionStatus: 'connected' },
        message: 'Device reconnected successfully'
      });
    }

    // Create new device connection
    const deviceData = {
      userId,
      type: deviceType as 'apple_watch' | 'garmin' | 'fitbit',
      deviceId,
      name: name || `${deviceType} Device`,
      model,
      connectionStatus: 'connected' as const,
      lastSync: new Date(),
      capabilities: capabilities || [],
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newDeviceId = await db.wearableDevices.add(deviceData);
    const newDevice = await db.wearableDevices.get(newDeviceId);

    return NextResponse.json({
      success: true,
      device: newDevice,
      message: 'Device connected successfully'
    });

  } catch (error) {
    logger.error('Device connection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to connect device'
    }, { status: 500 });
  }
}
