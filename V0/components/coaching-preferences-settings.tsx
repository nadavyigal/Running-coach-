'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { 
  Settings, 
  MessageSquare, 
  Brain, 
  Volume2, 
  Target, 
  Cloud, 
  Calendar,
  Save,
  RotateCcw,
  TrendingUp
} from 'lucide-react';

interface CoachingPreferences {
  communicationStyle: {
    motivationLevel: 'low' | 'medium' | 'high';
    detailPreference: 'minimal' | 'medium' | 'detailed';
    personalityType: 'analytical' | 'encouraging' | 'direct' | 'supportive';
    preferredTone: 'professional' | 'friendly' | 'enthusiastic' | 'calm';
  };
  feedbackPatterns: {
    preferredFeedbackFrequency: 'after_every_workout' | 'weekly' | 'monthly';
  };
  behavioralPatterns: {
    workoutPreferences: {
      difficultyPreference: number;
    };
    contextualPatterns: {
      weatherSensitivity: number;
      scheduleFlexibility: number;
      stressResponse: 'reduce_intensity' | 'maintain' | 'increase_focus';
    };
  };
}

interface CoachingPreferencesSettingsProps {
  userId: number;
  onClose?: () => void;
}

const MOTIVATION_DESCRIPTIONS = {
  low: 'Calm, measured encouragement',
  medium: 'Balanced motivation and support',
  high: 'Enthusiastic, high-energy motivation'
};

const DETAIL_DESCRIPTIONS = {
  minimal: 'Brief, to-the-point responses',
  medium: 'Balanced detail level',
  detailed: 'Comprehensive explanations with technical details'
};

const PERSONALITY_DESCRIPTIONS = {
  analytical: 'Data-driven insights and metrics focus',
  encouraging: 'Positive reinforcement and celebration',
  direct: 'Straightforward, efficient communication',
  supportive: 'Empathetic, understanding approach'
};

const TONE_DESCRIPTIONS = {
  professional: 'Formal, expert guidance',
  friendly: 'Warm, personable interaction',
  enthusiastic: 'Energetic, exciting communication',
  calm: 'Peaceful, zen-like approach'
};

