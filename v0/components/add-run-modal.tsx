"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import {
  FootprintsIcon as Walking,
  Zap,
  Timer,
  Mountain,
  Route,
  Clock,
  Flag,
  Trees,
  Dumbbell,
  Activity,
  StretchVerticalIcon as Stretch,
  CalendarIcon,
  Bot,
  ChevronDown,
  Play,
  ArrowLeft,
  RefreshCw,
} from "lucide-react"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { useToast } from "@/hooks/use-toast"

interface AddRunModalProps {
  isOpen: boolean
  onClose: () => void
}

interface WorkoutType {
  id: string
  name: string
  icon: any
  color: string
  bgColor: string
  description: string
  tips: string[]
  defaultDistance: number
  defaultDuration: number
}

const workoutTypes: WorkoutType[] = [
  {
    id: "easy",
    name: "Easy Run",
    icon: Walking,
    color: "from-green-400 to-green-600",
    bgColor: "from-green-500 to-green-400",
    description: "Comfortable pace, conversational effort",
    tips: [
      "Keep a pace where you can hold a conversation",
      "Focus on building aerobic base",
      "Should feel relaxed and sustainable",
    ],
    defaultDistance: 5,
    defaultDuration: 30,
  },
  {
    id: "tempo",
    name: "Tempo",
    icon: Zap,
    color: "from-orange-400 to-orange-600",
    bgColor: "from-orange-500 to-orange-400",
    description: "Comfortably hard, sustained effort",
    tips: ["Run at your lactate threshold pace", "Should feel 'comfortably hard'", "Great for improving race pace"],
    defaultDistance: 6,
    defaultDuration: 35,
  },
  {
    id: "intervals",
    name: "Intervals",
    icon: Timer,
    color: "from-pink-400 to-pink-600",
    bgColor: "from-pink-500 to-pink-400",
    description: "High intensity with recovery periods",
    tips: [
      "Alternate between hard efforts and recovery",
      "Focus on maintaining form when tired",
      "Great for improving VO2 max",
    ],
    defaultDistance: 8,
    defaultDuration: 45,
  },
  {
    id: "hills",
    name: "Hills",
    icon: Mountain,
    color: "from-green-500 to-green-700",
    bgColor: "from-purple-500 to-purple-400",
    description: "Uphill training for strength",
    tips: ["Lean slightly forward on uphills", "Use shorter, quicker steps", "Great for building leg strength"],
    defaultDistance: 5,
    defaultDuration: 35,
  },
  {
    id: "long",
    name: "Long Run",
    icon: Route,
    color: "from-blue-400 to-blue-600",
    bgColor: "from-blue-500 to-blue-400",
    description: "Extended distance at easy pace",
    tips: [
      "Start slow and maintain steady effort",
      "Focus on time on feet, not speed",
      "Builds endurance and mental toughness",
    ],
    defaultDistance: 12,
    defaultDuration: 75,
  },
  {
    id: "race",
    name: "Race",
    icon: Flag,
    color: "from-red-400 to-red-600",
    bgColor: "from-red-500 to-red-400",
    description: "Competitive event",
    tips: ["Taper training before race day", "Plan your race strategy", "Trust your training on race day"],
    defaultDistance: 10,
    defaultDuration: 50,
  },
  {
    id: "parkrun",
    name: "parkrun",
    icon: Trees,
    color: "from-teal-400 to-teal-600",
    bgColor: "from-teal-500 to-teal-400",
    description: "5K community run event",
    tips: ["Arrive early to register", "Great for regular fitness testing", "Enjoy the community atmosphere"],
    defaultDistance: 5,
    defaultDuration: 25,
  },
]

const strengthWorkouts = [
  {
    id: "strength",
    name: "Strength",
    icon: Dumbbell,
    color: "from-gray-400 to-gray-600",
    description: "Resistance training for runners",
    defaultDuration: 45,
  },
  {
    id: "pilates",
    name: "Pilates",
    icon: Activity,
    color: "from-cyan-400 to-cyan-600",
    description: "Core strength and flexibility",
    defaultDuration: 60,
  },
  {
    id: "mobility",
    name: "Mobility",
    icon: Stretch,
    color: "from-emerald-400 to-emerald-600",
    description: "Stretching and movement prep",
    defaultDuration: 30,
  },
]

