import { POST } from './route';
import { db } from '@/lib/db';

// Mock the db object
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    cohorts: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
        })),
      })),
    },
    cohortMembers: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            first: vi.fn(),
          })),
        })),
      })),
      add: vi.fn(),
    },
    users: {
      update: vi.fn(),
    },
  },
}));

// Mock NextResponse for testing API routes
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    })),
  },
}));

describe('POST /api/cohort/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully join a cohort with a valid invite code', async () => {
    const mockCohort = { id: 1, name: 'Test Cohort', inviteCode: 'VALIDCODE' };
    (db.cohort.findUnique as vi.Mock).mockResolvedValue(mockCohort);
    (db.cohortMember.findUnique as vi.Mock).mockResolvedValue(null);
    (db.cohortMember.create as vi.Mock).mockResolvedValue({});
    (db.user.update as vi.Mock).mockResolvedValue({});

    const mockRequest = {
      json: () => Promise.resolve({ inviteCode: 'VALIDCODE', userId: 'user123' }),
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(db.cohort.findUnique).toHaveBeenCalledWith({ where: { inviteCode: 'VALIDCODE' } });
    expect(db.cohortMember.findUnique).toHaveBeenCalledWith({
      where: {
        userId_cohortId: {
          userId: 'user123',
          cohortId: 1,
        },
      },
    });
    expect(db.cohortMember.create).toHaveBeenCalledWith({
      data: {
        userId: 'user123',
        cohortId: 1,
        joinDate: expect.any(Date),
      },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user123' },
      data: { cohortId: 1 },
    });
    expect(response.status).toBe(200);
    expect(data.message).toBe('Successfully joined cohort');
  });

  it('should return 404 if invite code is invalid', async () => {
    (db.cohort.findUnique as jest.Mock).mockResolvedValue(null);

    const mockRequest = {
      json: () => Promise.resolve({ inviteCode: 'INVALIDCODE', userId: 'user123' }),
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(db.cohort.findUnique).toHaveBeenCalledWith({ where: { inviteCode: 'INVALIDCODE' } });
    expect(response.status).toBe(404);
    expect(data.message).toBe('Invalid invite code');
  });

  it('should return 409 if user is already a member', async () => {
    const mockCohort = { id: 1, name: 'Test Cohort', inviteCode: 'VALIDCODE' };
    (db.cohort.findUnique as jest.Mock).mockResolvedValue(mockCohort);
    (db.cohortMember.findUnique as jest.Mock).mockResolvedValue({}); // User already a member

    const mockRequest = {
      json: () => Promise.resolve({ inviteCode: 'VALIDCODE', userId: 'user123' }),
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toBe('User is already a member of this cohort');
  });

  it('should return 400 for invalid request data', async () => {
    const mockRequest = {
      json: () => Promise.resolve({ userId: 'user123' }), // Missing inviteCode
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe('Invalid request data');
    expect(data.errors).toBeDefined();
  });

  it('should return 500 for internal server errors', async () => {
    (db.cohort.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    const mockRequest = {
      json: () => Promise.resolve({ inviteCode: 'VALIDCODE', userId: 'user123' }),
    } as Request;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Internal server error');
  });
});
