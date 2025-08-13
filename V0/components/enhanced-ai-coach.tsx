'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  Activity, 
  Target, 
  Calendar,
  ChevronRight,
  Lightbulb,
  BarChart3
} from 'lucide-react';
import { dbUtils, type User, type Run } from '@/lib/db';
import { adaptiveCoachingEngine, type UserContext, type AdaptiveRecommendation } from '@/lib/adaptiveCoachingEngine';

// Performance trend analysis interfaces
export interface PerformanceTrend {
  metric: 'distance' | 'pace' | 'duration' | 'frequency';
  trend: 'improving' | 'declining' | 'stable';
  value: number;
  period: 'week' | 'month' | 'quarter';
  percentage?: number;
  description: string;
}

export interface AICoachContext {
  userId: string;
  recentRuns: Run[];
  currentPlan: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  performanceTrends: PerformanceTrend[];
  userPreferences: Record<string, unknown>;
  coachingStyle: 'encouraging' | 'technical' | 'motivational' | 'educational';
}

export interface AICoachResponse {
  response: string;
  suggestedQuestions: string[];
  followUpActions: string[];
  confidence: number;
  contextUsed: string[];
}

interface EnhancedAICoachProps {
  user: User;
  onResponse?: (response: AICoachResponse) => void;
  className?: string;
}

