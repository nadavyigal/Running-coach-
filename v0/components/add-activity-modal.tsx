"use client"

import type React from "react"
import type { Run } from "@/lib/db"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Heart, Watch, Camera, Edit, Upload, CalendarIcon, Zap, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AiActivityAnalysisError, analyzeActivityImage } from "@/lib/ai-activity-client"
import { trackAnalyticsEvent } from "@/lib/analytics"
import { recordRunWithSideEffects } from "@/lib/run-recording"

interface AddActivityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onActivityAdded?: () => void
  initialStep?: "method" | "manual" | "upload"
  workoutId?: number
  runTypeHint?: Run["type"]
  autoMatchWorkout?: boolean
}

export function AddActivityModal({
  open,
  onOpenChange,
  onActivityAdded,
  initialStep,
  workoutId,
  runTypeHint,
  autoMatchWorkout = true,
}: AddActivityModalProps) {
  const [step, setStep] = useState<"method" | "manual" | "upload">("method")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activityData, setActivityData] = useState({
    type: "run",
    distance: "",
    duration: "",
    pace: "",
    calories: "",
    notes: "",
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageImportMeta, setImageImportMeta] = useState<{
    requestId?: string
    confidence?: number
    method?: string
    model?: string
    parserVersion?: string
    hasRouteMap?: boolean
    routeType?: string
    gpsCoordinates?: Array<{ lat: number; lng: number }>
    mapImageDescription?: string
  } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!open) return
    setStep(initialStep ?? "method")
  }, [initialStep, open])

  const formattedSelectedDate = useMemo(() => (selectedDate ? format(selectedDate, "PPP") : "Pick a date"), [selectedDate])
  const getDateRange = () => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    fourteenDaysAgo.setHours(0, 0, 0, 0)
    return { today, fourteenDaysAgo }
  }
  const isDateDisabled = (date: Date) => {
    const { today, fourteenDaysAgo } = getDateRange()
    return date > today || date < fourteenDaysAgo
  }
  const clampDateToRange = (date: Date) => {
    const { today, fourteenDaysAgo } = getDateRange()
    if (date > today) return today
    if (date < fourteenDaysAgo) return fourteenDaysAgo
    return date
  }

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
      name: "Sync Last Activity from Garmin",
      icon: Watch,
      description: "Import your latest Garmin activity",
      action: async () => {
        try {
          const { dbUtils } = await import("@/lib/dbUtils")
          const user = await dbUtils.getCurrentUser()
          if (!user?.id) {
            toast({ title: "Setup required", description: "Please complete onboarding first.", variant: "destructive" })
            return
          }
          // Check if Garmin is connected before attempting sync
          const { db } = await import("@/lib/db")
          const device = await (db.wearableDevices as any)
            .where('[userId+type]')
            .equals([user.id, 'garmin'])
            .first()
          if (!device || device.connectionStatus === 'disconnected') {
            toast({ title: "Garmin not connected", description: "Go to Profile > Devices & Apps to connect Garmin first.", variant: "destructive" })
            return
          }
          const response = await fetch("/api/garmin/sync-fit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error((data as { error?: string }).error ?? "Sync failed")
          toast({ title: (data as { processed?: boolean }).processed ? "Run synced!" : "Up to date", description: (data as { message?: string }).message })
          if ((data as { processed?: boolean }).processed) onActivityAdded?.()
          onOpenChange(false)
        } catch {
          toast({ title: "Sync failed", description: "Could not sync from Garmin. Please try again.", variant: "destructive" })
        }
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

  const resetForm = () => {
    setStep("method")
    setActivityData({
      type: "run",
      distance: "",
      duration: "",
      pace: "",
      calories: "",
      notes: "",
    })
    setSelectedDate(new Date())
    setError(null)
    setImageImportMeta(null)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }

  const parsePaceToSeconds = (pace: string) => {
    if (!pace) return undefined
    const match = pace.trim().match(/(\d{1,2})\s*:\s*(\d{1,2})/)
    if (match) {
      const minutesPart = match[1]
      const secondsPart = match[2]
      if (!minutesPart || !secondsPart) return undefined

      const minutes = Number.parseInt(minutesPart, 10)
      const seconds = Number.parseInt(secondsPart, 10)
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds
    }

    const numericPace = Number.parseFloat(pace)
    return Number.isFinite(numericPace) ? Math.round(numericPace * 60) : undefined
  }

  const formatPaceFromSeconds = (paceSeconds?: number | null) => {
    if (!paceSeconds || paceSeconds <= 0) return ""
    const minutes = Math.floor(paceSeconds / 60)
    const seconds = Math.round(paceSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const persistActivity = async (
    data: typeof activityData,
    date: Date,
    importMeta?: {
      requestId?: string
      confidence?: number
      method?: string
      model?: string
      parserVersion?: string
      hasRouteMap?: boolean
      routeType?: string
      gpsCoordinates?: Array<{ lat: number; lng: number }>
      mapImageDescription?: string
    },
  ) => {
    const { dbUtils } = await import("@/lib/dbUtils")
    const user = await dbUtils.getCurrentUser()

    if (!user || !user.id) {
      throw new Error("Unable to find an active user")
    }

    const distance = Number.parseFloat(data.distance)
    const durationMinutes = Number.parseFloat(data.duration)

    if (!Number.isFinite(distance) || distance <= 0) {
      throw new Error("Please provide a valid distance")
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new Error("Please provide a valid duration")
    }

    const paceSeconds = parsePaceToSeconds(data.pace)
    const calories = data.calories ? Number.parseFloat(data.calories) : undefined
    const caloriesValue = Number.isFinite(calories) ? calories : undefined

    const cleanedImportMeta = importMeta
      ? {
          ...(importMeta.requestId ? { requestId: importMeta.requestId } : {}),
          ...(typeof importMeta.confidence === "number" ? { confidence: importMeta.confidence } : {}),
          ...(importMeta.method ? { method: importMeta.method } : {}),
          ...(importMeta.model ? { model: importMeta.model } : {}),
          ...(importMeta.parserVersion ? { parserVersion: importMeta.parserVersion } : {}),
          ...(typeof importMeta.hasRouteMap === "boolean" ? { hasRouteMap: importMeta.hasRouteMap } : {}),
          ...(importMeta.routeType ? { routeType: importMeta.routeType } : {}),
          ...(importMeta.gpsCoordinates ? { gpsCoordinates: importMeta.gpsCoordinates } : {}),
          ...(importMeta.mapImageDescription ? { mapImageDescription: importMeta.mapImageDescription } : {}),
        }
      : undefined

    // Convert GPS coordinates to gpsPath format if available
    const gpsPath = importMeta?.gpsCoordinates
      ? JSON.stringify(importMeta.gpsCoordinates.map(coord => ({
          latitude: coord.lat,
          longitude: coord.lng,
          timestamp: Date.now(), // Placeholder timestamp
          accuracy: 10, // Placeholder accuracy
        })))
      : undefined

    await recordRunWithSideEffects({
      userId: user.id,
      ...(typeof workoutId === "number" ? { workoutId } : {}),
      autoMatchWorkout,
      ...(runTypeHint ? { type: runTypeHint } : {}),
      distanceKm: distance,
      durationSeconds: Math.round(durationMinutes * 60),
      completedAt: date,
      ...(typeof paceSeconds === "number" ? { paceSecondsPerKm: paceSeconds } : {}),
      ...(typeof caloriesValue === "number" ? { calories: caloriesValue } : {}),
      ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
      ...(gpsPath ? { gpsPath } : {}),
      ...(importMeta?.routeType ? { route: importMeta.mapImageDescription || importMeta.routeType } : {}),
      importSource: cleanedImportMeta ? "image" : "manual",
      ...(cleanedImportMeta ? { importMeta: cleanedImportMeta } : {}),
    })
  }

  const handleManualSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await persistActivity(activityData, selectedDate, imageImportMeta ?? undefined)
      toast({ title: "Activity saved", description: "Your run was added to Today's feed." })
      resetForm()
      onOpenChange(false)
      if (onActivityAdded) {
        onActivityAdded()
      }
    } catch (err) {
      console.error("Failed to save activity", err)
      setError(err instanceof Error ? err.message : "Unable to save activity")
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      setError("Unsupported file type. Please upload a JPG, PNG, or WebP image.")
      return
    }

    const maxSize = 6 * 1024 * 1024 // 6MB
    if (file.size > maxSize) {
      setError("File is too large. Please choose an image under 6MB")
      return
    }

    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })

    setIsAnalyzing(true)
    setError(null)
    trackAnalyticsEvent("run_image_analysis_started", {
      source: "add_activity_modal",
      fileType: file.type,
      fileSizeBytes: file.size,
    }).catch(() => undefined)

    try {
      const result = await analyzeActivityImage(file)
      trackAnalyticsEvent("run_image_analysis_succeeded", {
        source: "add_activity_modal",
        confidence: result.confidence ?? 0,
        requestId: result.requestId,
        method: result.method,
        model: result.model,
        hasCompletedAt: Boolean(result.completedAt),
        hasPace: Boolean(result.paceSecondsPerKm),
      }).catch(() => undefined)

      const normalizedDate = result.completedAt ? new Date(result.completedAt) : new Date()
      setSelectedDate(clampDateToRange(normalizedDate))
      setImageImportMeta({
        ...(result.requestId ? { requestId: result.requestId } : {}),
        ...(typeof result.confidence === "number" ? { confidence: result.confidence } : {}),
        ...(result.method ? { method: result.method } : {}),
        ...(result.model ? { model: result.model } : {}),
        ...(result.parserVersion ? { parserVersion: result.parserVersion } : {}),
        ...(typeof result.hasRouteMap === "boolean" ? { hasRouteMap: result.hasRouteMap } : {}),
        ...(result.routeType ? { routeType: result.routeType } : {}),
        ...(result.gpsCoordinates ? { gpsCoordinates: result.gpsCoordinates } : {}),
        ...(result.mapImageDescription ? { mapImageDescription: result.mapImageDescription } : {}),
      })

      const updatedActivity = {
        type: result.type || "run",
        distance: String(result.distanceKm),
        duration: String(result.durationSeconds / 60),
        pace: formatPaceFromSeconds(result.paceSecondsPerKm),
        calories: result.calories ? String(result.calories) : "",
        notes: result.notes || "",
      }

      setActivityData(updatedActivity)

      if (result.confidence && result.confidence >= 70 && result.distanceKm && result.durationSeconds) {
        trackAnalyticsEvent("run_image_auto_saved", {
          source: "add_activity_modal",
          confidence: result.confidence,
          requestId: result.requestId,
          method: result.method,
        }).catch(() => undefined)
        await persistActivity(updatedActivity, normalizedDate, {
          ...(result.requestId ? { requestId: result.requestId } : {}),
          ...(typeof result.confidence === "number" ? { confidence: result.confidence } : {}),
          ...(result.method ? { method: result.method } : {}),
          ...(result.model ? { model: result.model } : {}),
          ...(result.parserVersion ? { parserVersion: result.parserVersion } : {}),
        })
        toast({ title: "Activity logged", description: "AI imported your run automatically." })
        resetForm()
        onOpenChange(false)
        if (onActivityAdded) {
          onActivityAdded()
        }
      } else {
        trackAnalyticsEvent("run_image_requires_review", {
          source: "add_activity_modal",
          confidence: result.confidence ?? 0,
          requestId: result.requestId,
          method: result.method,
        }).catch(() => undefined)
        toast({
          title: "Review details",
          description: "We pre-filled the form. Please confirm before saving.",
        })
        setStep("manual")
      }
    } catch (err) {
      console.error("AI analysis failed", err)
      trackAnalyticsEvent("run_image_analysis_failed", {
        source: "add_activity_modal",
        error: err instanceof Error ? err.message : "Unknown error",
        requestId: err instanceof AiActivityAnalysisError ? err.requestId : undefined,
        errorCode: err instanceof AiActivityAnalysisError ? err.errorCode : undefined,
      }).catch(() => undefined)

      // Show more specific error message if critical fields are missing
      if (err instanceof AiActivityAnalysisError && err.errorCode === "ai_missing_required_fields") {
        setError(
          err.message + "\n\nTip: Make sure the screenshot shows the distance and duration clearly. You can also switch to manual entry to fill in the details yourself."
        )
      } else {
        setError(err instanceof Error ? err.message : "Failed to analyze the image")
      }

      // Pre-fill manual form with whatever we could extract
      setStep("manual")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "method" && "Add Activity"}
            {step === "manual" && "Manual Entry"}
            {step === "upload" && "Upload Activity"}
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

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
                    {formattedSelectedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500 text-center mt-2">
                You can log activities from the past 14 days
              </p>
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

            {/* Calories */}
            <div className="space-y-2">
              <Label htmlFor="calories">Calories (optional)</Label>
              <div className="relative">
                <Input
                  id="calories"
                  type="number"
                  placeholder="320"
                  value={activityData.calories}
                  onChange={(e) => setActivityData({ ...activityData, calories: e.target.value })}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">kcal</span>
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
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  "Save Activity"
                )}
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

              {previewUrl && (
                <div className="flex justify-center mb-4">
                  <img
                    src={previewUrl}
                    alt="Uploaded activity preview"
                    className="max-h-48 rounded-md border object-contain"
                  />
                </div>
              )}

              {isAnalyzing ? (
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyzing your screenshot...</span>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button asChild className="bg-green-500 hover:bg-green-600">
                      <span>Choose Photo</span>
                    </Button>
                  </label>
                </>
              )}
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
