'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Sparkles, Target } from 'lucide-react';
import { type ChallengeTemplate } from '@/lib/db';

export interface ChallengeCardProps {
  template: ChallengeTemplate;
  onSelect: (template: ChallengeTemplate) => void;
  isSelected?: boolean;
  className?: string;
}

const categoryIcons = {
  habit: Target,
  mindful: Sparkles,
  performance: TrendingUp,
  recovery: Calendar,
};

const categoryColors = {
  habit: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  mindful: 'bg-purple-100 text-purple-800 border-purple-300',
  performance: 'bg-orange-100 text-orange-800 border-orange-300',
  recovery: 'bg-blue-100 text-blue-800 border-blue-300',
};

const difficultyLabels = {
  beginner: { label: 'Beginner', color: 'bg-green-100 text-green-800' },
  intermediate: { label: 'Intermediate', color: 'bg-yellow-100 text-yellow-800' },
  advanced: { label: 'Advanced', color: 'bg-red-100 text-red-800' },
};

export function ChallengeCard({ template, onSelect, isSelected, className = '' }: ChallengeCardProps) {
  const CategoryIcon = categoryIcons[template.category];
  const categoryColor = categoryColors[template.category];
  const difficultyInfo = difficultyLabels[template.difficulty];

  return (
    <Card
      className={`
        relative overflow-hidden transition-all duration-300 cursor-pointer
        hover:shadow-xl hover:-translate-y-1
        ${isSelected ? 'ring-2 ring-emerald-500 shadow-lg scale-[1.02]' : 'hover:scale-[1.02]'}
        ${className}
      `}
      onClick={() => onSelect(template)}
    >
      {/* Featured badge */}
      {template.isFeatured && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="default" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <Sparkles className="h-3 w-3 mr-1" />
            Featured
          </Badge>
        </div>
      )}

      {/* Thumbnail or gradient background */}
      <div className="relative h-32 bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <CategoryIcon className="h-16 w-16 text-emerald-500 opacity-30" />
        )}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="outline" className={categoryColor}>
            <CategoryIcon className="h-3 w-3 mr-1" />
            {template.category}
          </Badge>
          <Badge variant="secondary" className={difficultyInfo.color}>
            {difficultyInfo.label}
          </Badge>
        </div>

        <CardTitle className="text-xl font-bold text-gray-900 mb-1">
          {template.name}
        </CardTitle>

        <CardDescription className="text-sm font-medium text-emerald-600">
          {template.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700 line-clamp-3">
          {template.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{template.durationDays} days</span>
          </div>
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{template.targetAudience.split(' ').slice(0, 2).join(' ')}</span>
          </div>
        </div>

        <Button
          className={`w-full transition-all ${
            isSelected
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-gray-900 hover:bg-gray-800'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(template);
          }}
        >
          {isSelected ? '✓ Selected' : 'Select Challenge'}
        </Button>
      </CardContent>
    </Card>
  );
}
