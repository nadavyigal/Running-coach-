'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PerformanceChart } from '@/components/performance-chart';
import { PersonalRecordsCard } from '@/components/personal-records-card';
import { PerformanceInsights } from '@/components/performance-insights';
import { CommunityComparison } from '@/components/community-comparison';
import { Download, TrendingUp, TrendingDown, Activity, Target, Calendar } from 'lucide-react';

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

export function PerformanceAnalyticsDashboard({ userId = 1, onClose }: PerformanceAnalyticsDashboardProps) {
  const [data, setData] = useState<PerformanceAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, userId]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/performance/analytics?userId=${userId}&timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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
    if (paceSecondsPerKm === 0) return '--:--';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (durationSeconds: number): string => {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-gray-500">
            {new Date(data.dateRange.start).toLocaleDateString()} - {new Date(data.dateRange.end).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {getChangeIcon(data.comparison.averagePace.change)}
              <span className={getChangeColor(data.comparison.averagePace.change, true)}>
                {Math.abs(data.comparison.averagePace.change)} sec/km
              </span>
              vs previous period
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PerformanceChart
              title="Performance Trends"
              data={data.trends.performanceProgression}
              dataKey="performance"
              color="#3b82f6"
              yAxisLabel="Performance Score (%)"
            />
            <PerformanceInsights insights={data.insights} />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PerformanceChart
              title="Pace Progression"
              data={data.trends.paceProgression}
              dataKey="pace"
              color="#10b981"
              yAxisLabel="Pace (sec/km)"
              formatValue={formatPace}
            />
            <PerformanceChart
              title="Distance Progression"
              data={data.trends.distanceProgression}
              dataKey="distance"
              color="#f59e0b"
              yAxisLabel="Distance (km)"
              formatValue={(value) => `${value.toFixed(1)} km`}
            />
          </div>
          <PerformanceChart
            title="Consistency Score"
            data={data.trends.consistencyProgression}
            dataKey="consistency"
            color="#8b5cf6"
            yAxisLabel="Consistency (%)"
            formatValue={(value) => `${value.toFixed(0)}%`}
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