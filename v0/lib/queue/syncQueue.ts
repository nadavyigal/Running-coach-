import { Queue, QueueEvents } from 'bullmq';
import { logger } from '@/lib/logger';

// Redis connection configuration
const getConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined
});

// Job data types
export interface GarminSyncJobData {
  deviceId: number;
  userId: number;
  type: 'initial_sync' | 'scheduled_sync' | 'manual_sync';
  priority?: number;
}

export interface AiActivityJobData {
  activityId: number;
  userId: number;
  imageUrl?: string;
  type: 'analyze' | 'generate_insights';
}

// Queue instances (lazy initialization)
let garminSyncQueue: Queue<GarminSyncJobData> | null = null;
let aiActivityQueue: Queue<AiActivityJobData> | null = null;
let queueEvents: QueueEvents | null = null;

// Check if Redis is available
function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_HOST || process.env.REDIS_URL);
}

// Get or create the Garmin sync queue
function getGarminSyncQueue(): Queue<GarminSyncJobData> | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!garminSyncQueue) {
    try {
      garminSyncQueue = new Queue<GarminSyncJobData>('garmin-sync', {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 24 * 3600, // 24 hours
          },
          removeOnFail: {
            count: 50, // Keep last 50 failed jobs for debugging
          },
        },
      });

      logger.log('[Queue] Garmin sync queue initialized');
    } catch (error) {
      logger.error('[Queue] Failed to initialize Garmin sync queue:', error);
      return null;
    }
  }

  return garminSyncQueue;
}

// Get or create the AI activity queue (connects to existing worker)
function getAiActivityQueue(): Queue<AiActivityJobData> | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!aiActivityQueue) {
    try {
      aiActivityQueue = new Queue<AiActivityJobData>('ai-activity', {
        connection: getConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 100,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 50,
          },
        },
      });

      logger.log('[Queue] AI activity queue initialized');
    } catch (error) {
      logger.error('[Queue] Failed to initialize AI activity queue:', error);
      return null;
    }
  }

  return aiActivityQueue;
}

// Queue a Garmin sync job
export async function queueGarminSyncJob(data: GarminSyncJobData): Promise<string | null> {
  const queue = getGarminSyncQueue();

  if (!queue) {
    logger.warn('[Queue] Redis not configured, falling back to in-memory processing');
    return null;
  }

  try {
    const job = await queue.add('sync', data, {
      priority: data.priority || 0,
      jobId: `garmin-sync-${data.deviceId}-${Date.now()}`,
    });

    logger.log(`[Queue] Garmin sync job queued: ${job.id}`);
    return job.id || null;
  } catch (error) {
    logger.error('[Queue] Failed to queue Garmin sync job:', error);
    return null;
  }
}

// Queue an AI activity analysis job
export async function queueAiActivityJob(data: AiActivityJobData): Promise<string | null> {
  const queue = getAiActivityQueue();

  if (!queue) {
    logger.warn('[Queue] Redis not configured, falling back to direct processing');
    return null;
  }

  try {
    const job = await queue.add('analyze', data, {
      jobId: `ai-activity-${data.activityId}-${Date.now()}`,
    });

    logger.log(`[Queue] AI activity job queued: ${job.id}`);
    return job.id || null;
  } catch (error) {
    logger.error('[Queue] Failed to queue AI activity job:', error);
    return null;
  }
}

// Check queue health
export async function getQueueHealth(): Promise<{
  garminSync: { available: boolean; waiting?: number; active?: number };
  aiActivity: { available: boolean; waiting?: number; active?: number };
}> {
  const result = {
    garminSync: { available: false as boolean, waiting: undefined as number | undefined, active: undefined as number | undefined },
    aiActivity: { available: false as boolean, waiting: undefined as number | undefined, active: undefined as number | undefined },
  };

  const garminQueue = getGarminSyncQueue();
  if (garminQueue) {
    try {
      const counts = await garminQueue.getJobCounts('waiting', 'active');
      result.garminSync = {
        available: true,
        waiting: counts.waiting,
        active: counts.active,
      };
    } catch {
      result.garminSync.available = false;
    }
  }

  const aiQueue = getAiActivityQueue();
  if (aiQueue) {
    try {
      const counts = await aiQueue.getJobCounts('waiting', 'active');
      result.aiActivity = {
        available: true,
        waiting: counts.waiting,
        active: counts.active,
      };
    } catch {
      result.aiActivity.available = false;
    }
  }

  return result;
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (garminSyncQueue) {
    closePromises.push(garminSyncQueue.close());
  }

  if (aiActivityQueue) {
    closePromises.push(aiActivityQueue.close());
  }

  if (queueEvents) {
    closePromises.push(queueEvents.close());
  }

  await Promise.all(closePromises);

  garminSyncQueue = null;
  aiActivityQueue = null;
  queueEvents = null;

  logger.log('[Queue] All queues closed');
}

// Export for testing
export { isRedisConfigured };
