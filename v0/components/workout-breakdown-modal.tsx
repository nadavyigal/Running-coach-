"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ShareRunModal } from "@/components/share-run-modal";

interface WorkoutBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WorkoutBreakdownModal({ isOpen, onClose }: WorkoutBreakdownModalProps) {
  const [selectedGoal, setSelectedGoal] = useState<"distance" | "duration">("distance")
  const [targetDistance, setTargetDistance] = useState("0.0")
  const [selectedDifficulty, setSelectedDifficulty] = useState("open")
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const presetDistances = [
    { label: "5k", value: "5.0" },
    { label: "10k", value: "10.0" },
    { label: "15k", value: "15.0" },
    { label: "Half Marathon", value: "21.1" },
  ]

  const difficulties = [
    { id: "open", label: "Open", description: "Range of difficulty suggestions" },
    { id: "easy", label: "Easy", description: "Comfortable effort" },
    { id: "medium", label: "Medium", description: "Moderate challenge" },
  ]

  const handleStart = () => {
    alert(`Starting workout with ${targetDistance}km target at ${selectedDifficulty} difficulty!`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Header with Gradient Background */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-400 text-white p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16" />
            <div className="absolute top-10 right-0 w-24 h-24 bg-white rounded-full translate-x-12 -translate-y-12" />
            <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white rounded-full -translate-x-20 translate-y-20" />
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={onClose} className="absolute -top-2 -left-2 text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-center pt-4">
              <h1 className="text-2xl font-bold mb-2">Select target goal</h1>
              <p className="text-white/90 text-sm">Set a total distance and we'll motivate you to the finish line</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Goal Type Toggle */}
          <div className="flex bg-gray-100 rounded-full p-1">
            <Button
              variant={selectedGoal === "distance" ? "default" : "ghost"}
              size="sm"
              className={`flex-1 rounded-full ${selectedGoal === "distance" ? "bg-black text-white" : "text-gray-600"}`}
              onClick={() => setSelectedGoal("distance")}
            >
              DISTANCE
            </Button>
            <Button
              variant={selectedGoal === "duration" ? "default" : "ghost"}
              size="sm"
              className={`flex-1 rounded-full ${selectedGoal === "duration" ? "bg-black text-white" : "text-gray-600"}`}
              onClick={() => setSelectedGoal("duration")}
            >
              DURATION
            </Button>
          </div>

          {/* Distance Input */}
          <div className="text-center">
            <div className="text-6xl font-bold text-gray-800 mb-4">
              {targetDistance}
              <span className="text-2xl text-gray-500 ml-2">KM</span>
            </div>

            {/* Preset Distance Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {presetDistances.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  className="h-12 bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => setTargetDistance(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">
              Select the difficulty of your long run. If you'd like a range of difficulty suggestions, select Open.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {difficulties.map((difficulty) => (
                <Button
                  key={difficulty.id}
                  variant={selectedDifficulty === difficulty.id ? "default" : "outline"}
                  className={`h-16 flex flex-col items-center justify-center ${
                    selectedDifficulty === difficulty.id ? "bg-black text-white" : "bg-gray-50"
                  }`}
                  onClick={() => setSelectedDifficulty(difficulty.id)}
                >
                  <div className="text-xs mb-1">⛰️</div>
                  <span className="font-medium">{difficulty.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 text-center">
              We'll build this workout off a current estimated race time from your plan. This will then inform the pace
              of your run.
            </p>
          </div>

          {/* Continue Button */}
          <Button onClick={handleStart} className="w-full h-12 bg-gray-800 hover:bg-black text-white">
            Continue
          </Button>
          {/* Share Button */}
          <Button onClick={() => setIsShareModalOpen(true)} className="w-full h-12 mt-2 bg-blue-600 hover:bg-blue-700 text-white">
            Share Run
          </Button>
        </div>
        {/* ShareRunModal Integration */}
        {isShareModalOpen && (
          <ShareRunModal
            runId={"placeholder_run_id"}
            runDate={new Date().toLocaleDateString()}
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
