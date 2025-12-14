'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type RechartsModule = typeof import('recharts');

interface GoalProgress {
  goalId: number;
  currentValue: number;
  targetValue: number;
  baselineValue: number;
  progressPercentage: number;
  trajectory: 'on_track' | 'ahead' | 'behind' | 'at_risk';
  projectedCompletion: string;
  daysUntilDeadline: number;
  improvementRate: number;
  recentTrend: 'improving' | 'stable' | 'declining';
}

interface Goal {
  id: number;
  title: string;
  description: string;
  goalType: string;
  category: string;
  priority: number;
  status: string;
  deadline: string;
  specificTarget: {
    metric: string;
    value: number;
    unit: string;
    description: string;
  };
}

interface GoalWithProgress {
  goal: Goal;
  progress: GoalProgress;
  milestones: any[];
  prediction: {
    probability: number;
    confidenceLevel: string;
    factors: string[];
  };
}

interface Props {
  goals: GoalWithProgress[];
}

export function GoalProgressAnalyticsTab({ goals }: Props) {
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    let mounted = true;
    import('recharts').then((mod) => {
      if (mounted) setRecharts(mod);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!recharts) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-600">Loading analytics…</CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CardTitle className="text-lg font-semibold mb-2">No Analytics Available</CardTitle>
          <CardDescription>Create some goals to see progress analytics.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  const { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } = recharts;

  const progressData = goals.map((g) => ({
    name: `${g.goal.title.slice(0, 10)}...`,
    progress: Math.round(g.progress.progressPercentage),
    target: 100,
    trajectory: g.progress.trajectory,
  }));

  const timelineData = goals.map((g) => ({
    name: `${g.goal.title.slice(0, 10)}...`,
    daysLeft: g.progress.daysUntilDeadline,
    probability: Math.round(g.prediction.probability * 100),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
            <CardDescription>Current progress toward each goal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="progress" fill="#3b82f6" />
                  <Bar dataKey="target" fill="#e5e7eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Probability</CardTitle>
            <CardDescription>Likelihood of achieving each goal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="probability" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {goals.map((goalData) => (
          <Card key={goalData.goal.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{goalData.goal.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Progress</span>
                <span className="font-semibold">{Math.round(goalData.progress.progressPercentage)}%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Probability</span>
                <span className="font-semibold">{Math.round(goalData.prediction.probability * 100)}%</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Trajectory</span>
                <span className="text-xs capitalize text-gray-700">{goalData.progress.trajectory.replace('_', ' ')}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Days Remaining</span>
                <span className="font-semibold">{goalData.progress.daysUntilDeadline}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
