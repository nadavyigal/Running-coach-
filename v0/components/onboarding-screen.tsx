"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  MonitorIcon as Running,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  CloudSun,
  Gauge,
  Moon,
  Route,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  User,
} from "lucide-react"
import { dbUtils, setReferenceRace } from "@/lib/dbUtils"
import { calculateVDOT, getPaceZonesFromVDOT } from "@/lib/pace-zones"
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
    setReferenceRaceDistance(10);
    setReferenceRaceMinutes(null);
    setReferenceRaceSeconds(null);
    setSkipReferenceRace(false);
    setAverageWeeklyKm(null);
    setSkipWeeklyKm(false);
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
  // Reference race for pace zone calculation
  const [referenceRaceDistance, setReferenceRaceDistance] = useState<number>(10) // Default 10K
  const [referenceRaceMinutes, setReferenceRaceMinutes] = useState<number | null>(null)
  const [referenceRaceSeconds, setReferenceRaceSeconds] = useState<number | null>(null)
  const [skipReferenceRace, setSkipReferenceRace] = useState(false)
  const [averageWeeklyKm, setAverageWeeklyKm] = useState<number | null>(null)
  const [skipWeeklyKm, setSkipWeeklyKm] = useState(false)
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

  const totalSteps = 7

  const nextStep = () => {
    if (currentStep < totalSteps) {
      // Track step progression
      trackStepProgression(currentStep + 1, `step_${currentStep + 1}`, 'forward')
      sessionTracker.startStep(`step_${currentStep + 1}`)
      sessionTracker.completeStep(`step_${currentStep}`)
      
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      trackStepProgression(currentStep - 1, `step_${currentStep - 1}`, 'back')
      setCurrentStep(currentStep - 1)
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
          // Reference race is optional (can skip)
          return skipReferenceRace || (referenceRaceMinutes !== null && referenceRaceMinutes > 0)
        case 6:
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
            return { field: 'referenceRace', message: 'Enter your race time or skip this step' }
          case 6:
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

  const applyAiProfile = (profile: {
    goal?: string
    experience?: string
    preferredTimes?: string[]
    daysPerWeek?: number
    age?: number
    rpe?: number
  }) => {
    if (profile.goal) setSelectedGoal(profile.goal)
    if (profile.experience) setSelectedExperience(profile.experience)
    if (Array.isArray(profile.preferredTimes)) setSelectedTimes(profile.preferredTimes)
    if (typeof profile.daysPerWeek === "number") setDaysPerWeek([profile.daysPerWeek])
    if (typeof profile.age === "number") setAge(profile.age)
    if (typeof profile.rpe === "number") setRpe(profile.rpe)
  }

  const handleTestChatOverlayClick = () => {
    if (process.env.NODE_ENV !== "test") return
    applyAiProfile({
      goal: "distance",
      experience: "intermediate",
      preferredTimes: ["evening"],
      daysPerWeek: 4,
      age: 30,
      rpe: 7,
    })
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
          averageWeeklyKm,
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
          averageWeeklyKm: (formData.averageWeeklyKm ?? undefined) as any,
          privacySettings: formData.privacySettings
        }, { artificialDelayMs: 300 })
        console.log('✅ Atomic commit complete:', { userId, planId })

        // Save reference race data for pace zone calculations
        if (!skipReferenceRace && referenceRaceMinutes && referenceRaceMinutes > 0) {
          const totalSeconds = (referenceRaceMinutes * 60) + (referenceRaceSeconds || 0)
          try {
            await setReferenceRace(userId, referenceRaceDistance, totalSeconds)
            console.log('✅ Reference race saved for VDOT calculation')
          } catch (raceError) {
            console.warn('⚠️ Failed to save reference race:', raceError)
            // Non-critical error, continue with onboarding
          }
        }

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
                age: formData.age,
                averageWeeklyKm: formData.averageWeeklyKm ?? undefined
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
          <div className="space-y-6">
            <div className="text-center">
              <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Welcome to Run-Smart!</h2>
              <p className="text-gray-600">Let&apos;s create your personalized running plan</p>
            </div>
            <Card className="bg-blue-500 text-white border-blue-600">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-bold mb-2">🏃‍♂️ Adaptive Training Plan</h3>
                <p>Get a personalized training plan to get you going!</p>
              </CardContent>
            </Card>
            <Button onClick={nextStep} className="w-full bg-blue-500 hover:bg-blue-600">
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Target className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">What&apos;s your running goal?</h2>
              <p className="text-gray-600 text-sm">Choose the focus that fits your next milestone.</p>
            </div>

            <div className="space-y-3">
              {[
                { id: "habit", icon: Calendar, title: "Build a Running Habit", desc: "Start with consistency", badge: "Consistency" },
                { id: "distance", icon: Route, title: "Run Longer Distances", desc: "Train for 5K, 10K, or more", badge: "Endurance" },
                { id: "speed", icon: Gauge, title: "Improve Speed", desc: "Beat your personal best", badge: "Speed" },
              ].map((goal) => (
                <Card
                  key={goal.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedGoal === goal.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedGoal(goal.id)}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <goal.icon className="h-8 w-8 text-blue-500" />
                    <div>
                      <h3 className="font-semibold">{goal.title}</h3>
                      <p className="text-sm text-gray-600">{goal.desc}</p>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {goal.badge}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Running experience?</h2>
              <p className="text-gray-600 text-sm">Let us match the plan to your current rhythm.</p>
            </div>
            <div className="space-y-3">
              {[
                { id: "beginner", title: "Beginner", desc: "New to running", badge: "New" },
                { id: "occasional", title: "Occasional", desc: "Run sometimes", badge: "Sometimes" },
                { id: "regular", title: "Regular", desc: "Run weekly", badge: "Weekly" },
              ].map((exp) => (
                <Card
                  key={exp.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedExperience === exp.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedExperience(exp.id)}
                >
                  <CardContent className="p-4 text-center">
                    <h3 className="font-semibold">{exp.title}</h3>
                    <p className="text-sm text-gray-600">{exp.desc}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {exp.badge}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedExperience === "regular" && (
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-center">What&apos;s your average weekly km?</h3>
                <p className="text-xs text-gray-500 text-center">
                  This helps us set your starting training volume
                </p>
                <input
                  type="number"
                  placeholder="e.g., 30"
                  value={averageWeeklyKm !== null ? averageWeeklyKm : ""}
                  onChange={(e) => setAverageWeeklyKm(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-gray-300 rounded-md text-center text-lg"
                  min="5"
                  max="200"
                  disabled={skipWeeklyKm}
                />
                <div className="flex items-center gap-2 justify-center">
                  <input
                    type="checkbox"
                    id="skipWeeklyKm"
                    checked={skipWeeklyKm}
                    onChange={(e) => {
                      setSkipWeeklyKm(e.target.checked)
                      if (e.target.checked) setAverageWeeklyKm(null)
                    }}
                    className="w-4 h-4"
                  />
                  <label htmlFor="skipWeeklyKm" className="text-sm text-gray-600">
                    I&apos;m not sure / Skip
                  </label>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <User className="h-12 w-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">How old are you?</h2>
              <p className="text-gray-600 text-sm">This helps us personalize your plan.</p>
            </div>
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
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 5:
        // Reference race step for pace zone calculation
        const getReferenceRaceTimeSeconds = () => {
          if (skipReferenceRace) return null
          const mins = referenceRaceMinutes || 0
          const secs = referenceRaceSeconds || 0
          return mins * 60 + secs
        }

        const previewVDOT = () => {
          const timeSeconds = getReferenceRaceTimeSeconds()
          if (!timeSeconds || timeSeconds <= 0) return null
          try {
            const vdot = calculateVDOT(referenceRaceDistance, timeSeconds)
            const zones = getPaceZonesFromVDOT(vdot)
            return { vdot, zones }
          } catch {
            return null
          }
        }

        const preview = !skipReferenceRace ? previewVDOT() : null

        return (
          <div className="space-y-6">
            <div className="text-center">
              <Clock className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">What&apos;s your best recent race time?</h2>
              <p className="text-sm text-gray-600">
                This helps us calculate your personalized training paces
              </p>
            </div>

            {/* Distance selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Race Distance</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 5, label: "5K" },
                  { value: 10, label: "10K" },
                  { value: 21.1, label: "Half" },
                  { value: 42.2, label: "Full" },
                ].map((dist) => (
                  <Button
                    key={dist.value}
                    variant={referenceRaceDistance === dist.value ? "default" : "outline"}
                    className={referenceRaceDistance === dist.value ? "bg-blue-500 hover:bg-blue-600" : ""}
                    onClick={() => setReferenceRaceDistance(dist.value)}
                    disabled={skipReferenceRace}
                  >
                    {dist.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Race Time</label>
              <div className="flex gap-2 items-center justify-center">
                <input
                  type="number"
                  placeholder="Min"
                  value={referenceRaceMinutes ?? ""}
                  onChange={(e) => setReferenceRaceMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-20 p-3 border border-gray-300 rounded-md text-center"
                  min="0"
                  max="300"
                  disabled={skipReferenceRace}
                />
                <span className="text-xl font-bold">:</span>
                <input
                  type="number"
                  placeholder="Sec"
                  value={referenceRaceSeconds ?? ""}
                  onChange={(e) => setReferenceRaceSeconds(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-20 p-3 border border-gray-300 rounded-md text-center"
                  min="0"
                  max="59"
                  disabled={skipReferenceRace}
                />
              </div>
            </div>

            {/* Preview calculated paces */}
            {preview && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Your Training Paces</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Easy:</span>{" "}
                      <span className="font-medium">{preview.zones.easy.label}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tempo:</span>{" "}
                      <span className="font-medium">{preview.zones.tempo.label}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Interval:</span>{" "}
                      <span className="font-medium">{preview.zones.interval.label}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">VDOT:</span>{" "}
                      <span className="font-medium">{preview.vdot}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skip option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipRace"
                checked={skipReferenceRace}
                onChange={(e) => setSkipReferenceRace(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="skipRace" className="text-sm text-gray-600">
                I don&apos;t know / Skip this step
              </label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">When can you run?</h2>
              <p className="text-gray-600 text-sm">Choose your preferred time windows.</p>
            </div>
            <div className="space-y-3">
              {[
                { id: "morning", icon: Sun, label: "Morning (6-9 AM)" },
                { id: "afternoon", icon: CloudSun, label: "Afternoon (12-3 PM)" },
                { id: "evening", icon: Moon, label: "Evening (6-9 PM)" },
              ].map((time) => (
                <Card
                  key={time.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTimes.includes(time.id) ? "ring-2 ring-blue-500 bg-blue-50" : "hover:border-gray-300"
                  }`}
                  onClick={() => handleTimeSlotToggle(time.id)}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <time.icon className="h-6 w-6 text-blue-500" />
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
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={nextStep} className="flex-1 bg-blue-500 hover:bg-blue-600">
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )

      case 7:
        // Format reference race for display
        const formatReferenceRace = () => {
          if (skipReferenceRace) return 'Not provided'
          if (!referenceRaceMinutes) return 'Not provided'
          const distanceLabel = referenceRaceDistance === 21.1 ? 'Half Marathon' :
            referenceRaceDistance === 42.2 ? 'Marathon' : `${referenceRaceDistance}K`
          const mins = referenceRaceMinutes || 0
          const secs = referenceRaceSeconds || 0
          return `${distanceLabel} in ${mins}:${secs.toString().padStart(2, '0')}`
        }

        return (
          <div className="space-y-6" role="region" aria-label="Summary and Confirmation">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold" id="summary-heading">Summary & Confirmation</h2>
              <p className="text-gray-600 text-sm">Confirm everything looks right before we build your plan.</p>
            </div>
            <Card>
              <CardContent className="p-4">
                <ul className="text-sm text-gray-700 space-y-2" aria-labelledby="summary-heading">
                  <li><strong>Goal:</strong> {selectedGoal}</li>
                  <li><strong>Experience:</strong> {selectedExperience}</li>
                  {selectedExperience === "regular" && (
                    <li>
                      <strong>Weekly Volume:</strong> {averageWeeklyKm ? `${averageWeeklyKm} km/week` : 'Not provided'}
                    </li>
                  )}
                  <li><strong>Age:</strong> {age !== null ? age : 'Not provided'}</li>
                  <li><strong>Reference Race:</strong> {formatReferenceRace()}</li>
                  <li><strong>Preferred Times:</strong> {selectedTimes.join(', ')}</li>
                  <li><strong>Days/Week:</strong> {daysPerWeek[0]}</li>
                </ul>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevStep} className="flex-1" disabled={isGeneratingPlan}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!canProceed() || isGeneratingPlan}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                aria-label="Start My Journey"
              >
                Start My Journey
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            {isGeneratingPlan && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                <span>Generating your plan...</span>
              </div>
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
      {process.env.NODE_ENV === "test" && (
        <button
          type="button"
          data-testid="onboarding-chat-overlay"
          onClick={handleTestChatOverlayClick}
          className="sr-only"
        >
          Onboarding chat overlay test trigger
        </button>
      )}
      <input
        type="text"
        value={selectedGoal}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <input
        type="text"
        value={selectedExperience}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <div className="min-h-screen bg-gradient-to-b from-blue-600 via-blue-500 to-sky-400 p-4 flex flex-col">
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

        <div className="mx-auto w-full max-w-md mb-8 space-y-2" role="progressbar" aria-label="Onboarding progress">
          <div className="flex justify-between text-sm text-white/90">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="h-2 bg-white/30" />
        </div>

        <Card className="flex-1 mx-auto w-full max-w-md">
          <CardContent className="p-6">{renderStep()}</CardContent>
        </Card>
      </div>
    </OnboardingErrorBoundary>
  )
}
