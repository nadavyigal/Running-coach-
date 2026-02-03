'use client';

import { useState, useEffect } from 'react';
import { ChallengeCard } from './challenge-card';
import { Button } from './ui/button';
import { Loader2, ArrowRight, Filter } from 'lucide-react';
import { type ChallengeTemplate } from '@/lib/db';
import { getActiveChallengeTemplates, getFeaturedChallengeTemplates } from '@/lib/challengeTemplates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ChallengePickerProps {
  onChallengeSelected: (template: ChallengeTemplate) => void;
  onSkip?: () => void;
  showSkipButton?: boolean;
  showFeaturedOnly?: boolean;
  className?: string;
}

export function ChallengePicker({
  onChallengeSelected,
  onSkip,
  showSkipButton = false,
  showFeaturedOnly = false,
  className = '',
}: ChallengePickerProps) {
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const loaded = showFeaturedOnly
          ? getFeaturedChallengeTemplates()
          : getActiveChallengeTemplates();

        setTemplates(loaded);
      } catch (error) {
        console.error('[ChallengePicker] Error loading templates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [showFeaturedOnly]);

  const handleSelect = (template: ChallengeTemplate) => {
    setSelectedTemplate(template);
  };

  const handleContinue = () => {
    if (selectedTemplate) {
      onChallengeSelected(selectedTemplate);
    }
  };

  // Apply filters
  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter !== 'all' && template.category !== categoryFilter) {
      return false;
    }
    if (difficultyFilter !== 'all' && template.difficulty !== difficultyFilter) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-gray-600">Loading challenges...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">Choose Your Challenge</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Each challenge is designed to build sustainable habits and unlock your potential.
          Pick the one that resonates with where you are right now.
        </p>
      </div>

      {/* Filters */}
      {!showFeaturedOnly && templates.length > 3 && (
        <div className="flex flex-wrap gap-3 items-center justify-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Filters:</span>
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="habit">Habit</SelectItem>
              <SelectItem value="mindful">Mindful</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="recovery">Recovery</SelectItem>
            </SelectContent>
          </Select>

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Challenge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <ChallengeCard
            key={template.slug}
            template={template}
            onSelect={handleSelect}
            isSelected={selectedTemplate?.slug === template.slug}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No challenges match your filters. Try adjusting them.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
        {showSkipButton && onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            className="text-gray-600"
          >
            Skip for now
          </Button>
        )}

        <Button
          onClick={handleContinue}
          disabled={!selectedTemplate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
          size="lg"
        >
          Continue with {selectedTemplate?.name.split('-')[0] || 'Challenge'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Helper text */}
      {selectedTemplate && (
        <div className="text-center text-sm text-gray-500 animate-in fade-in-50 duration-300">
          <p>
            <strong>{selectedTemplate.promise}</strong>
          </p>
          <p className="mt-1">
            This challenge starts on your chosen date and runs for {selectedTemplate.durationDays} days.
          </p>
        </div>
      )}
    </div>
  );
}