export function EnhancedAICoach({ user, onResponse, className = '' }: EnhancedAICoachProps) {
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [recommendations, setRecommendations] = useState<AdaptiveRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<AICoachContext | null>(null);

  useEffect(() => {
    loadPerformanceData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPerformanceData = async () => {
    try {
      setLoading(true);

      // Get user's recent runs for trend analysis
      const recentRuns = await dbUtils.getRunsByUser(user.id!);
      const performanceTrends = await analyzePerformanceTrends(recentRuns);
      
      // Build user context for AI coaching
      const userContext: UserContext = {
        currentGoals: [user.goal],
        recentActivity: recentRuns.length > 0 ? 
          `Last run: ${recentRuns[recentRuns.length - 1].distance}km` : 
          'No recent activity',
        mood: 'neutral',
        environment: 'outdoor'
      };

      // Generate adaptive recommendations
      const adaptiveRecommendations = await adaptiveCoachingEngine.generateAdaptiveRecommendations(
        user.id!,
        userContext
      );

      setPerformanceTrends(performanceTrends);
      setRecommendations(adaptiveRecommendations);
      
      // Set AI coach context
      const aiContext: AICoachContext = {
        userId: user.id!.toString(),
        recentRuns,
        currentPlan: null, // Would be loaded from active plan
        performanceTrends,
        userPreferences: {
          coachingStyle: user.coachingStyle || 'encouraging'
        },
        coachingStyle: user.coachingStyle || 'encouraging'
      };
      setContext(aiContext);

    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzePerformanceTrends = async (runs: Run[]): Promise<PerformanceTrend[]> => {
    if (runs.length < 2) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    
    // Sort runs by date
    const sortedRuns = runs.sort((a, b) => 
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    // Analyze distance trend (last 4 weeks)
    const recentRuns = sortedRuns.slice(-8); // Last 8 runs
    if (recentRuns.length >= 4) {
      const firstHalf = recentRuns.slice(0, Math.floor(recentRuns.length / 2));
      const secondHalf = recentRuns.slice(Math.floor(recentRuns.length / 2));
      
      const avgDistanceFirst = firstHalf.reduce((sum, run) => sum + run.distance, 0) / firstHalf.length;
      const avgDistanceSecond = secondHalf.reduce((sum, run) => sum + run.distance, 0) / secondHalf.length;
      
      const distanceChange = ((avgDistanceSecond - avgDistanceFirst) / avgDistanceFirst) * 100;
      
      trends.push({
        metric: 'distance',
        trend: distanceChange > 5 ? 'improving' : distanceChange < -5 ? 'declining' : 'stable',
        value: avgDistanceSecond,
        period: 'month',
        percentage: Math.abs(distanceChange),
        description: distanceChange > 5 ? 
          `Distance increased by ${distanceChange.toFixed(1)}%` :
          distanceChange < -5 ?
          `Distance decreased by ${Math.abs(distanceChange).toFixed(1)}%` :
          `Distance stable at ${avgDistanceSecond.toFixed(1)}km`
      });
    }

    // Analyze pace trend
    const runsWithPace = recentRuns.filter(run => run.pace);
    if (runsWithPace.length >= 4) {
      const firstHalfPace = runsWithPace.slice(0, Math.floor(runsWithPace.length / 2));
      const secondHalfPace = runsWithPace.slice(Math.floor(runsWithPace.length / 2));
      
      const avgPaceFirst = firstHalfPace.reduce((sum, run) => sum + run.pace!, 0) / firstHalfPace.length;
      const avgPaceSecond = secondHalfPace.reduce((sum, run) => sum + run.pace!, 0) / secondHalfPace.length;
      
      // Lower pace is better (improvement)
      const paceChange = ((avgPaceFirst - avgPaceSecond) / avgPaceFirst) * 100;
      
      trends.push({
        metric: 'pace',
        trend: paceChange > 2 ? 'improving' : paceChange < -2 ? 'declining' : 'stable',
        value: avgPaceSecond,
        period: 'month',
        percentage: Math.abs(paceChange),
        description: paceChange > 2 ? 
          `Pace improved by ${paceChange.toFixed(1)}%` :
          paceChange < -2 ?
          `Pace slowed by ${Math.abs(paceChange).toFixed(1)}%` :
          `Pace stable at ${formatPace(avgPaceSecond)}`
      });
    }

    // Analyze frequency trend (runs per week)
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const recentMonthRuns = sortedRuns.filter(run => 
      new Date(run.completedAt) >= oneMonthAgo
    );
    
    const runsPerWeek = recentMonthRuns.length / 4; // Approximate weeks in a month
    const targetFrequency = user.daysPerWeek || 3;
    
    trends.push({
      metric: 'frequency',
      trend: runsPerWeek >= targetFrequency ? 'improving' : 'declining',
      value: runsPerWeek,
      period: 'month',
      percentage: (runsPerWeek / targetFrequency) * 100,
      description: `${runsPerWeek.toFixed(1)} runs per week (target: ${targetFrequency})`
    });

    return trends;
  };

  const formatPace = (paceInSeconds: number): string => {
    const minutes = Math.floor(paceInSeconds / 60);
    const seconds = Math.round(paceInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getTrendIcon = (trend: PerformanceTrend) => {
    switch (trend.trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: PerformanceTrend) => {
    switch (trend.trend) {
      case 'improving':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'declining':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const generateCoachingInsight = async () => {
    if (!context) return;

    try {
      const userContext: UserContext = {
        currentGoals: [user.goal],
        recentActivity: context.recentRuns.length > 0 ? 
          `Recent performance trends: ${performanceTrends.map(t => `${t.metric} ${t.trend}`).join(', ')}` : 
          'No recent activity',
        mood: 'neutral'
      };

      const response = await adaptiveCoachingEngine.generatePersonalizedResponse(
        user.id!,
        `Based on my recent performance trends, what should I focus on improving?`,
        userContext
      );

      const aiResponse: AICoachResponse = {
        response: response.response,
        suggestedQuestions: [
          "How can I improve my consistency?",
          "What's the best way to increase my pace?",
          "Should I focus more on distance or speed?"
        ],
        followUpActions: response.suggestedActions || [],
        confidence: response.confidence,
        contextUsed: response.contextUsed
      };

      if (onResponse) {
        onResponse(aiResponse);
      }
    } catch (error) {
      console.error('Error generating coaching insight:', error);
    }
  };

  if (loading) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Enhanced AI Coach</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Performance Trends Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">Performance Trends</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {performanceTrends.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">
                Complete more runs to see performance trends
              </p>
            </div>
          ) : (
            performanceTrends.map((trend, index) => (
              <div key={index} className={`p-3 rounded-lg border ${getTrendColor(trend)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend)}
                    <span className="text-sm font-medium capitalize">
                      {trend.metric}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {trend.period}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600">
                  {trend.description}
                </p>
                {trend.percentage && (
                  <div className="mt-2">
                    <Progress 
                      value={Math.min(100, trend.percentage)} 
                      className="h-1" 
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* AI Coach Insights */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-medium">AI Coach Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600 text-white text-xs">
                AI
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm">
                {performanceTrends.length > 0 ? (
                  `Based on your recent trends, I notice ${
                    performanceTrends.filter(t => t.trend === 'improving').length > 0 
                      ? 'improvements in ' + performanceTrends.filter(t => t.trend === 'improving').map(t => t.metric).join(' and ')
                      : 'areas where we can focus on improvement'
                  }.`
                ) : (
                  "Let's start building your running data to provide personalized insights!"
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-blue-600 hover:text-blue-700 p-0 h-auto"
                onClick={generateCoachingInsight}
              >
                Get personalized advice
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adaptive Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <CardTitle className="text-sm font-medium">Smart Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-900">
                      {rec.title}
                    </h4>
                    <p className="text-xs text-yellow-800 mt-1">
                      {rec.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {rec.priority} priority
                      </Badge>
                      <span className="text-xs text-yellow-700">
                        {Math.round(rec.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Context Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <CardTitle className="text-sm font-medium">Coaching Context</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500">Experience:</span>
              <p className="font-medium capitalize">{user.experience}</p>
            </div>
            <div>
              <span className="text-gray-500">Goal:</span>
              <p className="font-medium capitalize">{user.goal}</p>
            </div>
            <div>
              <span className="text-gray-500">Target Frequency:</span>
              <p className="font-medium">{user.daysPerWeek} days/week</p>
            </div>
            <div>
              <span className="text-gray-500">Coaching Style:</span>
              <p className="font-medium capitalize">{user.coachingStyle || 'encouraging'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple AI Coach interface (from main branch) - for backward compatibility
export function SimpleEnhancedAICoach({ user, onResponse }: { user: User; onResponse: (res: any) => void }) {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)
    try {
      const runs = await dbUtils.getRunsByUser(user.id!)
      // Simplified fallback for compatibility
      const fallback = {
        response: `Hi ${user.name}, I understand you want to know about: ${text}`,
        suggestedQuestions: [],
        followUpActions: [],
        confidence: 0.5,
        contextUsed: []
      }
      setResponse(fallback)
      onResponse(fallback)
    } catch (e) {
      const fallback = {
        response: 'Unable to generate response.',
        suggestedQuestions: [],
        followUpActions: [],
        confidence: 0,
        contextUsed: []
      }
      setResponse(fallback)
      onResponse(fallback)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ask the coach..."
          data-testid="input"
        />
        <Button onClick={handleSend} disabled={isLoading || !text.trim()} data-testid="send">
          Send
        </Button>
      </div>
      {response && <p data-testid="response">{response.response}</p>}
    </div>
  )
}
