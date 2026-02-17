import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// DELETE - Disconnect device
// Returns success; client updates device status in Dexie.js (PWA local storage)
export async function DELETE(req: Request, { params }: { params: { deviceId: string } }) {
  try {
    const deviceId = parseInt(params.deviceId);

    if (!deviceId || isNaN(deviceId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid device ID'
      }, { status: 400 });
    }

    // Device state is managed client-side in Dexie.js
    // Client is responsible for updating connectionStatus to 'disconnected'
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
// Returns success; client applies updates in Dexie.js (PWA local storage)
export async function PUT(req: Request, { params }: { params: { deviceId: string } }) {
  try {
    const deviceId = parseInt(params.deviceId);

    if (!deviceId || isNaN(deviceId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid device ID'
      }, { status: 400 });
    }

    const updates = await req.json();

    // Device state is managed client-side in Dexie.js
    // Client is responsible for applying these updates to its local store
    return NextResponse.json({
      success: true,
      updates,
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
