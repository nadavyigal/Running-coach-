import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, TrendingUp, Activity, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CohortStats {
  totalMembers: number;
  activeMembers: number;
  totalRuns: number;
  totalDistance: number;
  avgDistance: number;
  weeklyRuns: number;
  weeklyDistance: number;
  cohortName: string;
}

interface CommunityStatsWidgetProps {
  userId: number;
  className?: string;
}

export const CommunityStatsWidget: React.FC<CommunityStatsWidgetProps> = ({ userId, className }) => {
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardClassName = cn('w-full', className);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/cohort/stats?userId=${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          setStats(data);
        } else {
          if (response.status === 404) {
            // User not in a cohort - this is expected, don't show error
            setStats(null);
          } else {
            setError(data.message || 'Failed to fetch cohort stats');
          }
        }
      } catch {
        setError('Failed to fetch cohort stats');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchStats();
    }
  }, [userId]);

  if (loading) {
    return (
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Loading community stats...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={cardClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Community Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Join a cohort to see community stats!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {stats.cohortName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Members Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Members</span>
            <Badge variant="secondary">{stats.totalMembers}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Active</span>
            <Badge variant="outline" className="text-green-600 border-green-600">
              {stats.activeMembers}
            </Badge>
          </div>
        </div>

        {/* Weekly Stats Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">This Week</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Runs</span>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                {stats.weeklyRuns}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Distance</span>
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                {(Number(stats.weeklyDistance) || 0).toFixed(1)} km
              </Badge>
            </div>
          </div>
        </div>

        {/* All-Time Stats Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">All-Time</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalRuns}</div>
              <div className="text-xs text-muted-foreground">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{(Number(stats.totalDistance) || 0).toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Total km</div>
            </div>
          </div>
          <div className="text-center pt-2">
            <div className="text-lg font-semibold text-muted-foreground">
              {(Number(stats.avgDistance) || 0).toFixed(1)} km avg
            </div>
            <div className="text-xs text-muted-foreground">Average per run</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
