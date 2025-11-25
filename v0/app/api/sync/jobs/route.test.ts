import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE } from './route';
import { db } from '@/lib/db';
import { backgroundSync } from '@/lib/backgroundSync';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    syncJobs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(),
            orderBy: vi.fn(() => ({
              reverse: vi.fn(() => ({
                limit: vi.fn(() => ({
                  toArray: vi.fn()
                }))
              }))
            }))
          })),
          toArray: vi.fn(),
          orderBy: vi.fn(() => ({
            reverse: vi.fn(() => ({
              limit: vi.fn(() => ({
                toArray: vi.fn()
              }))
            }))
          }))
        }))
      }))
    },
    wearableDevices: {
      get: vi.fn()
    }
  }
}));

// Mock the background sync manager
vi.mock('@/lib/backgroundSync', () => ({
  backgroundSync: {
    scheduleSync: vi.fn(),
    cancelJob: vi.fn()
  }
}));

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200
    }))
  }
}));

describe('/api/sync/jobs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET - Get sync jobs', () => {
    it('should return sync jobs for a user', async () => {
      const mockJobs = [
        {
          id: 1,
          userId: 1,
          deviceId: 1,
          type: 'activities',
          status: 'completed',
          createdAt: new Date()
        },
        {
          id: 2,
          userId: 1,
          deviceId: 1,
          type: 'heart_rate',
          status: 'pending',
          createdAt: new Date()
        }
      ];

      const mockStats = [
        { status: 'completed' },
        { status: 'pending' },
        { status: 'failed' }
      ];

      (db.syncJobs.where as any)().equals().orderBy().reverse().limit().toArray.mockResolvedValue(mockJobs);
      (db.syncJobs.where as any)().equals().toArray.mockResolvedValue(mockStats);

      const request = new Request('http://localhost/api/sync/jobs?userId=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.jobs).toEqual(mockJobs);
      expect(data.stats.total).toBe(3);
      expect(data.stats.completed).toBe(1);
      expect(data.stats.pending).toBe(1);
      expect(data.stats.failed).toBe(1);
    });

    it('should filter jobs by status', async () => {
      const mockJobs = [
        {
          id: 1,
          userId: 1,
          status: 'pending',
          createdAt: new Date()
        }
      ];

      (db.syncJobs.where as any)().equals().and().orderBy().reverse().limit().toArray.mockResolvedValue(mockJobs);
      (db.syncJobs.where as any)().equals().toArray.mockResolvedValue([]);

      const request = new Request('http://localhost/api/sync/jobs?userId=1&status=pending');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.jobs).toEqual(mockJobs);
    });

    it('should return error for missing userId', async () => {
      const request = new Request('http://localhost/api/sync/jobs');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('User ID is required');
      expect(response.status).toBe(400);
    });

    it('should handle database errors', async () => {
      (db.syncJobs.where as any).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/sync/jobs?userId=1');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch sync jobs');
      expect(response.status).toBe(500);
    });
  });

  describe('POST - Schedule sync job', () => {
    it('should schedule a sync job successfully', async () => {
      const mockDevice = {
        id: 1,
        connectionStatus: 'connected'
      };

      const mockJobId = 123;

      (db.wearableDevices.get as any).mockResolvedValue(mockDevice);
      (backgroundSync.scheduleSync as any).mockResolvedValue(mockJobId);
      (db.syncJobs.get as any).mockResolvedValue({
        id: mockJobId,
        userId: 1,
        deviceId: 1,
        type: 'activities',
        status: 'pending'
      });

      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'activities',
          priority: 'normal'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.job.id).toBe(mockJobId);
      expect(backgroundSync.scheduleSync).toHaveBeenCalledWith(1, 1, 'activities', 'normal', 0);
    });

    it('should return error for missing required fields', async () => {
      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1
          // Missing deviceId and type
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('User ID, device ID, and type are required');
      expect(response.status).toBe(400);
    });

    it('should validate sync type', async () => {
      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'invalid_type'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid sync type');
      expect(response.status).toBe(400);
    });

    it('should validate priority', async () => {
      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'activities',
          priority: 'invalid_priority'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid priority');
      expect(response.status).toBe(400);
    });

    it('should return error for non-existent device', async () => {
      (db.wearableDevices.get as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 999,
          type: 'activities'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Device not found');
      expect(response.status).toBe(404);
    });

    it('should return error for disconnected device', async () => {
      const mockDevice = {
        id: 1,
        connectionStatus: 'disconnected'
      };

      (db.wearableDevices.get as any).mockResolvedValue(mockDevice);

      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'activities'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Device must be connected to schedule sync');
      expect(response.status).toBe(400);
    });

    it('should handle scheduling errors', async () => {
      const mockDevice = {
        id: 1,
        connectionStatus: 'connected'
      };

      (db.wearableDevices.get as any).mockResolvedValue(mockDevice);
      (backgroundSync.scheduleSync as any).mockRejectedValue(new Error('Scheduling failed'));

      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'activities'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to schedule sync job');
      expect(response.status).toBe(500);
    });
  });

  describe('DELETE - Cancel sync jobs', () => {
    it('should cancel a specific job', async () => {
      (backgroundSync.cancelJob as any).mockResolvedValue(true);

      const request = new Request('http://localhost/api/sync/jobs?jobId=123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Sync job cancelled successfully');
      expect(backgroundSync.cancelJob).toHaveBeenCalledWith(123);
    });

    it('should return error for non-existent job', async () => {
      (backgroundSync.cancelJob as any).mockResolvedValue(false);

      const request = new Request('http://localhost/api/sync/jobs?jobId=999', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Job not found or cannot be cancelled');
      expect(response.status).toBe(404);
    });

    it('should cancel all pending jobs for a user', async () => {
      const mockPendingJobs = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'pending' }
      ];

      (db.syncJobs.where as any)().equals().and().toArray.mockResolvedValue(mockPendingJobs);
      (backgroundSync.cancelJob as any).mockResolvedValue(true);

      const request = new Request('http://localhost/api/sync/jobs?userId=1&cancelAll=true', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Cancelled 2 pending sync jobs');
      expect(backgroundSync.cancelJob).toHaveBeenCalledTimes(2);
    });

    it('should return error for missing parameters', async () => {
      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Either jobId or userId with cancelAll=true is required');
      expect(response.status).toBe(400);
    });

    it('should handle cancellation errors', async () => {
      (backgroundSync.cancelJob as any).mockRejectedValue(new Error('Cancellation failed'));

      const request = new Request('http://localhost/api/sync/jobs?jobId=123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to cancel sync jobs');
      expect(response.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON in POST request', async () => {
      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle invalid delay values', async () => {
      const mockDevice = {
        id: 1,
        connectionStatus: 'connected'
      };

      (db.wearableDevices.get as any).mockResolvedValue(mockDevice);
      (backgroundSync.scheduleSync as any).mockResolvedValue(123);
      (db.syncJobs.get as any).mockResolvedValue({});

      const request = new Request('http://localhost/api/sync/jobs', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          deviceId: 1,
          type: 'activities',
          delayMs: -1000 // Negative delay should be handled
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(backgroundSync.scheduleSync).toHaveBeenCalledWith(1, 1, 'activities', 'normal', -1000);
    });
  });
});