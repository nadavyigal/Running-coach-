import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ExportQuerySchema = z.object({
  userId: z.string().nullable().optional().transform((val) => val ? Number(val) : undefined),
  format: z.string().nullable().optional().transform((val) => {
    if (!val || val === 'null') return 'json';
    if (['csv', 'json'].includes(val)) return val as 'csv' | 'json';
    throw new z.ZodError([{
      code: 'invalid_enum_value',
      received: val,
      options: ['csv', 'json'],
      path: ['format'],
      message: `Invalid enum value. Expected 'csv' | 'json', received '${val}'`
    }]);
  }),
  timeRange: z.string().nullable().optional().transform((val) => {
    if (!val || val === 'null') return 'all-time';
    if (['7d', '30d', '90d', '1y', 'all-time'].includes(val)) return val as '7d' | '30d' | '90d' | '1y' | 'all-time';
    throw new z.ZodError([{
      code: 'invalid_enum_value',
      received: val,
      options: ['7d', '30d', '90d', '1y', 'all-time'],
      path: ['timeRange'],
      message: `Invalid enum value. Expected '7d' | '30d' | '90d' | '1y' | 'all-time', received '${val}'`
    }]);
  }),
  includeRuns: z.string().nullable().optional().transform(val => val === null || val === undefined ? true : val === 'true'),
  includeMetrics: z.string().nullable().optional().transform(val => val === null || val === undefined ? true : val === 'true'),
  includeRecords: z.string().nullable().optional().transform(val => val === null || val === undefined ? true : val === 'true'),
});

function formatRunsAsCSV(runs: any[]): string {
  const headers = ['Date', 'Distance (km)', 'Duration (min)', 'Pace (min/km)', 'Type', 'Notes'];
  const rows = runs.map(run => [
    new Date(run.date).toISOString().split('T')[0],
    run.distance.toFixed(2),
    Math.round(run.duration / 60),
    `${Math.floor(run.pace / 60)}:${(run.pace % 60).toString().padStart(2, '0')}`,
    run.type || 'Run',
    run.notes || '',
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function formatMetricsAsCSV(metrics: any[]): string {
  const headers = ['Date', 'Average Pace (s/km)', 'Total Distance (km)', 'Total Duration (min)', 'Consistency Score', 'Performance Score'];
  const rows = metrics.map(metric => [
    new Date(metric.date).toISOString().split('T')[0],
    metric.averagePace.toFixed(2),
    metric.totalDistance.toFixed(2),
    Math.round(metric.totalDuration / 60),
    metric.consistencyScore.toFixed(1),
    metric.performanceScore.toFixed(1),
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function formatRecordsAsCSV(records: any[]): string {
  const headers = ['Distance', 'Best Time', 'Best Pace', 'Date Achieved', 'Type'];
  const rows = records.map(record => [
    record.distance.toFixed(2),
    `${Math.floor(record.timeForDistance / 60)}:${(record.timeForDistance % 60).toString().padStart(2, '0')}`,
    `${Math.floor(record.bestPace / 60)}:${(record.bestPace % 60).toString().padStart(2, '0')}`,
    new Date(record.dateAchieved).toISOString().split('T')[0],
    record.recordType,
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params = ExportQuerySchema.parse({
      userId: searchParams.get('userId'),
      format: searchParams.get('format'),
      timeRange: searchParams.get('timeRange'),
      includeRuns: searchParams.get('includeRuns'),
      includeMetrics: searchParams.get('includeMetrics'),
      includeRecords: searchParams.get('includeRecords'),
    });

    const userId = params.userId || 1; // Default to user 1 for now
    const { format, timeRange, includeRuns, includeMetrics, includeRecords } = params;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case 'all-time':
        startDate.setFullYear(2000); // Far back date
        break;
    }

    const exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        userId,
      },
    };

    // Collect data based on user preferences
    if (includeRuns) {
      const runs = await dbUtils.getRunsInTimeRange(userId, startDate, endDate);
      exportData.runs = runs.map(run => ({
        date: run.completedAt,
        distance: run.distance,
        duration: run.duration,
        pace: run.pace,
        type: run.type,
        notes: run.notes,
        route: run.route,
      }));
    }

    if (includeMetrics) {
      const metrics = await dbUtils.getPerformanceMetrics(userId, startDate, endDate);
      exportData.performanceMetrics = metrics;
    }

    if (includeRecords) {
      const records = await dbUtils.getPersonalRecords(userId);
      exportData.personalRecords = records;
    }

    // Format response based on requested format
    if (format === 'csv') {
      let csvContent = '';
      
      if (includeRuns && exportData.runs) {
        csvContent += '# RUNS\n';
        csvContent += formatRunsAsCSV(exportData.runs);
        csvContent += '\n\n';
      }
      
      if (includeMetrics && exportData.performanceMetrics) {
        csvContent += '# PERFORMANCE METRICS\n';
        csvContent += formatMetricsAsCSV(exportData.performanceMetrics);
        csvContent += '\n\n';
      }
      
      if (includeRecords && exportData.personalRecords) {
        csvContent += '# PERSONAL RECORDS\n';
        csvContent += formatRecordsAsCSV(exportData.personalRecords);
        csvContent += '\n\n';
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="running-data-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // JSON format
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="running-data-${timeRange}-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting performance data:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to export performance data' },
      { status: 500 }
    );
  }
}