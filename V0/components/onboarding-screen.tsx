"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { MonitorIcon as Running, Calendar, Route, Gauge, Sun, CloudSun, Moon, Loader2, MessageCircle } from "lucide-react"
import { dbUtils } from "@/lib/db"
import { generatePlan, generateFallbackPlan } from "@/lib/planGenerator"
import { useToast } from "@/hooks/use-toast"
import { trackEngagementEvent } from '@/lib/analytics'
import { 
  trackGoalDiscovered,
  trackOnboardingStarted,
  trackStepProgression,
  trackFormValidationError,
  trackUserContext,
  OnboardingSessionTracker
} from '@/lib/onboardingAnalytics'
import { useErrorToast, NetworkStatusIndicator } from '@/components/error-toast'
import { useNetworkErrorHandling } from '@/hooks/use-network-error-handling'
import { useDatabaseErrorHandling } from '@/hooks/use-database-error-handling'
import { useAIServiceErrorHandling } from '@/hooks/use-ai-service-error-handling'
import { planAdjustmentService } from "@/lib/planAdjustmentService"
import { OnboardingChatOverlay } from "@/components/onboarding-chat-overlay"
import { GoalDiscoveryWizard } from "@/components/goal-discovery-wizard"
import { onboardingManager } from "@/lib/onboardingManager"
import OnboardingErrorBoundary from "@/components/onboarding-error-boundary"
import { validateOnboardingState } from "@/lib/onboardingStateValidator"
import { PrivacyDashboard, UserPrivacySettings } from "@/components/privacy-dashboard"
import { useEffect } from "react"
import type { GoalDiscoveryResult } from "@/lib/goalDiscoveryEngine"

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  // Initialize session tracker
  const [sessionTracker] = useState(() => new OnboardingSessionTracker())
  
  // Initialize error handling hooks
  const { showError } = useErrorToast()
  const { safeApiCall, isOnline } = useNetworkErrorHandling({
    enableOfflineMode: true,
    enableAutoRetry: true,
    showToasts: true
  })
  const { 
    saveUser, 
    savePlan, 
    checkDatabaseHealth, 
    recoverFromDatabaseError 
  } = useDatabaseErrorHandling()
  const { 
    aiPlanGenerationWithFallback, 
    getAIServiceStatus, 
    enableFallbackMode 
  } = useAIServiceErrorHandling({
    enableFallbacks: true,
    showUserFeedback: true
  })

  useEffect(() => {
    // Track onboarding start
    trackOnboardingStarted('guided_form')
    
    // Track user context on start
    trackUserContext({
      demographics: { age: undefined, experience: '', goal: '' },
      preferences: { daysPerWeek: 3, preferredTimes: [], coachingStyle: undefined },
      deviceInfo: { 
        platform: typeof window !== 'undefined' ? window.navigator.platform : 'unknown',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        screenSize: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined
      },
      behaviorPatterns: { sessionDuration: 0, interactionCount: 0, completionAttempts: 1 }
    })

    // Check database health on startup
    const initializeDatabase = async () => {
      try {
        const healthCheck = await checkDatabaseHealth()
        if (!healthCheck.isHealthy) {
          console.warn('Database health check failed:', healthCheck.error)
          if (!healthCheck.canWrite) {
            showError(new Error('Storage system unavailable'), {
              onRetry: recoverFromDatabaseError
            })
          }
        }
      } catch (error) {
        console.error('Database initialization failed:', error)
      }
    }

    // AC3: Detect incomplete onboarding state on app startup and clean up
    const checkAndCleanupOnboarding = async () => {
      try {
        if (onboardingManager.isOnboardingInProgress()) {
          console.warn("Detected incomplete onboarding state on startup. Attempting cleanup...");
          await onboardingManager.resetOnboardingState();
          toast({
            title: "Onboarding Reset",
            description: "An incomplete onboarding session was detected and reset. Please start again.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Onboarding cleanup failed:', error)
        showError(error as Error, {
          onRetry: checkAndCleanupOnboarding
        })
      }
    };
    
    initializeDatabase()
    checkAndCleanupOnboarding();
  }, [checkDatabaseHealth, recoverFromDatabaseError, showError]);

  const handleResetErrorBoundary = () => {
    // This function will be called when the error boundary resets
    // We should reset the onboarding state here to allow the user to retry
    onboardingManager.resetOnboardingState();
    setCurrentStep(1);
    setSelectedGoal("");
    setSelectedExperience("");
    setSelectedTimes([]);
    setDaysPerWeek([3]);
    setRpe(null);
    setAge(null);
    setConsents({
      data: false,
      gdpr: false,
      push: false,
    });
    setIsGeneratingPlan(false);
    setShowChatOverlay(false);
    setAiGeneratedProfile(null);
    toast({
      title: "Onboarding Restarted",
      description: "The onboarding process has been reset. Please try again.",
    });
  };


  const [currentStep, setCurrentStep] = useState(1)
  const [selectedGoal, setSelectedGoal] = useState<string>("")
  const [selectedExperience, setSelectedExperience] = useState<string>("")
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [daysPerWeek, setDaysPerWeek] = useState([3])
  const [rpe, setRpe] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [consents, setConsents] = useState({
    data: false,
    gdpr: false,
    push: false,
  })
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [showGoalWizard, setShowGoalWizard] = useState(false)
  const [aiGeneratedProfile, setAiGeneratedProfile] = useState<any>(null)
  const [goalDiscoveryResult, setGoalDiscoveryResult] = useState<GoalDiscoveryResult | null>(null)
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>({
    dataCollection: {
      location: true,
      performance: true,
      analytics: true,
      coaching: true,
    },
    consentHistory: [],
    exportData: false,
    deleteData: false,
  })
  const { toast } = useToast()

  const totalSteps = 9

  const nextStep = () => {
    if (currentStep < totalSteps) {
      // Track step progression
      trackStepProgression(currentStep + 1, `step_${currentStep + 1}`, 'forward')
      sessionTracker.startStep(`step_${currentStep + 1}`)
      sessionTracker.completeStep(`step_${currentStep}`)
      
      setCurrentStep(currentStep + 1)
    }
  }

  const handleChatOverlayComplete = (goals: any[], userProfile: any) => {
    setAiGeneratedProfile(userProfile)
    
    // Update form state with AI-generated data
    if (userProfile.goal) {
      setSelectedGoal(userProfile.goal)
      
      // Track goal discovery
      trackGoalDiscovered({
        goalType: userProfile.goal,
        goalCategory: userProfile.goal === 'habit' ? 'consistency' : 
                     userProfile.goal === 'distance' ? 'endurance' : 'speed',
        goalConfidenceScore: 0.9, // High confidence for AI-guided
        discoveryMethod: 'ai_guided',
        goalReasoning: `AI-discovered goal based on conversation analysis`,
        userContext: { goals_count: goals.length, coaching_style: userProfile.coachingStyle }
      })
    }
    if (userProfile.experience) {
      setSelectedExperience(userProfile.experience)
    }
    if (userProfile.preferredTimes) {
      setSelectedTimes(userProfile.preferredTimes)
    }
    if (userProfile.daysPerWeek) {
      setDaysPerWeek([userProfile.daysPerWeek])
    }
    
    setShowChatOverlay(false)
    
    // Track AI-guided onboarding completion
    trackEngagementEvent('ai_onboarding_complete', {
      goals_count: goals.length,
      coaching_style: userProfile.coachingStyle,
      goal_types: goals.map((g: any) => g.category)
    })
    
    toast({
      title: "Goals Created!",
      description: "Your personalized running goals have been set. Let's continue with your plan.",
    })
    
    // Skip to the next step
    nextStep()
  }

  const handleGoalWizardComplete = (discoveryResult: GoalDiscoveryResult) => {
    setGoalDiscoveryResult(discoveryResult)
    
    // Extract primary goal info for form compatibility
    const primaryGoal = discoveryResult.primaryGoal
    if (primaryGoal.category === 'consistency') {
      setSelectedGoal('habit')
    } else if (primaryGoal.category === 'endurance') {
      setSelectedGoal('distance')
    } else if (primaryGoal.category === 'speed') {
      setSelectedGoal('speed')
    }

    // Set experience from discovered profile if available
    if (discoveryResult.metadata?.userExperience) {
      setSelectedExperience(discoveryResult.metadata.userExperience)
    }
    
    setShowGoalWizard(false)
    
    // Track comprehensive goal discovery
    trackGoalDiscovered({
      goalType: primaryGoal.goalType,
      goalCategory: primaryGoal.category,
      goalConfidenceScore: primaryGoal.confidence,
      discoveryMethod: 'goal_wizard',
      goalReasoning: primaryGoal.reasoning,
      userContext: { 
        goals_count: discoveryResult.discoveredGoals.length,
        success_probability: discoveryResult.estimatedSuccessProbability,
        ai_enhanced: discoveryResult.metadata?.aiEnhanced || false
      }
    })
    
    trackEngagementEvent('goal_wizard_complete', {
      goals_count: discoveryResult.discoveredGoals.length,
      primary_goal: primaryGoal.title,
      success_probability: Math.round(discoveryResult.estimatedSuccessProbability * 100),
      overall_confidence: Math.round(discoveryResult.overallConfidence * 100)
    })
    
    toast({
      title: "Perfect Goals Discovered!",
      description: `Found ${discoveryResult.discoveredGoals.length} personalized goals with ${Math.round(discoveryResult.estimatedSuccessProbability * 100)}% success probability.`,
    })
    
    // Skip to a later step since we have comprehensive goal info
    nextStep()
  }

  const canProceed = () => {
    const canProceedResult = (() => {
      switch (currentStep) {
        case 2:
          return selectedGoal !== ""
        case 3:
          return selectedExperience !== ""
        case 4:
          return true // RPE is optional
        case 5:
          return age !== null && age >= 10 && age <= 100
        case 6:
          return selectedTimes.length > 0 && daysPerWeek[0] >= 2
        case 7:
          return consents.data && consents.gdpr
        case 8:
          return consents.data && consents.gdpr // Final step also requires consents
        default:
          return true
      }
    })()

    // Track validation errors
    if (!canProceedResult) {
      const getValidationError = () => {
        switch (currentStep) {
          case 2:
            return { field: 'goal', message: 'Goal selection is required' }
          case 3:
            return { field: 'experience', message: 'Experience level is required' }
          case 5:
            return { field: 'age', message: 'Valid age (10-100) is required' }
          case 6:
            return { field: 'schedule', message: 'At least one time slot and 2+ days per week required' }
          case 7:
          case 8:
            return { field: 'consents', message: 'Required consents must be accepted' }
          default:
            return { field: 'unknown', message: 'Validation failed' }
        }
      }

      const errorInfo = getValidationError()
      trackFormValidationError({
        step: currentStep,
        field: errorInfo.field,
        errorType: 'validation_failed',
        errorMessage: errorInfo.message
      })
    }

    return canProceedResult
  }

  const handleTimeSlotToggle = (time: string) => {
    setSelectedTimes((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]))
  }

  const handleComplete = async () => {
    setIsGeneratingPlan(true)
    
    try {
      console.log('=== ONBOARDING FINISH START ===')
      
      // Step 1: Migrate existing localStorage data with error handling
      console.log('📋 Step 1: Migrating localStorage data...')
      await safeApiCall(
        () => dbUtils.migrateFromLocalStorage(),
        {
          operation: 'migrate_localStorage',
          service: 'database',
          onboardingStep: 'data_migration'
        }
      )
      console.log('✅ localStorage migration completed')
      
      // Step 2: Create user through OnboardingManager with enhanced error handling
      console.log('📋 Step 2: Creating user via OnboardingManager...')
      const formData = {
        goal: selectedGoal as 'habit' | 'distance' | 'speed',
        experience: selectedExperience === 'occasional' 
          ? 'intermediate' 
          : selectedExperience === 'regular'
          ? 'advanced'
          : selectedExperience as 'beginner' | 'intermediate' | 'advanced',
        selectedTimes: selectedTimes.length > 0 ? selectedTimes : ['morning'],
        daysPerWeek: daysPerWeek[0] || 3,
        rpe,
        age,
        consents,
        privacySettings
      }
      
      console.log('Form data:', formData)
      
      // Use AI plan generation with fallback
      let onboardingResult
      try {
        const aiPlanData = await aiPlanGenerationWithFallback({
          goal: formData.goal,
          experience: formData.experience,
          daysPerWeek: formData.daysPerWeek,
          age: formData.age,
          preferredTimes: formData.selectedTimes
        })
        
        // Create user with AI-generated plan
        onboardingResult = await safeApiCall(
          () => onboardingManager.completeFormOnboarding({
            ...formData,
            aiPlanData
          }),
          {
            operation: 'complete_onboarding_with_ai_plan',
            service: 'database',
            onboardingStep: 'user_creation',
            fallbackData: { success: false, errors: ['AI plan generation failed'] }
          }
        )
      } catch (aiError) {
        console.warn('AI plan generation failed, using fallback:', aiError)
        
        // Fallback to regular onboarding without AI
        onboardingResult = await safeApiCall(
          () => onboardingManager.completeFormOnboarding(formData),
          {
            operation: 'complete_onboarding_fallback',
            service: 'database',
            onboardingStep: 'user_creation'
          }
        )
      }
      
      if (!onboardingResult.success) {
        throw new Error(onboardingResult.errors?.join(', ') || 'Failed to complete onboarding')
      }
      
      console.log('✅ User and plan created successfully via OnboardingManager:', {
        userId: onboardingResult.user.id,
        planId: onboardingResult.planId
      })

      // Initialize plan adjustment service with error handling
      console.log('📋 Step 3: Initializing plan adjustment service...')
      try {
        planAdjustmentService.init(onboardingResult.user.id!)
        console.log('✅ Plan adjustment service initialized')
      } catch (planServiceError) {
        console.warn('Plan adjustment service initialization failed:', planServiceError)
        // Continue anyway, this is not critical for onboarding
      }
      
      // Step 4: Track completion event
      console.log('📋 Step 4: Tracking completion event...')
      const goalDist = selectedGoal === 'distance' ? 5 : 0
      trackEngagementEvent('onboard_complete', { rookieChallenge: true, age: age ?? 0, goalDist })

      // Track goal discovery for manual form selection
      if (selectedGoal && !aiGeneratedProfile) {
        trackGoalDiscovered({
          goalType: selectedGoal as 'habit' | 'distance' | 'speed',
          goalCategory: selectedGoal === 'habit' ? 'consistency' : 
                       selectedGoal === 'distance' ? 'endurance' : 'speed',
          goalConfidenceScore: 0.8, // Good confidence for form selection
          discoveryMethod: 'form_selection',
          goalReasoning: 'User manually selected goal from predefined options',
          userContext: { experience: selectedExperience, age, daysPerWeek: daysPerWeek[0] }
        })
      }

      // Complete session tracking
      sessionTracker.complete({
        completionMethod: aiGeneratedProfile ? 'mixed' : 'guided_form',
        userDemographics: {
          age: age || undefined,
          experience: selectedExperience === 'occasional' 
            ? 'intermediate' 
            : selectedExperience === 'regular'
            ? 'advanced'
            : selectedExperience as 'beginner' | 'intermediate' | 'advanced',
          daysPerWeek: daysPerWeek[0],
          preferredTimes: selectedTimes.length > 0 ? selectedTimes : ['morning']
        },
        planGeneratedSuccessfully: true
      })

      console.log('✅ Completion event tracked')
      
      // Step 5: Success notification
      toast({
        title: "Success!",
        description: "Your personalized running plan has been created successfully.",
      })
      
      // Step 6: Complete onboarding
      console.log('📋 Step 6: Completing onboarding...')
      setIsGeneratingPlan(false)
      onComplete()
      
      console.log('🎉 Onboarding completed successfully!')
    } catch (error) {
      console.error('❌ Onboarding completion failed:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Track the error
      const { trackOnboardingError } = await import('@/lib/onboardingAnalytics')
      trackOnboardingError({
        errorType: errorMessage.includes('network') ? 'network_failure' : 
                   errorMessage.includes('plan') ? 'plan_generation_failure' :
                   errorMessage.includes('database') ? 'database_error' : 'validation_error',
        errorMessage,
        errorContext: {
          step: 'completion',
          selectedGoal,
          selectedExperience,
          age,
          daysPerWeek: daysPerWeek[0],
          hasAiProfile: !!aiGeneratedProfile
        },
        recoveryAttempted: false,
        recoverySuccessful: false,
        userImpact: 'high',
        onboardingStep: 'step_8'
      })

      sessionTracker.incrementErrorCount()
      
      toast({
        title: "Onboarding Failed",
        description: `Failed to complete onboarding: ${errorMessage}. Please try again.`,
        variant: "destructive"
      })
      setIsGeneratingPlan(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Run-Smart!</h2>
              <p className="text-gray-600">Let's create your personalized running plan</p>
            </div>
            <Card className="bg-gradient-to-r from-green-400 to-blue-500 text-white">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">🏃‍♂️ 21-Day Rookie Challenge</h3>
                <p>Perfect for beginners! Build a sustainable running habit with our AI coach.</p>
              </CardContent>
            </Card>
            <Button onClick={nextStep} className="w-full bg-green-500 hover:bg-green-600">
              Get Started
            </Button>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">What's your running goal?</h2>
            
            {/* AI Goal Discovery Options */}
            <div className="space-y-3">
              <Card className="border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Gauge className="h-6 w-6 text-blue-600" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200">Smart Goal Discovery</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Answer a few questions to get personalized goal recommendations with success prediction
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowGoalWizard(true)}
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Discover Goals
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800 dark:text-green-200">Chat with AI Coach</h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Have a conversation to explore your running motivations and goals
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowChatOverlay(true)}
                      variant="outline"
                      size="sm"
                      className="border-green-300 text-green-700 hover:bg-green-100"
                    >
                      Start Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="text-center text-sm text-gray-500">
              <p>Or choose from our predefined options:</p>
            </div>
            
            <div className="space-y-3">
              {[
                { id: "habit", icon: Calendar, title: "Build a Running Habit", desc: "Start with consistency" },
                { id: "distance", icon: Route, title: "Run Longer Distances", desc: "Train for 5K, 10K, or more" },
                { id: "speed", icon: Gauge, title: "Improve Speed", desc: "Beat your personal best" },
              ].map((goal) => (
                <Card
                  key={goal.id}
                  className={`cursor-pointer transition-all ${selectedGoal === goal.id ? "ring-2 ring-green-500 bg-green-50" : ""}`}
                  onClick={() => setSelectedGoal(goal.id)}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <goal.icon className="h-8 w-8 text-green-500" />
                    <div>
                      <h3 className="font-semibold">{goal.title}</h3>
                      <p className="text-sm text-gray-600">{goal.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {goalDiscoveryResult && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Smart Goal Discovery Results
                      </p>
                    </div>
                    <div className="bg-white dark:bg-blue-950 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Primary Goal:</span>
                        <span className="text-sm text-blue-800 dark:text-blue-200">{goalDiscoveryResult.primaryGoal.title}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Success Probability:</span>
                        <span className="text-sm font-semibold text-green-600">
                          {Math.round(goalDiscoveryResult.estimatedSuccessProbability * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Supporting Goals:</span>
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                          {goalDiscoveryResult.supportingGoals.length} additional
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {aiGeneratedProfile && !goalDiscoveryResult && (
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      AI has suggested: <strong>{aiGeneratedProfile.goal}</strong> goal with {aiGeneratedProfile.coachingStyle} coaching style
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Button onClick={nextStep} disabled={!canProceed()} className="w-full bg-green-500 hover:bg-green-600">
              Continue
            </Button>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Running experience?</h2>
            <div className="space-y-3">
              {[
                { id: "beginner", title: "Beginner", desc: "New to running" },
                { id: "occasional", title: "Occasional", desc: "Run sometimes" },
                { id: "regular", title: "Regular", desc: "Run weekly" },
              ].map((exp) => (
                <Card
                  key={exp.id}
                  className={`cursor-pointer transition-all ${selectedExperience === exp.id ? "ring-2 ring-green-500 bg-green-50" : ""}`}
                  onClick={() => setSelectedExperience(exp.id)}
                >
                  <CardContent className="p-4 text-center">
                    <h3 className="font-semibold">{exp.title}</h3>
                    <p className="text-sm text-gray-600">{exp.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={nextStep} disabled={!canProceed()} className="w-full bg-green-500 hover:bg-green-600">
              Continue
            </Button>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Fitness Assessment (Optional)</h2>
            <div className="space-y-3">
              <label htmlFor="rpe-slider" className="block text-center mb-2">How hard do you feel you can push yourself? (RPE 1-10)</label>
              <Slider
                id="rpe-slider"
                value={rpe !== null ? [rpe] : [5]}
                onValueChange={([val]: number[]) => setRpe(val)}
                min={1}
                max={10}
                step={1}
                className="w-full"
                aria-label="Rate of Perceived Exertion"
              />
              <div className="text-center text-sm text-gray-600">{rpe !== null ? rpe : 5} / 10</div>
              <p className="text-xs text-gray-500 text-center">This helps us tailor your plan, but you can skip it.</p>
            </div>
            <Button onClick={nextStep} className="w-full bg-green-500 hover:bg-green-600">Continue</Button>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">How old are you?</h2>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Enter your age"
                value={age !== null ? age : ''}
                onChange={(e) => setAge(parseInt(e.target.value) || null)}
                className="w-full p-3 border border-gray-300 rounded-md text-center text-lg"
                min="10"
                max="100"
                aria-label="Your age"
              />
              <p className="text-xs text-gray-500 text-center">This helps us personalize your plan.</p>
            </div>
            <Button onClick={nextStep} disabled={!canProceed()} className="w-full bg-green-500 hover:bg-green-600">Continue</Button>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">When can you run?</h2>
            <div className="space-y-3">
              {[
                { id: "morning", icon: Sun, label: "Morning (6-9 AM)" },
                { id: "afternoon", icon: CloudSun, label: "Afternoon (12-3 PM)" },
                { id: "evening", icon: Moon, label: "Evening (6-9 PM)" },
              ].map((time) => (
                <Card
                  key={time.id}
                  className={`cursor-pointer transition-all ${selectedTimes.includes(time.id) ? "ring-2 ring-green-500 bg-green-50" : ""}`}
                  onClick={() => handleTimeSlotToggle(time.id)}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <time.icon className="h-6 w-6 text-green-500" />
                    <span>{time.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">How many days per week?</h3>
              <div className="space-y-2">
                <Slider
                  value={daysPerWeek}
                  onValueChange={setDaysPerWeek}
                  max={6}
                  min={2}
                  step={1}
                  className="w-full"
                />
                <div className="text-center text-sm text-gray-600">{daysPerWeek[0]} days/week</div>
              </div>
            </div>
            <Button onClick={nextStep} className="w-full bg-green-500 hover:bg-green-600">
              Continue
            </Button>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Privacy & Consent</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="data-consent"
                  checked={consents.data}
                  onCheckedChange={(checked: boolean) => setConsents((prev) => ({ ...prev, data: !!checked }))}
                  aria-label="I agree to the processing of my health data for personalized coaching"
                />
                <label htmlFor="data-consent" className="text-sm leading-relaxed">
                  I agree to the processing of my health data for personalized coaching
                </label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="gdpr-consent"
                  checked={consents.gdpr}
                  onCheckedChange={(checked: boolean) => setConsents((prev) => ({ ...prev, gdpr: !!checked }))}
                  aria-label="I accept the Terms of Service and Privacy Policy (GDPR compliant)"
                />
                <label htmlFor="gdpr-consent" className="text-sm leading-relaxed">
                  I accept the Terms of Service and Privacy Policy (GDPR compliant)
                </label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="push-consent"
                  checked={consents.push}
                  onCheckedChange={(checked: boolean) => setConsents((prev) => ({ ...prev, push: !!checked }))}
                  aria-label="Enable push notifications for running reminders"
                />
                <label htmlFor="push-consent" className="text-sm leading-relaxed">
                  Enable push notifications for running reminders
                </label>
              </div>
            </div>
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              Continue
            </Button>
          </div>
        )
      case 8:
        return (
          <div className="space-y-6">
            <PrivacyDashboard
              user={{
                id: undefined,
                name: undefined,
                privacySettings: privacySettings
              }}
              onSettingsChange={setPrivacySettings}
            />
            <Button
              onClick={nextStep}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              Continue
            </Button>
          </div>
        )
      case 9:
        return (
          <div className="space-y-6" role="region" aria-label="Summary and Confirmation">
            <h2 className="text-2xl font-bold text-center" id="summary-heading">Summary & Confirmation</h2>
            <Card>
              <CardContent className="p-4">
                <ul className="text-sm text-gray-700 space-y-2" aria-labelledby="summary-heading">
                  <li><strong>Goal:</strong> {selectedGoal}</li>
                  <li><strong>Experience:</strong> {selectedExperience}</li>
                  <li><strong>Age:</strong> {age !== null ? age : 'Not provided'}</li>
                  <li><strong>Preferred Times:</strong> {selectedTimes.join(', ')}</li>
                  <li><strong>Days/Week:</strong> {daysPerWeek[0]}</li>
                  <li><strong>RPE:</strong> {rpe !== null ? rpe : 'Not provided'}</li>
                  <li><strong>GDPR Consent:</strong> {consents.gdpr ? 'Yes' : 'No'}</li>
                  <li><strong>Health Data Consent:</strong> {consents.data ? 'Yes' : 'No'}</li>
                  <li><strong>Push Notifications:</strong> {consents.push ? 'Yes' : 'No'}</li>
                  <li><strong>Privacy Settings:</strong> Configured</li>
                </ul>
              </CardContent>
            </Card>
            <Button onClick={handleComplete} disabled={!canProceed() || isGeneratingPlan} className="w-full bg-green-500 hover:bg-green-600" aria-label="Start My Journey">
              {isGeneratingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" role="status" aria-label="Loading" />
                  Creating Your Plan...
                </>
              ) : (
                'Start My Journey'
              )}
            </Button>
            
            {/* Emergency fallback button in case of persistent errors */}
            {isGeneratingPlan && (
              <Button 
                onClick={() => {
                  setIsGeneratingPlan(false);
                  localStorage.setItem("onboarding-complete", "true");
                  onComplete();
                }} 
                variant="outline" 
                className="w-full mt-2 text-sm"
              >
                Skip Plan Generation & Continue
              </Button>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <OnboardingErrorBoundary onReset={handleResetErrorBoundary}>
      <NetworkStatusIndicator />
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4 flex flex-col">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
            <Running className="h-8 w-8" />
            Run-Smart
          </h1>
          <p className="text-white/80">Your AI Running Coach</p>
          {!isOnline && (
            <p className="text-orange-200 text-sm mt-2">
              ⚡ Working in offline mode
            </p>
          )}
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex space-x-2" role="progressbar" aria-label="Onboarding progress" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${
                  step <= currentStep ? "bg-white text-green-500" : "bg-white/30 text-white"
                }`}
                role="button"
                tabIndex={0}
                aria-label={`Step ${step}${step <= currentStep ? ' - Completed' : step === currentStep ? ' - Current' : ' - Not started'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Optional: Allow keyboard navigation to completed steps
                    if (step <= currentStep) {
                      // Could implement step navigation here
                    }
                  }
                }}
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        <Card className="flex-1 mx-auto w-full max-w-md">
          <CardContent className="p-6">{renderStep()}</CardContent>
        </Card>
        
        {/* AI Chat Overlay */}
        <OnboardingChatOverlay
          isOpen={showChatOverlay}
          onClose={() => setShowChatOverlay(false)}
          onComplete={handleChatOverlayComplete}
          currentStep={currentStep}
          totalSteps={totalSteps}
        />
        
        {/* Goal Discovery Wizard */}
        <GoalDiscoveryWizard
          isOpen={showGoalWizard}
          onClose={() => setShowGoalWizard(false)}
          onComplete={handleGoalWizardComplete}
          initialProfile={{
            experience: selectedExperience as any,
            age: age || undefined,
            availableTime: {
              daysPerWeek: daysPerWeek[0],
              minutesPerSession: 30,
              preferredTimes: selectedTimes
            }
          }}
        />
      </div>
    </OnboardingErrorBoundary>
  )
}
