import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { db } from '@/lib/db';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';

// Mock IndexedDB
global.indexedDB = new FDBFactory();

describe('/api/performance/records', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    
    // Create test user
    await db.users.add({
      id: 1,
      goal: 'speed',
      experience: 'intermediate',
      preferredTimes: ['morning'],
      daysPerWeek: 4,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test runs
    const testRuns = [
      {
        id: 1,
        userId: 1,
        distance: 5,
        duration: 1800, // 30 minutes
        pace: 360, // 6 min/km
        completedAt: new Date('2023-12-01'),
        createdAt: new Date('2023-12-01'),
        type: 'tempo' as const,
        location: 'Park',
        route: 'Loop',
        notes: 'Good run',
      },
      {
        id: 2,
        userId: 1,
        distance: 10,
        duration: 3000, // 50 minutes
        pace: 300, // 5 min/km
        completedAt: new Date('2023-12-02'),
        createdAt: new Date('2023-12-02'),
        type: 'long' as const,
        location: 'Trail',
        route: 'Out and back',
        notes: 'Felt strong',
      },
    ];

    for (const run of testRuns) {
      await db.runs.add(run);
    }

    // Create test personal records
    await db.personalRecords.add({
      id: 1,
      userId: 1,
      recordType: 'fastest_5k',
      distance: 5,
      timeForDistance: 1800,
      bestPace: 360,
      dateAchieved: new Date('2023-12-01'),
      runId: 1,
      value: 1800,
      achievedAt: new Date('2023-12-01'),
      createdAt: new Date('2023-12-01'),
      updatedAt: new Date('2023-12-01'),
    });

    await db.personalRecords.add({
      id: 2,
      userId: 1,
      recordType: 'longest_run',
      distance: 10,
      timeForDistance: 3000,
      bestPace: 300,
      dateAchieved: new Date('2023-12-02'),
      runId: 2,
      value: 10,
      achievedAt: new Date('2023-12-02'),
      createdAt: new Date('2023-12-02'),
      updatedAt: new Date('2023-12-02'),
    });
  });

  describe('GET /api/performance/records', () => {
    it('should return all personal records by default', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('records');
      expect(data.records).toHaveLength(2);
      expect(data).toHaveProperty('recordStats');
      expect(data.recordStats).toHaveProperty('totalRecords', 2);
      expect(data).toHaveProperty('milestones');
      expect(data).toHaveProperty('progressionData');
    });

    it('should filter records by type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1&type=distance'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.records).toHaveLength(1);
      expect(data.records[0].recordType).toBe('longest_run');
    });

    it('should respect limit parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1&limit=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.records).toHaveLength(1);
    });

    it('should return milestone achievements', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.milestones).toBeInstanceOf(Array);
      expect(data.milestones).toHaveLength(5); // 1k, 5k, 10k, half, full
      expect(data.milestones[0]).toHaveProperty('distance', 1);
      expect(data.milestones[0]).toHaveProperty('achieved');
    });

    it('should return recent achievements', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('recentAchievements');
      expect(data.recentAchievements).toBeInstanceOf(Array);
    });

    it('should handle missing user gracefully', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=999'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.records).toHaveLength(0);
    });

    it('should return 400 for invalid parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records?userId=1&type=invalid'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST /api/performance/records', () => {
    it('should check and update personal records for new run', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: 1,
            runId: 3,
            distance: 5,
            duration: 1500, // 25 minutes - faster than existing 5k
            pace: 300, // 5 min/km
            date: new Date('2023-12-03').toISOString(),
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('updatedRecords');
      expect(data.updatedRecords).toHaveLength(1);
      expect(data.updatedRecords[0].recordType).toBe('fastest_5k');
      expect(data.updatedRecords[0].value).toBe(1500);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('new personal record');
    });

    it('should return no new records when performance is not better', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: 1,
            runId: 3,
            distance: 5,
            duration: 2000, // 33 minutes - slower than existing 5k
            pace: 400, // 6:40 min/km
            date: new Date('2023-12-03').toISOString(),
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('updatedRecords');
      expect(data.updatedRecords).toHaveLength(0);
      expect(data.message).toContain('No new personal records');
    });

    it('should return 400 for invalid request body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: 1,
            // Missing required fields
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('should handle multiple record types for single run', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/performance/records',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: 1,
            runId: 3,
            distance: 15, // Longer than existing longest run
            duration: 4500, // 75 minutes
            pace: 300, // 5 min/km - faster than existing pace
            date: new Date('2023-12-03').toISOString(),
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.updatedRecords.length).toBeGreaterThan(1);
      
      const recordTypes = data.updatedRecords.map((record: any) => record.recordType);
      expect(recordTypes).toContain('longest_run');
      expect(recordTypes).toContain('best_pace');
    });
  });
});