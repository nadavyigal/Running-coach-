"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { MonitorIcon as Running, Calendar, Route, Gauge, Sun, CloudSun, Moon, Loader2 } from "lucide-react"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import {
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
import { onboardingManager } from "@/lib/onboardingManager"
import OnboardingErrorBoundary from "@/components/onboarding-error-boundary"
import { UserPrivacySettings } from "@/components/privacy-dashboard"
import { useEffect } from "react"

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  // Initialize session tracker
  const [sessionTracker] = useState(() => new OnboardingSessionTracker())
  
  // Initialize error handling hooks
  const { showError } = useErrorToast()
  const { isOnline } = useNetworkErrorHandling({
    enableOfflineMode: true,
    enableAutoRetry: true,
    showToasts: true
  })
  const { 
    checkDatabaseHealth, 
    recoverFromDatabaseError 
  } = useDatabaseErrorHandling()
  useAIServiceErrorHandling({
    enableFallbacks: true,
    showUserFeedback: true
  })

  useEffect(() => {
    // Track onboarding start
    trackOnboardingStarted('guided_form')
    
    // Track user context on start
    trackUserContext({
      demographics: { experience: '', goal: '' } as any,
      preferences: { daysPerWeek: 3, preferredTimes: [] } as any,
      deviceInfo: {
        platform: typeof window !== 'undefined' ? window.navigator.platform : 'unknown'
      } as any,
      behaviorPatterns: { sessionDuration: 0, interactionCount: 0, completionAttempts: 1 } as any
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
  const [privacySettings] = useState<UserPrivacySettings>({
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

  const totalSteps = 6

  const nextStep = () => {
    if (currentStep < totalSteps) {
      // Track step progression
      trackStepProgression(currentStep + 1, `step_${currentStep + 1}`, 'forward')
      sessionTracker.startStep(`step_${currentStep + 1}`)
      sessionTracker.completeStep(`step_${currentStep}`)
      
      setCurrentStep(currentStep + 1)
    }
  }

  const canProceed = () => {
    const canProceedResult = (() => {
      switch (currentStep) {
        case 2:
          return selectedGoal !== ""
        case 3:
          return selectedExperience !== ""
        case 4:
          return age !== null && age >= 10 && age <= 100
        case 5:
          return (Array.isArray(selectedTimes) && selectedTimes.length > 0) && (Array.isArray(daysPerWeek) && (daysPerWeek[0] ?? 0) >= 2)
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
          case 4:
            return { field: 'age', message: 'Valid age (10-100) is required' }
          case 5:
            return { field: 'schedule', message: 'At least one time slot and 2+ days per week required' }
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
    console.log('🚀 ONBOARDING COMPLETION STARTED - WITH USER CREATION')
    
    setIsGeneratingPlan(true)
    let retryCount = 0
    const maxRetries = 3
      
    const attemptUserCreation = async (): Promise<boolean> => {
      try {
        console.log(`📝 Attempt ${retryCount + 1}/${maxRetries}: Atomic Finish commit...`)
        
        // Prepare form data
        const formData = {
          goal: selectedGoal,
          experience: selectedExperience,
          selectedTimes,
          daysPerWeek: daysPerWeek[0],
          rpe,
          age,
          consents,
          privacySettings
        }
        
        // Validate required fields
        if (!selectedGoal || !selectedExperience) {
          throw new Error('Missing required onboarding data')
        }

        // Set default consents since we removed the consent step
        formData.consents = {
          data: true,
          gdpr: true,
          push: false
        }
        
        console.log('📋 Creating user profile (atomic) ...')
        const { userId, planId } = await dbUtils.completeOnboardingAtomic({
          goal: formData.goal as any,
          experience: formData.experience as any,
          preferredTimes: formData.selectedTimes,
          daysPerWeek: formData.daysPerWeek as number,
          consents: formData.consents,
          rpe: (formData.rpe ?? undefined) as any,
          age: (formData.age ?? undefined) as any,
          privacySettings: formData.privacySettings
        }, { artificialDelayMs: 300 })
        console.log('✅ Atomic commit complete:', { userId, planId })

        // Generate AI-powered training plan with enhanced error handling
        if (isOnline) {
          void (async () => {
        console.log('🤖 Generating personalized training plan...')
        let aiPlanGenerated = false;
        
        try {
          // Set a reasonable timeout for AI generation
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          const planResponse = await fetch('/api/generate-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: {
                experience: formData.experience,
                goal: formData.goal,
                daysPerWeek: formData.daysPerWeek,
                preferredTimes: formData.selectedTimes,
                age: formData.age
              }
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (planResponse.ok) {
            const planData = await planResponse.json();
            console.log('✅ AI plan generated successfully:', planData);

            // Update the plan with AI-generated workouts
            if (planData.plan && planData.plan.workouts) {
              await dbUtils.updatePlanWithAIWorkouts(planId, planData.plan);
              console.log('✅ Plan updated with AI workouts');
              aiPlanGenerated = true;
            }
          } else {
            const errorData = await planResponse.json().catch(() => ({}));
            console.warn('⚠️ AI plan generation failed:', {
              status: planResponse.status,
              error: errorData
            });
            
            // Check if it's an API key issue
            if (planResponse.status === 503 || errorData.fallbackRequired) {
              console.log('📋 AI service unavailable - using default plan template');
              toast({
                title: "Using Default Plan",
                description: "AI coach is currently unavailable. We've created a great starter plan for you!",
                variant: "default"
              });
            }
          }
        } catch (planError: any) {
          // Handle specific error types
          if (planError.name === 'AbortError') {
            console.warn('⚠️ AI plan generation timed out, using default plan');
            toast({
              title: "Plan Generation Timeout",
              description: "AI took too long to respond. Using a pre-built plan instead.",
              variant: "default"
            });
          } else {
            console.warn('⚠️ AI plan generation error:', planError.message || planError);
          }
          // Continue with default plan - not a critical error
        }
        
        // Show appropriate success message based on AI availability
        if (!aiPlanGenerated) {
          console.log('📋 Using default plan template (AI unavailable)');
        }
          })()
        }

        return true
        
      } catch (error) {
        console.error(`❌ Attempt ${retryCount + 1} failed:`, error)
        
        // Check if it's a DB availability error
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        if (errorMsg.includes('User not found') || errorMsg.includes('Database not available')) {
          // Try database recovery
          console.log('🔄 Attempting database recovery...')
          try {
            await recoverFromDatabaseError()
            // Reset onboarding state after recovery
            onboardingManager.resetOnboardingState()
          } catch (recoveryError) {
            console.warn('Database recovery failed:', recoveryError)
          }
        }
        
        retryCount++
        return false
      }
    }
    
    try {
      // Attempt user creation with retries
      let success = false
      while (retryCount < maxRetries && !success) {
        success = await attemptUserCreation()
        
        if (!success && retryCount < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        }
      }
      
      if (success) {
        // Success path - customize message based on AI availability
        console.log('🎉 [OnboardingScreen] Onboarding completed successfully!')
        console.log('🎉 [OnboardingScreen] Calling onComplete() callback to navigate to Today screen...')

        // Set generating plan to false first
        setIsGeneratingPlan(false)

        // Show success toast
        toast({
          title: "Welcome to Run-Smart! 🏃",
          description: "Your personalized running journey begins now!",
        })

        // Call the parent's onComplete callback to trigger navigation
        try {
          onComplete()
          console.log('✅ [OnboardingScreen] onComplete() called successfully')
        } catch (error) {
          console.error('❌ [OnboardingScreen] Error calling onComplete():', error)
          // Force navigation even if callback fails
          setIsGeneratingPlan(false)
        }

      } else {
        // All retries failed - ask user to retry
        console.warn('⚠️ All user creation attempts failed; prompting retry')
        toast({
          title: "Couldn’t finish setup",
          description: "Check your connection and try Finish again. Your answers are preserved.",
          variant: "destructive"
        })
        setIsGeneratingPlan(false)
      }
      
    } catch (error) {
      console.error('❌ Critical onboarding failure:', error)

      toast({
        title: "Setup Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive"
      })

      setIsGeneratingPlan(false)

      // Do NOT call onComplete() on error - keep user on onboarding screen
      // User can retry by clicking "Start My Journey" again
    }
  }
      

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Run-Smart!</h2>
              <p className="text-gray-600">Let&apos;s create your personalized running plan</p>
            </div>
            <Card className="bg-green-500 text-white border-green-600">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">🏃‍♂️ Adaptive Training Plan</h3>
                <p>Get a personalized training plan to get you going!</p>
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={nextStep} className="w-full bg-green-500 hover:bg-green-600">
                Get Started
              </Button>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">What&apos;s your running goal?</h2>

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

      case 5:
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

      case 6:
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
                </ul>
              </CardContent>
            </Card>
            <Button 
              onClick={handleComplete} 
              disabled={!canProceed() || isGeneratingPlan} 
              className="w-full bg-green-500 hover:bg-green-600" 
              aria-label="Start My Journey"
            >
              {isGeneratingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" role="status" aria-label="Loading" />
                  Creating Your Plan...
                </>
              ) : (
                'Start My Journey'
              )}
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <OnboardingErrorBoundary onReset={handleResetErrorBoundary}>
      <NetworkStatusIndicator />
      <div className="min-h-screen bg-green-500 p-4 flex flex-col">
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
            {[1, 2, 3, 4, 5, 6].map((step) => (
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
      </div>
    </OnboardingErrorBoundary>
  )
}
