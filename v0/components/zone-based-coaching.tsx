'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, TrendingUp, AlertTriangle, Target, Zap } from 'lucide-react';
import { db } from '@/lib/db';

interface ZoneCoachingProps {
  userId: number;
  recentRuns?: number; // Number of recent runs to analyze
}

interface ZoneCoachingInsight {
  type: 'recovery_needed' | 'progression_ready' | 'zone_accuracy' | 'training_balance' | 'performance_trend';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendations: string[];
  data?: any;
}

export function ZoneBasedCoaching({ userId, recentRuns = 10 }: ZoneCoachingProps) {
  const [insights, setInsights] = useState<ZoneCoachingInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoneAccuracy, setZoneAccuracy] = useState<number>(0);
  const [trainingBalance, setTrainingBalance] = useState<{
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  }>({ zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 });

  useEffect(() => {
    analyzeZonePerformance();
  }, [userId, recentRuns]);

  const analyzeZonePerformance = async () => {
    try {
      setLoading(true);

      // Get recent runs with zone distribution
      const recentRunsData = await db.runs
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(recentRuns)
        .toArray();

      const zoneDistributions = await Promise.all(
        recentRunsData.map(async (run) => {
          const distribution = await db.zoneDistributions
            .where('runId')
            .equals(run.id!)
            .first();
          return { run, distribution };
        })
      );

      const validDistributions = zoneDistributions.filter(d => d.distribution);

      if (validDistributions.length === 0) {
        setInsights([{
          type: 'zone_accuracy',
          title: 'No Zone Data Available',
          description: 'Complete some runs with heart rate monitoring to get zone-based coaching insights.',
          priority: 'medium',
          actionable: false,
          recommendations: ['Connect a heart rate monitor', 'Complete a few runs with HR data']
        }]);
        setLoading(false);
        return;
      }

      // Calculate zone accuracy
      const accuracyScore = calculateZoneAccuracy(validDistributions);
      setZoneAccuracy(accuracyScore);

      // Calculate training balance
      const balance = calculateTrainingBalance(validDistributions);
      setTrainingBalance(balance);

      // Generate insights
      const newInsights = generateZoneInsights(validDistributions, accuracyScore, balance);
      setInsights(newInsights);

    } catch (error) {
      console.error('Error analyzing zone performance:', error);
      setInsights([{
        type: 'zone_accuracy',
        title: 'Analysis Error',
        description: 'Unable to analyze zone performance at this time.',
        priority: 'low',
        actionable: false,
        recommendations: ['Try again later', 'Check your data connection']
      }]);
    } finally {
      setLoading(false);
    }
  };

  const calculateZoneAccuracy = (distributions: any[]): number => {
    // Calculate how well user stays in intended zones
    let totalAccuracy = 0;
    let totalRuns = 0;

    distributions.forEach(({ distribution }) => {
      // Simple accuracy calculation based on zone distribution
      // Higher accuracy if more time spent in zones 2-4 (typical training zones)
      const zone2to4Time = distribution.zone2Time + distribution.zone3Time + distribution.zone4Time;
      const totalTime = distribution.totalTime;
      const accuracy = totalTime > 0 ? (zone2to4Time / totalTime) * 100 : 0;
      
      totalAccuracy += accuracy;
      totalRuns++;
    });

    return totalRuns > 0 ? Math.round(totalAccuracy / totalRuns) : 0;
  };

  const calculateTrainingBalance = (distributions: any[]): any => {
    const totalTime = distributions.reduce((sum, { distribution }) => sum + distribution.totalTime, 0);
    
    if (totalTime === 0) return { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };

    const zoneTimes = distributions.reduce((acc, { distribution }) => {
      acc.zone1 += distribution.zone1Time;
      acc.zone2 += distribution.zone2Time;
      acc.zone3 += distribution.zone3Time;
      acc.zone4 += distribution.zone4Time;
      acc.zone5 += distribution.zone5Time;
      return acc;
    }, { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 });

    return {
      zone1: Math.round((zoneTimes.zone1 / totalTime) * 100),
      zone2: Math.round((zoneTimes.zone2 / totalTime) * 100),
      zone3: Math.round((zoneTimes.zone3 / totalTime) * 100),
      zone4: Math.round((zoneTimes.zone4 / totalTime) * 100),
      zone5: Math.round((zoneTimes.zone5 / totalTime) * 100)
    };
  };

  const generateZoneInsights = (
    distributions: any[],
    accuracy: number,
    balance: any
  ): ZoneCoachingInsight[] => {
    const insights: ZoneCoachingInsight[] = [];

    // Zone accuracy insight
    if (accuracy < 60) {
      insights.push({
        type: 'zone_accuracy',
        title: 'Zone Accuracy Needs Improvement',
        description: `Your zone accuracy is ${accuracy}%. Focus on staying in your target zones during workouts.`,
        priority: 'high',
        actionable: true,
        recommendations: [
          'Use the real-time zone display during workouts',
          'Start with easier zone targets',
          'Practice zone awareness with shorter workouts'
        ]
      });
    } else if (accuracy > 80) {
      insights.push({
        type: 'zone_accuracy',
        title: 'Excellent Zone Control',
        description: `Great job! Your zone accuracy is ${accuracy}%. You're effectively targeting your intended training zones.`,
        priority: 'low',
        actionable: false,
        recommendations: ['Continue with current approach', 'Consider more challenging zone targets']
      });
    }

    // Recovery insight
    if (balance.zone5 > 20) {
      insights.push({
        type: 'recovery_needed',
        title: 'High Intensity Alert',
        description: 'You\'re spending a lot of time in Zone 5. Consider adding more recovery time.',
        priority: 'high',
        actionable: true,
        recommendations: [
          'Add more Zone 1-2 recovery runs',
          'Reduce high-intensity workout frequency',
          'Monitor for signs of overtraining'
        ]
      });
    }

    // Progression insight
    if (balance.zone2 > 50 && accuracy > 70) {
      insights.push({
        type: 'progression_ready',
        title: 'Ready for Progression',
        description: 'You\'re building a solid aerobic base. Consider adding more Zone 3-4 workouts.',
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Add tempo runs to your training',
          'Include threshold intervals',
          'Gradually increase workout intensity'
        ]
      });
    }

    // Training balance insight
    const zoneDistribution = [balance.zone1, balance.zone2, balance.zone3, balance.zone4, balance.zone5];
    const hasGoodBalance = zoneDistribution.every(zone => zone > 5 && zone < 40);
    
    if (!hasGoodBalance) {
      insights.push({
        type: 'training_balance',
        title: 'Training Balance Adjustment',
        description: 'Your training is skewed toward certain zones. Aim for more balanced training.',
        priority: 'medium',
        actionable: true,
        recommendations: [
          'Include a mix of easy, moderate, and hard runs',
          'Follow the 80/20 rule (80% easy, 20% hard)',
          'Plan recovery weeks every 3-4 weeks'
        ]
      });
    }

    return insights;
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recovery_needed': return <AlertTriangle className="h-4 w-4" />;
      case 'progression_ready': return <TrendingUp className="h-4 w-4" />;
      case 'zone_accuracy': return <Target className="h-4 w-4" />;
      case 'training_balance': return <Zap className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zone-Based Coaching</CardTitle>
          <CardDescription>Analyzing your zone performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Zone-Based Coaching
          </CardTitle>
          <CardDescription>
            Personalized insights based on your heart rate zone training
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Zone Accuracy Score */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Zone Accuracy</span>
              <span className="text-sm text-gray-600">{zoneAccuracy}%</span>
            </div>
            <Progress value={zoneAccuracy} className="h-2" />
            <p className="text-xs text-gray-500">
              How well you stay in your target zones during workouts
            </p>
          </div>

          {/* Training Balance */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Training Balance</span>
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="text-center">
                <div className="font-medium">Zone 1</div>
                <div className="text-blue-600">{trainingBalance.zone1}%</div>
              </div>
              <div className="text-center">
                <div className="font-medium">Zone 2</div>
                <div className="text-green-600">{trainingBalance.zone2}%</div>
              </div>
              <div className="text-center">
                <div className="font-medium">Zone 3</div>
                <div className="text-yellow-600">{trainingBalance.zone3}%</div>
              </div>
              <div className="text-center">
                <div className="font-medium">Zone 4</div>
                <div className="text-orange-600">{trainingBalance.zone4}%</div>
              </div>
              <div className="text-center">
                <div className="font-medium">Zone 5</div>
                <div className="text-red-600">{trainingBalance.zone5}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Coaching Insights</h3>
        {insights.map((insight, index) => (
          <Alert key={index} className={getPriorityColor(insight.priority)}>
            <div className="flex items-start gap-3">
              {getInsightIcon(insight.type)}
              <div className="flex-1">
                <AlertDescription className="font-medium mb-2">
                  {insight.title}
                </AlertDescription>
                <p className="text-sm mb-3">{insight.description}</p>
                {insight.actionable && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Recommendations:</span>
                    <ul className="text-sm space-y-1">
                      {insight.recommendations.map((rec, recIndex) => (
                        <li key={recIndex} className="flex items-start gap-2">
                          <span className="text-xs mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
} 
