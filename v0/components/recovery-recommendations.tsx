'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { RefreshCw, TrendingUp, Activity, Moon, Heart, Brain, Zap } from 'lucide-react';

interface RecoveryRecommendation {
  recommendations: string[];
  recoveryScore: number;
  confidence: number;
  breakdown?: {
    sleepScore: number;
    hrvScore: number;
    restingHRScore: number;
    subjectiveWellnessScore?: number;
    trainingLoadImpact: number;
    stressLevel?: number;
  };
}

interface RecoveryRecommendationsProps {
  userId?: number;
  date?: Date | string;
  showBreakdown?: boolean;
  onRefresh?: () => void;
}

export default function RecoveryRecommendations({ 
  userId = 1, 
  date,
  showBreakdown = false,
  onRefresh 
}: RecoveryRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecoveryRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [defaultDate] = useState(() => new Date());
  const inflightRequestRef = useRef<AbortController | null>(null);

  const normalizedDate = useMemo(() => {
    const raw = date ?? defaultDate;
    const parsed = typeof raw === 'string' ? new Date(raw) : raw;

    const normalized = new Date(parsed);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }, [date, defaultDate]);

  const dateKey = normalizedDate.toISOString();

  const loadRecommendations = useCallback(async () => {
    inflightRequestRef.current?.abort();
    const controller = new AbortController();
    inflightRequestRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/recovery/recommendations?userId=${userId}&date=${encodeURIComponent(dateKey)}`,
        { signal: controller.signal }
      );
       
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
       
      const data = await response.json();
       
      if (data.success) {
        setRecommendations(data.data);
      } else {
        setError(data.error || 'Failed to load recommendations');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      // Provide more detailed error message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load recovery recommendations: ${errorMessage}`);
      console.error('Error loading recommendations:', err);
    } finally {
      if (inflightRequestRef.current === controller) {
        inflightRequestRef.current = null;
      }
      setLoading(false);
    }
  }, [userId, dateKey]);

  useEffect(() => {
    loadRecommendations();
    return () => {
      inflightRequestRef.current?.abort();
    };
  }, [loadRecommendations]);

  const handleRefresh = useCallback(async () => {
    await loadRecommendations();
    onRefresh?.();
  }, [loadRecommendations, onRefresh]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const getRecommendationIcon = (recommendation: string) => {
    if (recommendation.toLowerCase().includes('sleep')) return <Moon className="w-4 h-4" />;
    if (recommendation.toLowerCase().includes('hrv') || recommendation.toLowerCase().includes('heart')) return <Heart className="w-4 h-4" />;
    if (recommendation.toLowerCase().includes('training') || recommendation.toLowerCase().includes('workout')) return <Activity className="w-4 h-4" />;
    if (recommendation.toLowerCase().includes('stress')) return <Brain className="w-4 h-4" />;
    if (recommendation.toLowerCase().includes('energy') || recommendation.toLowerCase().includes('motivation')) return <Zap className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4" />;
  };

  const getRecommendationPriority = (recommendation: string) => {
    const lowerRecommendation = recommendation.toLowerCase();
    if (lowerRecommendation.includes('rest') || lowerRecommendation.includes('recovery')) return 'high';
    if (lowerRecommendation.includes('stress') || lowerRecommendation.includes('sleep')) return 'medium';
    return 'low';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Recovery Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recovery Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadRecommendations} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recovery Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No recovery data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recovery Recommendations</span>
          <div className="flex items-center space-x-2">
            <Badge variant={recommendations.recoveryScore >= 80 ? 'default' : 'secondary'}>
              {getScoreLabel(recommendations.recoveryScore)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Recovery Score Summary */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-600">Recovery Score</span>
              <div className="flex items-center space-x-2">
                <span className={`text-2xl font-bold ${getScoreColor(recommendations.recoveryScore)}`}>
                  {recommendations.recoveryScore}/100
                </span>
                <Badge variant="outline">{recommendations.confidence}% confidence</Badge>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">Status</span>
              <div className="text-sm font-medium">
                {recommendations.recoveryScore >= 80 ? 'Ready for Training' :
                 recommendations.recoveryScore >= 60 ? 'Moderate Training OK' :
                 recommendations.recoveryScore >= 40 ? 'Light Activity Only' : 'Rest Day Recommended'}
              </div>
            </div>
          </div>

          {/* Breakdown (if enabled) */}
          {showBreakdown && recommendations.breakdown && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
              <div>
                <div className="flex items-center space-x-1">
                  <Moon className="w-3 h-3" />
                  <span className="text-xs font-medium">Sleep</span>
                </div>
                <span className={`text-sm font-bold ${getScoreColor(recommendations.breakdown.sleepScore)}`}>
                  {recommendations.breakdown.sleepScore}/100
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  <Heart className="w-3 h-3" />
                  <span className="text-xs font-medium">HRV</span>
                </div>
                <span className={`text-sm font-bold ${getScoreColor(recommendations.breakdown.hrvScore)}`}>
                  {recommendations.breakdown.hrvScore}/100
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span className="text-xs font-medium">Resting HR</span>
                </div>
                <span className={`text-sm font-bold ${getScoreColor(recommendations.breakdown.restingHRScore)}`}>
                  {recommendations.breakdown.restingHRScore}/100
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  <Brain className="w-3 h-3" />
                  <span className="text-xs font-medium">Wellness</span>
                </div>
                <span className={`text-sm font-bold ${getScoreColor(recommendations.breakdown.subjectiveWellnessScore || 50)}`}>
                  {recommendations.breakdown.subjectiveWellnessScore || 50}/100
                </span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Personalized Recommendations</h4>
            {recommendations.recommendations.map((recommendation, index) => (
              <div 
                key={index} 
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  getRecommendationPriority(recommendation) === 'high' 
                    ? 'bg-red-50 border-red-200' 
                    : getRecommendationPriority(recommendation) === 'medium'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className={`mt-1 ${
                  getRecommendationPriority(recommendation) === 'high' 
                    ? 'text-red-600' 
                    : getRecommendationPriority(recommendation) === 'medium'
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}>
                  {getRecommendationIcon(recommendation)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{recommendation}</p>
                  {getRecommendationPriority(recommendation) === 'high' && (
                    <Badge variant="destructive" className="mt-1 text-xs">
                      High Priority
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('/recovery', '_blank')}
            >
              View Full Dashboard
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open('/wellness', '_blank')}
            >
              Log Wellness Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 
