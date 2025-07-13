"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"

export function RecordScreen() {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [distance, setDistance] = useState(0)
  const [showRoutesModal, setShowRoutesModal] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1)
        setDistance((prev) => prev + 0.001) // Simulate distance increase
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, isPaused])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const calculatePace = () => {
    if (distance === 0) return "--:--"
    const paceInSeconds = duration / distance
    const mins = Math.floor(paceInSeconds / 60)
    const secs = Math.floor(paceInSeconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startRun = () => {
    setIsRunning(true)
    setIsPaused(false)
  }

  const pauseRun = () => {
    setIsPaused(true)
  }

  const stopRun = () => {
    setIsRunning(false)
    setIsPaused(false)
    setDuration(0)
    setDistance(0)
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Record Run</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowRoutesModal(true)}>
          <Map className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Container */}
      <Card className="h-64 relative overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="h-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center relative">
            <div className="text-center">
              <Map className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">GPS Ready</p>
            </div>

            {/* GPS Status Overlay */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <Satellite className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">GPS Ready</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{distance.toFixed(2)}</div>
            <div className="text-xs text-gray-600">Distance (km)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{formatTime(duration)}</div>
            <div className="text-xs text-gray-600">Duration</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-500">{calculatePace()}</div>
            <div className="text-xs text-gray-600">Pace (/km)</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isRunning ? (
          <Button onClick={startRun} className="bg-green-500 hover:bg-green-600 h-16 w-16 rounded-full">
            <Play className="h-6 w-6" />
          </Button>
        ) : (
          <>
            <Button onClick={pauseRun} variant="outline" className="h-16 w-16 rounded-full bg-transparent">
              <Pause className="h-6 w-6" />
            </Button>
            <Button onClick={stopRun} variant="destructive" className="h-16 w-16 rounded-full">
              <Square className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {/* Voice Cues */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4 text-green-500" />
            <span>Voice coaching enabled</span>
          </div>
        </CardContent>
      </Card>

      {/* Running Tips */}
      {isRunning && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-center">
              <h3 className="font-medium text-blue-900 mb-2">Keep it up! 🏃‍♂️</h3>
              <p className="text-sm text-blue-800">Maintain a steady rhythm and focus on your breathing.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {showRoutesModal && <RouteSelectorModal isOpen={showRoutesModal} onClose={() => setShowRoutesModal(false)} />}
    </div>
  )
}
