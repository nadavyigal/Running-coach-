"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Watch, 
  Activity, 
  Settings, 
  Wifi, 
  Battery, 
  RefreshCw,
  Heart,
  BarChart3,
  Calendar,
  Bell,
  Shield,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db"
import { BackgroundSyncStatus } from "./background-sync-status"

interface WearableDevice {
  id: number
  userId: number
  type: 'apple_watch' | 'garmin' | 'fitbit'
  name: string
  model?: string
  deviceId: string
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error'
  lastSync: Date | null
  capabilities: string[]
  settings: any
  authTokens?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}

interface DeviceSettingsScreenProps {
  userId: number
  deviceId: number
  onBack?: () => void
}

export function DeviceSettingsScreen({ userId, deviceId, onBack }: DeviceSettingsScreenProps) {
  const [device, setDevice] = useState<WearableDevice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [localSettings, setLocalSettings] = useState<any>({})
  const { toast } = useToast()

  useEffect(() => {
    loadDevice()
  }, [deviceId])

  const loadDevice = async () => {
    setIsLoading(true)
    try {
      const deviceData = await db.wearableDevices.get(deviceId)
      if (deviceData) {
        setDevice(deviceData)
        setLocalSettings(deviceData.settings || {})
      }
    } catch (error) {
      console.error('Error loading device:', error)
      toast({
        title: "Load Failed",
        description: "Failed to load device settings",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!device) return

    setIsSaving(true)
    try {
      await db.wearableDevices.update(deviceId, {
        settings: localSettings,
        updatedAt: new Date()
      })

      setDevice(prev => prev ? { ...prev, settings: localSettings } : null)
      
      toast({
        title: "Settings Saved",
        description: "Device settings have been updated successfully"
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save device settings",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    if (!device) return

    try {
      await db.wearableDevices.update(deviceId, {
        connectionStatus: 'syncing',
        updatedAt: new Date()
      })

      // Simulate connection test
      setTimeout(async () => {
        const success = Math.random() > 0.2 // 80% success rate
        await db.wearableDevices.update(deviceId, {
          connectionStatus: success ? 'connected' : 'error',
          lastSync: success ? new Date() : device.lastSync,
          updatedAt: new Date()
        })

        setDevice(prev => prev ? {
          ...prev,
          connectionStatus: success ? 'connected' : 'error',
          lastSync: success ? new Date() : prev.lastSync
        } : null)

        toast({
          title: success ? "Connection Successful" : "Connection Failed",
          description: success 
            ? "Device connection is working properly" 
            : "Failed to connect to device. Check device settings.",
          variant: success ? "default" : "destructive"
        })
      }, 2000)

    } catch (error) {
      console.error('Error testing connection:', error)
    }
  }

  const deleteDevice = async () => {
    if (!device) return

    setIsDeleting(true)
    try {
      // Cancel any pending sync jobs
      await fetch(`/api/sync/jobs?userId=${userId}&cancelAll=true`, {
        method: 'DELETE'
      })

      // Delete device
      await db.wearableDevices.delete(deviceId)

      toast({
        title: "Device Removed",
        description: "Device has been removed from your account"
      })

      onBack?.()
    } catch (error) {
      console.error('Error deleting device:', error)
      toast({
        title: "Delete Failed",
        description: "Failed to remove device",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const updateLocalSetting = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: value
    }))
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'apple_watch': return Watch
      case 'garmin': return Activity
      default: return Activity
    }
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600'
      case 'syncing': return 'text-blue-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getConnectionStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return CheckCircle
      case 'syncing': return RefreshCw
      case 'error': return AlertTriangle
      default: return Clock
    }
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

  if (!device) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Device not found
          </div>
        </CardContent>
      </Card>
    )
  }

  const DeviceIcon = getDeviceIcon(device.type)
  const StatusIcon = getConnectionStatusIcon(device.connectionStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              ← Back
            </Button>
          )}
          <DeviceIcon className="h-6 w-6" />
          <div>
            <h2 className="text-2xl font-bold">{device.name}</h2>
            {device.model && (
              <p className="text-gray-600">{device.model}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <StatusIcon className={`h-5 w-5 ${getConnectionStatusColor(device.connectionStatus)} ${device.connectionStatus === 'syncing' ? 'animate-spin' : ''}`} />
          <Badge className={getConnectionStatusColor(device.connectionStatus)}>
            {device.connectionStatus}
          </Badge>
        </div>
      </div>

      {/* Device Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="h-5 w-5" />
            <span>Connection Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm text-gray-600">Last Sync</Label>
              <div className="font-medium">
                {device.lastSync 
                  ? new Date(device.lastSync).toLocaleString()
                  : 'Never synced'
                }
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Device ID</Label>
              <div className="font-medium font-mono text-sm">{device.deviceId}</div>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Capabilities</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {device.capabilities.map(cap => (
                  <Badge key={cap} variant="secondary" className="text-xs">
                    {cap.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={testConnection}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Tabs defaultValue="sync" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          <TabsTrigger value="data">Data Collection</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automatic Sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Background Sync</Label>
                  <p className="text-sm text-gray-600">Automatically sync data in the background</p>
                </div>
                <Switch
                  checked={localSettings.autoSync !== false}
                  onCheckedChange={(checked) => updateLocalSetting('autoSync', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select
                  value={localSettings.syncFrequency || 'normal'}
                  onValueChange={(value) => updateLocalSetting('syncFrequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time (High battery usage)</SelectItem>
                    <SelectItem value="frequent">Every 15 minutes</SelectItem>
                    <SelectItem value="normal">Every hour</SelectItem>
                    <SelectItem value="battery">Every 3 hours (Battery saver)</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sync on WiFi Only</Label>
                  <p className="text-sm text-gray-600">Only sync when connected to WiFi</p>
                </div>
                <Switch
                  checked={localSettings.wifiOnly || false}
                  onCheckedChange={(checked) => updateLocalSetting('wifiOnly', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Background Sync Status */}
          <BackgroundSyncStatus userId={userId} deviceId={deviceId} />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Heart className="h-5 w-5" />
                <span>Heart Rate Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Collect Heart Rate Data</Label>
                  <p className="text-sm text-gray-600">Record heart rate during activities</p>
                </div>
                <Switch
                  checked={localSettings.collectHeartRate !== false}
                  onCheckedChange={(checked) => updateLocalSetting('collectHeartRate', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Resting Heart Rate Monitoring</Label>
                  <p className="text-sm text-gray-600">Track resting heart rate trends</p>
                </div>
                <Switch
                  checked={localSettings.restingHRMonitoring || false}
                  onCheckedChange={(checked) => updateLocalSetting('restingHRMonitoring', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Advanced Metrics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Running Dynamics</Label>
                  <p className="text-sm text-gray-600">Cadence, ground contact time, etc.</p>
                </div>
                <Switch
                  checked={localSettings.runningDynamics || false}
                  onCheckedChange={(checked) => updateLocalSetting('runningDynamics', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Performance Metrics</Label>
                  <p className="text-sm text-gray-600">VO2 max, training load, recovery</p>
                </div>
                <Switch
                  checked={localSettings.performanceMetrics || false}
                  onCheckedChange={(checked) => updateLocalSetting('performanceMetrics', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>GPS Tracking</Label>
                  <p className="text-sm text-gray-600">Record GPS routes and elevation</p>
                </div>
                <Switch
                  checked={localSettings.gpsTracking !== false}
                  onCheckedChange={(checked) => updateLocalSetting('gpsTracking', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Workout Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Workout Reminders</Label>
                  <p className="text-sm text-gray-600">Get notified about scheduled workouts</p>
                </div>
                <Switch
                  checked={localSettings.workoutReminders !== false}
                  onCheckedChange={(checked) => updateLocalSetting('workoutReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Goal Progress Updates</Label>
                  <p className="text-sm text-gray-600">Weekly progress notifications</p>
                </div>
                <Switch
                  checked={localSettings.goalProgressNotifications || false}
                  onCheckedChange={(checked) => updateLocalSetting('goalProgressNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Heart Rate Zone Alerts</Label>
                  <p className="text-sm text-gray-600">Alerts when entering specific zones</p>
                </div>
                <Switch
                  checked={localSettings.heartRateAlerts || false}
                  onCheckedChange={(checked) => updateLocalSetting('heartRateAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Data Encryption</Label>
                  <p className="text-sm text-gray-600">Encrypt data during sync</p>
                </div>
                <Switch
                  checked={localSettings.dataEncryption !== false}
                  onCheckedChange={(checked) => updateLocalSetting('dataEncryption', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Retention</Label>
                <Select
                  value={localSettings.dataRetention || '365'}
                  onValueChange={(value) => updateLocalSetting('dataRetention', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Device Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Device Name</Label>
                <Input
                  value={device.name}
                  onChange={(e) => setDevice(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Enter device name"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Danger Zone</span>
                </div>
                
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-800">Remove Device</h4>
                    <p className="text-sm text-red-700">
                      This will permanently remove the device from your account and cancel all sync jobs.
                      This action cannot be undone.
                    </p>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={deleteDevice}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remove Device
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={loadDevice}>
          Cancel
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Settings className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}