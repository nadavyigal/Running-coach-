'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  User as UserIcon,
  Trophy,
  Activity,
  History,
  Save,
  RotateCcw,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import { dbUtils } from '@/lib/dbUtils';
import { type User } from '@/lib/db';
import {
  validateUserData,
  calculateMaxHR,
  estimateVO2MaxFromVDOT,
  formatPace,
  parsePace,
  METRIC_DESCRIPTIONS,
} from '@/lib/userDataValidation';
import { calculateVDOT } from '@/lib/pace-zones';

interface UserDataSettingsProps {
  userId: number;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function UserDataSettings({ userId, open, onClose, onSave }: UserDataSettingsProps) {
  const [userData, setUserData] = useState<Partial<User>>({});
  const [originalData, setOriginalData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('profile');
  const [ltPaceInput, setLtPaceInput] = useState('');

  useEffect(() => {
    if (open && userId) {
      fetchUserData();
    }
  }, [open, userId]);

  useEffect(() => {
    if (originalData && Object.keys(originalData).length > 0) {
      const changed = JSON.stringify(userData) !== JSON.stringify(originalData);
      setHasChanges(changed);
    }
  }, [userData, originalData]);

  useEffect(() => {
    setLtPaceInput(userData.lactateThreshold ? formatPace(userData.lactateThreshold) : '');
  }, [userData.lactateThreshold]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const user = await dbUtils.getUser(userId);
      if (user) {
        setUserData(user);
        setOriginalData(user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load user data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const validation = validateUserData(userData);
    if (!validation.valid) {
      setErrors(validation.errors);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
      });
      return;
    }

    setSaving(true);
    try {
      const updates = { ...userData };

      if (updates.referenceRaceDistance && updates.referenceRaceTime) {
        updates.calculatedVDOT = calculateVDOT(
          updates.referenceRaceDistance,
          updates.referenceRaceTime
        );
      }

      await dbUtils.updateUser(userId, updates);

      setOriginalData(updates);
      setHasChanges(false);
      setErrors({});

      toast({
        title: 'Saved',
        description: 'Your training data has been updated',
      });

      if (onSave) {
        onSave();
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving user data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save user data',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setUserData(originalData);
    setErrors({});
    setHasChanges(false);
  };

  const updateField = (field: keyof User, value: any) => {
    setUserData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCalculateMaxHR = () => {
    if (userData.age) {
      const calculated = calculateMaxHR(userData.age);
      updateField('maxHeartRate', calculated);
      updateField('maxHeartRateSource', 'calculated');
      toast({
        title: 'Calculated',
        description: `Max HR: ${calculated} bpm (based on age ${userData.age})`,
      });
    }
  };

  const handleEstimateVO2Max = () => {
    if (userData.calculatedVDOT) {
      const estimated = estimateVO2MaxFromVDOT(userData.calculatedVDOT);
      updateField('vo2Max', estimated);
      toast({
        title: 'Estimated',
        description: `VO2 Max: ${estimated} ml/kg/min (from VDOT ${userData.calculatedVDOT.toFixed(1)})`,
      });
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const raceTime = userData.referenceRaceTime ?? 0;
  const raceHours = Math.floor(raceTime / 3600);
  const raceMinutes = Math.floor((raceTime % 3600) / 60);
  const raceSeconds = raceTime % 60;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Training Data</DialogTitle>
          <p className="text-sm text-gray-600">
            Add your physiological metrics and training history to get personalized plans
          </p>
        </DialogHeader>

        {hasChanges && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You have unsaved changes</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="race" className="gap-2">
              <Trophy className="h-4 w-4" />
              Race
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Activity className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                min={10}
                max={100}
                value={userData.age ?? ''}
                onChange={(e) => updateField('age', parseInt(e.target.value, 10) || undefined)}
                placeholder="Enter your age"
                className={errors.age ? 'border-red-500' : ''}
              />
              {errors.age && (
                <p className="text-sm text-red-600">{errors.age}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Running Experience *</Label>
              <Select
                value={userData.experience}
                onValueChange={(value) => updateField('experience', value as User['experience'])}
              >
                <SelectTrigger id="experience">
                  <SelectValue placeholder="Select your experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weeklyKm">Average Weekly Distance (km)</Label>
              <Input
                id="weeklyKm"
                type="number"
                min={0}
                max={300}
                value={userData.averageWeeklyKm ?? ''}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  const parsed = nextValue === '' ? undefined : parseFloat(nextValue);
                  updateField(
                    'averageWeeklyKm',
                    typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
                  );
                }}
                placeholder="e.g., 30"
              />
              <p className="text-xs text-gray-500">
                Your typical weekly running volume before starting this plan
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daysPerWeek">Training Days Per Week *</Label>
              <Select
                value={userData.daysPerWeek ? userData.daysPerWeek.toString() : undefined}
                onValueChange={(value) => updateField('daysPerWeek', parseInt(value, 10))}
              >
                <SelectTrigger id="daysPerWeek">
                  <SelectValue placeholder="Select training days" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} days per week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="race" className="space-y-6 mt-6">
            <p className="text-sm text-gray-600">
              Enter a recent race result to help us calculate your training paces
            </p>

            <div className="space-y-2">
              <Label htmlFor="raceDistance">Race Distance</Label>
              <Select
                value={userData.referenceRaceDistance ? userData.referenceRaceDistance.toString() : undefined}
                onValueChange={(value) => updateField('referenceRaceDistance', parseFloat(value))}
              >
                <SelectTrigger id="raceDistance">
                  <SelectValue placeholder="Select race distance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5K</SelectItem>
                  <SelectItem value="10">10K</SelectItem>
                  <SelectItem value="21.1">Half Marathon</SelectItem>
                  <SelectItem value="42.2">Marathon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="raceTime">Race Time</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="raceHours" className="text-xs text-gray-500">
                    Hours
                  </Label>
                  <Input
                    id="raceHours"
                    type="number"
                    min={0}
                    max={10}
                    value={raceHours}
                    placeholder="0"
                    onChange={(e) => {
                      const hours = parseInt(e.target.value, 10) || 0;
                      updateField('referenceRaceTime', hours * 3600 + raceMinutes * 60 + raceSeconds);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="raceMinutes" className="text-xs text-gray-500">
                    Minutes
                  </Label>
                  <Input
                    id="raceMinutes"
                    type="number"
                    min={0}
                    max={59}
                    value={raceMinutes}
                    placeholder="00"
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value, 10) || 0;
                      updateField('referenceRaceTime', raceHours * 3600 + minutes * 60 + raceSeconds);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="raceSeconds" className="text-xs text-gray-500">
                    Seconds
                  </Label>
                  <Input
                    id="raceSeconds"
                    type="number"
                    min={0}
                    max={59}
                    value={raceSeconds}
                    placeholder="00"
                    onChange={(e) => {
                      const seconds = parseInt(e.target.value, 10) || 0;
                      updateField('referenceRaceTime', raceHours * 3600 + raceMinutes * 60 + seconds);
                    }}
                  />
                </div>
              </div>
            </div>

            {userData.referenceRaceDistance && userData.referenceRaceTime && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Calculated VDOT</p>
                      <p className="text-xs text-blue-700">
                        Based on your race performance
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {calculateVDOT(userData.referenceRaceDistance, userData.referenceRaceTime).toFixed(1)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6 mt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vo2Max">VO2 Max (ml/kg/min)</Label>
                {userData.calculatedVDOT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEstimateVO2Max}
                    className="h-7 text-xs gap-1"
                  >
                    <Calculator className="h-3 w-3" />
                    Estimate from VDOT
                  </Button>
                )}
              </div>
              <Input
                id="vo2Max"
                type="number"
                min={20}
                max={85}
                value={userData.vo2Max ?? ''}
                onChange={(e) => updateField('vo2Max', parseFloat(e.target.value) || undefined)}
                placeholder="e.g., 55"
                className={errors.vo2Max ? 'border-red-500' : ''}
              />
              {errors.vo2Max && (
                <p className="text-sm text-red-600">{errors.vo2Max}</p>
              )}
              <p className="text-xs text-gray-500">
                {METRIC_DESCRIPTIONS.vo2Max.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ltPace">Lactate Threshold Pace (min/km)</Label>
              <Input
                id="ltPace"
                type="text"
                placeholder="e.g., 4:30"
                value={ltPaceInput}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setLtPaceInput(nextValue);
                  const parsed = parsePace(nextValue);
                  if (parsed !== null) {
                    updateField('lactateThreshold', parsed);
                  } else if (!nextValue) {
                    updateField('lactateThreshold', undefined);
                  }
                }}
                className={errors.lactateThreshold ? 'border-red-500' : ''}
              />
              {errors.lactateThreshold && (
                <p className="text-sm text-red-600">{errors.lactateThreshold}</p>
              )}
              <p className="text-xs text-gray-500">
                {METRIC_DESCRIPTIONS.lactateThreshold.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ltHR">LT Heart Rate (bpm)</Label>
              <Input
                id="ltHR"
                type="number"
                min={100}
                max={220}
                value={userData.lactateThresholdHR ?? ''}
                onChange={(e) => updateField('lactateThresholdHR', parseInt(e.target.value, 10) || undefined)}
                placeholder="e.g., 165"
                className={errors.lactateThresholdHR ? 'border-red-500' : ''}
              />
              {errors.lactateThresholdHR && (
                <p className="text-sm text-red-600">{errors.lactateThresholdHR}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="hrv">HRV Baseline (ms)</Label>
              <Input
                id="hrv"
                type="number"
                min={10}
                max={200}
                value={userData.hrvBaseline ?? ''}
                onChange={(e) => updateField('hrvBaseline', parseInt(e.target.value, 10) || undefined)}
                placeholder="e.g., 65"
                className={errors.hrvBaseline ? 'border-red-500' : ''}
              />
              {errors.hrvBaseline && (
                <p className="text-sm text-red-600">{errors.hrvBaseline}</p>
              )}
              <p className="text-xs text-gray-500">
                {METRIC_DESCRIPTIONS.hrvBaseline.description}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxHR">Max Heart Rate (bpm)</Label>
                {userData.age && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCalculateMaxHR}
                    className="h-7 text-xs gap-1"
                  >
                    <Calculator className="h-3 w-3" />
                    Calculate from age
                  </Button>
                )}
              </div>
              <Input
                id="maxHR"
                type="number"
                min={120}
                max={220}
                value={userData.maxHeartRate ?? ''}
                onChange={(e) => {
                  updateField('maxHeartRate', parseInt(e.target.value, 10) || undefined);
                  updateField('maxHeartRateSource', 'user_provided');
                }}
                placeholder="e.g., 185"
                className={errors.maxHeartRate ? 'border-red-500' : ''}
              />
              {errors.maxHeartRate && (
                <p className="text-sm text-red-600">{errors.maxHeartRate}</p>
              )}
              <p className="text-xs text-gray-500">
                {METRIC_DESCRIPTIONS.maxHeartRate.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restingHR">Resting Heart Rate (bpm)</Label>
              <Input
                id="restingHR"
                type="number"
                min={30}
                max={100}
                value={userData.restingHeartRate ?? ''}
                onChange={(e) => updateField('restingHeartRate', parseInt(e.target.value, 10) || undefined)}
                placeholder="e.g., 50"
                className={errors.restingHeartRate ? 'border-red-500' : ''}
              />
              {errors.restingHeartRate && (
                <p className="text-sm text-red-600">{errors.restingHeartRate}</p>
              )}
              <p className="text-xs text-gray-500">
                {METRIC_DESCRIPTIONS.restingHeartRate.description}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-6">
            <p className="text-sm text-gray-600">
              Add significant past runs to help us understand your training history
            </p>

            {userData.historicalRuns && userData.historicalRuns.length > 0 && (
              <div className="space-y-2">
                {userData.historicalRuns.map((run, index) => (
                  <Card key={`${run.distance}-${run.time}-${index}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {run.distance}km in {formatTime(run.time)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(run.date)} {run.type ? `- ${run.type}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const filtered = userData.historicalRuns?.filter((_, i) => i !== index);
                          updateField('historicalRuns', filtered);
                        }}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                toast({
                  title: 'Coming soon',
                  description: 'Historical run entry will be available soon',
                });
              }}
            >
              Add Historical Run
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
