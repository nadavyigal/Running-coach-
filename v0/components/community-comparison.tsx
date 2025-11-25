'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Trophy, 
  TrendingUp, 
  Target,
  Medal,
  Crown,
  Activity,
  Calendar
} from 'lucide-react';

interface CommunityComparisonData {
  performanceComparison: {
    userRank: number;
    totalMembers: number;
    userAvgPace: number;
    cohortAvgPace: number;
    userTotalDistance: number;
    cohortAvgDistance: number;
    percentile: number;
  };
  cohortName: string;
  totalMembers: number;
  activeMembers: number;
  totalRuns: number;
  totalDistance: number;
  avgDistance: number;
  weeklyRuns: number;
  weeklyDistance: number;
}

interface CommunityComparisonProps {
  userId: number;
  timeRange: string;
}

export function CommunityComparison({ userId, timeRange }: CommunityComparisonProps) {
  const [data, setData] = useState<CommunityComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInCohort, setUserInCohort] = useState(false);

  useEffect(() => {
    fetchCommunityData();
  }, [userId, timeRange]);

  const fetchCommunityData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cohort/stats?userId=${userId}&includePerformance=true&timeRange=${timeRange}`);
      
      if (response.status === 404) {
        setUserInCohort(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch community data');
      }

      const cohortData = await response.json();
      setData(cohortData);
      setUserInCohort(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatPace = (paceSecondsPerKm: number): string => {
    if (paceSecondsPerKm === 0) return '--:--';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank <= 3) return <Medal className="h-5 w-5 text-orange-500" />;
    if (rank <= 5) return <Trophy className="h-5 w-5 text-blue-500" />;
    return <Target className="h-5 w-5 text-gray-500" />;
  };

  const getPercentileLabel = (percentile: number) => {
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Top 50%';
    return 'Bottom 50%';
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return 'text-green-600';
    if (percentile >= 75) return 'text-blue-600';
    if (percentile >= 50) return 'text-yellow-600';
    return 'text-gray-600';
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
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
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
          <CardTitle>Community Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchCommunityData} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userInCohort) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Comparison
          </CardTitle>
          <CardDescription>Compare your performance with your cohort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-gray-300" />
            </div>
            <p className="text-gray-500 mb-2">You're not in a cohort yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Join a community cohort to compare your performance with other runners
            </p>
            <Button variant="outline">
              Join a Cohort
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
          <CardTitle>Community Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">No community data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cohort Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {data.cohortName}
          </CardTitle>
          <CardDescription>
            Your running community • {data.totalMembers} members • {data.activeMembers} active this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalRuns}</div>
              <div className="text-sm text-gray-500">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalDistance.toFixed(0)} km</div>
              <div className="text-sm text-gray-500">Total Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.weeklyRuns}</div>
              <div className="text-sm text-gray-500">This Week</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      {data.performanceComparison && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Performance Ranking
            </CardTitle>
            <CardDescription>
              How you stack up against your cohort ({timeRange})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Rank Display */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  {getRankIcon(data.performanceComparison.userRank)}
                  <div>
                    <div className="text-lg font-bold">
                      #{data.performanceComparison.userRank} of {data.performanceComparison.totalMembers}
                    </div>
                    <div className="text-sm text-gray-500">Overall Ranking</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={getPercentileColor(data.performanceComparison.percentile)}>
                    {getPercentileLabel(data.performanceComparison.percentile)}
                  </Badge>
                  <div className="text-sm text-gray-500 mt-1">
                    {data.performanceComparison.percentile.toFixed(0)}th percentile
                  </div>
                </div>
              </div>

              {/* Detailed Comparisons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Distance Comparison */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Total Distance</span>
                    <Target className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">You</span>
                      <span className="font-medium">{data.performanceComparison.userTotalDistance.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Cohort Avg</span>
                      <span className="font-medium">{data.performanceComparison.cohortAvgDistance.toFixed(1)} km</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (data.performanceComparison.userTotalDistance / data.performanceComparison.cohortAvgDistance) * 100)}
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500">
                      {data.performanceComparison.userTotalDistance > data.performanceComparison.cohortAvgDistance ? 
                        `${((data.performanceComparison.userTotalDistance / data.performanceComparison.cohortAvgDistance - 1) * 100).toFixed(0)}% above average` :
                        `${((1 - data.performanceComparison.userTotalDistance / data.performanceComparison.cohortAvgDistance) * 100).toFixed(0)}% below average`
                      }
                    </div>
                  </div>
                </div>

                {/* Pace Comparison */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Average Pace</span>
                    <Activity className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">You</span>
                      <span className="font-medium">{formatPace(data.performanceComparison.userAvgPace)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Cohort Avg</span>
                      <span className="font-medium">{formatPace(data.performanceComparison.cohortAvgPace)}</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (data.performanceComparison.cohortAvgPace / data.performanceComparison.userAvgPace) * 100)}
                      className="h-2"
                    />
                    <div className="text-xs text-gray-500">
                      {data.performanceComparison.userAvgPace < data.performanceComparison.cohortAvgPace ? 
                        `${Math.abs(data.performanceComparison.cohortAvgPace - data.performanceComparison.userAvgPace).toFixed(0)} sec/km faster` :
                        `${Math.abs(data.performanceComparison.userAvgPace - data.performanceComparison.cohortAvgPace).toFixed(0)} sec/km slower`
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Motivational Message */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {data.performanceComparison.userRank <= 3 ? 
                      "Outstanding performance!" : 
                      data.performanceComparison.percentile >= 75 ? 
                        "Great work!" : 
                        "Keep pushing!"
                    }
                  </span>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {data.performanceComparison.userRank <= 3 ? 
                    "You're among the top performers in your cohort. Keep leading by example!" :
                    data.performanceComparison.percentile >= 75 ? 
                      "You're performing well above average. Small improvements could move you up significantly!" :
                      "Every run counts. Consistency is key to improving your ranking in the group."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Cohort Activity
          </CardTitle>
          <CardDescription>This week's highlights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm">Weekly Runs</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{data.weeklyRuns}</div>
                <div className="text-xs text-gray-500">
                  {(data.weeklyRuns / data.totalMembers).toFixed(1)} per member
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Weekly Distance</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{data.weeklyDistance.toFixed(1)} km</div>
                <div className="text-xs text-gray-500">
                  {(data.weeklyDistance / data.totalMembers).toFixed(1)} km per member
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Active Members</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{data.activeMembers} / {data.totalMembers}</div>
                <div className="text-xs text-gray-500">
                  {((data.activeMembers / data.totalMembers) * 100).toFixed(0)}% participation
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}