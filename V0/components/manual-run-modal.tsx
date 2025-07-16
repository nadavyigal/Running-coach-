"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Activity, Save } from "lucide-react"
import { dbUtils, type Run } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { planAdjustmentService } from "@/lib/planAdjustmentService"

interface ManualRunModalProps {
  isOpen: boolean
  onClose: () => void
  workoutId?: number
  onSaved?: () => void
}

export function ManualRunModal({ isOpen, onClose, workoutId, onSaved }: ManualRunModalProps) {
  const [distance, setDistance] = useState("")
  const [duration, setDuration] = useState("")
  const [type, setType] = useState<'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'other'>('easy')
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!distance || !duration) {
      toast({
        title: "Missing Information",
        description: "Please enter both distance and duration",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const user = await dbUtils.getCurrentUser()
      if (!user?.id) {
        toast({
          title: "Error",
          description: "User not found. Please complete onboarding first.",
          variant: "destructive"
        })
        return
      }

      const distanceKm = parseFloat(distance)
      const durationSeconds = parseTimeToSeconds(duration)
      
      if (isNaN(distanceKm) || isNaN(durationSeconds) || distanceKm <= 0 || durationSeconds <= 0) {
        toast({
          title: "Invalid Input",
          description: "Please enter valid positive numbers for distance and duration",
          variant: "destructive"
        })
        return
      }

      const pace = durationSeconds / distanceKm
      const calories = Math.round(distanceKm * 60 + (durationSeconds / 60) * 3) // Basic estimation

      const runData: Omit<Run, 'id' | 'createdAt'> = {
        userId: user.id,
        workoutId,
        type,
        distance: distanceKm,
        duration: durationSeconds,
        pace,
        calories,
        notes: notes.trim() || undefined,
        completedAt: new Date()
      }

      await dbUtils.createRun(runData)
      
      // Mark workout as completed if linked
      if (workoutId) {
        await dbUtils.markWorkoutCompleted(workoutId)
      }

      await planAdjustmentService.afterRun(user.id)

      toast({
        title: "Run Saved! 🎉",
        description: `Great job! ${distanceKm}km in ${formatDuration(durationSeconds)}`,
      })

      // Reset form
      setDistance("")
      setDuration("")
      setType('easy')
      setNotes("")
      
      onSaved?.()
      onClose()

    } catch (error) {
      console.error('Failed to save manual run:', error)
      toast({
        title: "Error Saving Run",
        description: "Your run data couldn't be saved. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const parseTimeToSeconds = (timeStr: string): number => {
    // Handle formats like "25:30", "1:25:30", or just "1530" (seconds)
    const parts = timeStr.includes(':') ? timeStr.split(':') : [timeStr]
    
    if (parts.length === 1) {
      // Just seconds
      return parseInt(parts[0]) || 0
    } else if (parts.length === 2) {
      // MM:SS
      const minutes = parseInt(parts[0]) || 0
      const seconds = parseInt(parts[1]) || 0
      return minutes * 60 + seconds
    } else if (parts.length === 3) {
      // HH:MM:SS
      const hours = parseInt(parts[0]) || 0
      const minutes = parseInt(parts[1]) || 0
      const seconds = parseInt(parts[2]) || 0
      return hours * 3600 + minutes * 60 + seconds
    }
    
    return 0
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const quickTemplates = [
    { name: "5K Run", distance: "5", duration: "25:00", type: 'easy' as const },
    { name: "10K Run", distance: "10", duration: "50:00", type: 'easy' as const },
    { name: "Half Marathon", distance: "21.1", duration: "1:45:00", type: 'long' as const },
    { name: "30min Easy", distance: "5", duration: "30:00", type: 'easy' as const }
  ]

  const handleQuickTemplate = (template: typeof quickTemplates[0]) => {
    setDistance(template.distance)
    setDuration(template.duration)
    setType(template.type)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Manual Run Entry
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Templates */}
          <div>
            <Label className="text-sm font-medium">Quick Templates</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {quickTemplates.map((template) => (
                <Button
                  key={template.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickTemplate(template)}
                  className="text-xs h-8"
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Run Type */}
          <div>
            <Label htmlFor="type">Run Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy Run</SelectItem>
                <SelectItem value="tempo">Tempo Run</SelectItem>
                <SelectItem value="intervals">Intervals</SelectItem>
                <SelectItem value="long">Long Run</SelectItem>
                <SelectItem value="time-trial">Time Trial</SelectItem>
                <SelectItem value="hill">Hill Training</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Distance */}
          <div>
            <Label htmlFor="distance">Distance (km)</Label>
            <Input
              id="distance"
              type="number"
              step="0.1"
              min="0"
              placeholder="5.0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              required
            />
          </div>

          {/* Duration */}
          <div>
            <Label htmlFor="duration">Duration (MM:SS or HH:MM:SS)</Label>
            <Input
              id="duration"
              placeholder="25:30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            <div className="text-xs text-gray-500 mt-1">
              Format: 25:30 (minutes:seconds) or 1:25:30 (hours:minutes:seconds)
            </div>
          </div>

          {/* Calculated Metrics */}
          {distance && duration && (
            <Card className="bg-gray-50">
              <CardContent className="p-3">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Pace:</span>
                    <span className="font-medium">
                      {(() => {
                        const d = parseFloat(distance)
                        const s = parseTimeToSeconds(duration)
                        if (d > 0 && s > 0) {
                          const paceSeconds = s / d
                          const mins = Math.floor(paceSeconds / 60)
                          const secs = Math.floor(paceSeconds % 60)
                          return `${mins}:${secs.toString().padStart(2, '0')}/km`
                        }
                        return "--:--/km"
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Calories:</span>
                    <span className="font-medium">
                      {(() => {
                        const d = parseFloat(distance)
                        const s = parseTimeToSeconds(duration)
                        if (d > 0 && s > 0) {
                          return Math.round(d * 60 + (s / 60) * 3)
                        }
                        return "--"
                      })()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="How did the run feel? Any observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Run
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 