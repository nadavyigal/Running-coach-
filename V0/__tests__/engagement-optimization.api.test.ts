import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '@/app/api/engagement-optimization/route';
import { dbUtils } from '@/lib/db';
import { engagementOptimizationService } from '@/lib/engagement-optimization';

// Mock the database utilities
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getRuns: vi.fn(),
    getGoals: vi.fn(),
    getBadges: vi.fn(),
    updateUser: vi.fn(),
  },
}));

// Mock the engagement optimization service
vi.mock('@/lib/engagement-optimization', () => ({
  engagementOptimizationService: {
    calculateEngagementScore: vi.fn(),
    determineOptimalTiming: vi.fn(),
    generateMotivationalTriggers: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  preferredTimes: ['08:00'],
  daysPerWeek: 3,
  consents: {
    data: true,
    gdpr: true,
    push: true,
  },
  onboardingComplete: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  notificationPreferences: {
    frequency: 'medium' as const,
    timing: 'morning' as const,
    types: [
      { id: 'motivational', name: 'Motivational Messages', description: 'Daily encouragement and tips', enabled: true, category: 'motivational' as const },
      { id: 'reminder', name: 'Workout Reminders', description: 'Gentle reminders to stay active', enabled: true, category: 'reminder' as const },
      { id: 'achievement', name: 'Achievement Celebrations', description: 'Celebrate your milestones', enabled: true, category: 'achievement' as const },
      { id: 'milestone', name: 'Milestone Alerts', description: 'Progress towards your goals', enabled: true, category: 'milestone' as const }
    ],
    quietHours: { start: '22:00', end: '07:00' }
  }
};

const mockRuns = [
  {
    id: 1,
    userId: 1,
    type: 'easy' as const,
    distance: 5,
    duration: 30,
    date: new Date(),
    notes: 'Great run!'
  }
];

const mockGoals = [
  {
    id: 1,
    userId: 1,
    type: 'distance' as const,
    target: 100,
    current: 50,
    deadline: new Date('2024-12-31'),
    createdAt: new Date()
  }
];

const mockBadges = [
  {
    id: 1,
    userId: 1,
    type: 'streak' as const,
    name: '7 Day Streak',
    description: 'Completed 7 days in a row',
    earnedAt: new Date(),
    icon: '🏃‍♂️'
  }
];

describe('Engagement Optimization API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/engagement-optimization', () => {
    it('should return engagement data for authenticated user', async () => {
      const mockGetCurrentUser = vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      const mockGetRuns = vi.mocked(dbUtils.getRuns).mockResolvedValue(mockRuns);
      const mockGetGoals = vi.mocked(dbUtils.getGoals).mockResolvedValue(mockGoals);
      const mockGetBadges = vi.mocked(dbUtils.getBadges).mockResolvedValue(mockBadges);
      
      const mockCalculateEngagementScore = vi.mocked(engagementOptimizationService.calculateEngagementScore)
        .mockResolvedValue(85);
      const mockDetermineOptimalTiming = vi.mocked(engagementOptimizationService.determineOptimalTiming)
        .mockResolvedValue({ bestTime: '08:00', confidence: 0.9 });
      const mockGenerateMotivationalTriggers = vi.mocked(engagementOptimizationService.generateMotivationalTriggers)
        .mockResolvedValue([
          { id: 'streak', type: 'streak', message: 'Keep your streak alive!', priority: 'high' }
        ]);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('engagementScore', 85);
      expect(data).toHaveProperty('optimalTiming');
      expect(data).toHaveProperty('motivationalTriggers');
      expect(data).toHaveProperty('notificationPreferences');

      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(mockGetRuns).toHaveBeenCalledWith(1);
      expect(mockGetGoals).toHaveBeenCalledWith(1);
      expect(mockGetBadges).toHaveBeenCalledWith(1);
      expect(mockCalculateEngagementScore).toHaveBeenCalledWith(mockUser, mockRuns, mockGoals, mockBadges);
      expect(mockDetermineOptimalTiming).toHaveBeenCalledWith(mockUser, mockRuns);
      expect(mockGenerateMotivationalTriggers).toHaveBeenCalledWith(mockUser, mockRuns, mockGoals);
    });

    it('should return 404 when user is not found', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'User not found');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'Failed to fetch engagement data');
    });
  });

  describe('POST /api/engagement-optimization', () => {
    it('should update notification preferences successfully', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(dbUtils.updateUser).mockResolvedValue({
        ...mockUser,
        notificationPreferences: {
          ...mockUser.notificationPreferences,
          frequency: 'high'
        }
      });

      const newPreferences = {
        ...mockUser.notificationPreferences,
        frequency: 'high' as const
      };

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'POST',
        body: JSON.stringify({ notificationPreferences: newPreferences })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message', 'Engagement preferences updated successfully');
      expect(data).toHaveProperty('user');
      expect(data.user.notificationPreferences.frequency).toBe('high');
    });

    it('should return 400 when notification preferences are missing', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Notification preferences are required');
    });

    it('should return 404 when user is not found', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'POST',
        body: JSON.stringify({ notificationPreferences: mockUser.notificationPreferences })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'User not found');
    });
  });

  describe('PUT /api/engagement-optimization', () => {
    it('should update specific notification type successfully', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(dbUtils.updateUser).mockResolvedValue({
        ...mockUser,
        notificationPreferences: {
          ...mockUser.notificationPreferences,
          types: mockUser.notificationPreferences.types.map(t => 
            t.id === 'motivational' ? { ...t, enabled: false } : t
          )
        }
      });

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'PUT',
        body: JSON.stringify({ type: 'motivational', enabled: false })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message', 'Notification type updated successfully');
      expect(data).toHaveProperty('user');
      
      const motivationalType = data.user.notificationPreferences.types.find((t: any) => t.id === 'motivational');
      expect(motivationalType.enabled).toBe(false);
    });

    it('should return 400 when type or enabled status is missing', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'PUT',
        body: JSON.stringify({ type: 'motivational' })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Type and enabled status are required');
    });

    it('should return 404 when user is not found', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/engagement-optimization', {
        method: 'PUT',
        body: JSON.stringify({ type: 'motivational', enabled: false })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'User not found');
    });
  });
});