export function AddRunModal({ isOpen, onClose }: AddRunModalProps) {
  const [step, setStep] = useState<"select" | "configure" | "approve">("select")
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState<string>("")
  const [showCollapsed, setShowCollapsed] = useState(true)
  const [selectedGoal, setSelectedGoal] = useState<"distance" | "duration">("distance")
  const [targetValue, setTargetValue] = useState("5.0")
  const [selectedDifficulty, setSelectedDifficulty] = useState("open")
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [planEndDate, setPlanEndDate] = useState<Date | undefined>(undefined)
  const [planStartDate, setPlanStartDate] = useState<Date | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const { toast } = useToast()

  // Load plan data for calendar validation when modal opens
  useEffect(() => {
    if (isOpen && step === "configure") {
      loadPlanData()
    }
  }, [isOpen, step])

  // Load plan data for calendar validation
  const loadPlanData = async () => {
    try {
      const { dbUtils } = await import('@/lib/dbUtils')
      const user = await dbUtils.getCurrentUser()
      if (user && user.id) {
        const plan = await dbUtils.ensureUserHasActivePlan(user.id)
        if (plan) {
          setPlanStartDate(new Date(plan.startDate))
          setPlanEndDate(new Date(plan.endDate))
        }
      }
    } catch (error) {
      console.error("Failed to load plan data for calendar:", error)
    }
  }

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setIsCalendarOpen(false) // Close calendar after selection
    }
  }

  // Function to check if a date should be disabled in the calendar
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Disable dates before today (past dates)
    if (normalizedDate < today) {
      return true;
    }

    // Disable dates after plan end date if plan is loaded
    if (planEndDate) {
      const planEnd = new Date(planEndDate);
      planEnd.setHours(0, 0, 0, 0);
      if (normalizedDate > planEnd) {
        return true;
      }
    }

    return false;
  }

  const presetDistances = [
    { label: "5k", value: "5.0" },
    { label: "10k", value: "10.0" },
    { label: "15k", value: "15.0" },
    { label: "Half Marathon", value: "21.1" },
  ]

  const presetDurations = [
    { label: "10min", value: "10" },
    { label: "30min", value: "30" },
    { label: "45min", value: "45" },
    { label: "60min", value: "60" },
  ]

  const difficulties = [
    { id: "open", label: "Open", description: "Range of difficulty suggestions" },
    { id: "easy", label: "Easy", description: "Comfortable effort" },
    { id: "medium", label: "Medium", description: "Moderate challenge" },
  ]

  const handleWorkoutSelect = (workout: WorkoutType) => {
    setSelectedWorkout(workout)
    setTargetValue(
      selectedGoal === "distance" ? workout.defaultDistance.toString() : workout.defaultDuration.toString(),
    )
    setStep("configure")
  }

  const generateWorkoutDescription = async () => {
    if (!selectedWorkout) return

    setIsGenerating(true)
    try {
      const { text } = await generateText({
        model: openai("gpt-4o"),
        system: `You are an expert running coach. Create a detailed workout breakdown for a ${selectedWorkout.name} run. 
        
        Format your response as a JSON object with this structure:
        {
          "title": "Workout Name",
          "description": "Brief description",
          "duration": "estimated time range",
          "phases": [
            {
              "phase": "Warm-up",
              "color": "bg-gray-500",
              "steps": [
                {
                  "step": 1,
                  "description": "detailed instruction",
                  "detail": "additional guidance (optional)",
                  "type": "RUN"
                }
              ]
            }
          ]
        }
        
        Include warm-up, main workout, and cool-down phases. Make it specific to the workout type and difficulty level.`,
        prompt: `Create a ${selectedWorkout.name} workout for ${selectedGoal === "distance" ? targetValue + "km" : targetValue + " minutes"} at ${selectedDifficulty} difficulty level. The workout should be appropriate for a ${selectedWorkout.description}.`,
      })

      const workoutData = JSON.parse(text)
      setGeneratedWorkout(workoutData)
      setStep("approve")
    } catch (error) {
      console.error("Error generating workout:", error)
      // Fallback workout
      setGeneratedWorkout({
        title: `${selectedWorkout.name} Workout`,
        description: selectedWorkout.description,
        duration: "30-45 min",
        phases: [
          {
            phase: "Warm-up",
            color: "bg-gray-500",
            steps: [
              {
                step: 1,
                description: "10 minutes easy pace",
                detail: "Build up gradually",
                type: "RUN",
              },
            ],
          },
          {
            phase: "Main Workout",
            color: selectedWorkout.id === "tempo" ? "bg-orange-500" : "bg-green-500",
            steps: [
              {
                step: 2,
                description: `${selectedGoal === "distance" ? targetValue + "km" : targetValue + " minutes"} at ${selectedWorkout.name.toLowerCase()} pace`,
                type: "RUN",
              },
            ],
          },
          {
            phase: "Cool Down",
            color: "bg-gray-500",
            steps: [
              {
                step: 3,
                description: "10 minutes easy pace",
                detail: "Gradually slow down",
                type: "RUN",
              },
            ],
          },
        ],
      })
      setStep("approve")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedWorkout || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a workout type and date",
      })
      return
    }

    try {
      // Import database utilities
      const { dbUtils } = await import('@/lib/dbUtils')
      
      // Get current user
      const user = await dbUtils.getCurrentUser()
      if (!user || !user.id) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "User not found. Please complete onboarding first.",
        })
        return
      }

      // Ensure user has an active plan (with automatic recovery)
      let activePlan
      try {
        activePlan = await dbUtils.ensureUserHasActivePlan(user.id)
        
        // Debug logging for plan data
        console.log("🔍 Active plan data:", {
          id: activePlan.id,
          title: activePlan.title,
          startDate: activePlan.startDate,
          endDate: activePlan.endDate,
          totalWeeks: activePlan.totalWeeks
        })
        
        // Set plan end date for calendar validation
        
        // Check if this was a recovered/created plan
        const wasRecovered = activePlan.title.includes("Recovery") || activePlan.title.includes("Quick Start")
        if (wasRecovered) {
          toast({
            title: "Training Plan Ready! 🎯",
            description: "We've set up a training plan for you. You can customize it later in settings.",
          })
        }
        
      } catch (error) {
        const errorInfo = dbUtils.handlePlanError(error, 'creation/recovery')
        toast({
          variant: "destructive",
          title: errorInfo.title,
          description: errorInfo.description,
        })
        return
      }

      // Calculate week number based on plan start date and selected date
      const planStartDate = new Date(activePlan.startDate)
      const selectedDateTime = new Date(selectedDate)
      const daysDiff = Math.floor((selectedDateTime.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))
      const weekNumber = Math.floor(daysDiff / 7) + 1

      // Debug logging for date calculations
      console.log("🔍 Date calculations:", {
        planStartDate: planStartDate.toISOString(),
        selectedDateTime: selectedDateTime.toISOString(),
        daysDiff,
        weekNumber,
        planEndDate: activePlan.endDate.toISOString(),
        isWithinPlanRange: selectedDateTime >= planStartDate && selectedDateTime <= activePlan.endDate
      })

      // Get day of week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
      const idx = selectedDateTime.getDay()
      const dayOfWeek: string = dayNames[idx] ?? 'Mon'

      const workoutData: any = {
        planId: activePlan.id!,
        week: weekNumber,
        day: dayOfWeek,
        type: selectedWorkout.id as any,
        distance: selectedGoal === 'distance' ? Number.parseFloat(targetValue) : 0,
        notes: notes || generatedWorkout?.description || selectedWorkout.description,
        completed: false,
        scheduledDate: selectedDateTime
      }
      if (selectedGoal === 'duration') {
        workoutData.duration = Number.parseFloat(targetValue)
      }

      // Save workout to database
      const workoutId = await dbUtils.createWorkout(workoutData)

      toast({
        title: "Workout Scheduled! \ud83c\udf89",
        description: `${selectedWorkout.name} added to your ${selectedDate.toLocaleDateString()} plan`,
      })

      // Reset and close
      setStep("select")
      setSelectedWorkout(null)
      setTargetValue("5.0")
      setSelectedDifficulty("open")
      setSelectedGoal("distance")
      setNotes("")
      setGeneratedWorkout(null)
      onClose()
      
      // Trigger a page refresh to show the new workout
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('Failed to save workout:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save workout. Please try again.",
      })
    }
  }

  const handleAmendGoals = () => {
    setStep("configure")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {step === "select" && "Add run"}
              {step === "configure" && `Configure ${selectedWorkout?.name}`}
              {step === "approve" && "Review Workout"}
            </DialogTitle>
            {step === "select" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCollapsed(!showCollapsed)}
                className="text-gray-600"
                aria-label={showCollapsed ? "Collapse workout options" : "Expand workout options"}
                aria-expanded={!showCollapsed}
              >
                {showCollapsed ? "COLLAPSE" : "EXPAND"}
                <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showCollapsed ? "" : "rotate-180"}`} aria-hidden="true" />
              </Button>
            )}
            {(step === "configure" || step === "approve") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setStep(step === "configure" ? "select" : "configure")}
                aria-label="Go back to previous step"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {workoutTypes.map((workout) => (
                <Card
                  key={workout.id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
                  onClick={() => handleWorkoutSelect(workout)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${workout.name} workout - ${workout.description}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleWorkoutSelect(workout);
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div
                      className={`w-full h-16 bg-gradient-to-r ${workout.color} rounded-lg flex items-center justify-center mb-2 relative overflow-hidden`}
                    >
                      <workout.icon className="h-6 w-6 text-white z-10" aria-hidden="true" />
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-white rounded-full translate-x-2 -translate-y-2" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 bg-white rounded-full -translate-x-1 translate-y-1" />
                      </div>
                    </div>
                    <h4 className="font-medium text-sm text-center">{workout.name}</h4>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!showCollapsed && (
              <div className="animate-in slide-in-from-top duration-300">
                <div className="text-sm text-gray-600 mb-4">Workout</div>
                <div className="grid grid-cols-3 gap-3">
                  {strengthWorkouts.map((workout) => (
                    <Card key={workout.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div
                          className={`w-full h-16 bg-gradient-to-r ${workout.color} rounded-lg flex items-center justify-center mb-2`}
                        >
                          <workout.icon className="h-6 w-6 text-white" role="img" aria-label={workout.name} />
                        </div>
                        <h4 className="font-medium text-sm text-center">{workout.name}</h4>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Coach Tip */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <img
                      src="/placeholder.svg?height=40&width=40"
                      alt="Coach"
                      className="w-full h-full object-cover bg-green-500"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">Let's keep your progress going</h4>
                    <p className="text-sm text-blue-800">Missed workouts? Skip or add them to this week.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Record Workout Button */}
            <Button className="w-full bg-black hover:bg-gray-800 text-white h-12 text-lg font-medium">
              <Clock className="h-5 w-5 mr-2" aria-hidden="true" />
              Record workout
            </Button>
          </div>
        )}

        {step === "configure" && selectedWorkout && (
          <div className="space-y-6">
            {/* Workout Type Banner */}
            <Card className={`bg-gradient-to-r ${selectedWorkout.color} text-white`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <selectedWorkout.icon className="h-8 w-8" />
                  <div>
                    <h3 className="font-bold text-lg">{selectedWorkout.name}</h3>
                    <p className="text-white/90 text-sm">{selectedWorkout.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goal Selection with Dynamic Color */}
            <Card className={`bg-gradient-to-br ${selectedWorkout.bgColor} text-white relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16" />
                <div className="absolute top-10 right-0 w-24 h-24 bg-white rounded-full translate-x-12 -translate-y-12" />
              </div>
              <CardContent className="p-4 relative">
                <h3 className="font-bold text-lg mb-3">Select target goal</h3>

                {/* Goal Type Toggle */}
                <div className="flex bg-white/20 rounded-full p-1 mb-4">
                  <Button
                    variant={selectedGoal === "distance" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 rounded-full text-xs ${selectedGoal === "distance" ? "bg-white text-gray-800" : "text-white hover:bg-white/10"}`}
                    onClick={() => {
                      setSelectedGoal("distance")
                      setTargetValue(selectedWorkout.defaultDistance.toString())
                    }}
                  >
                    DISTANCE
                  </Button>
                  <Button
                    variant={selectedGoal === "duration" ? "default" : "ghost"}
                    size="sm"
                    className={`flex-1 rounded-full text-xs ${selectedGoal === "duration" ? "bg-white text-gray-800" : "text-white hover:bg-white/10"}`}
                    onClick={() => {
                      setSelectedGoal("duration")
                      setTargetValue(selectedWorkout.defaultDuration.toString())
                    }}
                  >
                    DURATION
                  </Button>
                </div>

                {/* Value Display */}
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold">
                    {targetValue}
                    <span className="text-lg ml-1">{selectedGoal === "distance" ? "KM" : "MIN"}</span>
                  </div>
                </div>

                {/* Preset Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(selectedGoal === "distance" ? presetDistances : presetDurations).map((preset) => (
                    <Button
                      key={preset.value}
                      variant="outline"
                      size="sm"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs"
                      onClick={() => setTargetValue(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Difficulty Selection */}
                <div className="grid grid-cols-3 gap-2">
                  {difficulties.map((difficulty) => (
                    <Button
                      key={difficulty.id}
                      variant={selectedDifficulty === difficulty.id ? "default" : "outline"}
                      size="sm"
                      className={`h-12 flex flex-col items-center justify-center text-xs ${
                        selectedDifficulty === difficulty.id
                          ? "bg-white text-gray-800"
                          : "bg-white/10 border-white/30 text-white hover:bg-white/20"
                      }`}
                      onClick={() => setSelectedDifficulty(difficulty.id)}
                    >
                      <div className="text-xs mb-1">⛰️</div>
                      <span className="font-medium">{difficulty.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Date Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">When do you want to run?</Label>
              {planStartDate && planEndDate && (
                <p className="text-sm text-muted-foreground">
                  Select a date between {format(planStartDate, "MMM d")} and {format(planEndDate, "MMM d, yyyy")}
                </p>
              )}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    autoFocus
                    disabled={isDateDisabled}
                    startMonth={new Date()}
                    endMonth={planEndDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any specific goals, route preferences, or reminders..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Generate Workout Button */}
            <Button
              onClick={generateWorkoutDescription}
              disabled={isGenerating}
              className="w-full bg-green-500 hover:bg-green-600 h-12"
              aria-describedby={isGenerating ? "generating-status" : undefined}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" aria-hidden="true" />
                  Generating Workout...
                </>
              ) : (
                <>
                  <Bot className="h-5 w-5 mr-2" aria-hidden="true" />
                  Generate Workout Plan
                </>
              )}
            </Button>
            {isGenerating && (
              <div id="generating-status" aria-live="polite" className="sr-only">
                Generating workout plan, please wait...
              </div>
            )}
          </div>
        )}

        {step === "approve" && generatedWorkout && selectedWorkout && (
          <div className="space-y-6">
            {/* Generated Workout Header */}
            <Card className={`bg-gradient-to-r ${selectedWorkout.color} text-white`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <selectedWorkout.icon className="h-8 w-8" />
                  <div>
                    <h3 className="font-bold text-lg">{generatedWorkout.title}</h3>
                    <p className="text-white/90 text-sm">{generatedWorkout.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">{generatedWorkout.duration}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workout Breakdown */}
            <div className="space-y-3">
              <h3 className="font-medium">Workout Breakdown</h3>
              {generatedWorkout.phases?.map((phase: any, phaseIndex: number) => (
                <div key={phaseIndex}>
                  <div className={`${phase.color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}>
                    <span className="font-medium">{phase.phase}</span>
                    {phase.repeat && (
                      <Badge className="bg-white/20 text-white border-white/30">Repeat {phase.repeat}</Badge>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-b-lg">
                    {phase.steps?.map((step: any, stepIndex: number) => (
                      <div
                        key={stepIndex}
                        className="flex items-center gap-4 p-4 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{step.description}</p>
                          {step.detail && <p className="text-sm text-gray-600 mt-1">{step.detail}</p>}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          <Play className="h-3 w-3 mr-1" />
                          {step.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleAmendGoals} className="flex-1 bg-transparent">
                Amend Goals
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-green-500 hover:bg-green-600">
                Schedule Workout
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
