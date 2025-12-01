'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Lightbulb, 
  TrendingUp, 
  Target, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Sparkles,
  ArrowRight,
  Calendar,
  Zap,
  Award,
  Users,
  RefreshCw
} from 'lucide-react';
import { SimpleGoalForm } from './simple-goal-form';
import { toast } from '@/components/ui/use-toast';

interface GoalRecommendationsProps {
  userId: number;
  className?: string;
}

interface GoalRecommendation {
  id?: number;
  userId: number;
  recommendationType: 'new_goal' | 'adjustment' | 'milestone' | 'motivation' | 'priority_change';
  title: string;
  description: string;
  reasoning: string;
  confidenceScore: number;
  status: 'pending' | 'accepted' | 'dismissed' | 'expired';
  recommendationData: {
    goalId?: number;
    suggestedChanges?: Record<string, any>;
    newGoalTemplate?: Record<string, any>;
    actionRequired?: string;
    benefits?: string[];
    risks?: string[];
  };
  expiresAt?: Date;
  createdAt: Date;
}

const recommendationIcons = {
  new_goal: Target,
  adjustment: Settings,
  milestone: Award,
  motivation: Zap,
  priority_change: TrendingUp
};

const recommendationColors = {
  new_goal: 'text-blue-600 bg-blue-50 border-blue-200',
  adjustment: 'text-orange-600 bg-orange-50 border-orange-200',
  milestone: 'text-purple-600 bg-purple-50 border-purple-200',
  motivation: 'text-green-600 bg-green-50 border-green-200',
  priority_change: 'text-indigo-600 bg-indigo-50 border-indigo-200'
};

