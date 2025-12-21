'use client';
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Flame } from "lucide-react"
import { dbUtils } from "@/lib/dbUtils"

export interface StreakIndicatorProps {
  userId?: number
  animationEnabled?: boolean
  onAnimationToggle?: (enabled: boolean) => void
}

export function StreakIndicator({ userId, animationEnabled = true, onAnimationToggle }: StreakIndicatorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streak, setStreak] = useState<number>(0)
  const [longest, setLongest] = useState<number>(0)
  const [showAnim, setShowAnim] = useState(animationEnabled)
  const prevStreak = useRef<number>(0)
  const [highlight, setHighlight] = useState(false)

  // Load user streak data
  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError(null)
    async function load() {
      try {
        const u = userId ? await dbUtils.getCurrentUser() : await dbUtils.getCurrentUser()
        if (!u) throw new Error("User not found")
        setStreak(u.currentStreak || 0)
        setLongest(u.longestStreak || 0)
      } catch (e: any) {
        setError(e.message || "Failed to load streak data")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [userId])

  // Animation on streak increase
  useEffect(() => {
    if (showAnim && streak > prevStreak.current) {
      setHighlight(true)
      const timeout = setTimeout(() => setHighlight(false), 1200)
      return () => clearTimeout(timeout)
    }
    prevStreak.current = streak
  }, [streak, showAnim])

  // Toggle animation
  const handleAnimToggle = (val: boolean) => {
    setShowAnim(val)
    onAnimationToggle?.(val)
  }

  // Real-time update: listen for custom event (e.g., streak-updated)
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && typeof e.detail.streak === "number") {
        setStreak(e.detail.streak)
      }
    }
    window.addEventListener("streak-updated", handler)
    return () => window.removeEventListener("streak-updated", handler)
  }, [])

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-lg" />
  }
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-4 text-red-700">{error}</CardContent>
      </Card>
    )
  }

  // Zero state
  if (!streak) {
    return (
      <Card className="bg-gradient-to-r from-gray-900 to-gray-800 text-white animate-in fade-in-50 duration-500">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-6 w-6 text-orange-400 animate-pulse" />
            <span>Streak</span>
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch checked={showAnim} onCheckedChange={handleAnimToggle} aria-label="Toggle streak animation" />
              </TooltipTrigger>
              <TooltipContent>Toggle animation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="text-2xl font-bold mb-1">Start your streak!</div>
          <div className="text-sm text-gray-300 mb-2">Complete your first run or workout to begin a streak.</div>
          <Badge className="bg-gray-700 text-gray-200">Longest Streak: {longest}</Badge>
        </CardContent>
      </Card>
    )
  }

  // Normal state
  return (
    <Card className={`bg-gradient-to-r from-orange-900 to-yellow-900 text-white shadow-lg transition-all duration-500 ${highlight ? "ring-4 ring-orange-400 scale-105" : ""}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className={`h-7 w-7 ${highlight ? "animate-bounce text-yellow-400" : "text-orange-400"}`} />
          <span>Streak</span>
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Switch checked={showAnim} onCheckedChange={handleAnimToggle} aria-label="Toggle streak animation" />
            </TooltipTrigger>
            <TooltipContent>Toggle animation</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-4xl font-extrabold tracking-tight ${highlight ? "animate-bounce text-yellow-300" : ""}`}>{streak}</span>
          <Badge className="bg-orange-700 text-yellow-200">🔥 Streak</Badge>
        </div>
        <Progress value={Math.min((streak / (longest || 1)) * 100, 100)} className="mb-2 bg-gray-800" />
        <div className="text-xs text-gray-200">Longest Streak: {longest}</div>
      </CardContent>
    </Card>
  )
} 
