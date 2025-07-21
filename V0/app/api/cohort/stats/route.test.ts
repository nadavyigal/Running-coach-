import { GET } from './route';
import { dbUtils } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock the dbUtils
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  dbUtils: {
    getUserById: vi.fn(),
    getCohortStats: vi.fn(),
  },
}));

// Mock NextResponse for testing API routes
vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    })),
  },
}));

describe('GET /api/cohort/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when userId is missing', async () => {
    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('User ID is required');
  });

  it('should return 404 when user is not found', async () => {
    (dbUtils.getUserById as vi.Mock).mockResolvedValue(null);

    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats?userId=123'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(dbUtils.getUserById).toHaveBeenCalledWith(123);
    expect(response.status).toBe(404);
    expect(data.message).toBe('User not in a cohort');
  });

  it('should return 404 when user is not in a cohort', async () => {
    (dbUtils.getUserById as vi.Mock).mockResolvedValue({ id: 123, cohortId: null });

    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats?userId=123'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(dbUtils.getUserById).toHaveBeenCalledWith(123);
    expect(response.status).toBe(404);
    expect(data.message).toBe('User not in a cohort');
  });

  it('should return cohort stats when user is in a cohort', async () => {
    const mockUser = { id: 123, cohortId: 456 };
    const mockStats = {
      totalMembers: 10,
      activeMembers: 7,
      totalRuns: 45,
      totalDistance: 234.5,
      avgDistance: 5.2,
      weeklyRuns: 12,
      weeklyDistance: 58.3,
      cohortName: 'Running Buddies',
    };

    (dbUtils.getUserById as vi.Mock).mockResolvedValue(mockUser);
    (dbUtils.getCohortStats as vi.Mock).mockResolvedValue(mockStats);

    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats?userId=123'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(dbUtils.getUserById).toHaveBeenCalledWith(123);
    expect(dbUtils.getCohortStats).toHaveBeenCalledWith(456);
    expect(response.status).toBe(200);
    expect(data).toEqual(mockStats);
  });

  it('should return 400 for invalid userId', async () => {
    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats?userId=invalid'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid request data');
    expect(data.errors).toBeDefined();
  });

  it('should return 500 for internal server errors', async () => {
    (dbUtils.getUserById as vi.Mock).mockRejectedValue(new Error('Database error'));

    const mockRequest = {
      nextUrl: new URL('http://localhost/api/cohort/stats?userId=123'),
    } as NextRequest;

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Internal server error');
  });
});