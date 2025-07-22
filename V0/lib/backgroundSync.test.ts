import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackgroundSyncManager } from './backgroundSync';
import { db, type SyncJob, type WearableDevice } from './db';

describe('BackgroundSyncManager', () => {
  let syncManager: BackgroundSyncManager;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    syncManager = BackgroundSyncManager.getInstance();
  });

  afterEach(async () => {
    syncManager.stop();
    await db.delete();
  });

  describe('Job Management', () => {
    it('should schedule sync job with correct properties', async () => {
      const jobId = await syncManager.scheduleSync(
        1, // userId
        1, // deviceId
        'activities',
        'normal'
      );

      expect(jobId).toBeGreaterThan(0);

      const job = await db.syncJobs.get(jobId);
      expect(job).toBeTruthy();
      expect(job?.userId).toBe(1);
      expect(job?.deviceId).toBe(1);
      expect(job?.type).toBe('activities');
      expect(job?.status).toBe('pending');
      expect(job?.priority).toBe('normal');
      expect(job?.maxRetries).toBe(3);
      expect(job?.retryCount).toBe(0);
      expect(job?.createdAt).toBeInstanceOf(Date);
      expect(job?.scheduledAt).toBeInstanceOf(Date);
    });

    it('should get user jobs', async () => {
      // Create test jobs
      const job1: Partial<SyncJob> = {
        userId: 1,
        deviceId: 1,
        type: 'activities',
        status: 'pending',
        priority: 'normal',
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      const job2: Partial<SyncJob> = {
        userId: 1,
        deviceId: 2,
        type: 'heart_rate',
        status: 'completed',
        priority: 'high',
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      const job3: Partial<SyncJob> = {
        userId: 2,
        deviceId: 1,
        type: 'activities',
        status: 'pending',
        priority: 'normal',
        scheduledAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      await db.syncJobs.add(job1 as SyncJob);
      await db.syncJobs.add(job2 as SyncJob);
      await db.syncJobs.add(job3 as SyncJob);

      const userJobs = await syncManager.getUserJobs(1);

      expect(userJobs).toHaveLength(2);
      expect(userJobs.every(job => job.userId === 1)).toBe(true);
    });

    it('should cancel sync job', async () => {
      const jobId = await syncManager.scheduleSync(
        1, // userId
        1, // deviceId
        'activities',
        'normal'
      );

      const result = await syncManager.cancelJob(jobId);
      expect(result).toBe(true);

      const job = await db.syncJobs.get(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should get job status', async () => {
      const jobId = await syncManager.scheduleSync(
        1, // userId
        1, // deviceId
        'activities',
        'normal'
      );
      const job = await syncManager.getJobStatus(jobId);
      expect(job).toBeTruthy();
      expect(job?.status).toBe('pending');
    });
  });

  describe('Manager Lifecycle', () => {
    it('should start and stop manager', async () => {
      expect(syncManager.isRunning()).toBe(false);

      syncManager.start();
      expect(syncManager.isRunning()).toBe(true);

      syncManager.stop();
      expect(syncManager.isRunning()).toBe(false);
    });

    it('should not start twice', () => {
      syncManager.start();
      expect(syncManager.isRunning()).toBe(true);

      // Starting again should not throw
      expect(() => syncManager.start()).not.toThrow();
      expect(syncManager.isRunning()).toBe(true);
    });

    it('should handle stopping when not running', () => {
      expect(syncManager.isRunning()).toBe(false);
      expect(() => syncManager.stop()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle getUserJobs errors gracefully', async () => {
      // Close the database to simulate an error
      await db.close();

      const jobs = await syncManager.getUserJobs(1);

      expect(jobs).toEqual([]);
    });

    it('should handle cancelJob errors gracefully', async () => {
      // Close the database to simulate an error
      await db.close();

      const result = await syncManager.cancelJob(999);

      expect(result).toBe(false);
    });

    it('should handle getJobStatus errors gracefully', async () => {
      // Close the database to simulate an error
      await db.close();

      const status = await syncManager.getJobStatus(999);

      expect(status).toBeNull();
    });
  });

  describe('Sync Operations', () => {
    beforeEach(() => {
      // Mock fetch for external API calls
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle device not found error', async () => {
      const jobId = await syncManager.scheduleSync(
        1, // userId
        999, // deviceId - non-existent
        'activities',
        'normal'
      );
      
      // Start the manager to process jobs
      syncManager.start();
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const job = await db.syncJobs.get(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.errorMessage).toContain('Device not found');
    });

    it('should handle unsupported device type', async () => {
      // Create a device with unsupported type
      const device: Partial<WearableDevice> = {
        userId: 1,
        type: 'unknown' as any,
        deviceId: 'test-device',
        connectionStatus: 'connected',
        lastSync: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const deviceId = await db.wearableDevices.add(device as WearableDevice);

      const jobId = await syncManager.scheduleSync(
        1, // userId
        deviceId,
        'activities',
        'normal'
      );
      
      // Start the manager to process jobs
      syncManager.start();
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const job = await db.syncJobs.get(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.errorMessage).toContain('Unsupported device type');
    });

    it('should retry failed jobs', async () => {
      // Create a Garmin device
      const device: Partial<WearableDevice> = {
        userId: 1,
        type: 'garmin',
        deviceId: 'garmin-123',
        connectionStatus: 'connected',
        authTokens: { accessToken: 'test-token' },
        lastSync: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const deviceId = await db.wearableDevices.add(device as WearableDevice);

      // Mock fetch to fail first time, succeed second time
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ activities: [] })
        });
      });

      const jobId = await syncManager.scheduleSync(
        1, // userId
        deviceId,
        'activities',
        'normal'
      );
      
      // Start the manager to process jobs
      syncManager.start();
      
      // Wait for processing and retry
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const job = await db.syncJobs.get(jobId);
      expect(job?.retryCount).toBeGreaterThan(0);
    });
  });
});