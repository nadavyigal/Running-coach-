'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles, Calendar, Target } from 'lucide-react';
import { type ChallengeTemplate } from '@/lib/db';

export interface NextChallengeRecommendationProps {
  template: ChallengeTemplate;
  onStartChallenge: (template: ChallengeTemplate) => void;
  className?: string;
}

export function NextChallengeRecommendation({
  template,
  onStartChallenge,
  className = '',
}: NextChallengeRecommendationProps) {
  return (
    <Card className={`border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-white" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Recommended Next
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
            <p className="text-sm text-emerald-600 font-semibold mt-1">{template.tagline}</p>
          </div>
        </div>

        <p className="text-gray-700 mb-4">{template.description}</p>

        <div className="bg-white rounded-lg p-4 mb-4 border border-purple-100">
          <h4 className="text-sm font-semibold text-purple-700 mb-2">What You'll Achieve</h4>
          <p className="text-sm text-gray-700">{template.promise}</p>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{template.durationDays} days</span>
          </div>
          <div className="text-gray-400">•</div>
          <div className="capitalize">{template.difficulty}</div>
          <div className="text-gray-400">•</div>
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span className="capitalize">{template.category}</span>
          </div>
        </div>

        <Button
          onClick={() => onStartChallenge(template)}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          size="lg"
        >
          Start This Challenge
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </CardContent>
    </Card>
  );
}
