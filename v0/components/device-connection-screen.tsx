"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Watch, 
  Activity, 
  Heart, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/db"

interface WearableDevice {
  id?: number;
  userId: number;
  type: 'apple_watch' | 'garmin' | 'fitbit';
  name: string;
  model?: string;
  deviceId: string;
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  capabilities: string[];
  settings: any;
  authTokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface DeviceConnectionScreenProps {
  userId: number;
  onDeviceConnected?: (device: WearableDevice) => void;
}

export function DeviceConnectionScreen({ userId, onDeviceConnected }: DeviceConnectionScreenProps) {
  const [connectedDevices, setConnectedDevices] = useState<WearableDevice[]>([])
  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const supportedDevices = [
    {
      type: 'apple_watch' as const,
      name: 'Apple Watch',
      icon: Watch,
      description: 'Heart rate, workouts, and health metrics',
      capabilities: ['heart_rate', 'workouts', 'health_kit'],
      color: 'bg-gray-900'
    },
    {
      type: 'garmin' as const,
      name: 'Garmin Device',
      icon: Activity,
      description: 'Advanced metrics, VO2 max, and training load',
      capabilities: ['heart_rate', 'vo2_max', 'training_load', 'running_dynamics'],
      color: 'bg-blue-600'
    }
  ]

  useEffect(() => {
    loadConnectedDevices()
  }, [userId])

  const loadConnectedDevices = async () => {
    try {
      // Always read from client-side Dexie.js (IndexedDB) — this is a PWA with local storage
      const devices = await db.wearableDevices.where('userId').equals(userId).toArray()
      setConnectedDevices(devices as WearableDevice[])
    } catch (error) {
      console.error('Error loading devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const connectAppleWatch = async () => {
    setIsConnecting('apple_watch')
    
    try {
      // Simulate Apple Watch connection flow
      // In real implementation, this would request HealthKit permissions
      const delayMs = process.env.NODE_ENV === 'test' ? 0 : 2000
      await new Promise(resolve => setTimeout(resolve, delayMs))
      
      const response = await fetch('/api/devices/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          deviceType: 'apple_watch',
          deviceId: `apple-watch-${userId}-${Date.now()}`,
          name: 'Apple Watch',
          model: 'Series 8',
          capabilities: ['heart_rate', 'workouts', 'health_kit']
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Apple Watch Connected",
          description: "Your Apple Watch has been connected successfully.",
        })
        
        await loadConnectedDevices()
        onDeviceConnected?.(data.device)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Apple Watch connection error:', error)
      toast({
        title: "Connection Failed",
        description: "Failed to connect Apple Watch. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(null)
    }
  }

  const connectGarmin = async () => {
    setIsConnecting('garmin')
    
    try {
      const response = await fetch('/api/devices/garmin/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId),
        },
        body: JSON.stringify({
          userId,
          redirectUri: `${window.location.origin}/garmin/callback`
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Redirect to Garmin OAuth
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Garmin connection error:', error)
      toast({
        title: "Connection Failed",
        description: "Failed to initiate Garmin connection. Please try again.",
        variant: "destructive",
      })
      setIsConnecting(null)
    }
  }

  const syncDevice = async (deviceId: number) => {
    setIsSyncing(deviceId)

    try {
      const response = await fetch(`/api/devices/${deviceId}/sync`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        // Update sync state in Dexie.js client-side
        await db.wearableDevices.update(deviceId, {
          connectionStatus: 'syncing',
          updatedAt: new Date()
        })

        toast({
          title: "Sync Started",
          description: "Device sync has been initiated.",
        })

        // Update to connected with fresh lastSync after delay
        setTimeout(async () => {
          await db.wearableDevices.update(deviceId, {
            connectionStatus: 'connected',
            lastSync: new Date(),
            updatedAt: new Date()
          })
          await loadConnectedDevices()
          setIsSyncing(null)
        }, 2000)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Device sync error:', error)
      toast({
        title: "Sync Failed",
        description: "Failed to sync device data. Please try again.",
        variant: "destructive",
      })
      setIsSyncing(null)
    }
  }

  const disconnectDevice = async (device: WearableDevice) => {
    try {
      const response =
        device.type === 'garmin'
          ? await fetch('/api/devices/garmin/disconnect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': String(userId),
              },
              body: JSON.stringify({ userId }),
            })
          : await fetch(`/api/devices/${device.id}`, {
              method: 'DELETE',
            })

      const data = await response.json()

      if (data.success) {
        // Update device status in Dexie.js client-side
        await db.wearableDevices.update(device.id!, {
          connectionStatus: 'disconnected',
          lastSync: null,
          authTokens: undefined,
          updatedAt: new Date()
        })

        toast({
          title: "Device Disconnected",
          description: "Device has been disconnected successfully.",
        })

        await loadConnectedDevices()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Device disconnection error:', error)
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect device. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getConnectionStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'syncing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800'
      case 'syncing':
        return 'bg-blue-100 text-blue-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Connect Your Devices</h1>
        <p className="text-gray-600">
          Connect your wearable devices to get personalized coaching and advanced metrics
        </p>
      </div>

      {/* Connected Devices */}
      {connectedDevices && connectedDevices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Connected Devices</h2>
          {connectedDevices.map((device) => (
            <Card key={device.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2 rounded-full bg-gray-100">
                    {device.type === 'apple_watch' ? (
                      <Watch className="h-6 w-6" />
                    ) : (
                      <Activity className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{device.name}</h3>
                    {device.model && <p className="text-sm text-gray-500">{device.model}</p>}
                    <div className="flex items-center space-x-2 mt-1">
                      {getConnectionStatusIcon(device.connectionStatus)}
                      <Badge className={getConnectionStatusColor(device.connectionStatus)}>
                        {device.connectionStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncDevice(device.id!)}
                    disabled={isSyncing === device.id || device.connectionStatus !== 'connected'}
                  >
                    {isSyncing === device.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectDevice(device)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
              
              {device.lastSync && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-500">
                    Last sync: {new Date(device.lastSync).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {device.capabilities.map((capability) => (
                      <Badge key={capability} variant="secondary" className="text-xs">
                        {capability.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Available Devices */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Devices</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supportedDevices.map((deviceType) => {
            const isConnected = connectedDevices && connectedDevices.some(d => d.type === deviceType.type && d.connectionStatus === 'connected')
            const isConnectingThis = isConnecting === deviceType.type
            
            return (
              <Card key={deviceType.type} className={`p-6 ${isConnected ? 'bg-green-50 border-green-200' : ''}`}>
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-lg ${deviceType.color} text-white`}>
                      <deviceType.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{deviceType.name}</CardTitle>
                      <p className="text-sm text-gray-600">{deviceType.description}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Features:</h4>
                    <div className="flex flex-wrap gap-2">
                      {deviceType.capabilities.map((capability) => (
                        <div key={capability} className="flex items-center space-x-1">
                          <Heart className="h-3 w-3 text-red-500" />
                          <span className="text-xs">{capability.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    disabled={isConnected || isConnectingThis}
                    onClick={deviceType.type === 'apple_watch' ? connectAppleWatch : connectGarmin}
                  >
                    {isConnectingThis ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : isConnected ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Connected
                      </>
                    ) : (
                      `Connect ${deviceType.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
