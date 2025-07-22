"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Heart, 
  TrendingUp, 
  Target, 
  Zap, 
  Timer,
  BarChart3,
  LineChart,
  Calendar,
  Award,
  RefreshCw
} from "lucide-react"
import { db } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"

interface AdvancedMetrics {
  id?: number
  runId: number
  deviceId: number
  vo2Max?: number
  lactateThresholdHR?: number
  lactateThresholdPace?: number
  trainingStressScore?: number
  intensityFactor?: number
  trainingLoad?: number
  recoveryTime?: number
  performanceCondition?: number
  racePredictor?: {
    fiveK: number
    tenK: number
    halfMarathon: number
    marathon: number
  }
  createdAt: Date
  updatedAt: Date
}

interface RunningDynamics {
  id?: number
  runId: number
  deviceId: number
  averageCadence?: number
  maxCadence?: number
  averageGroundContactTime?: number
  averageVerticalOscillation?: number
  averageStrideLength?: number
  groundContactBalance?: number
  verticalRatio?: number
  createdAt?: Date
  updatedAt?: Date
}

interface AdvancedMetricsDashboardProps {
  userId: number
  runId?: number
  showAllTime?: boolean
}

export function AdvancedMetricsDashboard({ 
  userId, 
  runId, 
  showAllTime = true 
}: AdvancedMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<AdvancedMetrics[]>([])
  const [dynamics, setDynamics] = useState<RunningDynamics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month')
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadMetricsData()
  }, [userId, runId, selectedPeriod])

  const loadMetricsData = async () => {
    setIsLoading(true)
    try {
      if (runId) {
        // Load metrics for specific run
        const runMetrics = await db.advancedMetrics
          .where('runId')
          .equals(runId)
          .toArray()
        
        const runDynamics = await db.runningDynamicsData
          .where('runId')
          .equals(runId)
          .toArray()

        setMetrics(runMetrics)
        setDynamics(runDynamics)
      } else {
        // Load all metrics for user within time period
        const runs = await db.runs.where('userId').equals(userId).toArray()
        const runIds = runs.map(run => run.id!)

        const cutoffDate = getCutoffDate(selectedPeriod)
        
        const allMetrics = await db.advancedMetrics
          .where('runId')
          .anyOf(runIds)
          .and(metric => !cutoffDate || metric.createdAt >= cutoffDate)
          .toArray()

        const allDynamics = await db.runningDynamicsData
          .where('runId')
          .anyOf(runIds)
          .and(dynamic => !cutoffDate || (dynamic.createdAt && dynamic.createdAt >= cutoffDate))
          .toArray()

        setMetrics(allMetrics)
        setDynamics(allDynamics)
      }
    } catch (error) {
      console.error('Error loading metrics data:', error)
      toast({
        title: "Load Failed",
        description: "Failed to load metrics data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getCutoffDate = (period: string): Date | null => {
    const now = new Date()
    switch (period) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return null
    }
  }

  const syncDeviceData = async () => {
    setIsSyncing(true)
    try {
      // Find connected devices
      const devices = await db.wearableDevices
        .where({ userId, connectionStatus: 'connected' })
        .toArray()

      for (const device of devices) {
        if (device.type === 'garmin' && device.authTokens?.accessToken) {
          // Trigger Garmin data sync
          const response = await fetch(`/api/devices/${device.id}/sync`, {
            method: 'POST'
          })
          
          if (!response.ok) {
            throw new Error(`Failed to sync ${device.name}`)
          }
        }
      }

      toast({
        title: "Sync Started",
        description: "Device data sync has been initiated"
      })

      // Reload data after sync
      setTimeout(() => {
        loadMetricsData()
        setIsSyncing(false)
      }, 3000)

    } catch (error) {
      console.error('Sync error:', error)
      toast({
        title: "Sync Failed",
        description: "Failed to sync device data",
        variant: "destructive"
      })
      setIsSyncing(false)
    }
  }

  const getLatestMetric = (field: keyof AdvancedMetrics) => {
    if (metrics.length === 0) return null
    const latest = metrics
      .filter(m => m[field] !== undefined && m[field] !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    return latest?.[field]
  }

  const getAverageMetric = (field: keyof AdvancedMetrics) => {
    const values = metrics
      .map(m => m[field])
      .filter(val => val !== undefined && val !== null && typeof val === 'number') as number[]
    
    if (values.length === 0) return null
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
  }

  const getLatestDynamic = (field: keyof RunningDynamics) => {
    if (dynamics.length === 0) return null
    const latest = dynamics
      .filter(d => d[field] !== undefined && d[field] !== null)
      .sort((a, b) => {
        const aDate = a.createdAt || new Date(0)
        const bDate = b.createdAt || new Date(0)
        return bDate.getTime() - aDate.getTime()
      })[0]
    return latest?.[field]
  }

  const getVO2MaxCategory = (vo2Max: number): { category: string; color: string } => {
    // Categories for males (adjust based on user gender and age)
    if (vo2Max >= 60) return { category: 'Excellent', color: 'text-green-600' }
    if (vo2Max >= 50) return { category: 'Good', color: 'text-blue-600' }
    if (vo2Max >= 40) return { category: 'Fair', color: 'text-yellow-600' }
    if (vo2Max >= 30) return { category: 'Poor', color: 'text-orange-600' }
    return { category: 'Very Poor', color: 'text-red-600' }
  }

  const formatPace = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
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

  const latestVO2Max = getLatestMetric('vo2Max') as number | null
  const averageVO2Max = getAverageMetric('vo2Max')
  const latestTrainingLoad = getLatestMetric('trainingLoad') as number | null
  const averageTrainingLoad = getAverageMetric('trainingLoad')
  const latestLTHR = getLatestMetric('lactateThresholdHR') as number | null
  const latestCadence = getLatestDynamic('averageCadence') as number | null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Metrics</h2>
          <p className="text-gray-600">
            {runId ? 'Single Run Analysis' : `Performance insights over ${selectedPeriod}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {showAllTime && !runId && (
            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Button variant="outline" onClick={syncDeviceData} disabled={isSyncing}>
            {isSyncing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-red-600" />
              <h3 className="font-medium">VO2 Max</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {latestVO2Max ? `${latestVO2Max} ml/kg/min` : 'No data'}
              </div>
              {latestVO2Max && (
                <Badge className={getVO2MaxCategory(latestVO2Max).color + ' mt-1'}>
                  {getVO2MaxCategory(latestVO2Max).category}
                </Badge>
              )}
              {averageVO2Max && averageVO2Max !== latestVO2Max && (
                <p className="text-sm text-gray-500 mt-1">Avg: {averageVO2Max}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <h3 className="font-medium">Training Load</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {latestTrainingLoad ? latestTrainingLoad : 'No data'}
              </div>
              {latestTrainingLoad && (
                <Progress 
                  value={Math.min(latestTrainingLoad / 500 * 100, 100)} 
                  className="mt-2 h-2"
                />
              )}
              {averageTrainingLoad && averageTrainingLoad !== latestTrainingLoad && (
                <p className="text-sm text-gray-500 mt-1">Avg: {averageTrainingLoad}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Lactate Threshold</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {latestLTHR ? `${latestLTHR} BPM` : 'No data'}
              </div>
              {getLatestMetric('lactateThresholdPace') && (
                <p className="text-sm text-gray-500 mt-1">
                  Pace: {formatPace(getLatestMetric('lactateThresholdPace') as number)}/km
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Timer className="h-5 w-5 text-green-600" />
              <h3 className="font-medium">Cadence</h3>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {latestCadence ? `${latestCadence} spm` : 'No data'}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {latestCadence && latestCadence >= 180 ? 'Optimal' : 
                 latestCadence && latestCadence >= 170 ? 'Good' : 
                 latestCadence ? 'Needs improvement' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="dynamics">Running Dynamics</TabsTrigger>
          <TabsTrigger value="predictions">Race Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Training Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Training Stress Score</span>
                  <span className="font-bold">
                    {getLatestMetric('trainingStressScore') || 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Intensity Factor</span>
                  <span className="font-bold">
                    {getLatestMetric('intensityFactor') 
                      ? (getLatestMetric('intensityFactor') as number).toFixed(2)
                      : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Recovery Time</span>
                  <span className="font-bold">
                    {getLatestMetric('recoveryTime') 
                      ? `${getLatestMetric('recoveryTime')}h`
                      : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Performance Condition</span>
                  <span className="font-bold">
                    {getLatestMetric('performanceCondition') 
                      ? `${getLatestMetric('performanceCondition')}%`
                      : 'No data'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Physiological Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>VO2 Max</span>
                    <span className="font-bold">
                      {latestVO2Max ? `${latestVO2Max} ml/kg/min` : 'No data'}
                    </span>
                  </div>
                  {latestVO2Max && (
                    <Progress 
                      value={Math.min(latestVO2Max / 70 * 100, 100)} 
                      className="h-2"
                    />
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Lactate Threshold HR</span>
                    <span className="font-bold">
                      {latestLTHR ? `${latestLTHR} BPM` : 'No data'}
                    </span>
                  </div>
                  {latestLTHR && (
                    <Progress 
                      value={Math.min(latestLTHR / 200 * 100, 100)} 
                      className="h-2"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dynamics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cadence & Stride</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Average Cadence</span>
                  <span className="font-bold">
                    {latestCadence ? `${latestCadence} spm` : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Max Cadence</span>
                  <span className="font-bold">
                    {getLatestDynamic('maxCadence') 
                      ? `${getLatestDynamic('maxCadence')} spm`
                      : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Average Stride Length</span>
                  <span className="font-bold">
                    {getLatestDynamic('averageStrideLength') 
                      ? `${(getLatestDynamic('averageStrideLength') as number).toFixed(2)}m`
                      : 'No data'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ground Contact & Oscillation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Ground Contact Time</span>
                  <span className="font-bold">
                    {getLatestDynamic('averageGroundContactTime') 
                      ? `${getLatestDynamic('averageGroundContactTime')}ms`
                      : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Vertical Oscillation</span>
                  <span className="font-bold">
                    {getLatestDynamic('averageVerticalOscillation') 
                      ? `${(getLatestDynamic('averageVerticalOscillation') as number).toFixed(1)}cm`
                      : 'No data'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Ground Contact Balance</span>
                  <span className="font-bold">
                    {getLatestDynamic('groundContactBalance') 
                      ? `${(getLatestDynamic('groundContactBalance') as number).toFixed(1)}%`
                      : 'No data'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5" />
                <span>Race Time Predictions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getLatestMetric('racePredictor') ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatPace((getLatestMetric('racePredictor') as any).fiveK)}
                    </div>
                    <div className="text-sm text-gray-600">5K</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPace((getLatestMetric('racePredictor') as any).tenK)}
                    </div>
                    <div className="text-sm text-gray-600">10K</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatPace((getLatestMetric('racePredictor') as any).halfMarathon)}
                    </div>
                    <div className="text-sm text-gray-600">Half Marathon</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {formatPace((getLatestMetric('racePredictor') as any).marathon)}
                    </div>
                    <div className="text-sm text-gray-600">Marathon</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No race prediction data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* No Data Message */}
      {metrics.length === 0 && dynamics.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Advanced Metrics Available</h3>
            <p className="text-gray-600 mb-4">
              Connect a compatible device like Garmin to get advanced running metrics and insights.
            </p>
            <Button onClick={syncDeviceData} disabled={isSyncing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}