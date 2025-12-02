"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Heart, Watch, Camera, Edit, Upload, CalendarIcon, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { analyzeActivityImage } from "@/lib/ai-activity-client"
import { dbUtils } from "@/lib/dbUtils"
import { planAdjustmentService } from "@/lib/planAdjustmentService"
import type { Run } from "@/lib/db"

interface AddActivityModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function AddActivityModal({ isOpen, onClose, onSaved }: AddActivityModalProps) {
  const [step, setStep] = useState<"method" | "manual" | "upload">("method")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [activityData, setActivityData] = useState({
    type: "run",
    distance: "",
    duration: "",
    pace: "",
    notes: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { toast } = useToast()

  const normalizedActivityType: Run["type"] = useMemo(() => {
    switch (activityData.type) {
      case "run":
        return "easy"
      case "tempo":
      case "intervals":
      case "long":
      case "time-trial":
      case "hill":
        return activityData.type
      default:
        return "other"
    }
  }, [activityData.type])

  const importMethods = [
    {
      id: "health",
      name: "Connect to Health",
      icon: Heart,
      description: "Import from Apple Health or Google Fit",
      action: () => {
        alert("Health app integration coming soon!")
      },
    },
    {
      id: "garmin",
      name: "Connect to Garmin",
      icon: Watch,
      description: "Sync with Garmin Connect",
      action: () => {
        alert("Garmin integration coming soon!")
      },
    },
    {
      id: "strava",
      name: "Import from Strava",
      icon: Zap,
      description: "Import activities from Strava",
      action: () => {
        alert("Strava integration coming soon!")
      },
    },
    {
      id: "screenshot",
      name: "Upload Screenshot/Pic",
      icon: Camera,
      description: "Upload a photo of your workout",
      action: () => setStep("upload"),
    },
    {
      id: "manual",
      name: "Manual Entry",
      icon: Edit,
      description: "Enter workout details manually",
      action: () => setStep("manual"),
    },
  ]

  const formatSecondsToDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const resetForm = () => {
    setStep("method")
    setActivityData({
      type: "run",
      distance: "",
      duration: "",
      pace: "",
      notes: "",
    })
    setSelectedDate(new Date())
  }

  const saveRun = async (
    runDetails: {
      distanceKm: number
      durationSeconds: number
      notes?: string
      paceSecondsPerKm?: number
      type?: Run["type"]
      completedAt?: Date
    },
    shouldClose = true,
  ) => {
    try {
      setIsSaving(true)
      const user = await dbUtils.getCurrentUser()
      if (!user?.id) {
        toast({
          title: "User not found",
          description: "Please complete onboarding before adding activities.",
          variant: "destructive",
        })
        return
      }

      const calories = Math.round(runDetails.distanceKm * 60 + (runDetails.durationSeconds / 60) * 3)
      const runData: Omit<Run, "id" | "createdAt"> = {
        userId: user.id,
        type: runDetails.type || normalizedActivityType,
        workoutId: undefined,
        distance: runDetails.distanceKm,
        duration: runDetails.durationSeconds,
        pace: runDetails.paceSecondsPerKm || runDetails.durationSeconds / runDetails.distanceKm,
        calories,
        notes: runDetails.notes?.trim() || undefined,
        completedAt: runDetails.completedAt || selectedDate,
      }

      await dbUtils.createRun(runData)
      await planAdjustmentService.afterRun(user.id)

      toast({
        title: "Activity added",
        description: `Logged ${runDetails.distanceKm.toFixed(2)} km in ${formatSecondsToDuration(runDetails.durationSeconds)}.`,
      })

      resetForm()
      onSaved?.()
      if (shouldClose) onClose()
    } catch (error) {
      console.error("Failed to save activity", error)
      toast({
        title: "Could not save activity",
        description: "Something went wrong while saving your run.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualSave = async () => {
    const distanceKm = Number.parseFloat(activityData.distance)
    const durationMinutes = Number.parseFloat(activityData.duration)

    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast({
        title: "Missing details",
        description: "Please enter a valid distance and duration.",
        variant: "destructive",
      })
      return
    }

    const durationSeconds = Math.round(durationMinutes * 60)
    const paceSecondsPerKm = activityData.pace
      ? activityData.pace
          .split(":")
          .map((part) => Number.parseInt(part.trim(), 10))
          .reduce((acc, part) => acc * 60 + (Number.isFinite(part) ? part : 0), 0)
      : undefined

    await saveRun({
      distanceKm,
      durationSeconds,
      notes: activityData.notes,
      paceSecondsPerKm,
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setIsAnalyzing(true)
    try {
      const result = await analyzeActivityImage(file)
      const paceDisplay = result.paceSecondsPerKm ? formatSecondsToDuration(result.paceSecondsPerKm) : ""

      setActivityData((current) => {
        const allowedTypes = ["run", "walk", "bike", "swim", "strength", "other"] as const
        const nextType = allowedTypes.includes((result.type as typeof allowedTypes[number]) || "run")
          ? (result.type as typeof allowedTypes[number])
          : current.type

        return {
          ...current,
          distance: result.distanceKm.toString(),
          duration: Math.round(result.durationSeconds / 60).toString(),
          pace: paceDisplay,
          notes: result.notes || current.notes,
          type: nextType,
        }
      })

      const completedAt = result.completedAt ? new Date(result.completedAt) : selectedDate

      await saveRun(
        {
          distanceKm: result.distanceKm,
          durationSeconds: result.durationSeconds,
          notes: result.notes,
          paceSecondsPerKm: result.paceSecondsPerKm,
          type: (result.type as Run["type"]) || normalizedActivityType,
          completedAt,
        },
        true,
      )
    } catch (error) {
      console.error("Image analysis failed", error)
      toast({
        title: "AI analysis failed",
        description: error instanceof Error ? error.message : "We couldn't read the workout screenshot.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
      setStep("method")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "method" && "Add Activity"}
            {step === "manual" && "Manual Entry"}
            {step === "upload" && "Upload Activity"}
          </DialogTitle>
        </DialogHeader>

        {step === "method" && (
          <div className="space-y-4">
            {importMethods.map((method) => (
              <Card
                key={method.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={method.action}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <method.icon className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{method.name}</h3>
                      <p className="text-sm text-gray-600">{method.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {step === "manual" && (
          <div className="space-y-4">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Activity Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activity-type">Activity Type</Label>
              <select
                id="activity-type"
                className="w-full p-2 border rounded-md"
                value={activityData.type}
                onChange={(e) => setActivityData({ ...activityData, type: e.target.value })}
              >
                <option value="run">Running</option>
                <option value="walk">Walking</option>
                <option value="bike">Cycling</option>
                <option value="swim">Swimming</option>
                <option value="strength">Strength Training</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Distance */}
            <div className="space-y-2">
              <Label htmlFor="distance">Distance</Label>
              <div className="relative">
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  placeholder="5.0"
                  value={activityData.distance}
                  onChange={(e) => setActivityData({ ...activityData, distance: e.target.value })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">km</span>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <div className="relative">
                <Input
                  id="duration"
                  type="number"
                  placeholder="30"
                  value={activityData.duration}
                  onChange={(e) => setActivityData({ ...activityData, duration: e.target.value })}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">min</span>
              </div>
            </div>

            {/* Average Pace */}
            <div className="space-y-2">
              <Label htmlFor="pace">Average Pace (optional)</Label>
              <div className="relative">
                <Input
                  id="pace"
                  placeholder="5:30"
                  value={activityData.pace}
                  onChange={(e) => setActivityData({ ...activityData, pace: e.target.value })}
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">min/km</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="How did it feel? Any observations..."
                value={activityData.notes}
                onChange={(e) => setActivityData({ ...activityData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("method")} className="flex-1" disabled={isSaving}>
                Back
              </Button>
              <Button
                onClick={handleManualSave}
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Activity"}
              </Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="font-medium mb-2">Upload Activity Screenshot</h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload a photo of your workout from any fitness app or device
              </p>

              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload" />
              <label htmlFor="file-upload">
                <Button asChild className="bg-green-500 hover:bg-green-600" disabled={isAnalyzing || isSaving}>
                  <span>{isAnalyzing ? "Analyzing..." : "Choose Photo"}</span>
                </Button>
              </label>
            </div>

            <div className="text-center">
              <Button variant="outline" onClick={() => setStep("method")}>Back</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
