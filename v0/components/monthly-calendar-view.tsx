"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, RefreshCw, Lightbulb } from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import { type Workout } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"

export function MonthlyCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDateWorkout, setSelectedDateWorkout] = useState<any>(null)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [draggedWorkout, setDraggedWorkout] = useState<any>(null)

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  // Workout type color mapping
  const workoutColorMap: { [key: string]: string } = {
    easy: "bg-green-500",
    tempo: "bg-orange-500",
    intervals: "bg-pink-500",
    long: "bg-blue-500",
    rest: "bg-gray-400",
    "time-trial": "bg-red-500",
    hill: "bg-purple-500",
  }

  // Load workouts for the current month
  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        setIsLoading(true)
        const user = await dbUtils.getCurrentUser()
        if (user && user.id) {
          // Get start and end of current month (full-day range)
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
          startOfMonth.setHours(0, 0, 0, 0)

          const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
          endOfMonth.setHours(23, 59, 59, 999)
          
          const monthWorkouts = await dbUtils.getWorkoutsForDateRange(user.id, startOfMonth, endOfMonth)
          setWorkouts(monthWorkouts)
        }
      } catch (error) {
        console.error('Failed to load workouts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkouts()
  }, [currentDate])

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  // Convert workouts to the format expected by the calendar
  const workoutData = workouts.reduce((acc, workout) => {
    const dateKey = formatDateKey(workout.scheduledDate)
    acc[dateKey] = {
      type: workout.type,
      distance: `${workout.distance}km`,
      completed: workout.completed,
      color: workoutColorMap[workout.type] || "bg-gray-500",
      id: workout.id,
      notes: workout.notes,
    }
    return acc
  }, {} as Record<string, any>)

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const handleDateClick = (date: Date) => {
    if (draggedWorkout) {
      return // Don't handle click when dragging
    }
    
    const dateKey = formatDateKey(date)
    const workout = workoutData[dateKey as keyof typeof workoutData]

    if (workout) {
      setSelectedDateWorkout({
        ...workout,
        date: date,
        dateString: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      })
      setShowDateWorkoutModal(true)
    } else {
      setSelectedDate(date)
      setShowAddRunModal(true)
    }
  }

  const handleDragStart = (e: React.DragEvent, workout: any, date: Date) => {
    e.stopPropagation()
    setDraggedWorkout({ ...workout, originalDate: date })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedWorkout(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedWorkout) return

    const targetDateKey = formatDateKey(targetDate)
    const existingWorkout = workoutData[targetDateKey as keyof typeof workoutData]
    
    // Don't allow dropping on a date that already has a workout
    if (existingWorkout) {
      alert("This date already has a workout scheduled. Please choose a different date.")
      setDraggedWorkout(null)
      return
    }

    try {
      // Update the workout in the database
      await dbUtils.updateWorkout(draggedWorkout.id, {
        scheduledDate: targetDate,
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][targetDate.getDay()]
      })

      // Refresh the workouts
      const user = await dbUtils.getCurrentUser()
      if (user && user.id) {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        const monthWorkouts = await dbUtils.getWorkoutsForDateRange(user.id, startOfMonth, endOfMonth)
        setWorkouts(monthWorkouts)
      }

      alert(`Workout moved to ${targetDate.toLocaleDateString()}!`)
    } catch (error) {
      console.error('Failed to move workout:', error)
      alert("Failed to move workout. Please try again.")
    }

    setDraggedWorkout(null)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const days = getDaysInMonth(currentDate)

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth("prev")}
          className="hover:scale-105 transition-transform"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const user = await dbUtils.getCurrentUser()
                if (user && user.id) {
                  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
                  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
                  const monthWorkouts = await dbUtils.getWorkoutsForDateRange(user.id, startOfMonth, endOfMonth)
                  setWorkouts(monthWorkouts)
                }
              } catch (error) {
                console.error('Failed to refresh workouts:', error)
              }
            }}
            className="hover:scale-105 transition-transform"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth("next")}
          className="hover:scale-105 transition-transform"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardContent className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="h-12" />
              }

              const dateKey = formatDateKey(date)
              const workout = workoutData[dateKey as keyof typeof workoutData]
              const today = isToday(date)

              return (
                <div
                  key={index}
                  className={`h-16 border rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md ${
                    today ? "bg-green-100 border-green-300 ring-2 ring-green-200" : "hover:bg-gray-50 border-gray-200"
                  } ${draggedWorkout ? "hover:bg-blue-100 border-blue-300" : ""}`}
                  onClick={() => handleDateClick(date)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, date)}
                >
                  <span className={`text-sm ${today ? "font-bold text-green-800" : "text-gray-700"}`}>
                    {date.getDate()}
                  </span>
                  {workout && (
                    <div 
                      className="flex flex-col items-center justify-center mt-1 w-full px-1"
                      draggable
                      onDragStart={(e) => handleDragStart(e, workout, date)}
                      onDragEnd={handleDragEnd}
                      title="Drag to move workout to another day"
                    >
                      <div className={`w-full h-1 rounded-full ${workout.color} ${workout.completed ? "" : "opacity-60"} mb-1`} />
                      <span className={`text-xs font-medium ${workout.completed ? "text-gray-800" : "text-gray-600"}`}>
                        {workout.type}
                      </span>
                    </div>
                  )}
                  {draggedWorkout && !workout && (
                    <div className="text-xs text-blue-600 mt-1">Drop here</div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50 border-green-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{workouts.length}</div>
            <div className="text-xs text-green-600 font-medium">Planned Runs</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{workouts.filter(w => w.completed).length}</div>
            <div className="text-xs text-blue-600 font-medium">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 border-pink-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-pink-700">
              {workouts.length > 0 ? Math.round((workouts.filter(w => w.completed).length / workouts.length) * 100) : 0}%
            </div>
            <div className="text-xs text-pink-600 font-medium">Success Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Workouts */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Upcoming This Week</h3>
          <div className="space-y-2">
            {Object.entries(workoutData)
              .filter(([dateStr, workout]) => {
                const workoutDate = new Date(dateStr)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                workoutDate.setHours(0, 0, 0, 0)
                return !workout.completed && workoutDate >= today
              })
              .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
              .slice(0, 3)
              .map(([date, workout], index) => {
                const workoutDate = new Date(date)
                const dayName = workoutDate.toLocaleDateString("en-US", { weekday: "short" })
                const dayNum = workoutDate.getDate()
                return (
                  <div
                    key={date}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${workout.color}`} />
                      <div>
                        <span className="font-medium capitalize">{workout.type} Run</span>
                        <span className="text-gray-600 ml-2">{workout.distance}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {dayNum} {dayName}
                    </Badge>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {showAddRunModal && (
        <AddRunModal
          isOpen={showAddRunModal}
          onClose={() => {
            setShowAddRunModal(false)
            setSelectedDate(null)
          }}
        />
      )}
      {/* Workout Types Legend */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Workout Types</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-700">Easy Run</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-xs text-gray-700">Intervals</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-xs text-gray-700">Hill Run</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-xs text-gray-700">Recovery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-gray-700">Tempo Run</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-700">Long Run</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-gray-700">Race</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-yellow-800">
              Tip: Drag workouts to different dates to reschedule them
            </span>
          </div>
        </CardContent>
      </Card>

      {showDateWorkoutModal && (
        <DateWorkoutModal
          isOpen={showDateWorkoutModal}
          onClose={() => {
            setShowDateWorkoutModal(false)
            setSelectedDateWorkout(null)
          }}
          workout={selectedDateWorkout}
        />
      )}
    </div>
  )
}
