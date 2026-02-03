'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, ArrowRight, Sparkles, Calendar, Flame } from 'lucide-react';
import { type ChallengeTemplate, type ChallengeProgress } from '@/lib/db';
import { getNextChallengeRecommendation } from '@/lib/challengeTemplates';

export interface ChallengeCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedTemplate: ChallengeTemplate;
  progress: ChallengeProgress;
  onStartNextChallenge?: (template: ChallengeTemplate) => void;
}

export function ChallengeCompletionModal({
  isOpen,
  onClose,
  completedTemplate,
  progress,
  onStartNextChallenge,
}: ChallengeCompletionModalProps) {
  const [showingNext, setShowingNext] = useState(false);
  const nextChallenge = getNextChallengeRecommendation(completedTemplate.slug);

  const handleViewNextChallenge = () => {
    setShowingNext(true);
  };

  const handleStartNextChallenge = () => {
    if (nextChallenge && onStartNextChallenge) {
      onStartNextChallenge(nextChallenge);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {!showingNext ? (
          // Celebration View
          <>
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl">
                  <Trophy className="h-12 w-12 text-white" />
                </div>
              </div>
              <DialogTitle className="text-3xl font-bold text-center">
                Challenge Complete! 🎉
              </DialogTitle>
              <DialogDescription className="text-center text-lg">
                You completed the {completedTemplate.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-2 border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">
                      {completedTemplate.durationDays}
                    </div>
                    <div className="text-xs text-gray-600">Days</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200">
                  <CardContent className="p-4 text-center">
                    <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{progress.streakDays}</div>
                    <div className="text-xs text-gray-600">Streak</div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-amber-200">
                  <CardContent className="p-4 text-center">
                    <Trophy className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-gray-900">{progress.totalDaysCompleted}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Achievement Message */}
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">You Did It!</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {completedTemplate.promise} Over the past {completedTemplate.durationDays} days,
                    you proved to yourself that consistency wins. This isn't just about running
                    anymore—it's about who you're becoming.
                  </p>
                </CardContent>
              </Card>

              {/* Identity Shift */}
              <div className="text-center space-y-2 py-4">
                <p className="text-lg text-gray-600">You're not someone who</p>
                <p className="text-2xl font-bold text-emerald-600">tries to run</p>
                <p className="text-lg text-gray-600">You're a</p>
                <p className="text-3xl font-bold text-gray-900">Runner</p>
              </div>

              {/* Next Challenge Teaser */}
              {nextChallenge && (
                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Sparkles className="h-8 w-8 text-purple-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 mb-2">
                          Ready for the Next Level?
                        </h3>
                        <p className="text-gray-700 mb-3">
                          We recommend: <strong>{nextChallenge.name}</strong>
                        </p>
                        <p className="text-sm text-gray-600">{nextChallenge.tagline}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {nextChallenge && (
                  <Button
                    onClick={handleViewNextChallenge}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                    size="lg"
                  >
                    View Next Challenge
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}

                <Button onClick={onClose} variant="outline" size="lg">
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Next Challenge View
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Your Next Challenge</DialogTitle>
              <DialogDescription>
                Based on your progress, we recommend this challenge next
              </DialogDescription>
            </DialogHeader>

            {nextChallenge && (
              <div className="space-y-6 py-6">
                {/* Challenge Info */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {nextChallenge.name}
                    </h3>
                    <p className="text-emerald-600 font-semibold mb-4">{nextChallenge.tagline}</p>
                    <p className="text-gray-700 mb-4">{nextChallenge.description}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{nextChallenge.durationDays} days</span>
                      </div>
                      <div className="text-gray-400">•</div>
                      <div>{nextChallenge.difficulty}</div>
                      <div className="text-gray-400">•</div>
                      <div className="capitalize">{nextChallenge.category}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Promise */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-6 border border-emerald-200">
                  <h4 className="font-bold text-gray-900 mb-2">What You'll Achieve</h4>
                  <p className="text-gray-700">{nextChallenge.promise}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleStartNextChallenge}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                    size="lg"
                  >
                    Start This Challenge
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <Button onClick={() => setShowingNext(false)} variant="outline">
                    Back
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
