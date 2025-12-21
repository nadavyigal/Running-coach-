"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import {
  CalendarIcon,
  Target,
  Trophy,
  Mountain,
  Route,
  Calendar as CalendarDays,
  CheckCircle,
  Info
} from "lucide-react"

interface RaceGoalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userId: number
  editingGoal?: any
}

const raceDistances = [
  { value: 5, label: "5K", description: "5 kilometers" },
  { value: 10, label: "10K", description: "10 kilometers" },
  { value: 15, label: "15K", description: "15 kilometers" },
  { value: 21.1, label: "Half Marathon", description: "21.1 kilometers" },
  { value: 42.2, label: "Marathon", description: "42.2 kilometers" },
  { value: 0, label: "Custom", description: "Custom distance" }
]

const raceTypes = [
  { value: "road", label: "Road", icon: Route },
  { value: "trail", label: "Trail", icon: Mountain },
  { value: "track", label: "Track", icon: Target },
  { value: "virtual", label: "Virtual", icon: CalendarDays }
]

const priorities = [
  { value: "A", label: "A Race", description: "Primary goal - peak performance target", color: "bg-red-500 text-white" },
  { value: "B", label: "B Race", description: "Secondary goal - fitness test or stepping stone", color: "bg-orange-500 text-white" },
  { value: "C", label: "C Race", description: "Tune-up race - training run in race environment", color: "bg-blue-500 text-white" }
]

const courseDifficulties = [
  { value: "easy", label: "Easy", description: "Flat, fast course" },
  { value: "moderate", label: "Moderate", description: "Some hills or challenging sections" },
  { value: "hard", label: "Hard", description: "Hilly, technical, or challenging conditions" }
]

