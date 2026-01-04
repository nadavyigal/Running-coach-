import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuthSecurity, ApiRequest } from '@/lib/security.middleware';
import { encryptToken } from '../token-crypto';
import { verifyAndParseState } from '../oauth-state';
import { logger } from '@/lib/logger';
import { queueGarminSyncJob, isRedisConfigured } from '@/lib/queue/syncQueue';

// POST - Handle Garmin OAuth callback (SECURED)
async function handleGarminCallback(req: ApiRequest) {
  try {
    const { code, state, error } = await req.json();

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Garmin OAuth error: ${error}`
      }, { status: 400 });
    }

    // Security: Validate input parameters
    if (!code || typeof code !== 'string' || code.length > 512) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authorization code format'
      }, { status: 400 });
    }

    if (!state || typeof state !== 'string' || state.length > 512) {
      return NextResponse.json({
        success: false,
        error: 'Invalid state parameter format'
      }, { status: 400 });
    }

    // Security: Retrieve OAuth state from signed payload rather than in-memory storage
    const storedState = verifyAndParseState(state);
    if (!storedState) {
      return NextResponse.json({
        success: false,
        error: 'OAuth state not found or expired',
      }, { status: 400 });
    }

    // Security: Extract userId from secure storage (not from client)
    const userId = storedState.userId;

    // Security: Verify authenticated user matches the OAuth state
    const authUserId = req.headers.get('x-user-id');
    if (authUserId && parseInt(authUserId) !== userId) {
      return NextResponse.json({
        success: false,
        error: 'User mismatch in OAuth flow',
      }, { status: 403 });
    }

    const garminConfig = {
      clientId: process.env.GARMIN_CLIENT_ID,
      clientSecret: process.env.GARMIN_CLIENT_SECRET,
      baseUrl: 'https://connect.garmin.com'
    };

    // Security: Server-side validation only
    if (!garminConfig.clientId || !garminConfig.clientSecret) {
      logger.error('❌ Garmin API credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Service configuration error'
      }, { status: 503 });
    }

    // Security: Exchange authorization code for access token (server-side only)
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
          redirect_uri: storedState.redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('❌ Token exchange failed:', errorText);
        throw new Error(`Token exchange failed with status ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();

      // Get user profile from Garmin
      const profileResponse = await fetch(`${garminConfig.baseUrl}/userprofile-service/userprofile`, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userProfile = profileResponse.ok ? await profileResponse.json() : null;

      // Security: Find or create device record without relying on client-side storage
      const device = await db.wearableDevices
        .where({ userId, type: 'garmin' })
        .first();

      const deviceData = {
        deviceId: userProfile?.userId ? `garmin-${userProfile.userId}` : `garmin-${userId}-${Date.now()}`,
        name: userProfile?.displayName || 'Garmin Device',
        connectionStatus: 'connected' as const,
        lastSync: new Date(),
        // Security: Encrypt tokens before storage (reversible for API usage)
        authTokens: {
          accessToken: encryptToken(tokenData.access_token),
          refreshToken: encryptToken(tokenData.refresh_token),
          expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000))
        },
        capabilities: [
          'heart_rate',
          'activities',
          'advanced_metrics',
          'running_dynamics'
        ],
        settings: {
          userProfile,
          encryptedStorage: true // Flag to indicate tokens are encrypted
        },
        updatedAt: new Date()
      };

      let deviceId: number;
      if (device) {
        await db.wearableDevices.update(device.id!, deviceData);
        deviceId = device.id!;
      } else {
        deviceId = await db.wearableDevices.add({
          userId,
          type: 'garmin',
          ...deviceData,
          createdAt: new Date()
        }) as number;
      }

      // Queue background sync job using Redis (with in-memory fallback)
      await queueGarminSync(deviceId, userId);

      return NextResponse.json({
        success: true,
        device: {
          id: deviceId,
          name: userProfile?.displayName || 'Garmin Device',
          connectionStatus: 'connected'
        },
        message: 'Garmin device connected successfully'
      });

    } catch (tokenError) {
      logger.error('Garmin token exchange error:', tokenError);
      return NextResponse.json({
        success: false,
        error: 'Failed to exchange authorization code'
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('Garmin callback error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete Garmin connection'
    }, { status: 500 });
  }
}

// Export secured handler with authentication
export const POST = withAuthSecurity(handleGarminCallback);

// Background job queue for Garmin sync operations
// Uses Redis (BullMQ) when available, falls back to in-memory queue

interface SyncJob {
  deviceId: number;
  userId: number;
  scheduledAt: Date;
  retryCount: number;
  maxRetries: number;
}

// In-memory fallback queue (used when Redis is unavailable)
const fallbackQueue: SyncJob[] = [];
let fallbackWorkerRunning = false;

async function queueGarminSync(deviceId: number, userId: number) {
  // Try Redis queue first
  if (isRedisConfigured()) {
    const jobId = await queueGarminSyncJob({
      deviceId,
      userId,
      type: 'initial_sync',
      priority: 1, // Higher priority for initial sync
    });

    if (jobId) {
      logger.log(`[Garmin] Sync job queued to Redis: ${jobId}`);
      return;
    }
  }

  // Fallback to in-memory queue
  logger.warn('[Garmin] Using in-memory fallback queue (Redis unavailable)');
  fallbackQueue.push({
    deviceId,
    userId,
    scheduledAt: new Date(),
    retryCount: 0,
    maxRetries: 3
  });

  if (!fallbackWorkerRunning) {
    processFallbackQueue();
  }
}

async function processFallbackQueue() {
  if (fallbackWorkerRunning) return;
  fallbackWorkerRunning = true;

  while (fallbackQueue.length > 0) {
    const job = fallbackQueue.shift();
    if (!job) continue;

    try {
      await performGarminSync(job.deviceId, job.userId);
    } catch (error) {
      logger.error(`Sync failed for device ${job.deviceId}:`, error);

      // Retry logic
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        fallbackQueue.push(job);
        logger.log(`Retrying sync for device ${job.deviceId} (attempt ${job.retryCount + 1})`);
      } else {
        logger.error(`Max retries reached for device ${job.deviceId}`);
        // Mark device as error state
        try {
          await db.wearableDevices.update(job.deviceId, {
            connectionStatus: 'error',
            updatedAt: new Date()
          });
        } catch (updateError) {
          logger.error('Failed to update device status:', updateError);
        }
      }
    }

    // Small delay between jobs to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  fallbackWorkerRunning = false;
}

async function performGarminSync(deviceId: number, userId: number) {
  const device = await db.wearableDevices.get(deviceId);
  if (!device || !device.authTokens) {
    throw new Error('Device or tokens not found');
  }

  // Note: Token is encrypted, would need decryption in real implementation
  logger.log(`[Garmin] Performing sync for device ${deviceId}, user ${userId}`);

  // Update last sync time
  await db.wearableDevices.update(deviceId, {
    lastSync: new Date(),
    connectionStatus: 'connected',
    updatedAt: new Date()
  });
}
