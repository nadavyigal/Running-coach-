'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flame, Trophy } from 'lucide-react';
import { type DailyChallengeData } from '@/lib/challengeEngine';

export interface ChallengeProgressRingProps {
  data: DailyChallengeData;
  challengeName: string;
  className?: string;
  showDetails?: boolean;
}

export function ChallengeProgressRing({
  data,
  challengeName,
  className = '',
  showDetails = true,
}: ChallengeProgressRingProps) {
  const { currentDay, totalDays, dayTheme, progress, isLastDay, daysRemaining, streakDays } = data;

  return (
    <Card className={`border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg ${className}`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{challengeName}</h3>
            <Badge variant="secondary" className="mt-1">
              Active Challenge
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-600">
              {currentDay}/{totalDays}
            </div>
            <div className="text-xs text-gray-600">days</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 mb-4">
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between text-xs text-gray-600">
            <span>{progress}% complete</span>
            {daysRemaining > 0 && <span>{daysRemaining} days remaining</span>}
            {isLastDay && <span className="text-emerald-600 font-bold">Final day!</span>}
          </div>
        </div>

        {/* Day Theme */}
        {showDetails && (
          <>
            <div className="bg-white rounded-lg p-4 mb-4 border border-emerald-100">
              <h4 className="text-sm font-semibold text-emerald-700 mb-1">Today's Focus</h4>
              <p className="text-sm text-gray-700">{dayTheme}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <Calendar className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-lg font-bold text-gray-900">{currentDay}</div>
                <div className="text-xs text-gray-600">Current</div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-orange-100">
                <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-gray-900">{streakDays}</div>
                <div className="text-xs text-gray-600">Streak</div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <Trophy className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-bold text-gray-900">{daysRemaining}</div>
                <div className="text-xs text-gray-600">To Go</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
