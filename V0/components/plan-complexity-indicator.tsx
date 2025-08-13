'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, TrendingDown, Target, CheckCircle, AlertCircle } from 'lucide-react';
import { planComplexityEngine, type PlanComplexityEngine, type AdaptationFactor } from '@/lib/plan-complexity-engine';
import { type Plan } from '@/lib/db';

interface PlanComplexityIndicatorProps {
  plan: Plan;
  userId: number;
  className?: string;
}

export function PlanComplexityIndicator({ plan, userId, className = '' }: PlanComplexityIndicatorProps) {
  const [complexity, setComplexity] = useState<PlanComplexityEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const loadComplexity = async () => {
      try {
        setLoading(true);
        const complexityData = await planComplexityEngine.calculatePlanComplexity(userId, plan);
        setComplexity(complexityData);
        
        // Get suggestions
        const planSuggestions = await planComplexityEngine.suggestPlanAdjustments(userId, plan, complexityData);
        setSuggestions(planSuggestions);
      } catch (error) {
        console.error('Error loading plan complexity:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComplexity();
  }, [plan, userId]);

  if (loading) {
    return (
      <Card className={`animate-pulse ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Plan Complexity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  if (!complexity) {
    return null;
  }

  const complexityColor = planComplexityEngine.getComplexityColor(complexity.complexityScore);
  const complexityDescription = planComplexityEngine.getComplexityDescription(complexity.complexityScore);

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Plan Complexity</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400 cursor-help" data-testid="info-icon" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Complexity is calculated based on your experience level, performance trends, 
                  and workout completion rates. The plan adapts to keep you challenged but not overwhelmed.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Complexity Score */}
          <div className="space-y-2" data-testid="complexity-score">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Complexity Score</span>
              <Badge className={`text-xs ${complexityColor}`} data-testid="complexity-badge">
                {complexity.complexityScore}/100
              </Badge>
            </div>
            <Progress value={complexity.complexityScore} className="h-2" />
            <p className="text-xs text-gray-500">{complexityDescription}</p>
          </div>

          {/* Plan Level */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Plan Level</span>
            <Badge variant="outline" className="text-xs">
              {complexity.planLevel.charAt(0).toUpperCase() + complexity.planLevel.slice(1)}
            </Badge>
          </div>

          {/* Adaptation Factors */}
          <div className="space-y-2">
            <span className="text-xs text-gray-600">Adaptation Factors</span>
            <div className="space-y-1">
              {complexity.adaptationFactors.map((factor, index) => (
                <AdaptationFactorItem key={index} factor={factor} />
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-gray-600">Suggestions</span>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <AlertCircle className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

interface AdaptationFactorItemProps {
  factor: AdaptationFactor;
}

function AdaptationFactorItem({ factor }: AdaptationFactorItemProps) {
  const getFactorIcon = (factorType: string) => {
    switch (factorType) {
      case 'performance':
        return <TrendingUp className="h-3 w-3" />;
      case 'consistency':
        return <CheckCircle className="h-3 w-3" />;
      case 'goals':
        return <Target className="h-3 w-3" />;
      case 'feedback':
        return <Info className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  const getFactorColor = (currentValue: number, targetValue: number) => {
    const ratio = currentValue / targetValue;
    if (ratio >= 0.8) return 'text-green-600';
    if (ratio >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFactorLabel = (factorType: string) => {
    switch (factorType) {
      case 'performance':
        return 'Performance';
      case 'consistency':
        return 'Consistency';
      case 'goals':
        return 'Goals';
      case 'feedback':
        return 'Feedback';
      default:
        return factorType;
    }
  };

  const color = getFactorColor(factor.currentValue, factor.targetValue);
  const icon = getFactorIcon(factor.factor);
  const label = getFactorLabel(factor.factor);

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className="text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`font-medium ${color}`}>
          {factor.currentValue.toFixed(1)}
        </span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{factor.targetValue}</span>
      </div>
    </div>
  );
}