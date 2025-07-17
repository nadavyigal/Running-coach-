import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { db } from '@/lib/db';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';

// Mock IndexedDB
global.indexedDB = new FDBFactory();

describe('/api/performance/analytics', () => {
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
  });

  it('should return performance analytics for default time range', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics?userId=1'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('timeRange', '30d');
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalRuns', 2);
    expect(data.summary).toHaveProperty('totalDistance', 15);
    expect(data).toHaveProperty('trends');
    expect(data).toHaveProperty('personalRecords');
  });

  it('should return performance analytics for 7d time range', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics?userId=1&timeRange=7d'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('timeRange', '7d');
    expect(data).toHaveProperty('dateRange');
    expect(data.dateRange).toHaveProperty('start');
    expect(data.dateRange).toHaveProperty('end');
  });

  it('should return 400 for invalid time range', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics?userId=1&timeRange=invalid'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return period comparison data', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics?userId=1&timeRange=30d'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('comparison');
    expect(data.comparison).toHaveProperty('totalRuns');
    expect(data.comparison).toHaveProperty('totalDistance');
    expect(data.comparison).toHaveProperty('averagePace');
    expect(data.comparison).toHaveProperty('consistencyScore');
    expect(data.comparison.totalRuns).toHaveProperty('current');
    expect(data.comparison.totalRuns).toHaveProperty('previous');
    expect(data.comparison.totalRuns).toHaveProperty('change');
  });

  it('should handle missing user gracefully', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics?userId=999'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.totalRuns).toBe(0);
  });

  it('should default to user 1 when no userId provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/analytics'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.totalRuns).toBe(2);
  });
});