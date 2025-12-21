'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award, Calendar, TrendingUp, Share2 } from 'lucide-react';
import { format } from 'date-fns';

interface PersonalRecord {
  id: number;
  recordType: string;
  distance: number;
  timeForDistance: number;
  bestPace: number;
  dateAchieved: Date;
  runId: number;
  value: number;
}

interface PersonalRecordsData {
  records: PersonalRecord[];
  recentAchievements: PersonalRecord[];
  recordStats: {
    totalRecords: number;
    recentAchievements: number;
    recordsByType: {
      distance: number;
      time: number;
      pace: number;
    };
    oldestRecord?: PersonalRecord;
    newestRecord?: PersonalRecord;
  };
  milestones: Array<{
    distance: number;
    record: PersonalRecord | null;
    achieved: boolean;
  }>;
  progressionData: Array<{
    distance: number;
    progression: Array<{
      date: Date;
      time: number;
      pace: number;
    }>;
  }>;
}

interface PersonalRecordsCardProps {
  userId: number;
}

export function PersonalRecordsCard({ userId }: PersonalRecordsCardProps) {
  const [data, setData] = useState<PersonalRecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonalRecords();
  }, [userId]);

  const fetchPersonalRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/performance/records?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch personal records');
      }

      const recordsData = await response.json();
      setData(recordsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceSecondsPerKm: number): string => {
    if (paceSecondsPerKm === 0) return '--:--';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRecordIcon = (recordType: string) => {
    if (recordType.includes('fastest')) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (recordType.includes('longest')) return <Medal className="h-4 w-4 text-blue-500" />;
    if (recordType.includes('pace')) return <Award className="h-4 w-4 text-green-500" />;
    return <Trophy className="h-4 w-4 text-gray-500" />;
  };

  const getRecordLabel = (recordType: string) => {
    switch (recordType) {
      case 'fastest_1k': return '1K';
      case 'fastest_5k': return '5K';
      case 'fastest_10k': return '10K';
      case 'fastest_half_marathon': return 'Half Marathon';
      case 'fastest_marathon': return 'Marathon';
      case 'longest_run': return 'Longest Run';
      case 'best_pace': return 'Best Pace';
      default: return recordType;
    }
  };

  const getMilestoneLabel = (distance: number) => {
    if (distance === 1) return '1K';
    if (distance === 5) return '5K';
    if (distance === 10) return '10K';
    if (distance === 21.1) return 'Half Marathon';
    if (distance === 42.2) return 'Marathon';
    return `${distance}K`;
  };

  const shareRecord = async (record: PersonalRecord) => {
    const recordLabel = getRecordLabel(record.recordType);
    const time = formatTime(record.timeForDistance);
    const pace = formatPace(record.bestPace);
    
    const shareText = `🏃‍♂️ New Personal Record!\n${recordLabel}: ${time} (${pace}/km)\nAchieved on ${format(new Date(record.dateAchieved), 'MMM dd, yyyy')}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Personal Record Achievement',
          text: shareText,
        });
      } catch {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchPersonalRecords} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No personal records available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{data.recordStats.totalRecords}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Achievements</p>
                <p className="text-2xl font-bold">{data.recordStats.recentAchievements}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">First Record</p>
                <p className="text-sm font-medium">
                  {data.recordStats.oldestRecord 
                    ? format(new Date(data.recordStats.oldestRecord.dateAchieved), 'MMM yyyy')
                    : 'N/A'
                  }
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Records</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Personal Records</CardTitle>
              <CardDescription>Your best performances across all distances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.records.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No records yet. Keep running to set your first record!</p>
                ) : (
                  data.records.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRecordIcon(record.recordType)}
                        <div>
                          <div className="font-medium">{getRecordLabel(record.recordType)}</div>
                          <div className="text-sm text-gray-500">
                            {format(new Date(record.dateAchieved), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {record.recordType.includes('pace') 
                            ? formatPace(record.value)
                            : record.recordType.includes('longest')
                            ? `${record.value.toFixed(1)} km`
                            : formatTime(record.value)
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {!record.recordType.includes('longest') && `${formatPace(record.bestPace)}/km`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => shareRecord(record)}
                        className="ml-2"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>Distance Milestones</CardTitle>
              <CardDescription>Track your progress across key running distances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.milestones.map((milestone) => (
                  <div
                    key={milestone.distance}
                    className={`p-4 border rounded-lg ${
                      milestone.achieved 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                        : 'bg-gray-50 dark:bg-gray-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{getMilestoneLabel(milestone.distance)}</div>
                      {milestone.achieved ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Achieved
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                    {milestone.record ? (
                      <div className="text-sm space-y-1">
                        <div className="font-medium">{formatTime(milestone.record.timeForDistance)}</div>
                        <div className="text-gray-500">{formatPace(milestone.record.bestPace)}/km</div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(milestone.record.dateAchieved), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Not achieved yet</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
              <CardDescription>Records set in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recentAchievements.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No recent achievements. Keep pushing for new records!</p>
                ) : (
                  data.recentAchievements.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-3">
                        {getRecordIcon(record.recordType)}
                        <div>
                          <div className="font-medium">{getRecordLabel(record.recordType)}</div>
                          <div className="text-sm text-gray-500">
                            {format(new Date(record.dateAchieved), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {record.recordType.includes('pace') 
                            ? formatPace(record.value)
                            : record.recordType.includes('longest')
                            ? `${record.value.toFixed(1)} km`
                            : formatTime(record.value)
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {!record.recordType.includes('longest') && `${formatPace(record.bestPace)}/km`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => shareRecord(record)}
                        className="ml-2"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
