'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Target,
  Calendar,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Shield,
  Activity,
  Zap
} from 'lucide-react';
import { HabitAnalyticsService, type HabitAnalytics, type HabitRisk } from '@/lib/habitAnalytics';
import { useToast } from '@/hooks/use-toast';

interface HabitAnalyticsWidgetProps {
  userId: number;
  showDetails?: boolean;
  className?: string;
}

export function HabitAnalyticsWidget({ userId, showDetails = false, className = '' }: HabitAnalyticsWidgetProps) {
  const [analytics, setAnalytics] = useState<HabitAnalytics | null>(null);
  const [risk, setRisk] = useState<HabitRisk | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(showDetails);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const habitService = new HabitAnalyticsService();

  useEffect(() => {
    loadAnalytics();
  }, [userId]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [analyticsData, riskData] = await Promise.all([
        habitService.calculateHabitAnalytics(userId),
        habitService.getHabitRisk(userId)
      ]);
      
      setAnalytics(analyticsData);
      setRisk(riskData);
    } catch (err) {
      console.error('Failed to load habit analytics:', err);
      setError('Failed to load habit analytics');
      toast({
        title: 'Error',
        description: 'Failed to load habit analytics. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Shield className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getConsistencyColor = (consistency: number) => {
    if (consistency >= 80) return 'text-green-500';
    if (consistency >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Unable to load habit analytics</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadAnalytics}
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Habit Analytics</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getRiskColor(analytics.riskLevel)}>
              {getRiskIcon(analytics.riskLevel)}
              <span className="ml-1 capitalize">{analytics.riskLevel} Risk</span>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">
                {analytics.currentStreak}
              </span>
            </div>
            <div className="text-xs text-gray-600">Current Streak</div>
            <div className="text-xs text-gray-500">
              Best: {analytics.longestStreak} days
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4 text-blue-500" />
              <span className={`text-2xl font-bold ${getConsistencyColor(analytics.weeklyConsistency)}`}>
                {analytics.weeklyConsistency}%
              </span>
            </div>
            <div className="text-xs text-gray-600">Weekly Consistency</div>
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
              {getTrendIcon(analytics.consistencyTrend)}
              <span className="capitalize">{analytics.consistencyTrend}</span>
            </div>
          </div>
        </div>

        {/* Consistency Progress Bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Weekly</span>
            <span className={getConsistencyColor(analytics.weeklyConsistency)}>
              {analytics.weeklyConsistency}%
            </span>
          </div>
          <Progress value={analytics.weeklyConsistency} className="h-2" />
          
          <div className="flex items-center justify-between text-sm">
            <span>Monthly</span>
            <span className={getConsistencyColor(analytics.monthlyConsistency)}>
              {analytics.monthlyConsistency}%
            </span>
          </div>
          <Progress value={analytics.monthlyConsistency} className="h-2" />
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-500">
                  {analytics.goalAlignment}%
                </div>
                <div className="text-xs text-gray-600">Goal Alignment</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-purple-500">
                  {analytics.planAdherence}%
                </div>
                <div className="text-xs text-gray-600">Plan Adherence</div>
              </div>
            </div>

            {/* Preferred Days */}
            {analytics.preferredDays.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Best Days
                </h4>
                <div className="flex gap-1 flex-wrap">
                  {analytics.preferredDays.slice(0, 3).map((day) => (
                    <Badge key={day.dayOfWeek} variant="outline" className="text-xs">
                      {day.dayName} ({Math.round(day.frequency * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Optimal Times */}
            {analytics.optimalTimes.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Optimal Times
                </h4>
                <div className="flex gap-1 flex-wrap">
                  {analytics.optimalTimes.map((time, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Assessment */}
            {risk && risk.factors.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Risk Factors
                </h4>
                <div className="space-y-1">
                  {risk.factors.slice(0, 2).map((factor, index) => (
                    <div key={index} className="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                      {factor}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {analytics.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  Suggestions
                </h4>
                <div className="space-y-1">
                  {analytics.suggestions.slice(0, 2).map((suggestion, index) => (
                    <div key={index} className="text-xs text-gray-700 bg-blue-50 p-2 rounded">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comparative Changes */}
            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className={`p-2 rounded ${analytics.weekOverWeek >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`font-semibold ${analytics.weekOverWeek >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.weekOverWeek > 0 ? '+' : ''}{analytics.weekOverWeek}%
                </div>
                <div className="text-gray-600">vs Last Week</div>
              </div>
              <div className={`p-2 rounded ${analytics.monthOverMonth >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`font-semibold ${analytics.monthOverMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analytics.monthOverMonth > 0 ? '+' : ''}{analytics.monthOverMonth}%
                </div>
                <div className="text-gray-600">vs Last Month</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={loadAnalytics}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t">
          Updated {analytics.lastUpdated.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}