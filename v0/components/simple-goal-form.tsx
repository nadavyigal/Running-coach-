'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import {
  Target, Clock, TrendingUp, CheckCircle2, Info,
  Calendar as CalendarIcon, Sparkles, Loader2
} from 'lucide-react';

interface SimpleGoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  onGoalCreated?: (goal: any) => void;
}

// Goal templates (reuse from current wizard)
const GOAL_TEMPLATES = {
  '5k_pr': {
    title: '5K Personal Record',
    description: 'Improve your 5K running time',
    goalType: 'time_improvement' as const,
    category: 'speed' as const,
    targetMetric: '5k_time',
    unit: 'minutes',
    icon: '🏃‍♂️'
  },
  '10k_pr': {
    title: '10K Personal Record',
    description: 'Achieve a new 10K personal best',
    goalType: 'time_improvement' as const,
    category: 'speed' as const,
    targetMetric: '10k_time',
    unit: 'minutes',
    icon: '🎯'
  },
  'first_marathon': {
    title: 'Complete First Marathon',
    description: 'Train for and complete your first 42.2K marathon',
    goalType: 'distance_achievement' as const,
    category: 'endurance' as const,
    targetMetric: 'marathon_completion',
    unit: 'km',
    icon: '🏅'
  },
  'consistency': {
    title: 'Build Running Consistency',
    description: 'Develop a consistent running habit',
    goalType: 'consistency' as const,
    category: 'consistency' as const,
    targetMetric: 'runs_per_week',
    unit: 'runs',
    icon: '📈'
  }
};

