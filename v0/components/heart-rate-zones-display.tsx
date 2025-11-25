"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Heart, Activity, Settings } from "lucide-react"
import { 
  HeartRateZoneConfig, 
  HeartRateAnalysis, 
  calculateHeartRateZones, 
  calculateMaxHeartRate,
  getZoneInfo,
  formatTimeInZone,
  getZonePercentage
} from "@/lib/heartRateZones"
import { db } from "@/lib/db"

interface HeartRateZonesDisplayProps {
  userId: number
  currentHeartRate?: number
  analysis?: HeartRateAnalysis
  showConfiguration?: boolean
  onConfigureZones?: () => void
}

export function HeartRateZonesDisplay({ 
  userId, 
  currentHeartRate, 
  analysis,
  showConfiguration = true,
  onConfigureZones 
}: HeartRateZonesDisplayProps) {
  const [zones, setZones] = useState<HeartRateZoneConfig | null>(null)
  const [userAge, setUserAge] = useState<number>(30)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadUserZones()
  }, [userId])

  const loadUserZones = async () => {
    try {
      // Load user's heart rate zones from database
      const userZones = await db.heartRateZones
        .where('userId')
        .equals(userId)
        .toArray()

      if (userZones.length > 0) {
        // Convert database zones to our format
        const zoneConfig: HeartRateZoneConfig = {
          zone1: { min: 0, max: 0 },
          zone2: { min: 0, max: 0 },
          zone3: { min: 0, max: 0 },
          zone4: { min: 0, max: 0 },
          zone5: { min: 0, max: 0 }
        }

        userZones.forEach(zone => {
          const zoneKey = `zone${zone.zoneNumber}` as keyof HeartRateZoneConfig
          if (zoneKey in zoneConfig) {
            zoneConfig[zoneKey] = { min: zone.minHeartRate, max: zone.maxHeartRate }
          }
        })

        setZones(zoneConfig)
      } else {
        // Calculate default zones based on age
        const user = await db.users.get(userId)
        const age = user?.dateOfBirth 
          ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear() 
          : 30
        
        setUserAge(age)
        const maxHR = calculateMaxHeartRate(age)
        const defaultZones = calculateHeartRateZones(maxHR)
        setZones(defaultZones)
      }
    } catch (error) {
      console.error('Error loading heart rate zones:', error)
      // Fallback to default zones
      const maxHR = calculateMaxHeartRate(userAge)
      const defaultZones = calculateHeartRateZones(maxHR)
      setZones(defaultZones)
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentZoneInfo = () => {
    if (!currentHeartRate || !zones) return null
    
    let currentZone = 1
    if (currentHeartRate > zones.zone1.max && currentHeartRate <= zones.zone2.max) currentZone = 2
    else if (currentHeartRate > zones.zone2.max && currentHeartRate <= zones.zone3.max) currentZone = 3
    else if (currentHeartRate > zones.zone3.max && currentHeartRate <= zones.zone4.max) currentZone = 4
    else if (currentHeartRate > zones.zone4.max) currentZone = 5

    return { zone: currentZone, info: getZoneInfo(currentZone) }
  }

  const renderZoneBar = (zoneNumber: number, zoneConfig: { min: number; max: number }) => {
    const zoneInfo = getZoneInfo(zoneNumber)
    const isCurrentZone = getCurrentZoneInfo()?.zone === zoneNumber
    const timeInZone = analysis?.timeInZones[zoneNumber] || 0
    const totalTime = analysis ? Object.values(analysis.timeInZones).reduce((sum, time) => sum + time, 0) : 0
    const percentage = getZonePercentage(timeInZone, totalTime)

    return (
      <div key={zoneNumber} className={`p-3 rounded-lg border-2 ${isCurrentZone ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: zoneInfo.color }}
            />
            <span className="font-medium">Zone {zoneNumber}</span>
            <Badge variant="outline">{zoneInfo.name}</Badge>
          </div>
          <span className="text-sm font-medium">{zoneConfig.min}-{zoneConfig.max} BPM</span>
        </div>
        
        <p className="text-sm text-gray-600 mb-2">{zoneInfo.description}</p>
        
        {analysis && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Time in zone:</span>
              <span className="font-medium">{formatTimeInZone(timeInZone)}</span>
            </div>
            <Progress 
              value={percentage} 
              className="h-2"
              style={{ 
                '--progress-background': zoneInfo.color + '20',
                '--progress-foreground': zoneInfo.color 
              } as any}
            />
            <div className="text-right text-xs text-gray-500">{percentage}%</div>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!zones) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Unable to load heart rate zones
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentZoneInfo = getCurrentZoneInfo()

  return (
    <div className="space-y-4">
      {/* Current Heart Rate Display */}
      {currentHeartRate && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-red-100 rounded-full">
                  <Heart className="h-6 w-6 text-red-600 animate-pulse" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{currentHeartRate} BPM</div>
                  {currentZoneInfo && (
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: currentZoneInfo.info.color }}
                      />
                      <span className="text-sm font-medium">Zone {currentZoneInfo.zone}</span>
                      <Badge variant="outline">{currentZoneInfo.info.name}</Badge>
                    </div>
                  )}
                </div>
              </div>
              {showConfiguration && (
                <Button variant="outline" size="sm" onClick={onConfigureZones}>
                  <Settings className="h-4 w-4 mr-1" />
                  Configure
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heart Rate Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Heart Rate Zones</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(zones).map(([zoneKey, zoneConfig]) => {
            const zoneNumber = parseInt(zoneKey.replace('zone', ''))
            return renderZoneBar(zoneNumber, zoneConfig)
          })}
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Heart Rate Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{analysis.averageHR}</div>
                <div className="text-sm text-gray-600">Average HR</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-700">{analysis.maxHR}</div>
                <div className="text-sm text-gray-600">Max HR</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{analysis.hrr}</div>
                <div className="text-sm text-gray-600">HR Range</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: getZoneInfo(analysis.currentZone).color }}
                  />
                  <div className="text-2xl font-bold">{analysis.currentZone}</div>
                </div>
                <div className="text-sm text-gray-600">Primary Zone</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}