import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET - List user's connected devices
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    const devices = await db.wearableDevices
      .where('userId')
      .equals(parseInt(userId))
      .toArray();

    return NextResponse.json({
      success: true,
      devices
    });

  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch devices'
    }, { status: 500 });
  }
}