'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Target, 
  Clock, 
  TrendingUp, 
  MapPin, 
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface GoalCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  onGoalCreated?: (goal: any) => void;
}

interface GoalFormData {
  title: string;
  description: string;
  goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health';
  category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength';
  priority: 1 | 2 | 3;
  specificTarget: {
    metric: string;
    value: number;
    unit: string;
    description: string;
  };
  measurableMetrics: string[];
  achievableAssessment: {
    currentLevel: number;
    targetLevel: number;
    feasibilityScore: number;
    recommendedAdjustments: string[];
  };
  relevantContext: string;
  timeBound: {
    deadline: Date;
    startDate: Date;
    totalDuration: number;
    milestoneSchedule: number[];
  };
  baselineValue: number;
  targetValue: number;
}

const GOAL_TEMPLATES = {
  '5k_pr': {
    title: '5K Personal Record',
    description: 'Improve your 5K running time',
    goalType: 'time_improvement' as const,
    category: 'speed' as const,
    specificTarget: {
      metric: '5k_time',
      unit: 'seconds',
      description: 'Run 5K in under target time'
    },
    measurableMetrics: ['5k_time', 'pace_improvement', 'weekly_speed_workouts']
  },
  '10k_pr': {
    title: '10K Personal Record',
    description: 'Achieve a new 10K personal best',
    goalType: 'time_improvement' as const,
    category: 'speed' as const,
    specificTarget: {
      metric: '10k_time',
      unit: 'seconds',
      description: 'Run 10K in under target time'
    },
    measurableMetrics: ['10k_time', 'pace_improvement', 'weekly_distance']
  },
  'first_marathon': {
    title: 'Complete First Marathon',
    description: 'Train for and complete your first 42.2K marathon',
    goalType: 'distance_achievement' as const,
    category: 'endurance' as const,
    specificTarget: {
      metric: 'marathon_completion',
      unit: 'kilometers',
      description: 'Complete 42.2K marathon distance'
    },
    measurableMetrics: ['longest_run', 'weekly_distance', 'marathon_pace_runs']
  },
  'consistency': {
    title: 'Running Consistency',
    description: 'Build a consistent running habit',
    goalType: 'frequency' as const,
    category: 'consistency' as const,
    specificTarget: {
      metric: 'weekly_runs',
      unit: 'runs',
      description: 'Run consistently every week'
    },
    measurableMetrics: ['weekly_runs', 'monthly_consistency', 'streak_days']
  }
};

const WIZARD_STEPS = [
  { id: 'template', title: 'Choose Template', description: 'Select a goal template or start from scratch' },
  { id: 'specific', title: 'Be Specific', description: 'Define your specific target and metrics' },
  { id: 'measurable', title: 'Make it Measurable', description: 'Set measurable criteria for success' },
  { id: 'achievable', title: 'Ensure it\'s Achievable', description: 'Validate feasibility based on your current level' },
  { id: 'relevant', title: 'Keep it Relevant', description: 'Explain why this goal matters to you' },
  { id: 'timebound', title: 'Set a Timeline', description: 'Define deadline and milestones' },
  { id: 'review', title: 'Review & Create', description: 'Review your SMART goal and create it' }
];

