'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import dynamic from 'next/dynamic';
import { Download, TrendingUp, TrendingDown, Activity, Target, Calendar } from 'lucide-react';

const PerformanceOverviewTab = dynamic(
  () => import('@/components/performance-overview-tab').then(mod => mod.PerformanceOverviewTab),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading overview…</div> }
);
const PerformanceTrendsTab = dynamic(
  () => import('@/components/performance-trends-tab').then(mod => mod.PerformanceTrendsTab),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading trends…</div> }
);
const PersonalRecordsCard = dynamic(
  () => import('@/components/personal-records-card').then(mod => mod.PersonalRecordsCard),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading records…</div> }
);
const CommunityComparison = dynamic(
  () => import('@/components/community-comparison').then(mod => mod.CommunityComparison),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading comparison…</div> }
);

interface PerformanceAnalyticsData {
  timeRange: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalRuns: number;
    totalDistance: number;
    totalDuration: number;
    averagePace: number;
    consistencyScore: number;
    performanceScore: number;
  };
  trends: {
    paceProgression: Array<{ date: Date; pace: number }>;
    distanceProgression: Array<{ date: Date; distance: number }>;
    consistencyProgression: Array<{ date: Date; consistency: number }>;
    performanceProgression: Array<{ date: Date; performance: number }>;
  };
  personalRecords: any[];
  insights: any[];
  comparison: {
    totalRuns: { current: number; previous: number; change: number };
    totalDistance: { current: number; previous: number; change: number };
    averagePace: { current: number; previous: number; change: number };
    consistencyScore: { current: number; previous: number; change: number };
  };
}

interface PerformanceAnalyticsDashboardProps {
  userId?: number;
  onClose?: () => void;
}

export function PerformanceAnalyticsDashboard({ userId = 1 }: PerformanceAnalyticsDashboardProps) {
  const [data, setData] = useState<PerformanceAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, userId]);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { dbUtils } = await import('@/lib/dbUtils');

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      
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

      const runs = await dbUtils.getRunsInTimeRange(userId, startDate, endDate);
      const trends = await dbUtils.calculatePerformanceTrends(runs);
      const personalRecords = await dbUtils.getPersonalRecords(userId);
      const insights = await dbUtils.getPerformanceInsights(userId, startDate, endDate);

      // Get period comparison data
      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(endDate);
      const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      previousPeriodStart.setDate(previousPeriodStart.getDate() - rangeDays);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - rangeDays);
      
      const previousPeriodRuns = await dbUtils.getRunsInTimeRange(userId, previousPeriodStart, previousPeriodEnd);
      const previousPeriodTrends = await dbUtils.calculatePerformanceTrends(previousPeriodRuns);

      const comparison = {
        totalRuns: {
          current: runs.length,
          previous: previousPeriodRuns.length,
          change: runs.length - previousPeriodRuns.length,
        },
        totalDistance: {
          current: runs.reduce((sum: number, run: any) => sum + run.distance, 0),
          previous: previousPeriodRuns.reduce((sum: number, run: any) => sum + run.distance, 0),
          change:
            runs.reduce((sum: number, run: any) => sum + run.distance, 0) -
            previousPeriodRuns.reduce((sum: number, run: any) => sum + run.distance, 0),
        },
        averagePace: {
          current: trends.averagePace,
          previous: previousPeriodTrends.averagePace,
          change: trends.averagePace - previousPeriodTrends.averagePace,
        },
        consistencyScore: {
          current: trends.consistencyScore,
          previous: previousPeriodTrends.consistencyScore,
          change: trends.consistencyScore - previousPeriodTrends.consistencyScore,
        },
      };

      const analyticsData: PerformanceAnalyticsData = {
        timeRange,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          totalRuns: runs.length,
          totalDistance: runs.reduce((sum: number, run: any) => sum + run.distance, 0),
          totalDuration: runs.reduce((sum: number, run: any) => sum + run.duration, 0),
          averagePace: trends.averagePace,
          consistencyScore: trends.consistencyScore,
          performanceScore: trends.performanceScore,
        },
        trends: {
          paceProgression: trends.paceProgression,
          distanceProgression: trends.distanceProgression,
          consistencyProgression: trends.consistencyProgression,
          performanceProgression: trends.performanceProgression,
        },
        personalRecords,
        insights,
        comparison,
      };

      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [timeRange, userId]);

  useEffect(() => {
    const handler = () => {
      fetchAnalyticsData().catch(() => undefined);
    };
    window.addEventListener('run-saved', handler);
    return () => window.removeEventListener('run-saved', handler);
  }, [fetchAnalyticsData]);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/performance/export?userId=${userId}&format=${format}&timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `running-data-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const formatPace = (paceSecondsPerKm: number): string => {
    if (!paceSecondsPerKm || paceSecondsPerKm <= 0 || !Number.isFinite(paceSecondsPerKm)) return '--:--';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const getChangeColor = (change: number, isInverse = false) => {
    if (change === 0) return 'text-gray-500';
    if (isInverse) {
      return change > 0 ? 'text-red-500' : 'text-green-500';
    }
    return change > 0 ? 'text-green-500' : 'text-red-500';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchAnalyticsData} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6 px-4 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Performance Analytics</h1>
          <p className="text-sm text-gray-500">
            {new Date(data.dateRange.start).toLocaleDateString()} - {new Date(data.dateRange.end).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all-time">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export JSON</span>
            <span className="sm:hidden">JSON</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalRuns}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getChangeIcon(data.comparison.totalRuns.change)}
              <span className={getChangeColor(data.comparison.totalRuns.change)}>
                {data.comparison.totalRuns.change > 0 ? '+' : ''}{data.comparison.totalRuns.change}
              </span>
              vs previous period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalDistance.toFixed(1)} km</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getChangeIcon(data.comparison.totalDistance.change)}
              <span className={getChangeColor(data.comparison.totalDistance.change)}>
                {data.comparison.totalDistance.change > 0 ? '+' : ''}{data.comparison.totalDistance.change.toFixed(1)} km
              </span>
              vs previous period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Pace</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPace(data.summary.averagePace)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {data.comparison.averagePace.previous > 0 ? (
                <>
                  {getChangeIcon(data.comparison.averagePace.change)}
                  <span className={getChangeColor(data.comparison.averagePace.change, true)}>
                    {Math.round(Math.abs(data.comparison.averagePace.change))} sec/km
                  </span>
                  vs previous period
                </>
              ) : (
                <span className="text-gray-500">No previous data</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consistency Score</CardTitle>
            <Badge variant="secondary">{data.summary.consistencyScore.toFixed(0)}%</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.performanceScore.toFixed(0)}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getChangeIcon(data.comparison.consistencyScore.change)}
              <span className={getChangeColor(data.comparison.consistencyScore.change)}>
                {data.comparison.consistencyScore.change > 0 ? '+' : ''}{data.comparison.consistencyScore.change.toFixed(1)}%
              </span>
              vs previous period
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <PerformanceOverviewTab
            performanceProgression={data.trends.performanceProgression}
            insights={data.insights}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <PerformanceTrendsTab
            paceProgression={data.trends.paceProgression}
            distanceProgression={data.trends.distanceProgression}
            consistencyProgression={data.trends.consistencyProgression}
          />
        </TabsContent>

        <TabsContent value="records">
          <PersonalRecordsCard userId={userId} />
        </TabsContent>

        <TabsContent value="community">
          <CommunityComparison userId={userId} timeRange={timeRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
