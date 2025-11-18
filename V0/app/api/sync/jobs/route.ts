import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { backgroundSync } from '@/lib/backgroundSync';
import { 
  validateRequired, 
  validateEnum, 
  NotFoundError, 
  ValidationError,
  safeDbOperation,
  logRequest
} from '@/lib/errorHandling';
import { withErrorHandling } from '@/lib/serverErrorHandling';

// GET - Get sync jobs for a user
export const GET = withErrorHandling(async (req: Request) => {
  logRequest(req, { endpoint: 'sync-jobs-get' });
  
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '10');
  const status = searchParams.get('status');

  validateRequired({ userId }, ['userId']);

  const jobs = await safeDbOperation(async () => {
    let query = db.syncJobs.where('userId').equals(parseInt(userId));
    
    if (status) {
      query = query.and(job => job.status === status);
    }

    return await query
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
  }, 'fetch sync jobs');

  // Get summary stats
  const stats = await safeDbOperation(async () => {
    return await db.syncJobs
      .where('userId')
      .equals(parseInt(userId))
      .toArray();
  }, 'fetch sync stats');

  const statusCounts = stats.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    success: true,
    jobs,
    stats: {
      total: stats.length,
      ...statusCounts
    }
  });
});

// POST - Schedule a new sync job
export async function POST(req: Request) {
  try {
    const { 
      userId, 
      deviceId, 
      type, 
      priority = 'normal',
      delayMs = 0 
    } = await req.json();

    if (!userId || !deviceId || !type) {
      return NextResponse.json({
        success: false,
        error: 'User ID, device ID, and type are required'
      }, { status: 400 });
    }

    // Validate type
    const validTypes = ['activities', 'heart_rate', 'metrics', 'full_sync'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sync type. Must be one of: ' + validTypes.join(', ')
      }, { status: 400 });
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid priority. Must be one of: ' + validPriorities.join(', ')
      }, { status: 400 });
    }

    // Check if device exists and is connected
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
        error: 'Device must be connected to schedule sync'
      }, { status: 400 });
    }

    // Schedule the sync job
    const jobId = await backgroundSync.scheduleSync(
      userId,
      deviceId,
      type,
      priority,
      delayMs
    );

    const job = await db.syncJobs.get(jobId);

    return NextResponse.json({
      success: true,
      job,
      message: 'Sync job scheduled successfully'
    });

  } catch (error) {
    console.error('Error scheduling sync job:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to schedule sync job'
    }, { status: 500 });
  }
}

// DELETE - Cancel sync jobs
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const userId = searchParams.get('userId');
    const cancelAll = searchParams.get('cancelAll') === 'true';

    if (jobId) {
      // Cancel specific job
      const success = await backgroundSync.cancelJob(parseInt(jobId));
      
      if (!success) {
        return NextResponse.json({
          success: false,
          error: 'Job not found or cannot be cancelled'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Sync job cancelled successfully'
      });

    } else if (userId && cancelAll) {
      // Cancel all pending jobs for user
      const pendingJobs = await db.syncJobs
        .where('userId')
        .equals(parseInt(userId))
        .and(job => job.status === 'pending')
        .toArray();

      let cancelledCount = 0;
      for (const job of pendingJobs) {
        const success = await backgroundSync.cancelJob(job.id!);
        if (success) cancelledCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Cancelled ${cancelledCount} pending sync jobs`
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Either jobId or userId with cancelAll=true is required'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error cancelling sync jobs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cancel sync jobs'
    }, { status: 500 });
  }
}
