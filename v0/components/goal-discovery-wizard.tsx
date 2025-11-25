"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Target,
  Clock,
  TrendingUp,
  Heart,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  Star,
  ArrowRight
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { goalDiscoveryEngine, type UserProfile, type DiscoveredGoal, type GoalDiscoveryResult } from "@/lib/goalDiscoveryEngine"

interface GoalDiscoveryWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (discoveryResult: GoalDiscoveryResult) => void
  initialProfile?: Partial<UserProfile>
}

interface WizardStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  isComplete: boolean
  isRequired: boolean
}

export function GoalDiscoveryWizard({ 
  isOpen, 
  onClose, 
  onComplete, 
  initialProfile = {} 
}: GoalDiscoveryWizardProps) {
  const { toast } = useToast()
  
  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<GoalDiscoveryResult | null>(null)
  
  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile>({
    experience: initialProfile.experience ?? 'beginner',
    currentFitnessLevel: 5,
    availableTime: {
      daysPerWeek: initialProfile.availableTime?.daysPerWeek ?? 3,
      minutesPerSession: initialProfile.availableTime?.minutesPerSession ?? 30,
      preferredTimes: initialProfile.availableTime?.preferredTimes ?? []
    },
    physicalLimitations: [],
    pastInjuries: [],
    motivations: [],
    barriers: [],
    preferences: {
      coachingStyle: initialProfile.preferences?.coachingStyle ?? 'supportive',
      workoutTypes: initialProfile.preferences?.workoutTypes ?? [],
      environment: initialProfile.preferences?.environment ?? 'both'
    },
    ...initialProfile
  })

  // Define wizard steps
  const steps: WizardStep[] = [
    {
      id: 'experience',
      title: 'Running Experience',
      description: 'Tell us about your running background',
      icon: TrendingUp,
      isComplete: false,
      isRequired: true
    },
    {
      id: 'fitness',  
      title: 'Current Fitness',
      description: 'Assess your current fitness level',
      icon: Heart,
      isComplete: false,
      isRequired: true
    },
    {
      id: 'availability',
      title: 'Time Availability', 
      description: 'How much time can you dedicate?',
      icon: Clock,
      isComplete: false,
      isRequired: true
    },
    {
      id: 'motivations',
      title: 'Motivations & Goals',
      description: 'What drives you to run?',
      icon: Target,
      isComplete: false,
      isRequired: true
    },
    {
      id: 'barriers',
      title: 'Potential Challenges',
      description: 'What might hold you back?',
      icon: AlertCircle,
      isComplete: false,
      isRequired: false
    },
    {
      id: 'preferences',
      title: 'Preferences',
      description: 'How do you like to train?',
      icon: Star,
      isComplete: false,
      isRequired: false
    },
    {
      id: 'discovery',
      title: 'Goal Discovery',
      description: 'AI analyzes your profile',
      icon: Sparkles,
      isComplete: false,
      isRequired: true
    },
    {
      id: 'review',
      title: 'Review Goals',
      description: 'Review and customize your goals',
      icon: CheckCircle,
      isComplete: false,
      isRequired: true
    }
  ]

  const currentStep = steps[currentStepIndex]
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100

  // Update step completion status
  useEffect(() => {
    updateStepCompletion()
  }, [userProfile, currentStepIndex])

  const updateStepCompletion = () => {
    // Logic to determine if current step is complete
    let isComplete = false
    
    switch (currentStep.id) {
      case 'experience':
        isComplete = !!userProfile.experience
        break
      case 'fitness':
        isComplete = userProfile.currentFitnessLevel > 0
        break
      case 'availability':
        isComplete = userProfile.availableTime.daysPerWeek > 0 && 
                    userProfile.availableTime.minutesPerSession > 0
        break
      case 'motivations':
        // Allow proceeding even with zero selections; we’ll collect more later
        isComplete = userProfile.motivations.length >= 0
        break
      case 'barriers':
        isComplete = true // Optional step
        break
      case 'preferences':
        isComplete = true // Optional step  
        break
      case 'discovery':
        // Consider step complete once discovery has run or was attempted
        isComplete = !!discoveryResult || !isProcessing
        break
      case 'review':
        isComplete = !!discoveryResult
        break
    }

    steps[currentStepIndex].isComplete = isComplete
  }

  const canProceed = () => {
    // Never hard-block progression; rely on validations later
    return true
  }

  const handleNext = async () => {
    if (currentStep.id === 'discovery') {
      await runGoalDiscovery()
    }
    
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }

  const handleComplete = () => {
    if (discoveryResult) {
      onComplete(discoveryResult)
    }
  }

  const runGoalDiscovery = async () => {
    setIsProcessing(true)
    try {
      console.log('🎯 Running goal discovery with profile:', userProfile)
      
      const result = await goalDiscoveryEngine.discoverGoals(userProfile, {
        userResponses: userProfile
      })
      
      setDiscoveryResult(result)
      steps[currentStepIndex].isComplete = true
      
      toast({
        title: "Goals Discovered!",
        description: `Found ${result.discoveredGoals.length} personalized goals for you.`,
      })
      
    } catch (error) {
      console.error('Goal discovery failed:', error)
      toast({
        title: "Discovery Failed",
        description: "We'll help you set goals manually. Let's continue.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'experience':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <TrendingUp className="h-12 w-12 mx-auto text-primary" />
              <h3 className="text-xl font-semibold">What's your running experience?</h3>
              <p className="text-muted-foreground">This helps us recommend appropriate goals for your level</p>
            </div>
            
            <div className="space-y-3">
              {[
                { id: 'beginner', title: 'Beginner', desc: 'New to running or getting back into it', icon: '🌱' },
                { id: 'intermediate', title: 'Intermediate', desc: 'Run regularly, have some experience', icon: '🏃' },
                { id: 'advanced', title: 'Advanced', desc: 'Experienced runner with specific goals', icon: '🏆' }
              ].map((level) => (
                <Card
                  key={level.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    userProfile.experience === level.id ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setUserProfile(prev => ({ ...prev, experience: level.id as any }))}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <span className="text-2xl">{level.icon}</span>
                    <div>
                      <h4 className="font-semibold">{level.title}</h4>
                      <p className="text-sm text-muted-foreground">{level.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )

      case 'fitness':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Heart className="h-12 w-12 mx-auto text-red-500" />
              <h3 className="text-xl font-semibold">How's your current fitness?</h3>
              <p className="text-muted-foreground">Rate your overall fitness level (1 = Very unfit, 10 = Very fit)</p>
            </div>
            
            <div className="space-y-4">
              <div className="px-4">
                <Slider
                  value={[userProfile.currentFitnessLevel]}
                  onValueChange={([value]) => setUserProfile(prev => ({ 
                    ...prev, 
                    currentFitnessLevel: value 
                  }))}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>Very unfit</span>
                  <span className="font-semibold text-primary">
                    {userProfile.currentFitnessLevel}/10
                  </span>
                  <span>Very fit</span>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Consider:</p>
                    <ul className="text-muted-foreground mt-1 space-y-1">
                      <li>• How easily you get out of breath climbing stairs</li>
                      <li>• Your energy levels throughout the day</li>
                      <li>• Any recent physical activity</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'availability':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Clock className="h-12 w-12 mx-auto text-blue-500" />
              <h3 className="text-xl font-semibold">How much time can you dedicate?</h3>
              <p className="text-muted-foreground">Be realistic about your schedule</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">Days per week</label>
                <div className="px-4">
                  <Slider
                    value={[userProfile.availableTime.daysPerWeek]}
                    onValueChange={([value]) => setUserProfile(prev => ({
                      ...prev,
                      availableTime: { ...prev.availableTime, daysPerWeek: value }
                    }))}
                    max={7}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>1 day</span>
                    <span className="font-semibold text-primary">
                      {userProfile.availableTime.daysPerWeek} days/week
                    </span>
                    <span>7 days</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Minutes per session</label>
                <div className="px-4">
                  <Slider
                    value={[userProfile.availableTime.minutesPerSession]}
                    onValueChange={([value]) => setUserProfile(prev => ({
                      ...prev,
                      availableTime: { ...prev.availableTime, minutesPerSession: value }
                    }))}
                    max={90}
                    min={15}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>15 min</span>
                    <span className="font-semibold text-primary">
                      {userProfile.availableTime.minutesPerSession} minutes
                    </span>
                    <span>90 min</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Preferred times (optional)</label>
                <div className="space-y-2">
                  {[
                    { id: 'morning', label: 'Morning (6-9 AM)', icon: '🌅' },
                    { id: 'afternoon', label: 'Afternoon (12-3 PM)', icon: '☀️' },
                    { id: 'evening', label: 'Evening (6-9 PM)', icon: '🌆' }
                  ].map((time) => (
                    <div key={time.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={time.id}
                        checked={userProfile.availableTime.preferredTimes.includes(time.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setUserProfile(prev => ({
                              ...prev,
                              availableTime: {
                                ...prev.availableTime,
                                preferredTimes: [...prev.availableTime.preferredTimes, time.id]
                              }
                            }))
                          } else {
                            setUserProfile(prev => ({
                              ...prev,
                              availableTime: {
                                ...prev.availableTime,
                                preferredTimes: prev.availableTime.preferredTimes.filter(t => t !== time.id)
                              }
                            }))
                          }
                        }}
                      />
                      <label htmlFor={time.id} className="text-sm flex items-center space-x-2">
                        <span>{time.icon}</span>
                        <span>{time.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'motivations':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Target className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="text-xl font-semibold">What motivates you to run?</h3>
              <p className="text-muted-foreground">Select all that apply - this helps us find the right goals</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'health', label: 'Improve overall health', icon: '❤️' },
                { id: 'weight', label: 'Lose weight / maintain weight', icon: '⚖️' },
                { id: 'fitness', label: 'Get fitter and stronger', icon: '💪' },
                { id: 'stress', label: 'Reduce stress and anxiety', icon: '🧘' },
                { id: 'energy', label: 'Increase energy levels', icon: '⚡' },
                { id: 'challenge', label: 'Personal challenge', icon: '🎯' },
                { id: 'social', label: 'Social activity / meet people', icon: '👥' },
                { id: 'race', label: 'Train for a race or event', icon: '🏃‍♂️' },
                { id: 'habit', label: 'Build a healthy habit', icon: '📅' },
                { id: 'mental', label: 'Mental health benefits', icon: '🧠' },
                { id: 'enjoy', label: 'Simply enjoy running', icon: '😊' },
                { id: 'outdoor', label: 'Spend time outdoors', icon: '🌳' }
              ].map((motivation) => (
                <div key={motivation.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={motivation.id}
                    checked={userProfile.motivations.includes(motivation.label)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setUserProfile(prev => ({
                          ...prev,
                          motivations: [...prev.motivations, motivation.label]
                        }))
                      } else {
                        setUserProfile(prev => ({
                          ...prev,
                          motivations: prev.motivations.filter(m => m !== motivation.label)
                        }))
                      }
                    }}
                  />
                  <label htmlFor={motivation.id} className="text-sm flex items-center space-x-2 cursor-pointer">
                    <span>{motivation.icon}</span>
                    <span>{motivation.label}</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium mb-2 block">Any other motivations? (optional)</label>
              <Textarea
                placeholder="Tell us about any other reasons you want to run..."
                className="resize-none"
                rows={3}
                value={userProfile.motivations.find(m => m.startsWith('Custom:'))?.replace('Custom:', '') || ''}
                onChange={(e) => {
                  const customText = e.target.value
                  setUserProfile(prev => ({
                    ...prev,
                    motivations: [
                      ...prev.motivations.filter(m => !m.startsWith('Custom:')),
                      ...(customText ? [`Custom:${customText}`] : [])
                    ]
                  }))
                }}
              />
            </div>
          </div>
        )

      case 'barriers':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 mx-auto text-orange-500" />
              <h3 className="text-xl font-semibold">What might hold you back?</h3>
              <p className="text-muted-foreground">Identifying barriers helps us create realistic goals</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'time', label: 'Lack of time', icon: '⏰' },
                { id: 'motivation', label: 'Staying motivated', icon: '😴' },
                { id: 'weather', label: 'Weather conditions', icon: '🌧️' },
                { id: 'safety', label: 'Safety concerns', icon: '🚨' },
                { id: 'injury', label: 'Fear of injury', icon: '🤕' },
                { id: 'equipment', label: 'Lack of proper equipment', icon: '👟' },
                { id: 'location', label: 'No good places to run', icon: '📍' },
                { id: 'energy', label: 'Feeling too tired', icon: '😪' },
                { id: 'selfconscious', label: 'Feeling self-conscious', icon: '😳' },
                { id: 'cost', label: 'Cost of gym/equipment', icon: '💰' },
                { id: 'schedule', label: 'Irregular schedule', icon: '📅' },
                { id: 'family', label: 'Family/childcare responsibilities', icon: '👶' }
              ].map((barrier) => (
                <div key={barrier.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={barrier.id}
                    checked={userProfile.barriers.includes(barrier.label)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setUserProfile(prev => ({
                          ...prev,
                          barriers: [...prev.barriers, barrier.label]
                        }))
                      } else {
                        setUserProfile(prev => ({
                          ...prev,
                          barriers: prev.barriers.filter(b => b !== barrier.label)
                        }))
                      }
                    }}
                  />
                  <label htmlFor={barrier.id} className="text-sm flex items-center space-x-2 cursor-pointer">
                    <span>{barrier.icon}</span>
                    <span>{barrier.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Star className="h-12 w-12 mx-auto text-yellow-500" />
              <h3 className="text-xl font-semibold">How do you prefer to train?</h3>
              <p className="text-muted-foreground">These preferences help us personalize your experience</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">Coaching style</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'supportive', label: 'Supportive & Encouraging', desc: 'Gentle guidance and positive reinforcement', icon: '🤗' },
                    { id: 'challenging', label: 'Challenging & Motivating', desc: 'Push you to achieve more', icon: '💪' },
                    { id: 'analytical', label: 'Data-Driven & Analytical', desc: 'Focus on metrics and progress tracking', icon: '📊' },
                    { id: 'encouraging', label: 'Balanced & Encouraging', desc: 'Mix of support and challenge', icon: '⚖️' }
                  ].map((style) => (
                    <Card
                      key={style.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        userProfile.preferences.coachingStyle === style.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setUserProfile(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, coachingStyle: style.id as any }
                      }))}
                    >
                      <CardContent className="p-3 flex items-center space-x-3">
                        <span className="text-lg">{style.icon}</span>
                        <div>
                          <h4 className="font-medium text-sm">{style.label}</h4>
                          <p className="text-xs text-muted-foreground">{style.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Preferred environment</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'outdoor', label: 'Outdoor', icon: '🌳' },
                    { id: 'indoor', label: 'Indoor', icon: '🏢' },
                    { id: 'both', label: 'Both', icon: '🔄' }
                  ].map((env) => (
                    <Button
                      key={env.id}
                      variant={userProfile.preferences.environment === env.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUserProfile(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, environment: env.id as any }
                      }))}
                      className="flex flex-col items-center py-3 h-auto"
                    >
                      <span className="text-lg mb-1">{env.icon}</span>
                      <span className="text-xs">{env.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'discovery':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <Sparkles className="h-16 w-16 mx-auto text-primary animate-pulse" />
              <h3 className="text-xl font-semibold">Discovering Your Perfect Goals</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Our AI is analyzing your profile to find the most suitable running goals for you...
              </p>
            </div>
            
            {isProcessing ? (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-6 space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm font-medium">Analyzing your fitness level and experience...</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm font-medium">Matching goals to your motivations...</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                    <span className="text-sm font-medium">Calculating success probability...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6">
                <div className="flex items-center justify-center">
                  <Button onClick={runGoalDiscovery} size="lg" className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Discover My Goals</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )

      case 'review':
        return discoveryResult ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="text-xl font-semibold">Your Personalized Goals</h3>
              <p className="text-muted-foreground">
                Success probability: <span className="font-semibold text-green-600">
                  {Math.round(discoveryResult.estimatedSuccessProbability * 100)}%
                </span>
              </p>
            </div>

            <div className="space-y-4">
              {/* Primary Goal */}
              <Card className="border-2 border-primary bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="w-fit">Primary Goal</Badge>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < Math.round(discoveryResult.primaryGoal.confidence * 5)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{discoveryResult.primaryGoal.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {discoveryResult.primaryGoal.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {discoveryResult.primaryGoal.category}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {discoveryResult.primaryGoal.timeBound.totalDuration} days
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Priority {discoveryResult.primaryGoal.priority}
                    </Badge>
                  </div>
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Target:</p>
                    <p className="font-medium text-sm">
                      {discoveryResult.primaryGoal.specificTarget.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Supporting Goals */}
              {discoveryResult.supportingGoals.map((goal, index) => (
                <Card key={goal.id} className="border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="w-fit">Supporting Goal</Badge>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < Math.round(goal.confidence * 5)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{goal.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">{goal.category}</Badge>
                      <Badge variant="outline" className="text-xs">{goal.timeBound.totalDuration} days</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recommendations */}
            {discoveryResult.recommendations.length > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                      Recommendations
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {discoveryResult.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span className="text-blue-800 dark:text-blue-200">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            {discoveryResult.nextSteps.length > 0 && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-base text-green-900 dark:text-green-100">
                      Next Steps
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {discoveryResult.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <span className="text-green-600 mt-0.5">{index + 1}.</span>
                        <span className="text-green-800 dark:text-green-200">{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No goals discovered yet. Please run the discovery process.</p>
          </div>
        )

      default:
        return <div>Unknown step</div>
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full h-[90vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span>AI Goal Discovery Wizard</span>
            </DialogTitle>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{currentStep.title}</span>
              <span className="text-sm text-muted-foreground">
                {currentStepIndex + 1} of {steps.length}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 px-6 py-6">
            {renderStepContent()}
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-2">
              {currentStepIndex === steps.length - 1 ? (
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleComplete}
                    className="flex items-center space-x-2"
                  >
                    <Trophy className="h-4 w-4" />
                    <span>Complete Discovery</span>
                  </Button>
                  <Button
                    onClick={() => {
                      // Allow user to apply goals and continue to plan generation immediately
                      if (discoveryResult) {
                        toast({
                          title: "Goals Applied!",
                          description: "Your personalized goals will be used to create your training plan.",
                          variant: "default"
                        });
                        handleComplete();
                      }
                    }}
                    variant="outline"
                    disabled={!discoveryResult}
                  >
                    Apply Goals & Continue
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleNext}
                  className="flex items-center space-x-2"
                >
                  <span>
                    {currentStep.id === 'discovery' && isProcessing ? 'Processing...' : 'Next'}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}