export function GoalRecommendations({ userId, className = '' }: GoalRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<{
    stored: GoalRecommendation[];
    dynamic: Partial<GoalRecommendation>[];
    summary: any;
  }>({ stored: [], dynamic: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] = useState<GoalRecommendation | Partial<GoalRecommendation> | null>(null);
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [wizardTemplate, setWizardTemplate] = useState<any>(null);

  useEffect(() => {
    loadRecommendations();
  }, [userId]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/goals/recommendations?userId=${userId}&includeExpired=false`);
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      } else {
        console.error('Failed to load recommendations');
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const respondToRecommendation = async (
    recommendation: GoalRecommendation | Partial<GoalRecommendation>,
    action: 'accepted' | 'dismissed',
    feedback?: string
  ) => {
    try {
      // For dynamic recommendations, we'll create and immediately accept them
      if (!recommendation.id) {
        if (action === 'accepted') {
          await handleDynamicRecommendationAcceptance(recommendation);
        }
        // Remove from dynamic list
        setRecommendations(prev => ({
          ...prev,
          dynamic: prev.dynamic.filter(r => r !== recommendation)
        }));
        return;
      }

      const response = await fetch('/api/goals/recommendations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          action,
          feedback
        })
      });

      if (response.ok) {
        // Update local state
        setRecommendations(prev => ({
          ...prev,
          stored: prev.stored.map(r => 
            r.id === recommendation.id 
              ? { ...r, status: action } 
              : r
          )
        }));

        toast({
          variant: "success",
          title: action === 'accepted' ? "Recommendation Accepted!" : "Recommendation Dismissed",
          description: action === 'accepted' 
            ? "We've applied the suggested changes."
            : "Thanks for the feedback.",
        });

        if (action === 'accepted' && recommendation.recommendationType === 'new_goal') {
          // Trigger goal wizard with template
          if (recommendation.recommendationData.newGoalTemplate) {
            setWizardTemplate(recommendation.recommendationData.newGoalTemplate);
            setShowGoalWizard(true);
          }
        }
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Failed to respond",
          description: error.message || "Please try again.",
        });
      }
    } catch (error) {
      console.error('Error responding to recommendation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process your response.",
      });
    }
  };

  const handleDynamicRecommendationAcceptance = async (recommendation: Partial<GoalRecommendation>) => {
    if (recommendation.recommendationType === 'new_goal' && recommendation.recommendationData?.newGoalTemplate) {
      setWizardTemplate(recommendation.recommendationData.newGoalTemplate);
      setShowGoalWizard(true);
    } else if (recommendation.recommendationType === 'adjustment' && recommendation.recommendationData?.goalId) {
      // Handle goal adjustment
      const changes = recommendation.recommendationData.suggestedChanges;
      try {
        const response = await fetch('/api/goals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalId: recommendation.recommendationData.goalId,
            ...changes
          })
        });

        if (response.ok) {
          toast({
            variant: "success",
            title: "Goal Updated!",
            description: "Your goal has been adjusted based on the recommendation.",
          });
        }
      } catch (error) {
        console.error('Error updating goal:', error);
      }
    }
  };

  const getRecommendationIcon = (type: string) => {
    const IconComponent = recommendationIcons[type as keyof typeof recommendationIcons] || Lightbulb;
    return <IconComponent className="h-5 w-5" />;
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 0.8) return { label: 'High', color: 'bg-green-100 text-green-800' };
    if (score >= 0.6) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Low', color: 'bg-gray-100 text-gray-600' };
  };

  const getTimeToExpiry = (expiresAt?: Date) => {
    if (!expiresAt) return null;
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatRecommendationType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const allRecommendations = [...(recommendations.stored || []), ...(recommendations.dynamic || [])]
    .filter(r => r.status !== 'dismissed' && r.status !== 'accepted')
    .sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 animate-pulse text-yellow-500" />
            <div className="text-sm text-gray-600">Loading recommendations...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Smart Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered suggestions to optimize your running goals
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadRecommendations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          {recommendations.summary && Object.keys(recommendations.summary).length > 0 && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {recommendations.summary.total || 0}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {recommendations.summary.highPriority || 0}
                </div>
                <div className="text-sm text-gray-600">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {recommendations.summary.newGoals || 0}
                </div>
                <div className="text-sm text-gray-600">New Goals</div>
              </div>
            </div>
          )}

          {/* Recommendations List */}
          <div className="space-y-4">
            {allRecommendations.map((recommendation, index) => {
              const confidence = getConfidenceLevel(recommendation.confidenceScore || 0);
              const daysToExpiry = getTimeToExpiry(recommendation.expiresAt);
              
              return (
                <Card 
                  key={recommendation.id || index} 
                  className={`border-l-4 hover:shadow-md transition-shadow cursor-pointer ${
                    recommendationColors[recommendation.recommendationType as keyof typeof recommendationColors]
                  }`}
                  onClick={() => setSelectedRecommendation(recommendation)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getRecommendationIcon(recommendation.recommendationType!)}
                        <div>
                          <h4 className="font-semibold">{recommendation.title}</h4>
                          <p className="text-sm text-gray-600">{recommendation.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={confidence.color}>
                          {confidence.label}
                        </Badge>
                        <Badge variant="outline">
                          {formatRecommendationType(recommendation.recommendationType!)}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">{recommendation.reasoning}</p>
                      
                      {recommendation.recommendationData?.benefits && (
                        <div className="flex flex-wrap gap-1">
                          {recommendation.recommendationData.benefits.slice(0, 2).map((benefit, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                          {recommendation.recommendationData.benefits.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{recommendation.recommendationData.benefits.length - 2} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {daysToExpiry && daysToExpiry <= 7 && (
                        <Alert className="py-2">
                          <Clock className="h-4 w-4" />
                          <AlertDescription>
                            Expires in {daysToExpiry} day{daysToExpiry !== 1 ? 's' : ''}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          respondToRecommendation(recommendation, 'accepted');
                        }}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          respondToRecommendation(recommendation, 'dismissed');
                        }}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {allRecommendations.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Recommendations</h3>
              <p className="text-gray-600 mb-4">
                You're all caught up! Check back later for new suggestions.
              </p>
              <Button variant="outline" onClick={loadRecommendations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Updates
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendation Detail Modal */}
      <Dialog 
        open={!!selectedRecommendation} 
        onOpenChange={() => setSelectedRecommendation(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRecommendation && getRecommendationIcon(selectedRecommendation.recommendationType!)}
              {selectedRecommendation?.title}
            </DialogTitle>
            <DialogDescription>
              {formatRecommendationType(selectedRecommendation?.recommendationType || '')} Recommendation
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecommendation && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-gray-700">{selectedRecommendation.description}</p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Reasoning</h4>
                <p className="text-sm text-gray-700">{selectedRecommendation.reasoning}</p>
              </div>

              {selectedRecommendation.recommendationData?.benefits && (
                <div>
                  <h4 className="font-medium mb-2">Benefits</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedRecommendation.recommendationData.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedRecommendation.recommendationData?.risks && (
                <div>
                  <h4 className="font-medium mb-2">Considerations</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {selectedRecommendation.recommendationData.risks.map((risk, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Confidence Level</span>
                <Badge className={getConfidenceLevel(selectedRecommendation.confidenceScore || 0).color}>
                  {getConfidenceLevel(selectedRecommendation.confidenceScore || 0).label} ({Math.round((selectedRecommendation.confidenceScore || 0) * 100)}%)
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRecommendation) {
                  respondToRecommendation(selectedRecommendation, 'dismissed');
                  setSelectedRecommendation(null);
                }
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            <Button
              onClick={() => {
                if (selectedRecommendation) {
                  respondToRecommendation(selectedRecommendation, 'accepted');
                  setSelectedRecommendation(null);
                }
              }}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Accept & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goal Creation Form */}
      <SimpleGoalForm
        isOpen={showGoalWizard}
        onClose={() => {
          setShowGoalWizard(false);
          setWizardTemplate(null);
        }}
        userId={userId}
        onGoalCreated={() => {
          loadRecommendations(); // Refresh recommendations
          toast({
            variant: "success",
            title: "Goal Created! 🎯",
            description: "Your new goal has been created based on our recommendation.",
          });
        }}
      />
    </div>
  );
}