export function RaceGoalModal({ isOpen, onClose, onSuccess, userId, editingGoal }: RaceGoalModalProps) {
  const [formData, setFormData] = useState({
    raceName: editingGoal?.raceName || "",
    raceDate: editingGoal?.raceDate ? new Date(editingGoal.raceDate) : new Date(),
    distance: editingGoal?.distance || 10,
    customDistance: "",
    targetTime: editingGoal?.targetTime || "",
    priority: editingGoal?.priority || "A",
    location: editingGoal?.location || "",
    raceType: editingGoal?.raceType || "road",
    elevationGain: editingGoal?.elevationGain || "",
    courseDifficulty: editingGoal?.courseDifficulty || "moderate",
    registrationStatus: editingGoal?.registrationStatus || "planned",
    notes: editingGoal?.notes || ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTargetTimeHelper, setShowTargetTimeHelper] = useState(false)
  const [isRaceDateCalendarOpen, setIsRaceDateCalendarOpen] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)

      // Validate required fields
      if (!formData.raceName || !formData.raceDate) {
        toast({
          variant: "destructive",
          title: "Missing Information",
          description: "Please fill in race name and date."
        })
        return
      }

      // Validate custom distance
      let finalDistance = formData.distance
      if (formData.distance === 0) {
        if (!formData.customDistance) {
          toast({
            variant: "destructive",
            title: "Missing Distance",
            description: "Please enter a custom distance."
          })
          return
        }
        finalDistance = parseFloat(formData.customDistance)
        if (isNaN(finalDistance) || finalDistance <= 0) {
          toast({
            variant: "destructive",
            title: "Invalid Distance",
            description: "Please enter a valid distance."
          })
          return
        }
      }

      // Convert target time to seconds if provided
      let targetTimeSeconds = null
      if (formData.targetTime) {
        const parts = formData.targetTime.split(':')
        if (parts.length === 2) {
          const minutes = parseInt(parts[0])
          const seconds = parseInt(parts[1])
          targetTimeSeconds = minutes * 60 + seconds
        } else if (parts.length === 3) {
          const hours = parseInt(parts[0])
          const minutes = parseInt(parts[1])
          const seconds = parseInt(parts[2])
          targetTimeSeconds = hours * 3600 + minutes * 60 + seconds
        }
      }

      const requestData = {
        userId,
        raceName: formData.raceName,
        raceDate: formData.raceDate.toISOString(),
        distance: finalDistance,
        targetTime: targetTimeSeconds,
        priority: formData.priority,
        location: formData.location,
        raceType: formData.raceType,
        elevationGain: formData.elevationGain ? parseInt(formData.elevationGain) : null,
        courseDifficulty: formData.courseDifficulty,
        registrationStatus: formData.registrationStatus,
        notes: formData.notes
      }

      const url = editingGoal ? '/api/training-plan/race-goal' : '/api/training-plan/race-goal'
      const method = editingGoal ? 'PUT' : 'POST'

      if (editingGoal) {
        requestData.id = editingGoal.id
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to save race goal')
      }

      toast({
        variant: "success",
        title: editingGoal ? "Race Goal Updated! 🎯" : "Race Goal Created! 🎯",
        description: `${formData.raceName} has been ${editingGoal ? 'updated' : 'added'} to your goals.`
      })

      onSuccess()
      onClose()

    } catch (error) {
      console.error('Error saving race goal:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save race goal. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculatePredictedTime = () => {
    // Simple prediction based on common race equivalencies
    const baseDistance = 10 // 10K as base
    const baseTime = 50 * 60 // 50 minutes in seconds
    
    const timeMultiplier = Math.pow(formData.distance / baseDistance, 1.06)
    const predictedSeconds = baseTime * timeMultiplier
    
    const hours = Math.floor(predictedSeconds / 3600)
    const minutes = Math.floor((predictedSeconds % 3600) / 60)
    const seconds = Math.floor(predictedSeconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing when clicking on calendar popover
          const target = e.target as Element;
          if (target.closest('[role="dialog"]') || target.closest('.rdp')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {editingGoal ? 'Edit Race Goal' : 'Set Race Goal'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Race Name and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="raceName">Race Name *</Label>
              <Input
                id="raceName"
                placeholder="e.g., Boston Marathon"
                value={formData.raceName}
                onChange={(e) => setFormData({ ...formData, raceName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Race Date *</Label>
              <Popover open={isRaceDateCalendarOpen} onOpenChange={setIsRaceDateCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.raceDate ? format(formData.raceDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-[200]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  style={{ pointerEvents: 'auto', touchAction: 'auto' }}
                >
                  <Calendar
                    mode="single"
                    selected={formData.raceDate}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, raceDate: date })
                        setIsRaceDateCalendarOpen(false)
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    defaultMonth={formData.raceDate || new Date()}
                    captionLayout="dropdown-buttons"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Distance and Target Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distance">Distance</Label>
              <Select value={formData.distance.toString()} onValueChange={(value) => setFormData({ ...formData, distance: parseFloat(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select distance" />
                </SelectTrigger>
                <SelectContent>
                  {raceDistances.map((dist) => (
                    <SelectItem key={dist.value} value={dist.value.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{dist.label}</span>
                        <span className="text-sm text-gray-600">{dist.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.distance === 0 && (
                <Input
                  placeholder="Enter distance in km"
                  value={formData.customDistance}
                  onChange={(e) => setFormData({ ...formData, customDistance: e.target.value })}
                  type="number"
                  step="0.1"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetTime" className="flex items-center gap-2">
                Target Time (optional)
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTargetTimeHelper(!showTargetTimeHelper)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </Label>
              <Input
                id="targetTime"
                placeholder="e.g., 45:00 or 1:30:00"
                value={formData.targetTime}
                onChange={(e) => setFormData({ ...formData, targetTime: e.target.value })}
              />
              {showTargetTimeHelper && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3">
                    <p className="text-sm text-blue-800">
                      Predicted time for {formData.distance}km: <strong>{calculatePredictedTime()}</strong>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Format: MM:SS for under 1 hour, HH:MM:SS for longer
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Priority and Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="space-y-2">
                {priorities.map((priority) => (
                  <div
                    key={priority.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.priority === priority.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFormData({ ...formData, priority: priority.value })}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={priority.color}>{priority.label}</Badge>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{priority.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Boston, MA"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Race Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {raceTypes.map((type) => (
                    <Button
                      key={type.value}
                      variant={formData.raceType === type.value ? "default" : "outline"}
                      onClick={() => setFormData({ ...formData, raceType: type.value })}
                      className="flex items-center gap-2"
                    >
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Course Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="elevationGain">Elevation Gain (meters)</Label>
              <Input
                id="elevationGain"
                placeholder="e.g., 500"
                value={formData.elevationGain}
                onChange={(e) => setFormData({ ...formData, elevationGain: e.target.value })}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseDifficulty">Course Difficulty</Label>
              <Select value={formData.courseDifficulty} onValueChange={(value) => setFormData({ ...formData, courseDifficulty: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {courseDifficulties.map((difficulty) => (
                    <SelectItem key={difficulty.value} value={difficulty.value}>
                      <div>
                        <div className="font-medium">{difficulty.label}</div>
                        <div className="text-sm text-gray-600">{difficulty.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Registration Status */}
          <div className="space-y-2">
            <Label>Registration Status</Label>
            <div className="flex gap-2">
              {[
                { value: "planned", label: "Planned", icon: Calendar },
                { value: "registered", label: "Registered", icon: CheckCircle },
                { value: "completed", label: "Completed", icon: Trophy }
              ].map((status) => (
                <Button
                  key={status.value}
                  variant={formData.registrationStatus === status.value ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, registrationStatus: status.value })}
                  className="flex items-center gap-2"
                >
                  <status.icon className="h-4 w-4" />
                  {status.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Training focus, course strategy, gear preferences..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
