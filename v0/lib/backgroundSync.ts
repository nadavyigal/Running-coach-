import { db } from './db';

export interface SyncJob {
  id?: number;
  userId: number;
  deviceId: number;
  type: 'activities' | 'heart_rate' | 'metrics' | 'full_sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  progress?: number;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private _isRunning = false;

  public isRunning(): boolean {
    return this._isRunning;
  }
  private activeJobs = new Set<number>();
  private readonly maxConcurrentJobs = 3;
  private readonly syncIntervalMs = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  start() {
    if (this._isRunning) return;
    
    this._isRunning = true;
    console.log('Background sync manager started');
    
    this.syncInterval = setInterval(() => {
      this.processPendingJobs();
    }, this.syncIntervalMs);

    // Process any pending jobs immediately
    this.processPendingJobs();
  }

  stop() {
    if (!this._isRunning) return;
    
    this._isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('Background sync manager stopped');
  }

  async scheduleSync(
    userId: number,
    deviceId: number,
    type: SyncJob['type'],
    priority: SyncJob['priority'] = 'normal',
    delayMs = 0
  ): Promise<number> {
    const scheduledAt = new Date(Date.now() + delayMs);
    
    // Check if similar job already exists
    const existingJob = await db.syncJobs
      .where(['userId', 'deviceId', 'type'])
      .equals([userId, deviceId, type])
      .and(job => job.status === 'pending' || job.status === 'running')
      .first();

    if (existingJob) {
      console.log(`Sync job already exists for user ${userId}, device ${deviceId}, type ${type}`);
      return existingJob.id!;
    }

    const jobId = await db.syncJobs.add({
      userId,
      deviceId,
      type,
      status: 'pending',
      priority,
      scheduledAt,
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`Scheduled sync job ${jobId} for user ${userId}, device ${deviceId}, type ${type}`);
    return jobId;
  }

  async cancelJob(jobId: number): Promise<boolean> {
    try {
      const job = await db.syncJobs.get(jobId);
      if (!job) return false;

      if (job.status === 'running') {
        // Can't cancel running jobs, but mark for cancellation
        await db.syncJobs.update(jobId, {
          status: 'cancelled',
          updatedAt: new Date()
        });
        return true;
      }

      if (job.status === 'pending') {
        await db.syncJobs.update(jobId, {
          status: 'cancelled',
          updatedAt: new Date()
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  async getJobStatus(jobId: number): Promise<SyncJob | null> {
    try {
      return await db.syncJobs.get(jobId);
    } catch (error) {
      console.error('Error getting job status:', error);
      return null;
    }
  }

  async getUserJobs(userId: number, limit = 10): Promise<SyncJob[]> {
    try {
      return await db.syncJobs
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('createdAt')
        .then(results => results.slice(0, limit));
    } catch (error) {
      console.error('Error getting user jobs:', error);
      return [];
    }
  }

  private async processPendingJobs() {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    try {
      const pendingJobs = await db.syncJobs
        .where('status')
        .equals('pending')
        .and(job => job.scheduledAt <= new Date())
        .sortBy('priority')
        .then(results => results.reverse().slice(0, this.maxConcurrentJobs - this.activeJobs.size));

      for (const job of pendingJobs) {
        if (this.activeJobs.size >= this.maxConcurrentJobs) break;
        
        this.processJob(job);
      }
    } catch (error) {
      console.error('Error processing pending jobs:', error);
    }
  }

  private async processJob(job: SyncJob) {
    if (this.activeJobs.has(job.id!)) return;
    
    this.activeJobs.add(job.id!);
    
    try {
      await db.syncJobs.update(job.id!, {
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Starting sync job ${job.id} - ${job.type} for device ${job.deviceId}`);

      await this.executeSync(job);

      await db.syncJobs.update(job.id!, {
        status: 'completed',
        completedAt: new Date(),
        progress: 100,
        updatedAt: new Date()
      });

      console.log(`Completed sync job ${job.id}`);

    } catch (error) {
      console.error(`Error in sync job ${job.id}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = job.retryCount + 1;
      const isRetryable = ![
        'Device not found',
        'Unsupported device type',
        'Device not connected'
      ].includes(errorMessage);

      if (!isRetryable || newRetryCount >= job.maxRetries) {
        await db.syncJobs.update(job.id!, {
          status: 'failed',
          errorMessage,
          retryCount: newRetryCount,
          updatedAt: new Date()
        });
      } else {
        // Schedule retry with exponential backoff
        const retryDelayMs = Math.pow(2, newRetryCount) * 60000; // 2^n minutes
        await db.syncJobs.update(job.id!, {
          status: 'pending',
          scheduledAt: new Date(Date.now() + retryDelayMs),
          retryCount: newRetryCount,
          errorMessage,
          updatedAt: new Date()
        });
      }
    } finally {
      this.activeJobs.delete(job.id!);
    }
  }

  private async executeSync(job: SyncJob) {
    const device = await db.wearableDevices.get(job.deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (device.connectionStatus !== 'connected') {
      throw new Error('Device not connected');
    }

    switch (job.type) {
      case 'activities':
        await this.syncActivities(job, device);
        break;
      case 'heart_rate':
        await this.syncHeartRateData(job, device);
        break;
      case 'metrics':
        await this.syncAdvancedMetrics(job, device);
        break;
      case 'full_sync':
        await this.syncActivities(job, device);
        await this.syncHeartRateData(job, device);
        await this.syncAdvancedMetrics(job, device);
        break;
      default:
        throw new Error(`Unknown sync type: ${job.type}`);
    }

    // Update device last sync time
    await db.wearableDevices.update(job.deviceId, {
      lastSync: new Date(),
      updatedAt: new Date()
    });
  }

  private async syncActivities(job: SyncJob, device: any) {
    if (device.type === 'garmin') {
      await this.syncGarminActivities(job, device);
    } else if (device.type === 'apple_watch') {
      await this.syncAppleWatchActivities(job, device);
    } else {
      throw new Error('Unsupported device type');
    }
  }

  private async syncGarminActivities(job: SyncJob, device: any) {
    const response = await fetch(`/api/devices/garmin/sync?userId=${encodeURIComponent(String(job.userId))}`, {
      method: 'POST',
      headers: {
        'x-user-id': String(job.userId),
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Garmin activities: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch activities')
    }

    // Process and store activities
    const activities = Array.isArray(data.activities) ? data.activities : []
    for (const activity of activities) {
      await this.processGarminActivity(activity, device.userId)
    }

    await db.syncJobs.update(job.id!, {
      progress: 33,
      metadata: { activitiesProcessed: activities.length },
      updatedAt: new Date()
    })
  }

  private async syncAppleWatchActivities(job: SyncJob, _device: any) {
    // Apple Watch sync would use HealthKit integration
    // This is a placeholder for the implementation
    console.log('Apple Watch activity sync not yet implemented');
    
    await db.syncJobs.update(job.id!, {
      progress: 33,
      metadata: { activitiesProcessed: 0 },
      updatedAt: new Date()
    });
  }

  private async processGarminActivity(activity: any, userId: number) {
    try {
      // Check if activity already exists
      const existingRun = await db.runs
        .where(['userId', 'externalId'])
        .equals([userId, `garmin-${activity.activityId}`])
        .first();

      if (existingRun) {
        return; // Already processed
      }

      // Create new run record
      const runId = await db.runs.add({
        userId,
        externalId: `garmin-${activity.activityId}`,
        distance: activity.distance,
        duration: activity.duration,
        pace: activity.averagePace,
        calories: activity.calories,
        elevationGain: activity.elevationGain,
        averageHeartRate: activity.averageHR,
        maxHeartRate: activity.maxHR,
        completedAt: new Date(activity.startTimeGMT),
        notes: `Imported from Garmin: ${activity.activityName}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Created run ${runId} from Garmin activity ${activity.activityId}`);
    } catch (error) {
      console.error('Error processing Garmin activity:', error);
    }
  }

  private async syncHeartRateData(job: SyncJob, _device: any) {
    // Implementation would fetch detailed heart rate data
    await db.syncJobs.update(job.id!, {
      progress: 66,
      updatedAt: new Date()
    });
  }

  private async syncAdvancedMetrics(job: SyncJob, _device: any) {
    // Implementation would fetch and process advanced metrics
    await db.syncJobs.update(job.id!, {
      progress: 100,
      updatedAt: new Date()
    });
  }

  async cleanupOldJobs(maxAgeMs = 7 * 24 * 60 * 60 * 1000) { // 7 days
    try {
      const cutoffDate = new Date(Date.now() - maxAgeMs);
      
      await db.syncJobs
        .where('createdAt')
        .below(cutoffDate)
        .and(job => job.status === 'completed' || job.status === 'failed')
        .delete();
        
      console.log('Cleaned up old sync jobs');
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
    }
  }
}

// Export singleton instance
export const backgroundSync = BackgroundSyncManager.getInstance();