export function GoalCreationWizard({ isOpen, onClose, userId, onGoalCreated }: GoalCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuggestions, setValidationSuggestions] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [formData, setFormData] = useState<GoalFormData>({
    title: '',
    description: '',
    goalType: 'time_improvement',
    category: 'speed',
    priority: 1,
    specificTarget: {
      metric: '',
      value: 0,
      unit: '',
      description: ''
    },
    measurableMetrics: [],
    achievableAssessment: {
      currentLevel: 0,
      targetLevel: 0,
      feasibilityScore: 50,
      recommendedAdjustments: []
    },
    relevantContext: '',
    timeBound: {
      deadline: new Date(Date.now() + 84 * 24 * 60 * 60 * 1000), // 12 weeks from now
      startDate: new Date(),
      totalDuration: 84,
      milestoneSchedule: [25, 50, 75]
    },
    baselineValue: 0,
    targetValue: 0
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = GOAL_TEMPLATES[templateId as keyof typeof GOAL_TEMPLATES];
    if (template) {
      setSelectedTemplate(templateId);
      setFormData(prev => ({
        ...prev,
        title: template.title,
        description: template.description,
        goalType: template.goalType,
        category: template.category,
        specificTarget: {
          ...prev.specificTarget,
          ...template.specificTarget
        },
        measurableMetrics: template.measurableMetrics
      }));
    }
  };

  const validateCurrentStep = (): boolean => {
    const errors: string[] = [];
    const suggestions: string[] = [];

    switch (WIZARD_STEPS[currentStep].id) {
      case 'specific':
        if (!formData.title || formData.title.length < 5) {
          errors.push('Goal title must be at least 5 characters long');
        }
        if (!formData.specificTarget.value || formData.specificTarget.value <= 0) {
          errors.push('Target value must be specified and greater than 0');
        }
        if (!formData.specificTarget.metric) {
          errors.push('Target metric must be specified');
        }
        break;

      case 'measurable':
        if (formData.measurableMetrics.length === 0) {
          errors.push('At least one measurable metric must be selected');
        }
        break;

      case 'achievable':
        if (formData.achievableAssessment.currentLevel <= 0) {
          errors.push('Current fitness level must be specified');
        }
        if (formData.achievableAssessment.feasibilityScore < 30) {
          errors.push('Goal appears to be unrealistic based on current level');
          suggestions.push('Consider extending the timeline or reducing the target');
        } else if (formData.achievableAssessment.feasibilityScore > 90) {
          suggestions.push('This goal might be too easy - consider making it more challenging');
        }
        break;

      case 'relevant':
        if (!formData.relevantContext || formData.relevantContext.length < 10) {
          errors.push('Please explain why this goal is relevant to you (at least 10 characters)');
        }
        break;

      case 'timebound':
        const daysUntilDeadline = Math.ceil((formData.timeBound.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDeadline < 7) {
          errors.push('Goal deadline should be at least one week in the future');
        } else if (daysUntilDeadline > 365) {
          suggestions.push('Consider breaking this long-term goal into smaller intermediate goals');
        }
        break;
    }

    setValidationErrors(errors);
    setValidationSuggestions(suggestions);
    return errors.length === 0;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setValidationErrors([]);
    setValidationSuggestions([]);
  };

  const calculateFeasibilityScore = () => {
    const { currentLevel, targetLevel } = formData.achievableAssessment;
    const { deadline } = formData.timeBound;
    
    if (currentLevel <= 0 || targetLevel <= 0) return 50;

    const improvementNeeded = Math.abs(targetLevel - currentLevel);
    const timeAvailable = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    // Simple feasibility calculation based on improvement rate and time
    let feasibilityScore = 50;
    
    if (formData.goalType === 'time_improvement') {
      // For time goals, smaller improvements are more feasible
      const improvementPercent = (improvementNeeded / currentLevel) * 100;
      const weeksAvailable = timeAvailable / 7;
      
      if (improvementPercent / weeksAvailable < 1) {
        feasibilityScore = 85; // Very achievable
      } else if (improvementPercent / weeksAvailable < 2) {
        feasibilityScore = 70; // Challenging but achievable
      } else if (improvementPercent / weeksAvailable < 4) {
        feasibilityScore = 50; // Difficult
      } else {
        feasibilityScore = 25; // Very difficult
      }
    } else {
      // For distance/frequency goals, linear progression
      const progressionRate = improvementNeeded / (timeAvailable / 7);
      if (progressionRate < currentLevel * 0.1) {
        feasibilityScore = 85;
      } else if (progressionRate < currentLevel * 0.2) {
        feasibilityScore = 70;
      } else if (progressionRate < currentLevel * 0.4) {
        feasibilityScore = 50;
      } else {
        feasibilityScore = 25;
      }
    }

    setFormData(prev => ({
      ...prev,
      achievableAssessment: {
        ...prev.achievableAssessment,
        feasibilityScore: Math.round(feasibilityScore)
      }
    }));
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
          timeBound: {
            ...formData.timeBound,
            deadline: formData.timeBound.deadline.toISOString(),
            startDate: formData.timeBound.startDate.toISOString()
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          variant: "success",
          title: "Goal Created Successfully! 🎯",
          description: `Your goal "${formData.title}" has been created with milestones.`,
        });

        if (onGoalCreated) {
          onGoalCreated(result.goal);
        }
        
        onClose();
        
        // Reset form for next use
        setCurrentStep(0);
        setSelectedTemplate(null);
        setFormData({
          title: '',
          description: '',
          goalType: 'time_improvement',
          category: 'speed',
          priority: 1,
          specificTarget: { metric: '', value: 0, unit: '', description: '' },
          measurableMetrics: [],
          achievableAssessment: {
            currentLevel: 0,
            targetLevel: 0,
            feasibilityScore: 50,
            recommendedAdjustments: []
          },
          relevantContext: '',
          timeBound: {
            deadline: new Date(Date.now() + 84 * 24 * 60 * 60 * 1000),
            startDate: new Date(),
            totalDuration: 84,
            milestoneSchedule: [25, 50, 75]
          },
          baselineValue: 0,
          targetValue: 0
        });
      } else {
        const error = await response.json();
        toast({
          variant: "destructive",
          title: "Failed to Create Goal",
          description: error.error || "Please try again later.",
        });
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create goal. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'template':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Choose Your Goal Type</h3>
              <p className="text-gray-600 text-sm">
                Select a template to get started quickly, or create a custom goal from scratch.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {Object.entries(GOAL_TEMPLATES).map(([id, template]) => (
                <Card 
                  key={id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleTemplateSelect(id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {template.category === 'speed' && <TrendingUp className="h-5 w-5 text-orange-500" />}
                        {template.category === 'endurance' && <MapPin className="h-5 w-5 text-blue-500" />}
                        {template.category === 'consistency' && <Clock className="h-5 w-5 text-green-500" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{template.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {template.goalType.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTemplate === 'custom' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => {
                  setSelectedTemplate('custom');
                  setFormData(prev => ({ ...prev, title: '', description: '' }));
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-purple-500 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-medium">Custom Goal</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Create a completely custom goal tailored to your specific needs.
                      </p>
                      <Badge variant="outline" className="text-xs mt-2">
                        Advanced
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'specific':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Target className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Be Specific</h3>
              <p className="text-gray-600 text-sm">
                Define exactly what you want to achieve with clear, specific details.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Goal Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Run 5K in under 25 minutes"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Briefly describe what you want to achieve"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Goal Type</Label>
                  <Select 
                    value={formData.goalType} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, goalType: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time_improvement">Time Improvement</SelectItem>
                      <SelectItem value="distance_achievement">Distance Achievement</SelectItem>
                      <SelectItem value="frequency">Frequency/Consistency</SelectItem>
                      <SelectItem value="race_completion">Race Completion</SelectItem>
                      <SelectItem value="health">Health & Fitness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speed">Speed</SelectItem>
                      <SelectItem value="endurance">Endurance</SelectItem>
                      <SelectItem value="consistency">Consistency</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="strength">Strength</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Target Value *</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Input
                    type="number"
                    value={formData.specificTarget.value || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      specificTarget: { ...prev.specificTarget, value: parseFloat(e.target.value) || 0 }
                    }))}
                    placeholder="Value"
                  />
                  <Input
                    value={formData.specificTarget.unit}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      specificTarget: { ...prev.specificTarget, unit: e.target.value }
                    }))}
                    placeholder="Unit (e.g., minutes)"
                  />
                  <Input
                    value={formData.specificTarget.metric}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      specificTarget: { ...prev.specificTarget, metric: e.target.value }
                    }))}
                    placeholder="Metric (e.g., 5k_time)"
                  />
                </div>
              </div>

              <div>
                <Label>Priority Level</Label>
                <Select 
                  value={formData.priority.toString()} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) as 1 | 2 | 3 }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">High Priority (Primary Focus)</SelectItem>
                    <SelectItem value="2">Medium Priority (Secondary)</SelectItem>
                    <SelectItem value="3">Low Priority (Maintenance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'measurable':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Make it Measurable</h3>
              <p className="text-gray-600 text-sm">
                Choose metrics that will help you track progress toward your goal.
              </p>
            </div>

            <div>
              <Label>Measurable Metrics *</Label>
              <p className="text-sm text-gray-600 mb-3">
                Select all metrics that will help track your progress:
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  '5k_time', '10k_time', 'half_marathon_time', 'marathon_time',
                  'weekly_distance', 'monthly_distance', 'longest_run',
                  'weekly_runs', 'monthly_consistency', 'streak_days',
                  'pace_improvement', 'heart_rate', 'race_completions'
                ].map((metric) => (
                  <label key={metric} className="flex items-center space-x-2 p-2 rounded border cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.measurableMetrics.includes(metric)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            measurableMetrics: [...prev.measurableMetrics, metric]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            measurableMetrics: prev.measurableMetrics.filter(m => m !== metric)
                          }));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{metric.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'achievable':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ensure it's Achievable</h3>
              <p className="text-gray-600 text-sm">
                Let's assess if this goal is realistic based on your current fitness level.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Current Level (Baseline) *</Label>
                <Input
                  type="number"
                  value={formData.achievableAssessment.currentLevel || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setFormData(prev => ({
                      ...prev,
                      baselineValue: value,
                      achievableAssessment: { ...prev.achievableAssessment, currentLevel: value }
                    }));
                    calculateFeasibilityScore();
                  }}
                  placeholder={`Current ${formData.specificTarget.unit || 'value'}`}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your current best {formData.specificTarget.metric?.replace('_', ' ') || 'performance'}
                </p>
              </div>

              <div>
                <Label>Target Level *</Label>
                <Input
                  type="number"
                  value={formData.achievableAssessment.targetLevel || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setFormData(prev => ({
                      ...prev,
                      targetValue: value,
                      specificTarget: { ...prev.specificTarget, value },
                      achievableAssessment: { ...prev.achievableAssessment, targetLevel: value }
                    }));
                    calculateFeasibilityScore();
                  }}
                  placeholder={`Target ${formData.specificTarget.unit || 'value'}`}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Feasibility Assessment</Label>
                  <Badge 
                    variant={
                      formData.achievableAssessment.feasibilityScore >= 70 ? "default" :
                      formData.achievableAssessment.feasibilityScore >= 50 ? "secondary" : "destructive"
                    }
                  >
                    {formData.achievableAssessment.feasibilityScore}% Feasible
                  </Badge>
                </div>
                <Progress value={formData.achievableAssessment.feasibilityScore} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.achievableAssessment.feasibilityScore >= 70 
                    ? "This goal appears achievable with consistent effort"
                    : formData.achievableAssessment.feasibilityScore >= 50
                    ? "This goal is challenging but possible"
                    : "This goal may be too ambitious - consider adjusting timeline or target"
                  }
                </p>
              </div>
            </div>
          </div>
        );

      case 'relevant':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Lightbulb className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keep it Relevant</h3>
              <p className="text-gray-600 text-sm">
                Explain why this goal matters to you and how it fits your running journey.
              </p>
            </div>

            <div>
              <Label htmlFor="relevantContext">Why is this goal important to you? *</Label>
              <Textarea
                id="relevantContext"
                value={formData.relevantContext}
                onChange={(e) => setFormData(prev => ({ ...prev, relevantContext: e.target.value }))}
                placeholder="e.g., I want to improve my speed to compete in local races and challenge myself..."
                className="mt-1 min-h-24"
              />
              <p className="text-xs text-gray-500 mt-1">
                Describing your motivation helps maintain focus and commitment
              </p>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Tips for Relevant Goals</h4>
                    <ul className="text-sm text-blue-800 mt-1 space-y-1">
                      <li>• Connect to your personal values and interests</li>
                      <li>• Consider how it fits with your lifestyle</li>
                      <li>• Think about the benefits beyond just running</li>
                      <li>• Make sure it aligns with your long-term aspirations</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'timebound':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Clock className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Set a Timeline</h3>
              <p className="text-gray-600 text-sm">
                Define when you want to achieve this goal and set milestone checkpoints.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Goal Deadline *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !formData.timeBound.deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.timeBound.deadline ? format(formData.timeBound.deadline, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.timeBound.deadline}
                      onSelect={(date) => {
                        if (date) {
                          const totalDays = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          setFormData(prev => ({
                            ...prev,
                            timeBound: { 
                              ...prev.timeBound, 
                              deadline: date,
                              totalDuration: totalDays
                            }
                          }));
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.timeBound.totalDuration > 0 && 
                    `${formData.timeBound.totalDuration} days (${Math.round(formData.timeBound.totalDuration / 7)} weeks)`
                  }
                </p>
              </div>

              <div>
                <Label>Milestone Schedule</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Choose when you'd like to check your progress:
                </p>
                <div className="space-y-2">
                  {[25, 50, 75].map((percentage) => (
                    <label key={percentage} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.timeBound.milestoneSchedule.includes(percentage)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              timeBound: {
                                ...prev.timeBound,
                                milestoneSchedule: [...prev.timeBound.milestoneSchedule, percentage].sort((a, b) => a - b)
                              }
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              timeBound: {
                                ...prev.timeBound,
                                milestoneSchedule: prev.timeBound.milestoneSchedule.filter(p => p !== percentage)
                              }
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {percentage}% milestone 
                        {formData.timeBound.totalDuration > 0 && 
                          ` (${format(new Date(Date.now() + (formData.timeBound.totalDuration * percentage / 100) * 24 * 60 * 60 * 1000), "MMM d")})`
                        }
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Review & Create</h3>
              <p className="text-gray-600 text-sm">
                Review your SMART goal before creating it.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {formData.title}
                </CardTitle>
                <CardDescription>{formData.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Type:</strong> {formData.goalType.replace('_', ' ')}
                  </div>
                  <div>
                    <strong>Category:</strong> {formData.category}
                  </div>
                  <div>
                    <strong>Priority:</strong> {formData.priority === 1 ? 'High' : formData.priority === 2 ? 'Medium' : 'Low'}
                  </div>
                  <div>
                    <strong>Deadline:</strong> {format(formData.timeBound.deadline, "MMM d, yyyy")}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <strong>Target:</strong> {formData.specificTarget.value} {formData.specificTarget.unit}
                  </div>
                  <div className="text-sm">
                    <strong>Current Level:</strong> {formData.achievableAssessment.currentLevel} {formData.specificTarget.unit}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <strong>Feasibility:</strong>
                    <Badge variant={
                      formData.achievableAssessment.feasibilityScore >= 70 ? "default" :
                      formData.achievableAssessment.feasibilityScore >= 50 ? "secondary" : "destructive"
                    }>
                      {formData.achievableAssessment.feasibilityScore}%
                    </Badge>
                  </div>
                </div>

                <div>
                  <strong className="text-sm">Why it matters:</strong>
                  <p className="text-sm text-gray-600 mt-1">{formData.relevantContext}</p>
                </div>

                <div>
                  <strong className="text-sm">Milestones:</strong>
                  <div className="flex gap-2 mt-1">
                    {formData.timeBound.milestoneSchedule.map(percentage => (
                      <Badge key={percentage} variant="outline" className="text-xs">
                        {percentage}%
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Create SMART Goal
          </DialogTitle>
          <DialogDescription>
            Follow the SMART framework to create an effective, achievable goal.
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
            <span>{Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100)}% Complete</span>
          </div>
          <Progress value={((currentStep + 1) / WIZARD_STEPS.length) * 100} className="h-2" />
        </div>

        {/* Step indicator */}
        <div className="flex justify-between text-xs">
          {WIZARD_STEPS.map((step, index) => (
            <div 
              key={step.id}
              className={`text-center ${index <= currentStep ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
                index <= currentStep ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'
              }`}>
                {index < currentStep ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <div className="hidden sm:block">{step.title}</div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-96">
          {renderStepContent()}
        </div>

        {/* Validation messages */}
        {(validationErrors.length > 0 || validationSuggestions.length > 0) && (
          <div className="space-y-2">
            {validationErrors.map((error, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            ))}
            {validationSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                <Lightbulb className="h-4 w-4 flex-shrink-0" />
                {suggestion}
              </div>
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={prevStep} 
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {currentStep === WIZARD_STEPS.length - 1 ? (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || validationErrors.length > 0}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Goal
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={nextStep}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}