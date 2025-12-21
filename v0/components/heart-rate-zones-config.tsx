"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Heart, Save, RotateCcw, Calculator } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { 
  HeartRateZoneConfig, 
  calculateHeartRateZones, 
  calculateMaxHeartRate,
  getZoneInfo
} from "@/lib/heartRateZones"
import { db } from "@/lib/db"

interface HeartRateZonesConfigProps {
  userId: number
  onSave?: (zones: HeartRateZoneConfig) => void
  onCancel?: () => void
}

export function HeartRateZonesConfig({ userId, onSave, onCancel }: HeartRateZonesConfigProps) {
  const [zones, setZones] = useState<HeartRateZoneConfig>({
    zone1: { min: 50, max: 60 },
    zone2: { min: 60, max: 70 },
    zone3: { min: 70, max: 80 },
    zone4: { min: 80, max: 90 },
    zone5: { min: 90, max: 100 }
  })
  const [age, setAge] = useState<number>(30)
  const [restingHR, setRestingHR] = useState<number>(60)
  const [maxHR, setMaxHR] = useState<number>(190)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadCurrentZones()
  }, [userId])

  const loadCurrentZones = async () => {
    try {
      // Load user's current zones and profile
      const user = await db.users.get(userId)
      if (user?.dateOfBirth) {
        const calculatedAge = new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
        setAge(calculatedAge)
        setMaxHR(calculateMaxHeartRate(calculatedAge))
      }

      if (user?.restingHeartRate) {
        setRestingHR(user.restingHeartRate)
      }

      const userZones = await db.heartRateZones
        .where('userId')
        .equals(userId)
        .toArray()

      if (userZones.length > 0) {
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
        // Calculate default zones
        calculateDefaultZones()
      }
    } catch (error) {
      console.error('Error loading zones:', error)
      calculateDefaultZones()
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDefaultZones = () => {
    const calculatedZones = calculateHeartRateZones(maxHR, restingHR)
    setZones(calculatedZones)
  }

  const handleZoneChange = (zoneNumber: number, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0
    const zoneKey = `zone${zoneNumber}` as keyof HeartRateZoneConfig
    
    setZones(prev => ({
      ...prev,
      [zoneKey]: {
        ...prev[zoneKey],
        [field]: numValue
      }
    }))
  }

  const validateZones = (): boolean => {
    const zoneValues = Object.values(zones)
    
    // Check that zones don't overlap incorrectly
    for (let i = 0; i < zoneValues.length - 1; i++) {
      if (zoneValues[i].max > zoneValues[i + 1].min) {
        toast({
          title: "Invalid Zones",
          description: `Zone ${i + 1} maximum cannot exceed Zone ${i + 2} minimum`,
          variant: "destructive"
        })
        return false
      }
    }

    // Check that min < max for each zone
    for (let i = 0; i < zoneValues.length; i++) {
      if (zoneValues[i].min >= zoneValues[i].max) {
        toast({
          title: "Invalid Zone Range",
          description: `Zone ${i + 1} minimum must be less than maximum`,
          variant: "destructive"
        })
        return false
      }
    }

    return true
  }

  const saveZones = async () => {
    if (!validateZones()) return

    setIsSaving(true)
    try {
      // Delete existing zones
      await db.heartRateZones.where('userId').equals(userId).delete()

      // Save new zones
      const zonesToSave = Object.entries(zones).map(([_zoneKey, zoneConfig], index) => ({
        userId,
        zoneNumber: index + 1,
        zoneName: getZoneInfo(index + 1).name,
        minHeartRate: zoneConfig.min,
        maxHeartRate: zoneConfig.max,
        color: getZoneInfo(index + 1).color,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      for (const zone of zonesToSave) {
        await db.heartRateZones.add(zone)
      }

      // Update user's resting heart rate if changed
      await db.users.update(userId, {
        restingHeartRate: restingHR,
        updatedAt: new Date()
      })

      toast({
        title: "Zones Saved",
        description: "Your heart rate zones have been updated successfully"
      })

      onSave?.(zones)
    } catch (error) {
      console.error('Error saving zones:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save heart rate zones",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const resetToCalculated = () => {
    calculateDefaultZones()
    toast({
      title: "Zones Reset",
      description: "Heart rate zones have been reset to calculated values"
    })
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5" />
            <span>Heart Rate Zone Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Data */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Personal Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 30)}
                  min="15"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restingHR">Resting HR (BPM)</Label>
                <Input
                  id="restingHR"
                  type="number"
                  value={restingHR}
                  onChange={(e) => setRestingHR(parseInt(e.target.value) || 60)}
                  min="40"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxHR">Max HR (BPM)</Label>
                <Input
                  id="maxHR"
                  type="number"
                  value={maxHR}
                  onChange={(e) => setMaxHR(parseInt(e.target.value) || 190)}
                  min="150"
                  max="220"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={calculateDefaultZones}>
                <Calculator className="h-4 w-4 mr-1" />
                Calculate Zones
              </Button>
              <Button variant="outline" size="sm" onClick={resetToCalculated}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset to Calculated
              </Button>
            </div>
          </div>

          <Separator />

          {/* Zone Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Heart Rate Zones</h3>
            <div className="space-y-4">
              {Object.entries(zones).map(([zoneKey, zoneConfig], index) => {
                const zoneNumber = index + 1
                const zoneInfo = getZoneInfo(zoneNumber)
                
                return (
                  <div key={zoneKey} className="flex items-center space-x-4 p-4 rounded-lg border">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: zoneInfo.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium">Zone {zoneNumber}</div>
                        <Badge variant="outline" className="text-xs">{zoneInfo.name}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min BPM</Label>
                        <Input
                          type="number"
                          value={zoneConfig.min}
                          onChange={(e) => handleZoneChange(zoneNumber, 'min', e.target.value)}
                          className="w-20 text-sm"
                          min="30"
                          max="220"
                        />
                      </div>
                      <span className="text-gray-500">-</span>
                      <div className="space-y-1">
                        <Label className="text-xs">Max BPM</Label>
                        <Input
                          type="number"
                          value={zoneConfig.max}
                          onChange={(e) => handleZoneChange(zoneNumber, 'max', e.target.value)}
                          className="w-20 text-sm"
                          min="30"
                          max="220"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={saveZones} disabled={isSaving}>
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Zones
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
