'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	  Target,
	  TrendingUp,
	  TrendingDown,
	  AlertTriangle,
	  CheckCircle2,
	  Calendar,
	  Trophy,
	  Flag,
	  BarChart3,
	  Award
	} from 'lucide-react';
import { GoalAnalyticsInsights } from './goal-analytics-insights';

const GoalProgressAnalyticsTab = dynamic(
  () => import('./goal-progress-analytics-tab').then(mod => mod.GoalProgressAnalyticsTab),
  { ssr: false, loading: () => <div className="p-6 text-sm text-gray-600">Loading analytics…</div> }
);

interface GoalProgressDashboardProps {
  userId: number;
  className?: string;
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

export function GoalProgressDashboard({ userId, className = '' }: GoalProgressDashboardProps) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterStatus, setFilterStatus] = useState('active');

  useEffect(() => {
    loadGoalsProgress();
  }, [userId, filterStatus]);

  const loadGoalsProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/goals/progress?userId=${userId}&includeHistory=true&includeAnalytics=true`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Filter goals based on status
        let filteredGoals = data.goals || [];
        if (filterStatus !== 'all') {
          filteredGoals = filteredGoals.filter((g: GoalWithProgress) => g.goal.status === filterStatus);
        }
        
        setGoals(filteredGoals);
        setSummary(data.summary);
      } else {
        console.error('Failed to load goals progress');
      }
    } catch (error) {
      console.error('Error loading goals progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data || data.goals.length === 0) {
    return (
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Goals</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Set a goal to start tracking your progress and get personalized insights.
          </p>
          <Button>Create Goal</Button>
        </CardContent>
      </Card>
    );
  }

  const selectedGoalData = selectedGoalId === 'all' 
    ? null 
    : data.goals.find(g => g.goal.id.toString() === selectedGoalId);

  return (

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <GoalProgressAnalyticsTab goals={goals} />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          {renderMilestones()}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
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