export function CoachingPreferencesSettings({ userId, onClose }: CoachingPreferencesSettingsProps) {
  const [preferences, setPreferences] = useState<CoachingPreferences>({
    communicationStyle: {
      motivationLevel: 'medium',
      detailPreference: 'medium',
      personalityType: 'encouraging',
      preferredTone: 'friendly'
    },
    feedbackPatterns: {
      preferredFeedbackFrequency: 'weekly'
    },
    behavioralPatterns: {
      workoutPreferences: {
        difficultyPreference: 5
      },
      contextualPatterns: {
        weatherSensitivity: 5,
        scheduleFlexibility: 5,
        stressResponse: 'maintain'
      }
    }
  });

  const [originalPreferences, setOriginalPreferences] = useState<CoachingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchCurrentPreferences();
  }, [userId]);

  useEffect(() => {
    if (originalPreferences) {
      const changed = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
      setHasChanges(changed);
    }
  }, [preferences, originalPreferences]);

  const fetchCurrentPreferences = async () => {
    try {
      const response = await fetch(`/api/coaching/profile?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        const profile = data.coachingProfile;
        
        const currentPrefs: CoachingPreferences = {
          communicationStyle: profile.communicationStyle,
          feedbackPatterns: {
            preferredFeedbackFrequency: profile.feedbackPatterns?.preferredFeedbackFrequency || 'weekly'
          },
          behavioralPatterns: {
            workoutPreferences: {
              difficultyPreference: profile.learnedPreferences?.difficultyPreference || 5
            },
            contextualPatterns: {
              weatherSensitivity: profile.learnedPreferences?.weatherSensitivity || 5,
              scheduleFlexibility: profile.behavioralPatterns?.contextualPatterns?.scheduleFlexibility || 5,
              stressResponse: profile.learnedPreferences?.stressResponse || 'maintain'
            }
          }
        };
        
        setPreferences(currentPrefs);
        setOriginalPreferences(currentPrefs);
      } else if (response.status === 404) {
        // No profile exists, use defaults
        setOriginalPreferences(preferences);
      }
    } catch (error) {
      console.error('Error fetching coaching preferences:', error);
      toast({
        variant: "destructive",
        title: "Error loading preferences",
        description: "Using default settings. Your changes will still be saved.",
      });
      setOriginalPreferences(preferences);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/coaching/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...preferences
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          variant: "success",
          title: "Preferences updated! 🎯",
          description: result.adaptations?.length > 0 
            ? `${result.adaptations.length} coaching adaptations applied.`
            : "Your coaching experience will adapt to these preferences.",
        });

        setOriginalPreferences(preferences);
        setHasChanges(false);
        
        if (onClose) {
          setTimeout(onClose, 1000);
        }
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        variant: "destructive",
        title: "Error saving preferences",
        description: "Please try again later.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalPreferences) {
      setPreferences(originalPreferences);
    }
  };

  const updateCommunicationStyle = (key: keyof CoachingPreferences['communicationStyle'], value: string) => {
    setPreferences(prev => ({
      ...prev,
      communicationStyle: {
        ...prev.communicationStyle,
        [key]: value
      }
    }));
  };

  const updateContextualPattern = (key: string, value: number | string) => {
    setPreferences(prev => ({
      ...prev,
      behavioralPatterns: {
        ...prev.behavioralPatterns,
        contextualPatterns: {
          ...prev.behavioralPatterns.contextualPatterns,
          [key]: value
        }
      }
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 animate-spin text-blue-500" />
            <div className="text-sm text-gray-600">Loading preferences...</div>
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
            <Settings className="h-5 w-5 text-blue-500" />
            Coaching Preferences
          </CardTitle>
          <CardDescription>
            Customize how your AI coach communicates and adapts to your needs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Communication Style */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <h3 className="font-medium">Communication Style</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motivation Level</Label>
                <Select
                  value={preferences.communicationStyle.motivationLevel}
                  onValueChange={(value) => updateCommunicationStyle('motivationLevel', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOTIVATION_DESCRIPTIONS).map(([key, description]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium capitalize">{key}</div>
                          <div className="text-xs text-gray-600">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Detail Level</Label>
                <Select
                  value={preferences.communicationStyle.detailPreference}
                  onValueChange={(value) => updateCommunicationStyle('detailPreference', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DETAIL_DESCRIPTIONS).map(([key, description]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium capitalize">{key}</div>
                          <div className="text-xs text-gray-600">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Personality Type</Label>
                <Select
                  value={preferences.communicationStyle.personalityType}
                  onValueChange={(value) => updateCommunicationStyle('personalityType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERSONALITY_DESCRIPTIONS).map(([key, description]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium capitalize">{key}</div>
                          <div className="text-xs text-gray-600">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preferred Tone</Label>
                <Select
                  value={preferences.communicationStyle.preferredTone}
                  onValueChange={(value) => updateCommunicationStyle('preferredTone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TONE_DESCRIPTIONS).map(([key, description]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-medium capitalize">{key}</div>
                          <div className="text-xs text-gray-600">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Feedback Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <h3 className="font-medium">Feedback Preferences</h3>
            </div>

            <div className="space-y-2">
              <Label>Feedback Frequency</Label>
              <Select
                value={preferences.feedbackPatterns.preferredFeedbackFrequency}
                onValueChange={(value) => setPreferences(prev => ({
                  ...prev,
                  feedbackPatterns: {
                    ...prev.feedbackPatterns,
                    preferredFeedbackFrequency: value as any
                  }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_every_workout">After every workout</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Contextual Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <h3 className="font-medium">Contextual Sensitivity</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Weather Sensitivity
                  </Label>
                  <Badge variant="outline">
                    {preferences.behavioralPatterns.contextualPatterns.weatherSensitivity}/10
                  </Badge>
                </div>
                <Slider
                  value={[preferences.behavioralPatterns.contextualPatterns.weatherSensitivity]}
                  onValueChange={(value) => updateContextualPattern('weatherSensitivity', value[0])}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-gray-600">
                  How much should weather conditions affect workout recommendations?
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule Flexibility
                  </Label>
                  <Badge variant="outline">
                    {preferences.behavioralPatterns.contextualPatterns.scheduleFlexibility}/10
                  </Badge>
                </div>
                <Slider
                  value={[preferences.behavioralPatterns.contextualPatterns.scheduleFlexibility]}
                  onValueChange={(value) => updateContextualPattern('scheduleFlexibility', value[0])}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-gray-600">
                  How flexible is your schedule for workout adjustments?
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stress Response</Label>
                <Select
                  value={preferences.behavioralPatterns.contextualPatterns.stressResponse}
                  onValueChange={(value) => updateContextualPattern('stressResponse', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reduce_intensity">Reduce intensity when stressed</SelectItem>
                    <SelectItem value="maintain">Maintain regular routine</SelectItem>
                    <SelectItem value="increase_focus">Increase focus and structure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Workout Difficulty Preference
                  </Label>
                  <Badge variant="outline">
                    {preferences.behavioralPatterns.workoutPreferences.difficultyPreference}/10
                  </Badge>
                </div>
                <Slider
                  value={[preferences.behavioralPatterns.workoutPreferences.difficultyPreference]}
                  onValueChange={(value) => setPreferences(prev => ({
                    ...prev,
                    behavioralPatterns: {
                      ...prev.behavioralPatterns,
                      workoutPreferences: {
                        ...prev.behavioralPatterns.workoutPreferences,
                        difficultyPreference: value[0]
                      }
                    }
                  }))}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-gray-600">
                  Your preferred workout intensity level (1 = very easy, 10 = very challenging)
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>

          {hasChanges && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              You have unsaved changes. Save them to update your coaching experience.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}