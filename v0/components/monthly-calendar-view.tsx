"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, RefreshCw, Lightbulb, Check, X } from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import { type Workout, type Run } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"

type CalendarCellType = 'future-planned' | 'completed-run' | 'unplanned-run' | 'missed-workout'

type CalendarCellData = {
  cellType: CalendarCellType
  type: string
  distance: string
  color: string
  id: number | undefined        // workout id (if a workout exists)
  runId: number | undefined     // run id (if an actual run exists)
  notes: string | undefined
  completed: boolean | undefined
  actualDistanceKm: number | undefined
}

export function MonthlyCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [, setSelectedDate] = useState<Date | null>(null)
  const [selectedDateWorkout, setSelectedDateWorkout] = useState<any>(null)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [, setIsLoading] = useState(true)
  const [draggedWorkout, setDraggedWorkout] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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

  // Listen for plan-updated events (triggered by rescheduling, save-to-plan, etc.)
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1)
    window.addEventListener('plan-updated', handler)
    return () => window.removeEventListener('plan-updated', handler)
  }, [])

  // Load workouts and runs for the current month
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const user = await dbUtils.getCurrentUser()
        if (user && user.id) {
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
          startOfMonth.setHours(0, 0, 0, 0)

          const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
          endOfMonth.setHours(23, 59, 59, 999)

          const [monthWorkouts, monthRuns] = await Promise.all([
            dbUtils.getWorkoutsForDateRange(user.id, startOfMonth, endOfMonth, { planScope: "active" }),
            dbUtils.getRunsInTimeRange(user.id, startOfMonth, endOfMonth),
          ])
          setWorkouts(monthWorkouts)
          setRuns(monthRuns)
        }
      } catch (error) {
        console.error('Failed to load calendar data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [currentDate, refreshKey])

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  // Build merged calendar data map
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Index runs by date (first run per date wins)
  const runsByDate: Record<string, Run> = {}
  for (const run of runs) {
    const runDate = new Date(run.completedAt ?? run.createdAt)
    const key = formatDateKey(runDate)
    if (!runsByDate[key]) runsByDate[key] = run
  }

  // Index workouts by date
  const workoutsByDate: Record<string, Workout> = {}
  for (const workout of workouts) {
    const key = formatDateKey(workout.scheduledDate)
    workoutsByDate[key] = workout
  }

  // Merge into CalendarCellData
  const calendarData: Record<string, CalendarCellData> = {}

  const allDateKeys = new Set([...Object.keys(runsByDate), ...Object.keys(workoutsByDate)])
  for (const key of allDateKeys) {
    const run = runsByDate[key]
    const workout = workoutsByDate[key]
    const cellDate = new Date(key)
    cellDate.setHours(0, 0, 0, 0)
    const isPast = cellDate < today

    if (isPast) {
      if (run) {
        // Determine if this run was linked to the planned workout
        const isLinked = workout && run.workoutId === workout.id
        calendarData[key] = {
          cellType: isLinked ? 'completed-run' : 'unplanned-run',
          type: run.type,
          distance: `${run.distance}km`,
          color: workoutColorMap[run.type] || "bg-gray-500",
          id: workout?.id,
          runId: run.id,
          notes: run.notes,
          completed: undefined,
          actualDistanceKm: run.distance,
        }
      } else if (workout) {
        calendarData[key] = {
          cellType: 'missed-workout',
          type: workout.type,
          distance: `${workout.distance}km`,
          color: workoutColorMap[workout.type] || "bg-gray-500",
          id: workout.id,
          runId: undefined,
          notes: workout.notes,
          completed: undefined,
          actualDistanceKm: undefined,
        }
      }
    } else {
      // Today or future: show planned workout
      if (workout) {
        calendarData[key] = {
          cellType: 'future-planned',
          type: workout.type,
          distance: `${workout.distance}km`,
          color: workoutColorMap[workout.type] || "bg-gray-500",
          id: workout.id,
          runId: undefined,
          notes: workout.notes,
          completed: workout.completed,
          actualDistanceKm: undefined,
        }
      }
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

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
      return
    }

    const dateKey = formatDateKey(date)
    const cell = calendarData[dateKey]

    if (cell) {
      setSelectedDateWorkout({
        ...cell,
        date: date,
        dateString: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      })
      setShowDateWorkoutModal(true)
    } else {
      setSelectedDate(date)
      setShowAddRunModal(true)
    }
  }

  const handleDragStart = (e: React.DragEvent, cell: CalendarCellData, date: Date) => {
    e.stopPropagation()
    setDraggedWorkout({ ...cell, originalDate: date })
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
    const existingCell = calendarData[targetDateKey]

    if (existingCell) {
      alert("This date already has a workout scheduled. Please choose a different date.")
      setDraggedWorkout(null)
      return
    }

    try {
      await dbUtils.updateWorkout(draggedWorkout.id, {
        scheduledDate: targetDate,
        day: (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).at(targetDate.getDay()) ?? 'Sun',
      })

      window.dispatchEvent(new CustomEvent('plan-updated'))
      alert(`Workout moved to ${targetDate.toLocaleDateString()}!`)
    } catch (error) {
      console.error('Failed to move workout:', error)
      alert("Failed to move workout. Please try again.")
    }

    setDraggedWorkout(null)
  }

  const isToday = (date: Date) => {
    const now = new Date()
    return date.toDateString() === now.toDateString()
  }

  const days = getDaysInMonth(currentDate)

  // Stats: count completed runs and adherence
  const completedCount = Object.values(calendarData).filter(
    c => c.cellType === 'completed-run' || c.cellType === 'unplanned-run'
  ).length
  const missedCount = Object.values(calendarData).filter(c => c.cellType === 'missed-workout').length
  const adherenceDenominator = completedCount + missedCount
  const adherencePct = adherenceDenominator > 0 ? Math.round((completedCount / adherenceDenominator) * 100) : 0
  const scheduledCount = workouts.length

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
            onClick={() => setRefreshKey(k => k + 1)}
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
                return <div key={index} className="h-16" />
              }

              const dateKey = formatDateKey(date)
              const cell = calendarData[dateKey]
              const todayCell = isToday(date)
              const isFuturePlanned = cell?.cellType === 'future-planned'

              return (
                <div
                  key={index}
                  className={`h-16 border rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-md ${todayCell ? "bg-green-100 border-green-300 ring-2 ring-green-200" : "hover:bg-gray-50 border-gray-200"
                    } ${draggedWorkout ? "hover:bg-blue-100 border-blue-300" : ""}`}
                  onClick={() => handleDateClick(date)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, date)}
                >
                  <span className={`text-sm ${todayCell ? "font-bold text-green-800" : "text-gray-700"}`}>
                    {date.getDate()}
                  </span>
                  {cell && (
                    <div
                      className="flex flex-col items-center justify-center mt-1 w-full px-1"
                      draggable={isFuturePlanned}
                      onDragStart={isFuturePlanned ? (e) => handleDragStart(e, cell, date) : undefined}
                      onDragEnd={isFuturePlanned ? handleDragEnd : undefined}
                      title={isFuturePlanned ? "Drag to move workout to another day" : undefined}
                    >
                      <div className="relative w-full mb-1">
                        {cell.cellType === 'completed-run' && (
                          <>
                            <div className={`w-full h-1.5 rounded-full ${cell.color}`} />
                            <span className="absolute -top-2 -right-1 text-[8px] text-green-600">✓</span>
                          </>
                        )}
                        {cell.cellType === 'unplanned-run' && (
                          <>
                            <div className={`w-full h-1.5 rounded-full ${cell.color}`} />
                            <span className="absolute -top-2 -right-1 text-[8px] text-blue-500">🏃</span>
                          </>
                        )}
                        {cell.cellType === 'missed-workout' && (
                          <>
                            <div className={`w-full h-1 rounded-full ${cell.color} opacity-30`} />
                            <span className="absolute -top-2 -right-1 text-[8px] text-red-500">✗</span>
                          </>
                        )}
                        {cell.cellType === 'future-planned' && (
                          <div className={`w-full h-1 rounded-full ${cell.color} opacity-60`} />
                        )}
                      </div>
                      {cell.cellType === 'missed-workout' ? (
                        <span className="text-xs font-medium text-gray-400 line-through">{cell.type}</span>
                      ) : cell.cellType === 'completed-run' || cell.cellType === 'unplanned-run' ? (
                        <span className="text-xs font-medium text-gray-800">{cell.actualDistanceKm?.toFixed(1)}k</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-600">{cell.type}</span>
                      )}
                    </div>
                  )}
                  {draggedWorkout && !cell && (
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
            <div className="text-2xl font-bold text-green-700">{scheduledCount}</div>
            <div className="text-xs text-green-600 font-medium">Scheduled (Month)</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{completedCount}</div>
            <div className="text-xs text-blue-600 font-medium">Completed (Month)</div>
          </CardContent>
        </Card>
        <Card className="bg-pink-50 border-pink-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-pink-700">{adherencePct}%</div>
            <div className="text-xs text-pink-600 font-medium">Plan Adherence</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Workouts */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Upcoming This Week</h3>
          <div className="space-y-2">
            {Object.entries(calendarData)
              .filter(([, cell]) => cell.cellType === 'future-planned')
              .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
              .slice(0, 3)
              .map(([date, cell]) => {
                const workoutDate = new Date(date)
                const dayName = workoutDate.toLocaleDateString("en-US", { weekday: "short" })
                const dayNum = workoutDate.getDate()
                return (
                  <div
                    key={date}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${cell.color}`} />
                      <div>
                        <span className="font-medium capitalize">{cell.type} Run</span>
                        <span className="text-gray-600 ml-2">{cell.distance}</span>
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
          open={showAddRunModal}
          onOpenChange={(open) => {
            setShowAddRunModal(open)
            if (!open) setSelectedDate(null)
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
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Check className="h-3 w-3 text-green-600" /> Completed run
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <X className="h-3 w-3 text-red-500" /> Missed workout (faded)
            </div>
          </div>
          <div className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-yellow-800">
              Tip: Drag future workouts to different dates to reschedule them
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
