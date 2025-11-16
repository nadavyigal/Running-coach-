import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/dbUtils';

const RecordsQuerySchema = z.object({
  userId: z.string().transform(Number).optional(),
  type: z.enum(['distance', 'time', 'pace', 'all']).nullable().optional().default('all'),
  limit: z.string().transform(Number).nullable().optional().default(50),
});

const UpdateRecordSchema = z.object({
  userId: z.number(),
  runId: z.number(),
  distance: z.number(),
  duration: z.number(),
  pace: z.number(),
  date: z.string().transform(str => new Date(str)),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = RecordsQuerySchema.parse({
      userId: searchParams.get('userId'),
      type: searchParams.get('type'),
      limit: searchParams.get('limit'),
    });

    const userId = params.userId || 1; // Default to user 1 for now
    const { type, limit } = params;

    // Get personal records
    const allRecords = await dbUtils.getPersonalRecords(userId);
    
    // Filter by type if specified
    let filteredRecords = allRecords;
    if (type !== 'all') {
      filteredRecords = allRecords.filter(record => record.recordType === type);
    }
    
    // Apply limit
    const records = filteredRecords.slice(0, limit);
    
    // Get recent achievements (records set in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAchievements = records.filter(record => 
      new Date(record.dateAchieved) >= thirtyDaysAgo
    );
    
    // Calculate record statistics
    const recordStats = {
      totalRecords: records.length,
      recentAchievements: recentAchievements.length,
      recordsByType: {
        distance: records.filter(r => r.recordType === 'distance').length,
        time: records.filter(r => r.recordType === 'time').length,
        pace: records.filter(r => r.recordType === 'pace').length,
      },
      oldestRecord: records.reduce((oldest, record) => 
        new Date(record.dateAchieved) < new Date(oldest.dateAchieved) ? record : oldest,
        records[0]
      ),
      newestRecord: records.reduce((newest, record) => 
        new Date(record.dateAchieved) > new Date(newest.dateAchieved) ? record : newest,
        records[0]
      ),
    };
    
    // Get milestone achievements (common distance PRs)
    const milestoneDistances = [1, 5, 10, 21.1, 42.2]; // 1k, 5k, 10k, half marathon, marathon
    const milestones = milestoneDistances.map(distance => {
      const record = records.find(r => 
        r.recordType === 'distance' && 
        Math.abs(r.distance - distance) < 0.1
      );
      return {
        distance,
        record: record || null,
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
    console.error('Error fetching personal records:', error);
    
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
    
    // Check and update personal records based on new run
    const updatedRecords = await dbUtils.checkAndUpdatePersonalRecords(
      data.userId,
      data.runId,
      data.distance,
      data.duration,
      data.pace,
      data.date
    );
    
    // Get updated records list
    const allRecords = await dbUtils.getPersonalRecords(data.userId);
    
    return NextResponse.json({
      updatedRecords,
      allRecords,
      message: updatedRecords.length > 0 
        ? `Congratulations! You set ${updatedRecords.length} new personal record(s)!`
        : 'No new personal records this time, but keep pushing!',
    });
  } catch (error) {
    console.error('Error updating personal records:', error);
    
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
    await dbUtils.deletePersonalRecord(Number(userId), Number(recordId));
    
    return NextResponse.json({
      message: 'Personal record deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting personal record:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete personal record' },
      { status: 500 }
    );
  }
}