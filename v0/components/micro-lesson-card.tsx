'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, BookOpen } from 'lucide-react';
import { getMicroLesson } from '@/lib/challengePrompts';

export interface MicroLessonCardProps {
  challengeSlug: string;
  currentDay: number;
  className?: string;
}

export function MicroLessonCard({ challengeSlug, currentDay, className = '' }: MicroLessonCardProps) {
  const lesson = getMicroLesson(challengeSlug, currentDay);

  return (
    <Card className={`border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="h-6 w-6 text-amber-600" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              <h3 className="font-bold text-gray-900">
                Why This Matters (Day {currentDay})
              </h3>
            </div>
            <p className="text-gray-800 leading-relaxed">
              {lesson}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
