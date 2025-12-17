'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Target,
  Clock,
  Award,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Lightbulb,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

type RechartsModule = typeof import('recharts');

const LazyCharts = dynamic(async () => {
  const mod = await import('recharts');
  return {
    default: mod,
  };
}, { ssr: false });

interface GoalAnalyticsInsightsProps {
  userId: number;
  goalId?: number;
  timeRange?: '7d' | '30d' | '90d' | '1y' | 'all';
  className?: string;
}

interface AnalyticsData {
  overview: {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    averageCompletionTime: number;
    successRate: number;
    streak: number;
  };
  progressTrends: Array<{
    date: string;
    progress: number;
    goalsActive: number;
    goalsCompleted: number;
  }>;
  goalPerformance: Array<{
    goalId: number;
    title: string;
    category: string;
    progressRate: number;
    daysActive: number;
    completionProbability: number;
    status: string;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    successRate: number;
    averageProgress: number;
  }>;
  milestoneAchievements: Array<{
    date: string;
    count: number;
    category: string;
  }>;
  insights: Array<{
    type: 'success' | 'warning' | 'info' | 'achievement';
    title: string;
    description: string;
    actionable: boolean;
    metric?: number;
    trend?: 'up' | 'down' | 'stable';
  }>;
  predictions: {
    nextMilestone: {
      goalTitle: string;
      milestoneTitle: string;
      estimatedDate: string;
      confidence: number;
    } | null;
    goalCompletion: Array<{
      goalId: number;
      goalTitle: string;
      estimatedCompletion: string;
      probability: number;
    }>;
    recommendedActions: Array<{
      action: string;
      reason: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function GoalAnalyticsInsights({ 
  userId, 
  goalId, 
  timeRange = '30d', 
  className = '' 
}: GoalAnalyticsInsightsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [activeTab, setActiveTab] = useState('overview');
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [userId, goalId, selectedTimeRange]);

  useEffect(() => {
    let mounted = true;
    import('recharts').then((mod) => {
      if (mounted) setRecharts(mod);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId: userId.toString(),
        timeRange: selectedTimeRange,
        ...(goalId && { goalId: goalId.toString() })
      });

      const response = await fetch(`/api/goals/analytics?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error('Failed to load goal analytics');
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load analytics data.",
        });
      }
    } catch (error) {
      console.error('Error loading goal analytics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while loading analytics.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'achievement': return <Award className="h-5 w-5 text-purple-500" />;
      default: return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'achievement': return 'border-purple-200 bg-purple-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const exportAnalytics = async () => {
    try {
      const dataStr = JSON.stringify(analytics, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `goal-analytics-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        variant: "success",
        title: "Analytics Exported",
        description: "Your goal analytics have been downloaded.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export analytics data.",
      });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 animate-pulse text-blue-500" />
            <div className="text-sm text-gray-600">Loading analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Available</h3>
          <p className="text-gray-600">Create some goals to see detailed analytics.</p>
        </CardContent>
      </Card>
    );
  }

  if (!recharts) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 animate-pulse text-blue-500" />
            <div className="text-sm text-gray-600">Loading charts…</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } = recharts;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Goal Analytics & Insights
              </CardTitle>
              <CardDescription>
                Deep insights into your goal progress and performance patterns
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedTimeRange} onValueChange={(value) => setSelectedTimeRange(value as typeof selectedTimeRange)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportAnalytics}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadAnalytics}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.overview.totalGoals}</div>
                    <div className="text-sm text-gray-600">Total Goals</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Activity className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.overview.activeGoals}</div>
                    <div className="text-sm text-gray-600">Active Goals</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.overview.completedGoals}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.overview.averageCompletionTime}</div>
                    <div className="text-sm text-gray-600">Avg Days</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Award className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{Math.round(analytics.overview.successRate)}%</div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{analytics.overview.streak}</div>
                    <div className="text-sm text-gray-600">Day Streak</div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Progress Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.progressTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="progress" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Goal Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ category, count }) => `${category}: ${count}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {analytics.categoryBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              {/* Goal Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Individual Goal Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.goalPerformance.map((goal) => (
                      <div key={goal.goalId} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{goal.title}</h4>
                            <p className="text-sm text-gray-600">{goal.category}</p>
                          </div>
                          <Badge variant={goal.status === 'active' ? 'default' : 'secondary'}>
                            {goal.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Progress Rate:</span>
                            <div className="font-semibold flex items-center gap-1">
                              {goal.progressRate}%/day
                              {getTrendIcon(goal.progressRate > 1 ? 'up' : goal.progressRate < 0.5 ? 'down' : 'stable')}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Days Active:</span>
                            <div className="font-semibold">{goal.daysActive}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Completion Probability:</span>
                            <div className="font-semibold">{Math.round(goal.completionProbability * 100)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Category Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.categoryBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="successRate" fill="#10b981" name="Success Rate %" />
                        <Bar dataKey="averageProgress" fill="#3b82f6" name="Avg Progress %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="space-y-4">
                {analytics.insights.map((insight, index) => (
                  <Card key={index} className={`border-2 ${getInsightColor(insight.type)}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-700">{insight.description}</p>
                          
                          <div className="flex items-center gap-4 mt-2">
                            {insight.metric && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-600">Metric:</span>
                                <span className="font-semibold">{insight.metric}</span>
                              </div>
                            )}
                            {insight.trend && (
                              <div className="flex items-center gap-1">
                                {getTrendIcon(insight.trend)}
                                <span className="text-xs text-gray-600">Trend</span>
                              </div>
                            )}
                            {insight.actionable && (
                              <Badge variant="outline" className="text-xs">
                                Actionable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="predictions" className="space-y-6">
              {/* Next Milestone Prediction */}
              {analytics.predictions.nextMilestone && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Next Milestone Prediction
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold mb-2">{analytics.predictions.nextMilestone.goalTitle}</h4>
                      <p className="text-sm text-gray-700 mb-3">{analytics.predictions.nextMilestone.milestoneTitle}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-600">Estimated Date:</span>
                          <div className="font-semibold">{new Date(analytics.predictions.nextMilestone.estimatedDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Confidence:</span>
                          <div className="font-semibold">{Math.round(analytics.predictions.nextMilestone.confidence * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Goal Completion Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle>Goal Completion Forecasts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.predictions.goalCompletion.map((prediction) => (
                      <div key={prediction.goalId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{prediction.goalTitle}</div>
                          <div className="text-sm text-gray-600">
                            Est. completion: {new Date(prediction.estimatedCompletion).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant={prediction.probability > 0.7 ? "default" : prediction.probability > 0.4 ? "secondary" : "destructive"}>
                          {Math.round(prediction.probability * 100)}% likely
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommended Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.predictions.recommendedActions.map((action, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium">{action.action}</h5>
                            <p className="text-sm text-gray-600 mt-1">{action.reason}</p>
                          </div>
                          <Badge variant={action.impact === 'high' ? "default" : action.impact === 'medium' ? "secondary" : "outline"}>
                            {action.impact} impact
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
