'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Zap, MessageCircle } from 'lucide-react';
import { type ChallengeTemplate } from '@/lib/db';
import { getRandomPrompt } from '@/lib/challengePrompts';

export interface DailyChallengePromptProps {
  template: ChallengeTemplate;
  timing: 'before' | 'after';
  className?: string;
}

export function DailyChallengePrompt({ template, timing, className = '' }: DailyChallengePromptProps) {
  const prompt = getRandomPrompt(timing, template.coachTone);

  const bgColors = {
    gentle: 'from-green-50 to-emerald-50',
    tough_love: 'from-orange-50 to-red-50',
    analytical: 'from-blue-50 to-indigo-50',
    calm: 'from-purple-50 to-pink-50',
  };

  const iconColors = {
    gentle: 'text-green-600',
    tough_love: 'text-orange-600',
    analytical: 'text-blue-600',
    calm: 'text-purple-600',
  };

  const bgColor = bgColors[template.coachTone] || bgColors.gentle;
  const iconColor = iconColors[template.coachTone] || iconColors.gentle;

  return (
    <Card className={`border-none shadow-md bg-gradient-to-br ${bgColor} ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${iconColor}`}>
            {timing === 'before' ? (
              <Zap className="h-6 w-6" />
            ) : (
              <MessageCircle className="h-6 w-6" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">
              {timing === 'before' ? 'Before Your Run' : 'After Your Run'}
            </h3>
            <p className="text-gray-800 leading-relaxed">
              {prompt}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
