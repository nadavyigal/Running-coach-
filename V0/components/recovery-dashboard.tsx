'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Calendar, TrendingUp, TrendingDown, Activity, Moon, Heart, Brain } from 'lucide-react';

interface RecoveryScore {
  id?: number;
  userId: number;
  date: Date;
  overallScore: number;
  sleepScore: number;
  hrvScore: number;
  restingHRScore: number;
  subjectiveWellnessScore?: number;
  trainingLoadImpact: number;
  stressLevel?: number;
  recommendations: string[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RecoveryTrends {
  trends: RecoveryScore[];
  stats: {
    overall: { avg: number; min: number; max: number; trend: string };
    sleep: { avg: number; min: number; max: number; trend: string };
    hrv: { avg: number; min: number; max: number; trend: string };
    restingHR: { avg: number; min: number; max: number; trend: string };
  };
  period: string;
}

interface SubjectiveWellness {
  id?: number;
  userId: number;
  date: Date;
  energyLevel: number;
  moodScore: number;
  sorenessLevel: number;
  stressLevel: number;
  motivationLevel: number;
  notes?: string;
  createdAt: Date;
}

export default function RecoveryDashboard() {
  const [currentScore, setCurrentScore] = useState<RecoveryScore | null>(null);
  const [trends, setTrends] = useState<RecoveryTrends | null>(null);
  const [wellnessData, setWellnessData] = useState<SubjectiveWellness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadRecoveryData();
  }, [selectedDate]);

  const loadRecoveryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load current recovery score
      const scoreResponse = await fetch(`/api/recovery/score?userId=1&date=${selectedDate.toISOString()}`);
      const scoreData = await scoreResponse.json();
      
      if (scoreData.success) {
        setCurrentScore(scoreData.data);
      }

      // Load recovery trends
      const trendsResponse = await fetch('/api/recovery/trends?userId=1&days=30');
      const trendsData = await trendsResponse.json();
      
      if (trendsData.success) {
        setTrends(trendsData.data);
      }

      // Load wellness data
      const wellnessResponse = await fetch(`/api/recovery/wellness?userId=1&date=${selectedDate.toISOString()}`);
      const wellnessData = await wellnessResponse.json();
      
      if (wellnessData.success) {
        setWellnessData(wellnessData.data);
      }

    } catch (err) {
      setError('Failed to load recovery data');
      console.error('Error loading recovery data:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getWellnessLabel = (level: number) => {
    if (level >= 8) return 'Excellent';
    if (level >= 6) return 'Good';
    if (level >= 4) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="mb-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recovery Dashboard</h1>
          <p className="text-gray-600">Track your recovery metrics and optimize your training</p>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4" />
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="border rounded px-2 py-1"
          />
        </div>
      </div>

      {/* Current Recovery Score */}
      {currentScore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Today's Recovery Score</span>
              <Badge variant={currentScore.overallScore >= 80 ? 'default' : 'secondary'}>
                {getScoreLabel(currentScore.overallScore)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overall Score */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Overall Recovery</span>
                  <span className={`font-bold text-xl ${getScoreColor(currentScore.overallScore)}`}>
                    {currentScore.overallScore}/100
                  </span>
                </div>
                <Progress value={currentScore.overallScore} className="h-3" />
              </div>

              {/* Individual Scores */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Moon className="w-4 h-4" />
                    <span className="text-sm font-medium">Sleep</span>
                  </div>
                  <Progress value={currentScore.sleepScore} className="h-2" />
                  <span className="text-xs text-gray-600">{currentScore.sleepScore}/100</span>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm font-medium">HRV</span>
                  </div>
                  <Progress value={currentScore.hrvScore} className="h-2" />
                  <span className="text-xs text-gray-600">{currentScore.hrvScore}/100</span>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Resting HR</span>
                  </div>
                  <Progress value={currentScore.restingHRScore} className="h-2" />
                  <span className="text-xs text-gray-600">{currentScore.restingHRScore}/100</span>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="w-4 h-4" />
                    <span className="text-sm font-medium">Wellness</span>
                  </div>
                  <Progress 
                    value={currentScore.subjectiveWellnessScore || 50} 
                    className="h-2" 
                  />
                  <span className="text-xs text-gray-600">
                    {currentScore.subjectiveWellnessScore || 50}/100
                  </span>
                </div>
              </div>

              {/* Confidence */}
              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Confidence</span>
                  <span className="text-sm font-medium">{currentScore.confidence}%</span>
                </div>
                <Progress value={currentScore.confidence} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {currentScore && currentScore.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentScore.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trends and Wellness */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trends">Recovery Trends</TabsTrigger>
          <TabsTrigger value="wellness">Wellness Input</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          {trends && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Overall Recovery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trends.stats.overall.trend)}
                    <span className="text-lg font-bold">{trends.stats.overall.avg}</span>
                    <span className="text-sm text-gray-600">avg</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {trends.stats.overall.min}-{trends.stats.overall.max} range
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Sleep Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trends.stats.sleep.trend)}
                    <span className="text-lg font-bold">{trends.stats.sleep.avg}</span>
                    <span className="text-sm text-gray-600">avg</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {trends.stats.sleep.min}-{trends.stats.sleep.max} range
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">HRV Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trends.stats.hrv.trend)}
                    <span className="text-lg font-bold">{trends.stats.hrv.avg}</span>
                    <span className="text-sm text-gray-600">avg</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {trends.stats.hrv.min}-{trends.stats.hrv.max} range
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Resting HR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trends.stats.restingHR.trend)}
                    <span className="text-lg font-bold">{trends.stats.restingHR.avg}</span>
                    <span className="text-sm text-gray-600">avg</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {trends.stats.restingHR.min}-{trends.stats.restingHR.max} range
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="wellness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How are you feeling today?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wellnessData ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Energy Level</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold">{wellnessData.energyLevel}/10</span>
                        <Badge variant="outline">{getWellnessLabel(wellnessData.energyLevel)}</Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Mood</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold">{wellnessData.moodScore}/10</span>
                        <Badge variant="outline">{getWellnessLabel(wellnessData.moodScore)}</Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Soreness</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold">{wellnessData.sorenessLevel}/10</span>
                        <Badge variant="outline">{getWellnessLabel(wellnessData.sorenessLevel)}</Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Stress Level</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold">{wellnessData.stressLevel}/10</span>
                        <Badge variant="outline">{getWellnessLabel(wellnessData.stressLevel)}</Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Motivation</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold">{wellnessData.motivationLevel}/10</span>
                        <Badge variant="outline">{getWellnessLabel(wellnessData.motivationLevel)}</Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">No wellness data for today</p>
                    <Button onClick={() => {/* TODO: Open wellness input modal */}}>
                      Add Wellness Data
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 