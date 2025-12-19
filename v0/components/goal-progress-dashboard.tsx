'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Settings,
  Trophy,
  Zap,
  Flag,
  BarChart3,
  Filter,
  Sparkles,
  Award
} from 'lucide-react';
import { GoalAnalyticsInsights } from './goal-analytics-insights';
import { toast } from '@/components/ui/use-toast';

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
  const [selectedGoal, setSelectedGoal] = useState<GoalWithProgress | null>(null);

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

  const getTrajectoryIcon = (trajectory: string) => {
    switch (trajectory) {
      case 'ahead': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'on_track': return <Target className="h-4 w-4 text-blue-500" />;
      case 'behind': return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      case 'at_risk': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrajectoryColor = (trajectory: string) => {
    switch (trajectory) {
      case 'ahead': return 'text-green-600 bg-green-50';
      case 'on_track': return 'text-blue-600 bg-blue-50';
      case 'behind': return 'text-yellow-600 bg-yellow-50';
      case 'at_risk': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1: return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
      case 2: return <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>;
      case 3: return <Badge className="bg-green-100 text-green-800">Low Priority</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'seconds') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${Math.round(value * 10) / 10} ${unit}`;
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Active Goals</p>
                <p className="text-2xl font-bold">{summary?.totalActiveGoals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold">{Math.round(summary?.averageProgress || 0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">On Track</p>
                <p className="text-2xl font-bold">{summary?.goalsOnTrack || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">At Risk</p>
                <p className="text-2xl font-bold">{summary?.goalsAtRisk || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {goals.map((goalData) => (
          <Card key={goalData.goal.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedGoal(goalData)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{goalData.goal.title}</h3>
                    {getPriorityBadge(goalData.goal.priority)}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getTrajectoryColor(goalData.progress.trajectory)}`}>
                      {getTrajectoryIcon(goalData.progress.trajectory)}
                      {goalData.progress.trajectory.replace('_', ' ')}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">{goalData.goal.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(goalData.progress.progressPercentage)}%</p>
                  <p className="text-xs text-gray-500">{goalData.progress.daysUntilDeadline} days left</p>
                </div>
              </div>

              <div className="space-y-3">
                <Progress value={goalData.progress.progressPercentage} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>
                    Current: {formatValue(goalData.progress.currentValue, goalData.goal.specificTarget.unit)}
                  </span>
                  <span>
                    Target: {formatValue(goalData.progress.targetValue, goalData.goal.specificTarget.unit)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due{' '}
                      {(() => {
                        const deadline = new Date(goalData.goal.deadline);
                        return Number.isNaN(deadline.getTime()) ? '--' : deadline.toLocaleDateString();
                      })()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      {Math.round(goalData.prediction.probability * 100)}% likely
                    </span>
                  </div>
                  
                  {goalData.milestones.filter(m => m.status === 'achieved').length > 0 && (
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-yellow-600">
                        {goalData.milestones.filter(m => m.status === 'achieved').length} milestones
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {goals.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Goals Yet</h3>
            <p className="text-gray-600 mb-4">
              {filterStatus === 'active'
                ? "Go to your Profile to create your first goal and get a personalized training plan."
                : `No ${filterStatus} goals found.`}
            </p>
            <p className="text-sm text-gray-500">
              Tap the Profile icon in the bottom navigation to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );


  const renderMilestones = () => (
    <div className="space-y-6">
      {goals.map((goalData) => (
        <Card key={goalData.goal.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              {goalData.goal.title}
            </CardTitle>
            <CardDescription>
              {goalData.milestones.length} milestones • {goalData.milestones.filter(m => m.status === 'achieved').length} achieved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goalData.milestones.map((milestone: any, index: number) => (
                <div key={milestone.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    milestone.status === 'achieved' ? 'bg-green-100 text-green-600' :
                    milestone.isNext ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {milestone.status === 'achieved' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium">{milestone.title}</h4>
                    <p className="text-sm text-gray-600">{milestone.description}</p>
                    {milestone.daysUntilTarget !== null && milestone.daysUntilTarget > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {milestone.daysUntilTarget} days remaining
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatValue(milestone.targetValue, goalData.goal.specificTarget.unit)}
                    </p>
                    <Badge 
                      variant={milestone.status === 'achieved' ? "default" : "outline"}
                      className="mt-1"
                    >
                      {milestone.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      
      {goals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Milestones Yet</h3>
            <p className="text-gray-600">Create goals to see milestone tracking.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 animate-pulse text-blue-500" />
            <div className="text-sm text-gray-600">Loading goals...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Goal Progress</h1>
          <p className="text-gray-600">Track your running goals and milestones</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Goals</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="all">All Goals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
