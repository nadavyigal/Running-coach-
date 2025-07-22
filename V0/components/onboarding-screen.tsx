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
import { planAdjustmentService } from "@/lib/planAdjustmentService"
import { OnboardingChatOverlay } from "@/components/onboarding-chat-overlay"
import { onboardingManager } from "@/lib/onboardingManager"

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
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
  const [aiGeneratedProfile, setAiGeneratedProfile] = useState<any>(null)
  const { toast } = useToast()

  const totalSteps = 8

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleChatOverlayComplete = (goals: any[], userProfile: any) => {
    setAiGeneratedProfile(userProfile)
    
    // Update form state with AI-generated data
    if (userProfile.goal) {
      setSelectedGoal(userProfile.goal)
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

  const canProceed = () => {
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
  }

  const handleTimeSlotToggle = (time: string) => {
    setSelectedTimes((prev) => (prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]))
  }

  const handleComplete = async () => {
    setIsGeneratingPlan(true)
    
    try {
      console.log('=== ONBOARDING FINISH START ===')
      
      // Step 1: Migrate existing localStorage data first
      console.log('📋 Step 1: Migrating localStorage data...')
      await dbUtils.migrateFromLocalStorage()
      console.log('✅ localStorage migration completed')
      
      // Step 2: Create user through OnboardingManager
      console.log('📋 Step 2: Creating user via OnboardingManager...')
      const formData = {
        goal: selectedGoal as 'habit' | 'distance' | 'speed',
        experience: selectedExperience === 'occasional' 
          ? 'intermediate' 
          : selectedExperience === 'regular'
          ? 'advanced'
          : selectedExperience as 'beginner' | 'intermediate' | 'advanced',
        selectedTimes: selectedTimes.length > 0 ? selectedTimes : ['morning'],
        daysPerWeek: daysPerWeek[0],
        rpe,
        age,
        consents
      }
      
      console.log('Form data:', formData)
      const onboardingResult = await onboardingManager.completeFormOnboarding(formData)
      
      if (!onboardingResult.success) {
        throw new Error(onboardingResult.errors?.join(', ') || 'Failed to complete onboarding')
      }
      
      console.log('✅ User and plan created successfully via OnboardingManager:', {
        userId: onboardingResult.user.id,
        planId: onboardingResult.planId
      })

      // Initialize plan adjustment service
      console.log('📋 Step 3: Initializing plan adjustment service...')
      planAdjustmentService.init(onboardingResult.user.id!)
      console.log('✅ Plan adjustment service initialized')
      
      // Step 4: Track completion event
      console.log('📋 Step 4: Tracking completion event...')
      const goalDist = selectedGoal === 'distance' ? 5 : 0
      trackEngagementEvent('onboard_complete', { rookieChallenge: true, age: age ?? 0, goalDist })
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
            
            {/* AI Chat Option */}
            <Card className="border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-800 dark:text-green-200">Get AI Guidance</h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Chat with our AI coach to discover your perfect running goals
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
            
            {aiGeneratedProfile && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
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
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 p-4 flex flex-col">
      <div className="text-center mb-8 pt-8">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
          <Running className="h-8 w-8" />
          Run-Smart
        </h1>
        <p className="text-white/80">Your AI Running Coach</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5, 6, 7].map((step) => (
            <div
              key={step}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep ? "bg-white text-green-500" : "bg-white/30 text-white"
              }`}
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
    </div>
  )
}
