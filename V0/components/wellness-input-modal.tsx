'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Activity, Heart, Brain, Smile, Zap } from 'lucide-react';

interface WellnessInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WellnessData) => void;
  loading?: boolean;
}

interface WellnessData {
  userId: number;
  date: string;
  energyLevel: number;
  moodScore: number;
  sorenessLevel: number;
  stressLevel: number;
  motivationLevel: number;
  notes?: string;
}

export default function WellnessInputModal({ 
  open, 
  onOpenChange, 
  onSubmit, 
  loading = false 
}: WellnessInputModalProps) {
  const [wellnessData, setWellnessData] = useState<WellnessData>({
    userId: 1,
    date: new Date().toISOString().split('T')[0],
    energyLevel: 5,
    moodScore: 5,
    sorenessLevel: 5,
    stressLevel: 5,
    motivationLevel: 5,
    notes: ''
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      await onSubmit(wellnessData);
      onOpenChange(false);
    } catch (err) {
      setError('Failed to save wellness data');
    }
  };

  const getWellnessLabel = (level: number) => {
    if (level >= 8) return 'Excellent';
    if (level >= 6) return 'Good';
    if (level >= 4) return 'Fair';
    return 'Poor';
  };

  const getWellnessColor = (level: number) => {
    if (level >= 8) return 'text-green-600';
    if (level >= 6) return 'text-blue-600';
    if (level >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>How are you feeling today?</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Energy Level */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <Label className="text-sm font-medium">Energy Level</Label>
            </div>
            <div className="space-y-2">
              <Slider
                value={[wellnessData.energyLevel]}
                onValueChange={(value) => setWellnessData(prev => ({ ...prev, energyLevel: value[0] }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Low</span>
                <span className={`font-medium ${getWellnessColor(wellnessData.energyLevel)}`}>
                  {wellnessData.energyLevel}/10 - {getWellnessLabel(wellnessData.energyLevel)}
                </span>
                <span className="text-xs text-gray-500">High</span>
              </div>
            </div>
          </div>

          {/* Mood Score */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Smile className="w-4 h-4" />
              <Label className="text-sm font-medium">Mood</Label>
            </div>
            <div className="space-y-2">
              <Slider
                value={[wellnessData.moodScore]}
                onValueChange={(value) => setWellnessData(prev => ({ ...prev, moodScore: value[0] }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Poor</span>
                <span className={`font-medium ${getWellnessColor(wellnessData.moodScore)}`}>
                  {wellnessData.moodScore}/10 - {getWellnessLabel(wellnessData.moodScore)}
                </span>
                <span className="text-xs text-gray-500">Great</span>
              </div>
            </div>
          </div>

          {/* Soreness Level */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <Label className="text-sm font-medium">Soreness Level</Label>
            </div>
            <div className="space-y-2">
              <Slider
                value={[wellnessData.sorenessLevel]}
                onValueChange={(value) => setWellnessData(prev => ({ ...prev, sorenessLevel: value[0] }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">None</span>
                <span className={`font-medium ${getWellnessColor(11 - wellnessData.sorenessLevel)}`}>
                  {wellnessData.sorenessLevel}/10 - {getWellnessLabel(11 - wellnessData.sorenessLevel)}
                </span>
                <span className="text-xs text-gray-500">Severe</span>
              </div>
            </div>
          </div>

          {/* Stress Level */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Heart className="w-4 h-4" />
              <Label className="text-sm font-medium">Stress Level</Label>
            </div>
            <div className="space-y-2">
              <Slider
                value={[wellnessData.stressLevel]}
                onValueChange={(value) => setWellnessData(prev => ({ ...prev, stressLevel: value[0] }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Low</span>
                <span className={`font-medium ${getWellnessColor(11 - wellnessData.stressLevel)}`}>
                  {wellnessData.stressLevel}/10 - {getWellnessLabel(11 - wellnessData.stressLevel)}
                </span>
                <span className="text-xs text-gray-500">High</span>
              </div>
            </div>
          </div>

          {/* Motivation Level */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <Label className="text-sm font-medium">Motivation</Label>
            </div>
            <div className="space-y-2">
              <Slider
                value={[wellnessData.motivationLevel]}
                onValueChange={(value) => setWellnessData(prev => ({ ...prev, motivationLevel: value[0] }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Low</span>
                <span className={`font-medium ${getWellnessColor(wellnessData.motivationLevel)}`}>
                  {wellnessData.motivationLevel}/10 - {getWellnessLabel(wellnessData.motivationLevel)}
                </span>
                <span className="text-xs text-gray-500">High</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional Notes (Optional)</Label>
            <Textarea
              placeholder="Any additional thoughts about how you're feeling..."
              value={wellnessData.notes}
              onChange={(e) => setWellnessData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Saving...' : 'Save Wellness Data'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 