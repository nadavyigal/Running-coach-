"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Gauge,
  HelpCircle,
  Route,
  TrendingUp,
} from "lucide-react"
import { dbUtils, setReferenceRace } from "@/lib/dbUtils"
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
import { cn } from "@/lib/utils"
import type { ChallengeTemplate } from "@/lib/db"
import { getChallengeTemplateBySlug } from "@/lib/challengeTemplates"
import { syncPlanWithChallenge } from "@/lib/challenge-plan-sync"

type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

const WEEKDAYS: Array<{ key: Weekday; label: string; weekdayIndex: number }> = [
  { key: 'Mon', label: 'Monday', weekdayIndex: 1 },
  { key: 'Tue', label: 'Tuesday', weekdayIndex: 2 },
  { key: 'Wed', label: 'Wednesday', weekdayIndex: 3 },
  { key: 'Thu', label: 'Thursday', weekdayIndex: 4 },
  { key: 'Fri', label: 'Friday', weekdayIndex: 5 },
  { key: 'Sat', label: 'Saturday', weekdayIndex: 6 },
  { key: 'Sun', label: 'Sunday', weekdayIndex: 0 },
]

const ALL_WEEKDAYS: Weekday[] = WEEKDAYS.map((day) => day.key)

const DISTANCE_CHIPS = [
  { value: 5, label: '5K' },
  { value: 10, label: '10K' },
  { value: 21.1, label: 'Half' },
  { value: 42.2, label: 'Full' },
]

const WHEEL_ITEM_HEIGHT = 48
const WHEEL_VISIBLE_ITEMS = 5
const WHEEL_CENTER_OFFSET = Math.floor(WHEEL_VISIBLE_ITEMS / 2)

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatTimeHms(totalSeconds: number) {
  const seconds = clampNumber(Math.round(totalSeconds), 0, 99 * 3600)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getDefaultRaceTimeSeconds(distanceKm: number) {
  if (distanceKm === 5) return 30 * 60
  if (distanceKm === 10) return 58 * 60
  if (distanceKm === 21.1) return 2 * 60 * 60
  if (distanceKm === 42.2) return 4 * 60 * 60 + 30 * 60
  return 60 * 60
}

function getWeekdayLabel(day: Weekday) {
  return WEEKDAYS.find((d) => d.key === day)?.label || day
}

function selectTrainingDays(availableDays: Weekday[], daysPerWeek: number, longRunDay: Weekday): Weekday[] {
  const dayToIndex: Record<Weekday, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
  const indexToDay: Record<number, Weekday> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

  const availableSet = new Set(availableDays)
  const desired = Math.min(Math.max(daysPerWeek, 2), 6)
  const chosen = new Set<Weekday>()

  if (availableSet.has(longRunDay)) chosen.add(longRunDay)

  const candidates = availableDays
    .slice()
    .sort((a, b) => dayToIndex[a] - dayToIndex[b])

  const circularDistance = (a: number, b: number) => {
    const diff = Math.abs(a - b)
    return Math.min(diff, 7 - diff)
  }

  while (chosen.size < desired) {
    let best: Weekday | null = null
    let bestScore = -1

    for (const candidate of candidates) {
      if (chosen.has(candidate)) continue
      const candidateIndex = dayToIndex[candidate]
      const distances = Array.from(chosen).map((d) => circularDistance(candidateIndex, dayToIndex[d]))
      const minDistance = distances.length ? Math.min(...distances) : 7
      if (minDistance > bestScore) {
        bestScore = minDistance
        best = candidate
      }
    }

    if (!best) break
    chosen.add(best)
  }

  return Array.from(chosen)
    .map((d) => ({ d, idx: dayToIndex[d] }))
    .sort((a, b) => a.idx - b.idx)
    .map((x) => indexToDay[x.idx] ?? 'Sun')
}

function SelectCard(props: {
  selected: boolean
  onClick: () => void
  title: string
  subtitle?: string
  left?: ReactNode
  right?: ReactNode
}) {
  const { selected, onClick, title, subtitle, left, right } = props
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div
        className={cn(
          'relative overflow-hidden border rounded-3xl px-6 py-5 flex items-center justify-between shadow-lg transition-all duration-200 bg-gradient-to-br',
          selected
            ? 'border-primary/60 ring-2 ring-inset ring-primary/30 from-white/[0.18] via-white/[0.1] to-white/[0.04] text-white'
            : 'border-white/[0.15] hover:border-white/30 from-white/[0.08] via-white/[0.05] to-white/[0.02] text-white hover:from-white/[0.12]'
        )}
      >
        <div className="flex items-center gap-4">
          {left && (
            <div className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary/80">
              {left}
            </div>
          )}
          <div className="flex-1">
            <div className="text-lg font-medium">{title}</div>
            {subtitle && <div className="text-sm text-white/60 mt-1.5 leading-relaxed">{subtitle}</div>}
          </div>
        </div>
        {right && <div className="ml-4">{right}</div>}
      </div>
    </button>
  )
}