export function SimpleGoalForm({ isOpen, onClose, userId, onGoalCreated }: SimpleGoalFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  // Form state - minimal fields
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [deadline, setDeadline] = useState<Date>();
  const [motivation, setMotivation] = useState('');

  // Auto-calculated fields
  const [feasibility, setFeasibility] = useState<string>('');
  const [smartScore, setSmartScore] = useState(0);

  // Template selection handler
  const handleTemplateSelect = (templateKey: string) => {
    const template = GOAL_TEMPLATES[templateKey as keyof typeof GOAL_TEMPLATES];
    setSelectedTemplate(templateKey);
    setTitle(template.title);
    setTargetUnit(template.unit);
  };

  // Real-time feasibility calculation
  const updateFeasibility = () => {
    if (!currentLevel || !targetValue || !deadline) return;

    const current = parseFloat(currentLevel);
    const target = parseFloat(targetValue);
    const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const weeksUntil = daysUntil / 7;

    if (current <= 0 || target <= 0 || weeksUntil <= 0) return;

    const improvement = Math.abs(target - current);
    const improvementPercent = (improvement / current) * 100;
    const improvementPerWeek = improvementPercent / weeksUntil;

    if (improvementPerWeek < 1) {
      setFeasibility('Very achievable ✓');
      setSmartScore(5);
    } else if (improvementPerWeek < 2) {
      setFeasibility('Challenging but realistic');
      setSmartScore(4);
    } else if (improvementPerWeek < 4) {
      setFeasibility('Ambitious - will require dedication');
      setSmartScore(3);
    } else {
      setFeasibility('Very ambitious - consider extending timeline');
      setSmartScore(2);
    }
  };

  // Update feasibility when inputs change
  useEffect(() => {
    updateFeasibility();
  }, [currentLevel, targetValue, deadline]);

  // Form submission with auto-plan generation
  const handleSubmit = async () => {
    // Validate minimal required fields
    if (!title || !targetValue || !deadline) {
      toast({
        title: 'Missing required fields',
        description: 'Please provide a title, target value, and deadline',
        variant: 'destructive'
      });
      return;
    }

    // Validate targetValue is a positive number
    const parsedTargetValue = parseFloat(targetValue);
    if (isNaN(parsedTargetValue) || parsedTargetValue <= 0) {
      toast({
        title: 'Invalid target value',
        description: 'Target value must be a number greater than 0',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Import dbUtils for client-side database operations
      const { dbUtils } = await import('@/lib/dbUtils');

      // Build minimal goal data
      const template = selectedTemplate ? GOAL_TEMPLATES[selectedTemplate as keyof typeof GOAL_TEMPLATES] : null;
      const goalData = {
        userId,
        title,
        goalType: template?.goalType || 'time_improvement',
        category: template?.category || 'speed',
        targetValue: parsedTargetValue,
        specificTarget: {
          metric: template?.targetMetric || 'custom',
          value: parsedTargetValue,
          unit: targetUnit || 'units',
          description: title
        },
        timeBound: {
          deadline,
          startDate: new Date()
        },
        baselineValue: currentLevel ? parseFloat(currentLevel) : undefined,
        relevantContext: motivation || undefined
      };

      console.log('Creating goal client-side with data:', goalData);

      // Auto-complete missing fields
      const completedGoal = await dbUtils.autoCompleteGoalFields(goalData, userId);
      console.log('Goal fields auto-completed');

      // Validate SMART criteria
      const validation = dbUtils.validateSMARTGoal(completedGoal);
      console.log(`SMART score: ${validation.smartScore}/100`);

      if (!validation.isValid) {
        toast({
          title: 'Goal validation failed',
          description: validation.errors.join(', '),
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      // Create the goal in client-side database
      const goalId = await dbUtils.createGoal(completedGoal);
      console.log(`Goal created with ID: ${goalId}`);

      // Generate initial milestones
      try {
        await dbUtils.generateGoalMilestones(goalId);
        console.log('Milestones generated');
      } catch (milestoneError) {
        console.warn('Milestone generation failed:', milestoneError);
      }

      toast({
        title: '✓ Goal created!',
        description: `SMART score: ${validation.smartScore}/100. ${validation.autoGenerated.length} fields auto-generated.`
      });

      // Auto-generate training plan
      setGeneratingPlan(true);

      try {
        const planResponse = await fetch('/api/generate-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            goalId,
            goalContext: {
              type: completedGoal.goalType,
              target: parsedTargetValue,
              deadline: deadline,
              metric: completedGoal.specificTarget.metric
            }
          })
        });

        if (planResponse.ok) {
          toast({
            title: '✓ Training plan generated!',
            description: 'Your personalized plan is ready'
          });
        } else {
          console.warn('Plan generation failed (non-critical)');
          toast({
            title: 'Goal created',
            description: 'Plan generation failed, you can create one manually',
            variant: 'default'
          });
        }
      } catch (planError) {
        console.warn('Plan generation error:', planError);
        // Non-critical - goal was still created
      }

      setGeneratingPlan(false);

      // Get the created goal to pass to callback
      const createdGoal = await dbUtils.getGoal(goalId);
      onGoalCreated?.(createdGoal);

      // Close the dialog
      onClose();

    } catch (error) {
      console.error('Goal creation error:', error);
      toast({
        title: 'Failed to create goal',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
      setGeneratingPlan(false);
    }
  };

  // SMART criteria badges
  const hasSpecific = title.length >= 3;
  const hasMeasurable = targetValue && targetUnit;
  const hasAchievable = feasibility !== '';
  const hasRelevant = motivation.length >= 10 || true; // Optional
  const hasTimeBound = deadline !== undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Create Running Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          <div>
            <Label>Choose a template (optional)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {Object.entries(GOAL_TEMPLATES).map(([key, template]) => (
                <Card
                  key={key}
                  className={`cursor-pointer hover:border-primary transition ${selectedTemplate === key ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => handleTemplateSelect(key)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{template.icon}</div>
                    <div className="font-medium text-sm">{template.title}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* SMART Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Goal Details
              </CardTitle>
              <CardDescription>
                Fill in the basics - we'll auto-generate the rest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title (Specific) */}
              <div>
                <Label className="flex items-center gap-2">
                  Goal Title
                  {hasSpecific && <Badge variant="secondary" className="text-xs">✓ Specific</Badge>}
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Run 5K in under 25 minutes"
                  className="mt-1"
                />
              </div>

              {/* Target Value (Measurable) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-2">
                    Target Value
                    {hasMeasurable && <Badge variant="secondary" className="text-xs">✓ Measurable</Badge>}
                  </Label>
                  <Input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="25"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="minutes"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Current Level (for Achievable calculation) */}
              <div>
                <Label className="flex items-center gap-2">
                  Current Level <span className="text-xs text-muted-foreground">(optional)</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input
                  type="number"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  placeholder="30"
                  className="mt-1"
                />
                {feasibility && (
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">{feasibility}</span>
                    {hasAchievable && <Badge variant="secondary" className="text-xs">✓ Achievable</Badge>}
                  </div>
                )}
              </div>

              {/* Deadline (Time-bound) */}
              <div>
                <Label className="flex items-center gap-2">
                  Target Date
                  {hasTimeBound && <Badge variant="secondary" className="text-xs">✓ Time-bound</Badge>}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {deadline ? format(deadline, 'PPP') : 'Select deadline'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={(date) => setDeadline(date)}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Motivation (Relevant) */}
              <div>
                <Label className="flex items-center gap-2">
                  Why this goal matters <span className="text-xs text-muted-foreground">(optional)</span>
                  {hasRelevant && <Badge variant="secondary" className="text-xs">✓ Relevant</Badge>}
                </Label>
                <Textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="e.g., I want to improve my fitness and prove to myself I can achieve this"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* SMART Score Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="font-medium">SMART Goal Score</span>
                </div>
                <div className="flex gap-1">
                  {[hasSpecific, hasMeasurable, hasAchievable, hasRelevant, hasTimeBound].map((met, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${met ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    >
                      {met ? '✓' : '○'}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Missing fields will be auto-generated intelligently
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || generatingPlan || !title || !targetValue || !deadline}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Goal...
                </>
              ) : generatingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Create Goal & Plan
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
