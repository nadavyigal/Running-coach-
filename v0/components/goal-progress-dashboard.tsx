'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  TrendingUp,
  CheckCircle2,
  Trophy,
  Flag,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dbUtils } from '@/lib/dbUtils';
import { GoalProgressEngine, type GoalProgress } from '@/lib/goalProgressEngine';
import type { Goal, GoalMilestone } from '@/lib/db';

const GoalProgressAnalyticsTab = dynamic(
  () => import('./goal-progress-analytics-tab').then(mod => mod.GoalProgressAnalyticsTab),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading analytics...</div> }
);
const GoalAnalyticsInsights = dynamic(
  () => import('./goal-analytics-insights').then(mod => mod.GoalAnalyticsInsights),
  { ssr: false }
);

interface GoalProgressDashboardProps {
  userId: number;
  className?: string;
}

interface GoalWithProgress {
  goal: Goal;
  progress: GoalProgress;
  milestones: GoalMilestone[];
  prediction: {
    probability: number;
    confidenceLevel: string;
    factors: string[];
  };
}

export function GoalProgressDashboard({ userId, className = '' }: GoalProgressDashboardProps) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadGoals = async () => {
      try {
        setLoading(true);
        const userGoals = await dbUtils.getUserGoals(userId);
        const engine = new GoalProgressEngine();

        const goalsWithProgress = await Promise.all(
          userGoals.map(async (goal) => {
            const progress = await engine.calculateGoalProgress(goal.id!);
            const milestones = await dbUtils.getGoalMilestones(goal.id!);

            if (!progress) return null;

            return {
              goal,
              progress,
              milestones,
              prediction: {
                probability: 0.85,
                confidenceLevel: 'High',
                factors: ['Consistent training', 'Improving pace']
              }
            };
          })
        );

        setGoals(goalsWithProgress.filter((g): g is GoalWithProgress => g !== null));
      } catch (error) {
        console.error("Error loading goals:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadGoals();
    }
  }, [userId]);

  const activeGoalsCount = goals.filter(g => g.goal.status === 'active').length;
  const onTrackCount = goals.filter(g => g.progress?.trajectory === 'on_track' || g.progress?.trajectory === 'ahead').length;
  const completedCount = goals.filter(g => g.goal.status === 'completed').length;

  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((acc, g) => acc + (g.progress?.progressPercentage || 0), 0) / goals.length)
    : 0;

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Target className="h-5 w-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{activeGoalsCount}</div>
            <div className="text-xs text-gray-500">Active Goals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
            <div className="text-2xl font-bold">{avgProgress}%</div>
            <div className="text-xs text-gray-500">Avg Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-2" />
            <div className="text-2xl font-bold">{onTrackCount}</div>
            <div className="text-xs text-gray-500">On Track</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Trophy className="h-5 w-5 text-yellow-500 mb-2" />
            <div className="text-2xl font-bold">{completedCount}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-900">Active Goals</h3>
        {goals.filter(g => g.goal.status === 'active').length === 0 ? (
          <p className="text-sm text-gray-500">No active goals found.</p>
        ) : (
          goals.filter(g => g.goal.status === 'active').map(({ goal, progress }) => (
            <Card key={goal.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                    <p className="text-sm text-gray-500">{goal.description}</p>
                  </div>
                  {progress?.daysUntilDeadline !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      {progress.daysUntilDeadline} days left
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{progress?.progressPercentage || 0}% Complete</span>
                    <span className="capitalize text-emerald-600 font-medium">{progress?.trajectory?.replace('_', ' ') || 'N/A'}</span>
                  </div>
                  <Progress value={progress?.progressPercentage || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );

  const renderMilestones = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upcoming Milestones</CardTitle>
        <CardDescription>Key targets to hit soon</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {goals.map(({ goal, progress }) => {
            if (!progress?.nextMilestone) return null;
            return (
              <div key={`${goal.id}-milestone`} className="flex items-center gap-3 p-3 bg-gray-5 rounded-lg">
                <Flag className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium text-sm text-gray-900">{progress.nextMilestone.title || `Milestone for ${goal.title}`}</p>
                  <p className="text-xs text-gray-500">Target: {progress.nextMilestone.targetValue} {goal.specificTarget?.unit || ''}</p>
                </div>
              </div>
            );
          })}
          {goals.every(g => !g.progress?.nextMilestone) && (
            <p className="text-sm text-gray-500 text-center py-4">No upcoming milestones defined.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-[300px] ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <Card className={`bg-gray-50 border-dashed ${className}`}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Goals Set</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Create your first goal to start tracking progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="analytics">
          <GoalProgressAnalyticsTab goals={goals} />
        </TabsContent>

        <TabsContent value="milestones">
          {renderMilestones()}
        </TabsContent>

        <TabsContent value="insights">
          <GoalAnalyticsInsights
            userId={userId}
            timeRange="30d"
            className="w-full"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