function WheelColumn(props: {
  value: number
  min: number
  max: number
  padTo2?: boolean
  suffix?: string
  ariaLabel: string
  onChange: (value: number) => void
}) {
  const { value, min, max, padTo2, suffix, ariaLabel, onChange } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const scrollTimeout = useRef<number | null>(null)
  const isUserScrolling = useRef(false)
  const isInitialized = useRef(false)

  const items = useMemo(() => {
    const values = Array.from({ length: max - min + 1 }, (_, idx) => min + idx)
    return [
      ...Array.from({ length: WHEEL_CENTER_OFFSET }).map(() => null),
      ...values,
      ...Array.from({ length: WHEEL_CENTER_OFFSET }).map(() => null),
    ]
  }, [min, max])

  const getScrollTopForValue = (val: number) => {
    const valueIndex = val - min
    return valueIndex * WHEEL_ITEM_HEIGHT
  }

  const getValueFromScrollTop = (scrollTop: number) => {
    const valueIndex = Math.round(scrollTop / WHEEL_ITEM_HEIGHT)
    return Math.min(max, Math.max(min, min + valueIndex))
  }

  useEffect(() => {
    if (isInitialized.current) return
    const container = ref.current
    if (!container) return
    container.scrollTop = getScrollTopForValue(value)
    isInitialized.current = true
  }, [])

  useEffect(() => {
    if (!isInitialized.current) return
    if (isUserScrolling.current) return
    const container = ref.current
    if (!container) return
    const targetScrollTop = getScrollTopForValue(value)
    if (Math.abs(container.scrollTop - targetScrollTop) > 2) {
      container.scrollTop = targetScrollTop
    }
  }, [value, min])

  const handleScroll = () => {
    isUserScrolling.current = true
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current)
    scrollTimeout.current = window.setTimeout(() => {
      const container = ref.current
      if (!container) return

      const newValue = getValueFromScrollTop(container.scrollTop)
      const snappedScrollTop = getScrollTopForValue(newValue)

      onChange(newValue)

      container.scrollTo({ top: snappedScrollTop, behavior: 'smooth' })

      setTimeout(() => {
        isUserScrolling.current = false
      }, 150)
    }, 100)
  }

  return (
    <div className="relative w-20">
      <div
        ref={ref}
        aria-label={ariaLabel}
        role="listbox"
        className="h-60 overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {items.map((item, idx) => {
          const isSelected = item === value
          return (
            <button
              key={`${ariaLabel}-${idx}`}
              type="button"
              className={cn(
                'w-full h-12 flex items-center justify-center text-xl transition',
                item === null ? 'opacity-0 pointer-events-none' : 'opacity-40',
                isSelected && 'opacity-100 font-semibold text-white'
              )}
              style={{ scrollSnapAlign: 'center' }}
              onClick={() => {
                if (typeof item !== 'number') return
                onChange(item)
                const container = ref.current
                if (container) {
                  container.scrollTo({ top: getScrollTopForValue(item), behavior: 'smooth' })
                }
              }}
            >
              {typeof item === 'number'
                ? `${padTo2 ? String(item).padStart(2, '0') : item}${suffix ?? ''}`
                : ''}
            </button>
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 rounded-lg border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[oklch(12%_0.02_255)] via-[oklch(12%_0.02_255/0.8)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[oklch(12%_0.02_255)] via-[oklch(12%_0.02_255/0.8)] to-transparent" />
    </div>
  )
}

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
      preferences: { daysPerWeek: 3, preferredTimes: ['morning'] } as any,
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
    setSelectedTimes(["morning"]);
    setDaysPerWeek(3);
    setLongRunDay('Sat');
    setRpe(null);
    setAge(null);
    setReferenceRaceDistance(10);
    setTimeSeeded(true);
    const resetSeconds = getDefaultRaceTimeSeconds(10);
    setReferenceRaceHours(Math.floor(resetSeconds / 3600));
    setReferenceRaceMinutes(Math.floor((resetSeconds % 3600) / 60));
    setReferenceRaceSeconds(resetSeconds % 60);
    setAverageWeeklyKm(null);
    setSkipWeeklyKm(false);
    setConsents({
      data: false,
      gdpr: false,
      push: false,
    });
    setSelectedChallenge(null);
    setIsGeneratingPlan(false);
    toast({
      title: "Onboarding Restarted",
      description: "The onboarding process has been reset. Please try again.",
    });
  };


  const [currentStep, setCurrentStep] = useState(1)
  const [selectedGoal, setSelectedGoal] = useState<string>("")
  const [selectedExperience, setSelectedExperience] = useState<string>("")
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["morning"])
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3)
  const [longRunDay, setLongRunDay] = useState<Weekday>('Sat')
  const [rpe, setRpe] = useState<number | null>(null)
  const [age, setAge] = useState<number | null>(null)
  const [referenceRaceDistance, setReferenceRaceDistance] = useState<number>(10)
  const [timeSeeded, setTimeSeeded] = useState(true)
  const [referenceRaceHours, setReferenceRaceHours] = useState<number>(() => {
    const initialSeconds = getDefaultRaceTimeSeconds(10)
    return Math.floor(initialSeconds / 3600)
  })
  const [referenceRaceMinutes, setReferenceRaceMinutes] = useState<number>(() => {
    const initialSeconds = getDefaultRaceTimeSeconds(10)
    return Math.floor((initialSeconds % 3600) / 60)
  })
  const [referenceRaceSeconds, setReferenceRaceSeconds] = useState<number>(() => {
    const initialSeconds = getDefaultRaceTimeSeconds(10)
    return initialSeconds % 60
  })
  const [averageWeeklyKm, setAverageWeeklyKm] = useState<number | null>(null)
  const [skipWeeklyKm, setSkipWeeklyKm] = useState(false)
  const [consents, setConsents] = useState({
    data: false,
    gdpr: false,
    push: false,
  })
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
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
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeTemplate | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedSlug = window.localStorage.getItem('preselectedChallenge')
    if (!storedSlug) return

    const template = getChallengeTemplateBySlug(storedSlug)
    if (template) {
      setSelectedChallenge(template)
    }
  }, [])

  const defaultRaceSeconds = useMemo(
    () => getDefaultRaceTimeSeconds(referenceRaceDistance),
    [referenceRaceDistance]
  )
  const referenceRaceTimeSeconds = referenceRaceHours * 3600 + referenceRaceMinutes * 60 + referenceRaceSeconds

  useEffect(() => {
    if (!timeSeeded) return
    setReferenceRaceHours(Math.floor(defaultRaceSeconds / 3600))
    setReferenceRaceMinutes(Math.floor((defaultRaceSeconds % 3600) / 60))
    setReferenceRaceSeconds(defaultRaceSeconds % 60)
  }, [defaultRaceSeconds, timeSeeded])

  const totalSteps = 6
  const progressPercent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100)

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
      trackStepProgression(currentStep - 1, `step_${currentStep - 1}`, 'backward')
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    const canProceedResult = (() => {
      switch (currentStep) {
        case 1:
          return selectedGoal !== ""
        case 2:
          return selectedExperience !== ""
        case 3:
          return age !== null && age >= 10 && age <= 100
        case 4:
          return referenceRaceTimeSeconds > 0
        case 5:
          return daysPerWeek >= 2 && Boolean(longRunDay)
        case 6:
          return privacyAccepted
        default:
          return true
      }
    })()

    // Track validation errors
    if (!canProceedResult) {
      const getValidationError = () => {
        switch (currentStep) {
          case 1:
            return { field: 'goal', message: 'Goal selection is required' }
          case 2:
            return { field: 'experience', message: 'Experience level is required' }
          case 3:
            return { field: 'age', message: 'Valid age (10-100) is required' }
          case 4:
            return { field: 'referenceRace', message: 'Enter your current race time' }
          case 5:
            return { field: 'schedule', message: 'Select your training days and long run day' }
          case 6:
            return { field: 'privacy', message: 'Please accept the privacy policy to continue' }
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

  const getValidationMessage = (step: number): string => {
    switch (step) {
      case 1:
        return "Please select your running goal to continue"
      case 2:
        return "Please tell us about your running experience"
      case 3:
        return "Age helps us personalize your training"
      case 4:
        return "Enter your current race time to continue"
      case 5:
        return "Select your training days and long run day"
      case 6:
        return "Please accept the privacy policy to continue"
      default:
        return "Please complete all required fields"
    }
  }

  const isStepValid = canProceed()
  const isFinalStep = currentStep === totalSteps
  const isActionDisabled = !isStepValid || (isFinalStep && isGeneratingPlan)

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
    if (Array.isArray(profile.preferredTimes) && profile.preferredTimes.length > 0) {
      setSelectedTimes(profile.preferredTimes)
    }
    if (typeof profile.daysPerWeek === "number") {
      const normalizedDays = clampNumber(profile.daysPerWeek, 2, 6)
      setDaysPerWeek(normalizedDays)
    }
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

        const availableDays = ALL_WEEKDAYS
        const trainingDays = selectTrainingDays(availableDays, daysPerWeek, longRunDay)
        const planPreferences = {
          availableDays,
          trainingDays,
          longRunDay,
          currentRaceTimeSeconds: referenceRaceTimeSeconds,
        }

        // Prepare form data
        const formData = {
          goal: selectedGoal,
          experience: selectedExperience,
          selectedTimes,
          daysPerWeek,
          rpe,
          age,
          averageWeeklyKm,
          consents,
          privacySettings,
          planPreferences,
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
          privacySettings: formData.privacySettings,
          planPreferences: formData.planPreferences as any
        }, { artificialDelayMs: 300 })
        console.log('✅ Atomic commit complete:', { userId, planId })

        // If a challenge was selected, start the challenge
          if (selectedChallenge) {
            try {
              console.log('🏆 Starting challenge:', selectedChallenge.name)
              const { startChallenge } = await import('@/lib/challengeEngine')
              await startChallenge(userId, selectedChallenge.slug, planId)
              console.log('✅ Challenge started successfully')
            } catch (challengeError) {
              console.warn('⚠️ Failed to start challenge:', challengeError)
              // Non-critical error, continue with onboarding
            }
          }

          if (typeof window !== 'undefined') {
            localStorage.removeItem('preselectedChallenge')
          }

          // Save reference race data for pace zone calculations
          if (referenceRaceTimeSeconds > 0) {
          try {
            await setReferenceRace(userId, referenceRaceDistance, referenceRaceTimeSeconds)
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

              if (selectedChallenge) {
                const syncResult = await syncPlanWithChallenge(userId, planId, selectedChallenge)
                clearTimeout(timeoutId)
                aiPlanGenerated = syncResult.planUpdated

                if (!syncResult.planUpdated) {
                  console.warn('Challenge plan sync failed:', syncResult.error)
                }
              } else {
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
                  console.log('AI plan generated successfully:', planData);

                  // Update the plan with AI-generated workouts
                  if (planData.plan && planData.plan.workouts) {
                    await dbUtils.updatePlanWithAIWorkouts(planId, planData.plan);
                    console.log('Plan updated with AI workouts');
                    aiPlanGenerated = true;
                  }
                } else {
                  const errorData = await planResponse.json().catch(() => ({}));
                  console.warn('AI plan generation failed:', {
                    status: planResponse.status,
                    error: errorData
                  });

                  // Check if it is an API key issue
                  if (planResponse.status === 503 || errorData.fallbackRequired) {
                    console.log('AI service unavailable - using default plan template');
                    toast({
                      title: "Using Default Plan",
                      description: "AI coach is currently unavailable. We have created a great starter plan for you!",
                      variant: "default"
                    });
                  }
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
      // User can retry by clicking "Complete Setup" again
    }
  }


  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="pt-2 space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold leading-tight">What is your main goal?</h2>
              <p className="text-white/60 text-sm">Choose the focus that fits your next milestone.</p>
            </div>

            <div className="space-y-3">
              {[
                { id: "habit", icon: Calendar, title: "Build a running habit", desc: "Start with consistency" },
                { id: "distance", icon: Route, title: "Run longer distances", desc: "Train for 5K, 10K, or more" },
                { id: "speed", icon: Gauge, title: "Improve speed", desc: "Beat your personal best" },
              ].map((goal) => (
                <SelectCard
                  key={goal.id}
                  selected={selectedGoal === goal.id}
                  onClick={() => setSelectedGoal(goal.id)}
                  title={goal.title}
                  subtitle={goal.desc}
                  left={<goal.icon className="h-5 w-5" />}
                />
              ))}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="pt-2 space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold leading-tight">Running experience</h2>
              <p className="text-white/60 text-sm">Let us match the plan to your current rhythm.</p>
            </div>
            <div className="space-y-3">
              {[
                { id: "beginner", title: "Beginner", desc: "New to running", icon: TrendingUp },
                { id: "occasional", title: "Occasional", desc: "Run sometimes", icon: TrendingUp },
                { id: "regular", title: "Regular", desc: "Run weekly", icon: TrendingUp },
              ].map((exp) => (
                <SelectCard
                  key={exp.id}
                  selected={selectedExperience === exp.id}
                  onClick={() => setSelectedExperience(exp.id)}
                  title={exp.title}
                  subtitle={exp.desc}
                  left={<exp.icon className="h-5 w-5" />}
                />
              ))}
            </div>
            {selectedExperience === "regular" && (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Average weekly km</h3>
                  <p className="text-white/60 text-sm">
                    This helps us set your starting training volume.
                  </p>
                </div>
                <input
                  type="number"
                  placeholder="e.g., 30"
                  value={averageWeeklyKm !== null ? averageWeeklyKm : ""}
                  onChange={(e) => setAverageWeeklyKm(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-white placeholder:text-white/40"
                  min="5"
                  max="200"
                  disabled={skipWeeklyKm}
                />
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <input
                    type="checkbox"
                    id="skipWeeklyKm"
                    checked={skipWeeklyKm}
                    onChange={(e) => {
                      setSkipWeeklyKm(e.target.checked)
                      if (e.target.checked) setAverageWeeklyKm(null)
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor="skipWeeklyKm">I am not sure</label>
                </div>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="pt-2 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold leading-tight">How old are you?</h2>
              <p className="text-white/60 text-sm">This helps us personalize your plan.</p>
            </div>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Enter your age"
                value={age !== null ? age : ''}
                onChange={(e) => setAge(parseInt(e.target.value) || null)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg text-white placeholder:text-white/40"
                min="10"
                max="100"
                aria-label="Your age"
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="pt-2 space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">
                  What is your estimated current race time?
                </h2>
                <p className="text-white/60 mt-3 leading-relaxed text-sm">
                  Choose a time reflective of your current fitness level.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/50 hover:text-white/80 hover:bg-white/5 shrink-0"
                aria-label="Help"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {DISTANCE_CHIPS.map((chip) => {
                const active = referenceRaceDistance === chip.value
                return (
                  <Button
                    key={chip.value}
                    type="button"
                    onClick={() => {
                      setTimeSeeded(true)
                      setReferenceRaceDistance(chip.value)
                    }}
                    className={cn(
                      'h-10 rounded-full px-4 shrink-0 text-sm font-medium border transition-all duration-200',
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 hover:bg-primary/90'
                        : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
                    )}
                  >
                    {chip.label}
                  </Button>
                )
              })}
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <WheelColumn
                value={referenceRaceHours}
                min={0}
                max={10}
                suffix="h"
                ariaLabel="Hours"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setReferenceRaceHours(value)
                }}
              />
              <div className="text-2xl -mt-1 text-white/40">:</div>
              <WheelColumn
                value={referenceRaceMinutes}
                min={0}
                max={59}
                padTo2
                suffix="m"
                ariaLabel="Minutes"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setReferenceRaceMinutes(value)
                }}
              />
              <div className="text-2xl -mt-1 text-white/40">:</div>
              <WheelColumn
                value={referenceRaceSeconds}
                min={0}
                max={59}
                padTo2
                suffix="s"
                ariaLabel="Seconds"
                onChange={(value) => {
                  setTimeSeeded(false)
                  setReferenceRaceSeconds(value)
                }}
              />
            </div>

            <div className="text-center text-white/60 text-sm pt-3 leading-relaxed">
              I can currently run a{' '}
              <span className="text-primary font-medium">
                {DISTANCE_CHIPS.find((chip) => chip.value === referenceRaceDistance)?.label ?? `${referenceRaceDistance}K`}
              </span>{' '}
              in <span className="text-white font-semibold">{formatTimeHms(referenceRaceTimeSeconds)}</span>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="pt-2 space-y-10">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-semibold leading-tight">How many days per week would you like to run?</h2>
                  <p className="text-white/60 mt-3 leading-relaxed text-sm">
                    Pick a sustainable weekly rhythm.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/50 hover:text-white/80 hover:bg-white/5 shrink-0"
                  aria-label="Help"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-4">
                {[2, 3, 4, 5, 6].map((n) => (
                  <SelectCard
                    key={n}
                    selected={daysPerWeek === n}
                    onClick={() => setDaysPerWeek(n)}
                    title={`${n} days`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-semibold leading-tight">Which day do you want to do your long runs on?</h2>
                  <p className="text-white/60 mt-3 leading-relaxed text-sm">Choose one to continue</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/50 hover:text-white/80 hover:bg-white/5 shrink-0"
                  aria-label="Help"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-3.5">
                {WEEKDAYS.map((day) => (
                  <SelectCard
                    key={day.key}
                    selected={longRunDay === day.key}
                    onClick={() => setLongRunDay(day.key)}
                    title={day.label}
                  />
                ))}
              </div>
            </div>
          </div>
        )

      case 6:
        const distanceLabel =
          referenceRaceDistance === 21.1
            ? 'Half Marathon'
            : referenceRaceDistance === 42.2
              ? 'Marathon'
              : `${referenceRaceDistance}K`

        return (
          <div className="pt-2 space-y-8" role="region" aria-label="Summary and confirmation">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-2xl font-semibold">Summary and confirmation</h2>
              <p className="text-white/60 text-sm">Confirm everything looks right before we build your plan.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <ul className="space-y-3 text-sm text-white/70">
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Goal</span>
                  <span className="text-white font-medium">{selectedGoal || 'Not set'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Experience</span>
                  <span className="text-white font-medium">{selectedExperience || 'Not set'}</span>
                </li>
                {selectedExperience === "regular" && (
                  <li className="flex items-center justify-between">
                    <span className="text-white/50">Weekly volume</span>
                    <span className="text-white font-medium">
                      {averageWeeklyKm ? `${averageWeeklyKm} km/week` : 'Not provided'}
                    </span>
                  </li>
                )}
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Age</span>
                  <span className="text-white font-medium">{age !== null ? age : 'Not provided'}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Current race time</span>
                  <span className="text-white font-medium">
                    {distanceLabel} in {formatTimeHms(referenceRaceTimeSeconds)}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Days per week</span>
                  <span className="text-white font-medium">{daysPerWeek}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-white/50">Long run day</span>
                  <span className="text-white font-medium">{getWeekdayLabel(longRunDay)}</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <input
                type="checkbox"
                id="privacy-policy"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <label htmlFor="privacy-policy" className="text-sm text-white/80 leading-relaxed cursor-pointer select-none">
                I have read and agree to the{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline underline-offset-2 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
                . I understand that my running data is stored locally on my device.
              </label>
            </div>
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
      <div className="relative min-h-screen bg-[oklch(16%_0.02_255)] text-white flex flex-col">
        {/* Header */}
        <div className="px-4 pb-3 pt-4 relative z-10" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/5 -ml-2"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 flex items-center justify-center">
                <div className="h-1 w-40 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="w-9" />
            </div>
            {!isOnline && (
              <p className="mt-3 text-xs text-amber-400">Working in offline mode</p>
            )}
          </div>

        <div className={cn("flex-1 overflow-y-auto relative z-10", "px-4 pb-4")}>
          {renderStep()}

          {!isStepValid && currentStep > 1 && (
            <div className="mt-6 flex items-center gap-2 text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {getValidationMessage(currentStep)}
            </div>
          )}
        </div>

        <div
          className={cn(
            "px-6 pt-3 relative z-10",
            "bg-[oklch(12%_0.02_255)] px-8"
          )}
          style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
        >
          <Button
            type="button"
            className={cn(
              "w-full font-semibold rounded-2xl transition-all duration-200 shadow-lg",
              "h-[58px] text-xl font-bold bg-white text-neutral-950 hover:bg-white/95 hover:shadow-2xl hover:scale-[1.02] active:scale-100"
            )}
            onClick={isFinalStep ? handleComplete : nextStep}
            disabled={isActionDisabled}
          >
            {isFinalStep ? (isGeneratingPlan ? "Completing..." : "Complete setup") : "Continue"}
          </Button>
        </div>
      </div>
    </OnboardingErrorBoundary>
  )
}

