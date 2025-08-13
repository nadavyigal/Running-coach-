'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Clock, 
  TrendingUp, 
  Target, 
  Zap,
  Settings,
  Activity,
  Star,
  Award,
  Heart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dbUtils, type User } from '@/lib/db';
import { engagementOptimizationService } from '@/lib/engagement-optimization';

interface NotificationPreferences {
  frequency: 'low' | 'medium' | 'high';
  timing: 'morning' | 'afternoon' | 'evening';
  types: NotificationType[];
  quietHours: { start: string; end: string };
}

interface NotificationType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'motivational' | 'reminder' | 'achievement' | 'milestone';
}

interface EngagementOptimizationProps {
  user?: User;
  onPreferencesChange?: (preferences: NotificationPreferences) => void;
}

const defaultNotificationTypes: NotificationType[] = [
  {
    id: 'motivational',
    name: 'Motivational Messages',
    description: 'Daily motivation and encouragement',
    enabled: true,
    category: 'motivational',
  },
  {
    id: 'reminder',
    name: 'Run Reminders',
    description: 'Scheduled workout reminders',
    enabled: true,
    category: 'reminder',
  },
  {
    id: 'achievement',
    name: 'Achievement Celebrations',
    description: 'Celebrate your milestones',
    enabled: true,
    category: 'achievement',
  },
  {
    id: 'milestone',
    name: 'Milestone Notifications',
    description: 'Progress towards goals',
    enabled: true,
    category: 'milestone',
  },
];

export function EngagementOptimization({ user: propUser, onPreferencesChange }: EngagementOptimizationProps) {
  const [user, setUser] = useState<User | null>(propUser || null);
  const [engagementScore, setEngagementScore] = useState(0);
  const [optimalTiming, setOptimalTiming] = useState('08:00');
  const [motivationalTriggers, setMotivationalTriggers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    frequency: 'medium',
    timing: 'morning',
    types: defaultNotificationTypes,
    quietHours: { start: '22:00', end: '07:00' },
  });
  const { toast } = useToast();

  const loadUserPreferences = async () => {
    try {
      if (!user) {
        const currentUser = await dbUtils.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        } else {
          console.error('No user found');
          return;
        }
      }

      if (!user) return;

      // Load user's notification preferences
      if (user.notificationPreferences) {
        setPreferences(user.notificationPreferences);
      }

      // Calculate engagement score
      await calculateEngagementScore();
      
      // Get optimal timing
      await loadOptimalTiming();
      
      // Generate motivational triggers
      await loadMotivationalTriggers();
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
  };

  const calculateEngagementScore = async () => {
    try {
      if (!user) return;

      // Calculate engagement score based on user activity patterns
      const runs = await dbUtils.getRuns(user.id!);
      const recentRuns = runs.filter(run => {
        const runDate = new Date(run.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return runDate > thirtyDaysAgo;
      });

      // Simple engagement calculation based on recent activity
      const activityScore = Math.min(100, (recentRuns.length / 15) * 100);
      const consistencyScore = user.currentStreak ? Math.min(100, (user.currentStreak / 7) * 100) : 0;
      const overallScore = Math.round((activityScore + consistencyScore) / 2);
      
      setEngagementScore(overallScore);
      
      // Calculate optimal timing based on user patterns
      if (recentRuns.length > 0) {
        const runTimes = recentRuns.map(run => new Date(run.date).getHours());
        const avgHour = runTimes.reduce((sum, hour) => sum + hour, 0) / runTimes.length;
        const optimalHour = Math.round(avgHour);
        setOptimalTiming(`${optimalHour.toString().padStart(2, '0')}:30`);
      }
    } catch (error) {
      console.error('Failed to calculate engagement score:', error);
    }
  };

  const loadOptimalTiming = async () => {
    try {
      if (!user) return;
      
      const timing = await engagementOptimizationService.determineOptimalTiming(user.id!);
      setOptimalTiming(timing.bestTime);
    } catch (error) {
      console.error('Failed to load optimal timing:', error);
    }
  };

  const loadMotivationalTriggers = async () => {
    try {
      if (!user) return;
      
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(user.id!);
      setMotivationalTriggers(triggers);
    } catch (error) {
      console.error('Failed to load motivational triggers:', error);
    }
  };

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    if (onPreferencesChange) {
      onPreferencesChange(newPreferences);
    }
  };

  const handleNotificationTypeToggle = (typeId: string, enabled: boolean) => {
    const updatedTypes = preferences.types.map(type =>
      type.id === typeId ? { ...type, enabled } : type
    );
    handlePreferenceChange('types', updatedTypes);
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Save preferences to database
      await dbUtils.updateUser(user.id!, {
        notificationPreferences: preferences
      });
      
      toast({
        title: 'Preferences Saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEngagementLevel = (score: number) => {
    if (score >= 80) return { level: 'High', color: 'bg-green-500', icon: Star };
    if (score >= 60) return { level: 'Medium', color: 'bg-yellow-500', icon: TrendingUp };
    return { level: 'Low', color: 'bg-red-500', icon: Activity };
  };

  const engagementInfo = getEngagementLevel(engagementScore);

  useEffect(() => {
    loadUserPreferences();
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Activity className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading user preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Engagement Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Engagement Optimization</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <engagementInfo.icon className="h-4 w-4" />
              <span className="text-sm font-medium">Engagement Score</span>
            </div>
            <Badge className={engagementInfo.color}>
              {engagementScore}%
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Label>Optimal Timing</Label>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{optimalTiming}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Smart Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Notification Frequency</Label>
            <Select value={preferences.frequency} onValueChange={(value: 'low' | 'medium' | 'high') => handlePreferenceChange('frequency', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Weekly)</SelectItem>
                <SelectItem value="medium">Medium (Every 3 days)</SelectItem>
                <SelectItem value="high">High (Daily)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timing">Preferred Timing</Label>
            <Select value={preferences.timing} onValueChange={(value: 'morning' | 'afternoon' | 'evening') => handlePreferenceChange('timing', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (6 AM - 10 AM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                <SelectItem value="evening">Evening (6 PM - 10 PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quiet Hours</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <input
                  id="start-time"
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) => handlePreferenceChange('quietHours', { ...preferences.quietHours, start: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <input
                  id="end-time"
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) => handlePreferenceChange('quietHours', { ...preferences.quietHours, end: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notification Types</Label>
            <div className="space-y-2">
              {preferences.types.map((type) => (
                <div key={type.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                  <Switch
                    checked={type.enabled}
                    onCheckedChange={(enabled) => handleNotificationTypeToggle(type.id, enabled)}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievement Celebrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5" />
            <span>Achievement Celebrations</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Motivational Triggers</Label>
            <div className="space-y-2">
              {motivationalTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{trigger.message}</p>
                    <p className="text-sm text-gray-500">{trigger.type}</p>
                  </div>
                  <Switch checked={trigger.enabled} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adaptive Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Adaptive Frequency</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Engagement Patterns</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm">Morning Runner</span>
              </div>
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm">Consistent Schedule</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Engagement Insights</Label>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• You're most active in the mornings</p>
              <p>• Your consistency is improving</p>
              <p>• Consider increasing frequency during peak times</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSavePreferences} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}