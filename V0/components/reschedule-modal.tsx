"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Sun, CloudSun, Moon, CalendarIcon } from "lucide-react"

interface RescheduleModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RescheduleModal({ isOpen, onClose }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedTime, setSelectedTime] = useState<string>("")

  const timeSlots = [
    { id: "morning", icon: Sun, label: "Morning", time: "6-9 AM" },
    { id: "afternoon", icon: CloudSun, label: "Afternoon", time: "12-3 PM" },
    { id: "evening", icon: Moon, label: "Evening", time: "6-9 PM" },
  ]

  const handleReschedule = () => {
    if (!selectedTime) {
      alert("Please select a time slot")
      return
    }

    const timeLabel = timeSlots.find((slot) => slot.id === selectedTime)?.label
    alert(`Workout rescheduled to ${selectedDate.toDateString()} in the ${timeLabel}!`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Reschedule Workout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Workout Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h3 className="font-medium text-blue-900 mb-1">Current Workout</h3>
              <p className="text-sm text-blue-800">Easy Run • 3.2km • Today</p>
            </CardContent>
          </Card>

          {/* Date Selection */}
          <div className="space-y-3">
            <h3 className="font-medium">Choose New Date</h3>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <h3 className="font-medium">Choose Time</h3>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((slot) => (
                <Button
                  key={slot.id}
                  variant={selectedTime === slot.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTime(slot.id)}
                  className="flex flex-col h-auto py-3 hover:scale-105 transition-transform"
                >
                  <slot.icon className="h-4 w-4 mb-1" />
                  <span className="text-xs">{slot.label}</span>
                  <span className="text-xs opacity-70">{slot.time}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleReschedule} className="flex-1 bg-green-500 hover:bg-green-600">
              Reschedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
