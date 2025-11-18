'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, Send, Lightbulb } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { planAdaptationEngine } from '@/lib/planAdaptationEngine';

interface CoachingFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interactionId?: string;
  interactionType: 'workout_recommendation' | 'chat_response' | 'plan_adjustment' | 'motivation' | 'guidance';
  userId: number;
  initialContext?: {
    weather?: string;
    timeOfDay?: string;
    userMood?: string;
    recentPerformance?: string;
  };
}

interface FeedbackData {
  rating: number;
  aspects: {
    helpfulness: number;
    relevance: number;
    clarity: number;
    motivation: number;
    accuracy: number;
  };
  feedbackText: string;
  improvementSuggestions: string[];
  quickReaction?: 'helpful' | 'not_helpful' | 'too_detailed' | 'too_simple';
}

const QUICK_REACTIONS = [
  { id: 'helpful', label: 'Very Helpful', icon: ThumbsUp, color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'not_helpful', label: 'Not Helpful', icon: ThumbsDown, color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'too_detailed', label: 'Too Detailed', icon: MessageSquare, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'too_simple', label: 'Too Simple', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
];

const ASPECT_LABELS = {
  helpfulness: 'How helpful was this response?',
  relevance: 'How relevant was it to your situation?',
  clarity: 'How clear and understandable was it?',
  motivation: 'How motivating did you find it?',
  accuracy: 'How accurate was the information?',
};

export function CoachingFeedbackModal({
  isOpen,
  onClose,
  interactionId,
  interactionType,
  userId,
  initialContext = {}
}: CoachingFeedbackModalProps) {
  const [step, setStep] = useState<'quick' | 'detailed'>('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 4,
    aspects: {
      helpfulness: 4,
      relevance: 4,
      clarity: 4,
      motivation: 4,
      accuracy: 4,
    },
    feedbackText: '',
    improvementSuggestions: [],
  });

  const handleQuickFeedback = async (reaction: string) => {
    try {
      setIsSubmitting(true);
      
      const quickRating = reaction === 'helpful' ? 5 : reaction === 'not_helpful' ? 2 : 3;
      
      const response = await fetch('/api/coaching/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          interactionId,
          interactionType,
          feedbackType: 'quick_reaction',
          rating: quickRating,
          context: {
            ...initialContext,
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
          },
          coachingResponseId: interactionId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check if plan should be adapted based on feedback
        try {
          const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(userId);
          
          if (adaptationAssessment.shouldAdapt && adaptationAssessment.confidence > 70) {
            console.log('Feedback triggered plan adaptation:', adaptationAssessment.reason);
            
            // Get current active plan
            const { dbUtils } = await import('@/lib/db');
            const currentPlan = await dbUtils.getActivePlan(userId);
            if (currentPlan) {
              // Adapt the plan
              const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
                currentPlan.id!,
                `Feedback-based: ${adaptationAssessment.reason}`
              );
              
              console.log('Plan adapted successfully after feedback:', adaptedPlan.title);
              
              // Show user notification about plan adaptation
              toast({
                title: "Plan Updated! 📈",
                description: `Your training plan has been adjusted based on your feedback: ${adaptationAssessment.reason}`,
              });
            }
          }
        } catch (adaptationError) {
          console.error('Plan adaptation failed after feedback:', adaptationError);
          // Don't fail the feedback submission if adaptation fails
        }
        
        toast({
          variant: "success",
          title: "Thank you for your feedback! 🙏",
          description: result.impact?.effectivenessChange 
            ? `Your feedback will help improve coaching by ${Math.abs(result.impact.effectivenessChange).toFixed(1)} points.`
            : "Your feedback helps me provide better coaching.",
        });

        onClose();
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting quick feedback:', error);
      toast({
        variant: "destructive",
        title: "Error submitting feedback",
        description: "Please try again or use the detailed feedback option.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedSubmit = async () => {
    try {
      setIsSubmitting(true);

      const suggestionsList = feedback.improvementSuggestions.filter(s => s.trim().length > 0);
      
      const response = await fetch('/api/coaching/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          interactionId,
          interactionType,
          feedbackType: 'rating',
          rating: feedback.rating,
          aspects: feedback.aspects,
          feedbackText: feedback.feedbackText,
          context: {
            ...initialContext,
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
          },
          coachingResponseId: interactionId,
          improvementSuggestions: suggestionsList,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check if plan should be adapted based on detailed feedback
        try {
          const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(userId);
          
          if (adaptationAssessment.shouldAdapt && adaptationAssessment.confidence > 70) {
            console.log('Detailed feedback triggered plan adaptation:', adaptationAssessment.reason);
            
            // Get current active plan
            const { dbUtils } = await import('@/lib/db');
            const currentPlan = await dbUtils.getActivePlan(userId);
            if (currentPlan) {
              // Adapt the plan
              const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
                currentPlan.id!,
                `Detailed feedback: ${adaptationAssessment.reason}`
              );
              
              console.log('Plan adapted successfully after detailed feedback:', adaptedPlan.title);
              
              // Show user notification about plan adaptation
              toast({
                title: "Plan Updated! 📈",
                description: `Your training plan has been adjusted based on your detailed feedback: ${adaptationAssessment.reason}`,
              });
            }
          }
        } catch (adaptationError) {
          console.error('Plan adaptation failed after detailed feedback:', adaptationError);
          // Don't fail the feedback submission if adaptation fails
        }
        
        toast({
          variant: "success",
          title: "Detailed feedback received! 🎯",
          description: result.insights?.newPatternsDetected > 0 
            ? `New coaching patterns detected! Your input is helping me adapt better.`
            : "Your detailed feedback will help improve my coaching approach.",
        });

        onClose();
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting detailed feedback:', error);
      toast({
        variant: "destructive",
        title: "Error submitting feedback",
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSuggestion = () => {
    setFeedback(prev => ({
      ...prev,
      improvementSuggestions: [...prev.improvementSuggestions, '']
    }));
  };

  const updateSuggestion = (index: number, value: string) => {
    setFeedback(prev => ({
      ...prev,
      improvementSuggestions: prev.improvementSuggestions.map((s, i) => i === index ? value : s)
    }));
  };

  const removeSuggestion = (index: number) => {
    setFeedback(prev => ({
      ...prev,
      improvementSuggestions: prev.improvementSuggestions.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Coaching Feedback
          </DialogTitle>
          <DialogDescription>
            Help me improve my coaching by sharing your thoughts on this {interactionType.replace('_', ' ')}.
          </DialogDescription>
        </DialogHeader>

        {step === 'quick' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Quick feedback (tap one):
            </div>

            <div className="grid grid-cols-2 gap-3">
              {QUICK_REACTIONS.map((reaction) => {
                const Icon = reaction.icon;
                return (
                  <Button
                    key={reaction.id}
                    variant="outline"
                    className={`h-16 flex-col gap-2 ${reaction.color} hover:scale-105 transition-transform`}
                    onClick={() => handleQuickFeedback(reaction.id)}
                    disabled={isSubmitting}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{reaction.label}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('detailed')}
                className="text-blue-600 hover:text-blue-800"
              >
                Give detailed feedback instead →
              </Button>
            </div>
          </div>
        )}

        {step === 'detailed' && (
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Overall Rating</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 cursor-pointer transition-colors ${
                      star <= feedback.rating
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300 hover:text-yellow-400'
                    }`}
                    onClick={() => setFeedback(prev => ({ ...prev, rating: star }))}
                  />
                ))}
                <span className="ml-2 text-sm text-gray-600">
                  {feedback.rating}/5 stars
                </span>
              </div>
            </div>

            {/* Aspect Ratings */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Detailed Ratings</Label>
              {Object.entries(ASPECT_LABELS).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{label}</Label>
                    <Badge variant="outline" className="text-xs">
                      {feedback.aspects[key as keyof typeof feedback.aspects]}/5
                    </Badge>
                  </div>
                  <Slider
                    value={[feedback.aspects[key as keyof typeof feedback.aspects]]}
                    onValueChange={(value) =>
                      setFeedback(prev => ({
                        ...prev,
                        aspects: { ...prev.aspects, [key]: value[0] }
                      }))
                    }
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            {/* Text Feedback */}
            <div className="space-y-2">
              <Label htmlFor="feedback-text" className="text-sm font-medium">
                Additional Comments (Optional)
              </Label>
              <Textarea
                id="feedback-text"
                placeholder="What worked well? What could be improved? Any specific suggestions?"
                value={feedback.feedbackText}
                onChange={(e) => setFeedback(prev => ({ ...prev, feedbackText: e.target.value }))}
                className="min-h-20 text-sm"
              />
            </div>

            {/* Improvement Suggestions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Improvement Suggestions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSuggestion}
                  className="text-xs"
                >
                  + Add
                </Button>
              </div>
              
              {feedback.improvementSuggestions.map((suggestion, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    placeholder={`Suggestion ${index + 1}...`}
                    value={suggestion}
                    onChange={(e) => updateSuggestion(index, e.target.value)}
                    className="min-h-10 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSuggestion(index)}
                    className="text-red-500 hover:text-red-700 px-2"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('quick')}
                className="flex-1"
              >
                ← Quick
              </Button>
              <Button
                onClick={handleDetailedSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

