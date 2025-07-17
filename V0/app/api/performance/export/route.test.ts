import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { db } from '@/lib/db';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';

// Mock IndexedDB
global.indexedDB = new FDBFactory();

describe('/api/performance/export', () => {
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
  });

  it('should export data in JSON format by default', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(data).toHaveProperty('metadata');
    expect(data.metadata).toHaveProperty('userId', 1);
    expect(data).toHaveProperty('runs');
    expect(data.runs).toHaveLength(2);
    expect(data).toHaveProperty('personalRecords');
    expect(data.personalRecords).toHaveLength(1);
  });

  it('should export data in CSV format when requested', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1&format=csv'
    );

    const response = await GET(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(text).toContain('# RUNS');
    expect(text).toContain('Date,Distance (km),Duration (min),Pace (min/km),Type,Notes');
    expect(text).toContain('# PERSONAL RECORDS');
    expect(text).toContain('Distance,Best Time,Best Pace,Date Achieved,Type');
  });

  it('should respect time range filtering', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1&timeRange=7d'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metadata).toHaveProperty('timeRange', '7d');
    expect(data.metadata.dateRange).toHaveProperty('start');
    expect(data.metadata.dateRange).toHaveProperty('end');
  });

  it('should respect include flags', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1&includeRuns=false&includeRecords=false'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).not.toHaveProperty('runs');
    expect(data).not.toHaveProperty('personalRecords');
    expect(data).toHaveProperty('metadata');
  });

  it('should return 400 for invalid parameters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1&format=invalid'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should handle missing user gracefully', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=999'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.runs).toHaveLength(0);
  });

  it('should include proper filename in content-disposition header', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/performance/export?userId=1&format=csv&timeRange=30d'
    );

    const response = await GET(request);

    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain('running-data-30d');
    expect(response.headers.get('content-disposition')).toContain('.csv');
  });
});