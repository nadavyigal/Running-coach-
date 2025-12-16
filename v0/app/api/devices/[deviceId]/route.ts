import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// DELETE - Disconnect device
export async function DELETE(req: Request, { params }: { params: { deviceId: string } }) {
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

    // Update device status to disconnected instead of deleting
    await db.wearableDevices.update(deviceId, {
      connectionStatus: 'disconnected',
      lastSync: null,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Device disconnected successfully'
    });

  } catch (error) {
    logger.error('Device disconnection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to disconnect device'
    }, { status: 500 });
  }
}

// PUT - Update device settings
export async function PUT(req: Request, { params }: { params: { deviceId: string } }) {
  try {
    const deviceId = parseInt(params.deviceId);
    const updates = await req.json();

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

    await db.wearableDevices.update(deviceId, {
      ...updates,
      updatedAt: new Date()
    });

    const updatedDevice = await db.wearableDevices.get(deviceId);

    return NextResponse.json({
      success: true,
      device: updatedDevice,
      message: 'Device updated successfully'
    });

  } catch (error) {
    logger.error('Device update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update device'
    }, { status: 500 });
  }
}
