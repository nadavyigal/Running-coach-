import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../app/api/chat/ping/route';

// Mock the ChatDriver
vi.mock('../lib/chatDriver', () => ({
  chatDriver: {
    health: vi.fn(),
  },
}));

describe('/api/chat/ping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should return healthy status when chat service is available', async () => {
    const { chatDriver } = await import('../lib/chatDriver');
    
    vi.mocked(chatDriver.health).mockResolvedValue({
      available: true,
      model: 'gpt-4o-mini',
      latency: 150,
      quota: {
        remaining: 180000,
        resetAt: new Date(),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.available).toBe(true);
    expect(data.model).toBe('gpt-4o-mini');
    expect(data.latency).toBeGreaterThanOrEqual(0);
    expect(data.serviceLatency).toBe(150);
  });

  it('should return unhealthy status when chat service is unavailable', async () => {
    const { chatDriver } = await import('../lib/chatDriver');
    
    vi.mocked(chatDriver.health).mockResolvedValue({
      available: false,
      model: 'unavailable',
      latency: 0,
      quota: {
        remaining: 0,
        resetAt: new Date(),
      },
      lastError: 'API key not configured',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.available).toBe(false);
    expect(data.error).toBe('API key not configured');
  });

  it('should handle health check errors', async () => {
    const { chatDriver } = await import('../lib/chatDriver');
    
    vi.mocked(chatDriver.health).mockRejectedValue(new Error('Health check failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.available).toBe(false);
    expect(data.error).toBe('Health check failed');
  });

  it('should measure total latency including health check time', async () => {
    const { chatDriver } = await import('../lib/chatDriver');
    
    vi.mocked(chatDriver.health).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        available: true,
        model: 'gpt-4o-mini',
        latency: 50,
        quota: {
          remaining: 180000,
          resetAt: new Date(),
        },
      };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.latency).toBeGreaterThanOrEqual(90);
    expect(data.serviceLatency).toBe(50);
  });

  it('should include timestamp in response', async () => {
    const { chatDriver } = await import('../lib/chatDriver');
    
    vi.mocked(chatDriver.health).mockResolvedValue({
      available: true,
      model: 'gpt-4o-mini',
      latency: 100,
      quota: {
        remaining: 180000,
        resetAt: new Date(),
      },
    });

    const beforeRequest = Date.now();
    const response = await GET();
    const afterRequest = Date.now();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    
    const timestamp = new Date(data.timestamp).getTime();
    expect(timestamp).toBeGreaterThanOrEqual(beforeRequest);
    expect(timestamp).toBeLessThanOrEqual(afterRequest);
  });
});
