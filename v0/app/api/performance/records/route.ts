import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase, safeDbOperation } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';


const RecordsQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  type: z.enum(['distance', 'time', 'pace', 'all']).optional().default('all'),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

const UpdateRecordSchema = z.object({
  userId: z.number(),
  runId: z.number(),
  distance: z.number(),
  duration: z.number(),
  pace: z.number(),
  date: z.string().transform(str => new Date(str)),
});

type RecordCategory = 'distance' | 'time' | 'pace';

function getRecordCategory(recordType: unknown): RecordCategory | null {
  switch (recordType) {
    case 'longest_run':
      return 'distance';
    case 'best_pace':
      return 'pace';
    case 'fastest_1k':
    case 'fastest_5k':
    case 'fastest_10k':
      return 'time';
    default:
      return null;
  }
}

function getRecordTimestamp(record: any): number {
  const dateLike =
    record?.achievedAt ?? record?.dateAchieved ?? record?.createdAt ?? record?.updatedAt ?? null;

  if (dateLike instanceof Date) return dateLike.getTime();
  if (typeof dateLike === 'string' || typeof dateLike === 'number') {
    const ms = new Date(dateLike).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

async function getPersonalRecordEntries(userId: number) {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];
    return database.personalRecords.where('userId').equals(userId).toArray();
  }, 'api_getPersonalRecordEntries', [] as any[]);
}

function resolveTimeRecordType(distanceKm: number): 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | null {
  const matches = (target: number) => Math.abs(distanceKm - target) <= target * 0.05;
  if (matches(1)) return 'fastest_1k';
  if (matches(5)) return 'fastest_5k';
  if (matches(10)) return 'fastest_10k';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = RecordsQuerySchema.parse({
      userId: searchParams.get('userId') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    const userId = params.userId ?? 1; // Default to user 1 for now
    const { type, limit } = params;

    // Get personal record entries (stored table, not derived UI summaries)
    const allRecords = await getPersonalRecordEntries(userId);
    
    // Filter by type if specified
    let filteredRecords: any[] = allRecords;
    if (type !== 'all') {
      filteredRecords = allRecords.filter(record => getRecordCategory(record.recordType) === type);
    }
    
    // Apply limit
    const records = filteredRecords
      .slice()
      .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a))
      .slice(0, limit);
    
    // Get recent achievements (records set in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAchievements = records.filter(record => 
      getRecordTimestamp(record) >= thirtyDaysAgo.getTime()
    );
    
    // Calculate record statistics
    const recordsByType = records.reduce(
      (acc: { distance: number; time: number; pace: number }, record) => {
        const category = getRecordCategory(record.recordType);
        if (category) {
          acc[category] += 1;
        }
        return acc;
      },
      { distance: 0, time: 0, pace: 0 }
    );

    const recordStats = {
      totalRecords: records.length,
      recentAchievements: recentAchievements.length,
      recordsByType,
      oldestRecord:
        records.length > 0
          ? records.reduce((oldest, record) =>
              getRecordTimestamp(record) < getRecordTimestamp(oldest) ? record : oldest
            )
          : null,
      newestRecord:
        records.length > 0
          ? records.reduce((newest, record) =>
              getRecordTimestamp(record) > getRecordTimestamp(newest) ? record : newest
            )
          : null,
    };
    
    // Get milestone achievements (common distance PRs)
    const milestoneDistances = [1, 5, 10, 21.1, 42.2]; // 1k, 5k, 10k, half marathon, marathon
    const milestones = milestoneDistances.map(distance => {
      const record =
        allRecords.find(r => r.recordType === resolveTimeRecordType(distance)) ??
        allRecords.find(r => r.recordType === 'longest_run' && typeof r.value === 'number' && r.value >= distance) ??
        null;

      return {
        distance,
        record,
        achieved: !!record,
      };
    });
    
    // Get progression data for main distances
    const progressionData = await Promise.all(
      milestoneDistances.map(async (distance) => {
        const progression = await dbUtils.getPersonalRecordProgression(userId, distance);
        return {
          distance,
          progression,
        };
      })
    );

    const response = {
      records,
      recentAchievements,
      recordStats,
      milestones,
      progressionData,
      metadata: {
        userId,
        type,
        limit,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error fetching personal records:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch personal records' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = UpdateRecordSchema.parse(body);
    
    const updatedRecords = await safeDbOperation(async () => {
      const database = getDatabase();
      if (!database) return [];

      const now = new Date();
      const existing = await database.personalRecords.where('userId').equals(data.userId).toArray();
      const byType = new Map<string, any>(existing.map(record => [record.recordType, record]));

      const updates: any[] = [];

      const upsertRecord = async (recordType: string, value: number) => {
        const existingRecord = byType.get(recordType);
        const recordBase = {
          userId: data.userId,
          recordType,
          value,
          achievedAt: data.date,
          runId: data.runId,
          updatedAt: now,
        };

        if (existingRecord?.id) {
          await database.personalRecords.update(existingRecord.id, recordBase);
          updates.push({ ...existingRecord, ...recordBase });
          return;
        }

        const id = await database.personalRecords.add({ ...recordBase, createdAt: now });
        updates.push({ ...recordBase, id, createdAt: now });
      };

      const timeRecordType = resolveTimeRecordType(data.distance);
      if (timeRecordType) {
        const existingRecord = byType.get(timeRecordType);
        if (typeof existingRecord?.value !== 'number' || data.duration < existingRecord.value) {
          await upsertRecord(timeRecordType, data.duration);
        }
      }

      const existingLongest = byType.get('longest_run');
      if (typeof existingLongest?.value !== 'number' || data.distance > existingLongest.value) {
        await upsertRecord('longest_run', data.distance);
      }

      // Track best pace only for longer efforts to avoid short-distance bias.
      if (data.distance >= 10) {
        const existingPace = byType.get('best_pace');
        if (typeof existingPace?.value !== 'number' || data.pace < existingPace.value) {
          await upsertRecord('best_pace', data.pace);
        }
      }

      return updates;
    }, 'api_updatePersonalRecords', [] as any[]);

    const allRecords = await getPersonalRecordEntries(data.userId);
    
    return NextResponse.json({
      updatedRecords,
      allRecords,
      message: updatedRecords.length > 0 
        ? `Congratulations! You set ${updatedRecords.length} new personal record(s)!`
        : 'No new personal records this time, but keep pushing!',
    });
  } catch (error) {
    logger.error('Error updating personal records:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update personal records' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const userId = searchParams.get('userId');
    
    if (!recordId || !userId) {
      return NextResponse.json(
        { error: 'Record ID and User ID are required' },
        { status: 400 }
      );
    }
    
    // Delete specific record (admin functionality)
    await safeDbOperation(async () => {
      const database = getDatabase();
      if (!database) return;
      await database.personalRecords.delete(Number(recordId));
    }, 'api_deletePersonalRecord');
    
    return NextResponse.json({
      message: 'Personal record deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting personal record:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete personal record' },
      { status: 500 }
    );
  }
}
