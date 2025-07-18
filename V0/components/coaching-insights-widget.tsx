'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  MessageSquare, 
  Target, 
  Settings,
  Lightbulb,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';

interface CoachingProfile {
  communicationStyle: {
    motivationLevel: 'low' | 'medium' | 'high';
    detailPreference: 'minimal' | 'medium' | 'detailed';
    personalityType: 'analytical' | 'encouraging' | 'direct' | 'supportive';
    preferredTone: 'professional' | 'friendly' | 'enthusiastic' | 'calm';
  };
  learnedPreferences: {
    workoutDays: string[];
    preferredWorkoutTypes: string[];
    difficultyPreference: number;
    weatherSensitivity: number;
    stressResponse: string;
  };
  effectivenessMetrics: {
    overallSatisfaction: number;
    coachingScore: number;
    engagementImprovement: number;
    totalInteractions: number;
    totalFeedback: number;
  };
  behaviorPatterns: Array<{
    type: string;
    confidence: number;
    lastObserved: string;
    observationCount: number;
    pattern: string;
  }>;
}

interface AdaptationHistory {
  date: string;
  adaptation: string;
  effectiveness: number;
  reason: string;
}

interface CoachingInsightsWidgetProps {
  userId: number;
  className?: string;
  showDetails?: boolean;
  onSettingsClick?: () => void;
}

export function CoachingInsightsWidget({ 
  userId, 
  className = '', 
  showDetails = true,
  onSettingsClick 
}: CoachingInsightsWidgetProps) {
  const [profile, setProfile] = useState<CoachingProfile | null>(null);
  const [adaptationHistory, setAdaptationHistory] = useState<AdaptationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCoachingData();
  }, [userId]);

  const fetchCoachingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/coaching/profile?userId=${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No profile exists yet - this is normal for new users
          setProfile(null);
          return;
        }
        throw new Error(`Failed to fetch coaching profile: ${response.status}`);
      }

      const data = await response.json();
      setProfile(data.coachingProfile);
      setAdaptationHistory(data.adaptationHistory || []);
    } catch (err) {
      console.error('Error fetching coaching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coaching data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 animate-pulse text-blue-500" />
            <div className="text-sm text-gray-600">Loading coaching insights...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <Brain className="h-5 w-5" />
            <div className="text-sm">Error loading coaching data</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Brain className="h-12 w-12 mx-auto text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900">Adaptive Coaching Ready</h3>
              <p className="text-sm text-gray-600 mt-1">
                Start chatting with your AI coach to begin learning your preferences!
              </p>
            </div>
            <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-chat'))}>
              Start Coaching
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMotivationColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPersonalityIcon = (type: string) => {
    switch (type) {
      case 'analytical': return BarChart3;
      case 'encouraging': return TrendingUp;
      case 'direct': return Target;
      case 'supportive': return MessageSquare;
      default: return Brain;
    }
  };

  const recentAdaptation = adaptationHistory[0];
  const PersonalityIcon = getPersonalityIcon(profile.communicationStyle.personalityType);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Adaptive Coaching
          </CardTitle>
          {onSettingsClick && (
            <Button variant="ghost" size="sm" onClick={onSettingsClick}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Coaching Effectiveness */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Coaching Effectiveness</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {profile.effectivenessMetrics.coachingScore}/100
            </Badge>
          </div>
          
          <Progress 
            value={profile.effectivenessMetrics.coachingScore} 
            className="h-2"
          />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-600">
                {profile.effectivenessMetrics.overallSatisfaction.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Satisfaction</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">
                {profile.effectivenessMetrics.totalInteractions}
              </div>
              <div className="text-xs text-gray-600">Interactions</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-purple-600">
                {profile.effectivenessMetrics.totalFeedback}
              </div>
              <div className="text-xs text-gray-600">Feedback</div>
            </div>
          </div>
        </div>

        {/* Communication Style */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PersonalityIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Communication Style</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge className={getMotivationColor(profile.communicationStyle.motivationLevel)}>
              {profile.communicationStyle.motivationLevel} motivation
            </Badge>
            <Badge variant="outline">
              {profile.communicationStyle.detailPreference} detail
            </Badge>
            <Badge variant="outline">
              {profile.communicationStyle.personalityType}
            </Badge>
          </div>
        </div>

        {/* Recent Adaptation */}
        {recentAdaptation && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Recent Adaptation</span>
              <Badge variant="outline" className="text-xs">
                {new Date(recentAdaptation.date).toLocaleDateString()}
              </Badge>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">{recentAdaptation.adaptation}</p>
              <p className="text-xs text-blue-700 mt-1">{recentAdaptation.reason}</p>
            </div>
          </div>
        )}

        {/* Learned Preferences (if showDetails) */}
        {showDetails && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Learned Preferences</span>
            </div>
            
            <div className="space-y-2 text-sm">
              {profile.learnedPreferences.workoutDays.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Preferred days:</span>
                  <span className="font-medium">
                    {profile.learnedPreferences.workoutDays.slice(0, 3).join(', ')}
                  </span>
                </div>
              )}
              
              {profile.learnedPreferences.preferredWorkoutTypes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Favorite types:</span>
                  <span className="font-medium">
                    {profile.learnedPreferences.preferredWorkoutTypes.slice(0, 2).join(', ')}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">Weather sensitivity:</span>
                <span className="font-medium">
                  {profile.learnedPreferences.weatherSensitivity}/10
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Behavior Patterns */}
        {showDetails && profile.behaviorPatterns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Detected Patterns</span>
            </div>
            
            <div className="space-y-2">
              {profile.behaviorPatterns.slice(0, 3).map((pattern, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs font-medium capitalize">
                      {pattern.type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-600">
                      {pattern.observationCount} observations
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {pattern.confidence}% confident
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvement Trend */}
        {profile.effectivenessMetrics.engagementImprovement !== 0 && (
          <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                {profile.effectivenessMetrics.engagementImprovement > 0 ? 'Improving' : 'Adapting'}
              </span>
            </div>
            <p className="text-xs text-gray-700 mt-1">
              Coaching effectiveness {profile.effectivenessMetrics.engagementImprovement > 0 ? 'improved' : 'adjusting'} 
              by {Math.abs(profile.effectivenessMetrics.engagementImprovement).toFixed(1)}% recently
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}