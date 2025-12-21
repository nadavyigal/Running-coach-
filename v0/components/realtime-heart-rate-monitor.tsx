"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Heart, Activity, TrendingUp, TrendingDown } from "lucide-react"
import { 
  HeartRateZoneConfig, 
  getHeartRateZone,
  getZoneInfo
} from "@/lib/heartRateZones"

interface RealtimeHeartRateMonitorProps {
  currentHeartRate: number
  zones: HeartRateZoneConfig
  targetZone?: number
  showTrend?: boolean
  compact?: boolean
  onZoneChange?: (newZone: number, previousZone: number) => void
}

export function RealtimeHeartRateMonitor({
  currentHeartRate,
  zones,
  targetZone,
  showTrend = true,
  compact = false,
  onZoneChange
}: RealtimeHeartRateMonitorProps) {
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([])
  const [currentZone, setCurrentZone] = useState<number>(1)
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable')

  useEffect(() => {
    // Update heart rate history
    setHeartRateHistory(prev => {
      const newHistory = [...prev, currentHeartRate].slice(-10) // Keep last 10 readings
      return newHistory
    })

    // Calculate current zone
    const newZone = getHeartRateZone(currentHeartRate, zones)
    if (newZone !== currentZone) {
      setCurrentZone(newZone)
      onZoneChange?.(newZone, currentZone)
    }

    // Calculate trend
    if (heartRateHistory.length >= 3) {
      const recent = heartRateHistory.slice(-3)
      const avgRecent = recent.reduce((sum, hr) => sum + hr, 0) / recent.length
      const difference = currentHeartRate - avgRecent

      if (difference > 2) setTrend('up')
      else if (difference < -2) setTrend('down')
      else setTrend('stable')
    }
  }, [currentHeartRate, zones, currentZone, heartRateHistory, onZoneChange])

  const currentZoneInfo = getZoneInfo(currentZone)
  const targetZoneInfo = targetZone ? getZoneInfo(targetZone) : null
  const isInTargetZone = targetZone ? currentZone === targetZone : true

  const getIntensityPercentage = () => {
    const zoneConfig = zones[`zone${currentZone}` as keyof HeartRateZoneConfig]
    if (!zoneConfig) return 0
    
    const range = zoneConfig.max - zoneConfig.min
    const position = currentHeartRate - zoneConfig.min
    return Math.max(0, Math.min(100, (position / range) * 100))
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-blue-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border shadow-sm">
        <div className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-red-600 animate-pulse" />
          <span className="text-xl font-bold">{currentHeartRate}</span>
        </div>
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: currentZoneInfo.color }}
        />
        <Badge 
          variant="outline" 
          className={isInTargetZone ? 'border-green-500 text-green-700' : 'border-orange-500 text-orange-700'}
        >
          Zone {currentZone}
        </Badge>
        {showTrend && getTrendIcon()}
      </div>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-white to-gray-50">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Current Heart Rate Display */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <Heart className="h-8 w-8 text-red-600 animate-pulse" />
              <div className="text-6xl font-bold text-gray-900">{currentHeartRate}</div>
              <div className="text-xl text-gray-600 self-end pb-2">BPM</div>
            </div>
            
            {showTrend && (
              <div className="flex items-center justify-center space-x-1">
                {getTrendIcon()}
                <span className="text-sm text-gray-500 capitalize">{trend}</span>
              </div>
            )}
          </div>

          {/* Current Zone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: currentZoneInfo.color }}
                />
                <span className="font-medium">Zone {currentZone}</span>
                <Badge variant="outline">{currentZoneInfo.name}</Badge>
              </div>
              <span className="text-sm text-gray-600">
                {zones[`zone${currentZone}` as keyof HeartRateZoneConfig].min}-
                {zones[`zone${currentZone}` as keyof HeartRateZoneConfig].max} BPM
              </span>
            </div>
            
            <Progress 
              value={getIntensityPercentage()} 
              className="h-3"
              style={{ 
                '--progress-background': currentZoneInfo.color + '20',
                '--progress-foreground': currentZoneInfo.color 
              } as any}
            />
            
            <p className="text-sm text-gray-600">{currentZoneInfo.description}</p>
          </div>

          {/* Target Zone Comparison */}
          {targetZone && targetZone !== currentZone && (
            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: targetZoneInfo!.color }}
                  />
                  <span className="font-medium text-orange-800">Target: Zone {targetZone}</span>
                  <Badge variant="outline" className="border-orange-300 text-orange-700">
                    {targetZoneInfo!.name}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                {currentZone < targetZone ? 'Increase intensity to reach target zone' : 'Reduce intensity to reach target zone'}
              </p>
            </div>
          )}

          {/* Zone Indicator Bar */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Heart Rate Zones</div>
            <div className="flex rounded-lg overflow-hidden h-6">
              {[1, 2, 3, 4, 5].map(zoneNumber => {
                const zoneInfo = getZoneInfo(zoneNumber)
                const isCurrentZone = zoneNumber === currentZone
                const isTargetZone = zoneNumber === targetZone
                
                return (
                  <div
                    key={zoneNumber}
                    className={`flex-1 flex items-center justify-center text-xs font-medium text-white relative ${
                      isCurrentZone ? 'ring-2 ring-white ring-inset' : ''
                    }`}
                    style={{ backgroundColor: zoneInfo.color }}
                  >
                    {zoneNumber}
                    {isTargetZone && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Recovery</span>
              <span>VO2 Max</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
