"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Battery, 
  AlertTriangle,
  CheckCircle,
  BarChart3
} from "lucide-react"
import { db } from "@/lib/db"

interface TrainingLoadData {
  date: Date
  acuteLoad: number
  chronicLoad: number
  trainingStressBalance: number
  rampRate: number
  recommendation: 'rest' | 'easy' | 'moderate' | 'hard' | 'peak'
}

interface TrainingLoadAnalyzerProps {
  userId: number
  period?: 'week' | 'month' | 'quarter'
}

export function TrainingLoadAnalyzer({ userId, period = 'month' }: TrainingLoadAnalyzerProps) {
  const [loadData, setLoadData] = useState<TrainingLoadData[]>([])
  const [currentLoad, setCurrentLoad] = useState<TrainingLoadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'recommendations'>('overview')

  useEffect(() => {
    calculateTrainingLoad()
  }, [userId, period])

  const calculateTrainingLoad = async () => {
    setIsLoading(true)
    try {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : 90
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      // Get runs with metrics
      const runs = await db.runs
        .where('userId')
        .equals(userId)
        .and(run => run.completedAt >= startDate && run.completedAt <= endDate)
        .toArray()

      const runIds = runs.map(run => run.id!)
      
      // Get advanced metrics for these runs
      const metrics = await db.advancedMetrics
        .where('runId')
        .anyOf(runIds)
        .toArray()

      // Calculate daily training loads
      const dailyLoads = calculateDailyLoads(runs, metrics, startDate, endDate)
      
      // Calculate acute load (7-day average), chronic load (42-day average), and TSB
      const loadDataWithMetrics = calculateLoadMetrics(dailyLoads)
      
      setLoadData(loadDataWithMetrics)
      setCurrentLoad(loadDataWithMetrics[loadDataWithMetrics.length - 1] || null)
    } catch (error) {
      console.error('Error calculating training load:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDailyLoads = (runs: any[], metrics: any[], startDate: Date, endDate: Date) => {
    const dailyLoads: { [key: string]: number } = {}
    
    // Initialize all days with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0]
      dailyLoads[dateKey] = 0
    }

    // Calculate load for each run
    runs.forEach(run => {
      const dateKey = run.completedAt.toISOString().split('T')[0]
      const runMetrics = metrics.find(m => m.runId === run.id)
      
      // Use TSS if available, otherwise calculate from duration and intensity
      let tss = runMetrics?.trainingStressScore
      
      if (!tss && run.duration) {
        // Estimate TSS based on duration and effort
        const durationHours = run.duration / 3600
        const intensityFactor = runMetrics?.intensityFactor || 0.7 // Default moderate intensity
        tss = Math.round(durationHours * 100 * intensityFactor * intensityFactor)
      }
      
      if (tss) {
        dailyLoads[dateKey] += tss
      }
    })

    return dailyLoads
  }

  const calculateLoadMetrics = (dailyLoads: { [key: string]: number }): TrainingLoadData[] => {
    const dates = Object.keys(dailyLoads).sort()
    const result: TrainingLoadData[] = []

    dates.forEach((dateKey, index) => {
      const date = new Date(dateKey)
      
      // Calculate acute load (7-day rolling average)
      const acuteStart = Math.max(0, index - 6)
      const acutePeriod = dates.slice(acuteStart, index + 1)
      const acuteSum = acutePeriod.reduce((sum, d) => sum + dailyLoads[d], 0)
      const acuteLoad = acuteSum / acutePeriod.length

      // Calculate chronic load (42-day rolling average, but use available data)
      const chronicStart = Math.max(0, index - 41)
      const chronicPeriod = dates.slice(chronicStart, index + 1)
      const chronicSum = chronicPeriod.reduce((sum, d) => sum + dailyLoads[d], 0)
      const chronicLoad = chronicSum / chronicPeriod.length

      // Training Stress Balance (TSB) = Chronic Load - Acute Load
      const trainingStressBalance = chronicLoad - acuteLoad

      // Calculate ramp rate (change in acute load)
      let rampRate = 0
      if (index > 6) {
        const previousAcuteEnd = index - 7
        const previousAcuteStart = Math.max(0, previousAcuteEnd - 6)
        const previousAcutePeriod = dates.slice(previousAcuteStart, previousAcuteEnd + 1)
        const previousAcuteSum = previousAcutePeriod.reduce((sum, d) => sum + dailyLoads[d], 0)
        const previousAcuteLoad = previousAcuteSum / previousAcutePeriod.length
        
        if (previousAcuteLoad > 0) {
          rampRate = ((acuteLoad - previousAcuteLoad) / previousAcuteLoad) * 100
        }
      }

      // Generate recommendation based on TSB and ramp rate
      const recommendation = generateRecommendation(trainingStressBalance, rampRate, acuteLoad)

      result.push({
        date,
        acuteLoad,
        chronicLoad,
        trainingStressBalance,
        rampRate,
        recommendation
      })
    })

    return result
  }

  const generateRecommendation = (tsb: number, rampRate: number, acuteLoad: number): 'rest' | 'easy' | 'moderate' | 'hard' | 'peak' => {
    // Very negative TSB indicates high fatigue
    if (tsb < -30) return 'rest'
    
    // High positive TSB indicates freshness, good for hard training
    if (tsb > 20) return 'hard'
    
    // High ramp rate indicates rapid load increase
    if (rampRate > 20) return 'easy'
    
    // Moderate negative TSB with reasonable ramp rate
    if (tsb < -10 && rampRate < 10) return 'easy'
    
    // Peak condition (slightly positive TSB, low load)
    if (tsb > 10 && acuteLoad < 50) return 'peak'
    
    // Default to moderate training
    return 'moderate'
  }

  const getRecommendationInfo = (rec: string) => {
    const recommendations = {
      rest: { 
        label: 'Rest Day', 
        color: 'bg-red-100 text-red-800', 
        icon: Battery,
        description: 'High fatigue detected. Focus on recovery and rest.'
      },
      easy: { 
        label: 'Easy Training', 
        color: 'bg-blue-100 text-blue-800', 
        icon: CheckCircle,
        description: 'Keep intensity low. Focus on easy aerobic runs.'
      },
      moderate: { 
        label: 'Moderate Training', 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: Activity,
        description: 'Balanced training. Mix of easy and moderate efforts.'
      },
      hard: { 
        label: 'Hard Training', 
        color: 'bg-green-100 text-green-800', 
        icon: TrendingUp,
        description: 'Good fitness and freshness. Time for intense training.'
      },
      peak: { 
        label: 'Peak Condition', 
        color: 'bg-purple-100 text-purple-800', 
        icon: CheckCircle,
        description: 'Excellent condition for racing or peak performance.'
      }
    }
    return recommendations[rec as keyof typeof recommendations]
  }

  const getTSBStatus = (tsb: number) => {
    if (tsb < -30) return { status: 'Very Fatigued', color: 'text-red-600' }
    if (tsb < -10) return { status: 'Fatigued', color: 'text-orange-600' }
    if (tsb < 10) return { status: 'Balanced', color: 'text-blue-600' }
    if (tsb < 25) return { status: 'Fresh', color: 'text-green-600' }
    return { status: 'Very Fresh', color: 'text-purple-600' }
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

  if (!currentLoad) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Training Load Data</h3>
          <p className="text-gray-600">Complete some runs to see your training load analysis.</p>
        </CardContent>
      </Card>
    )
  }

  const tsbStatus = getTSBStatus(currentLoad.trainingStressBalance)
  const recommendationInfo = getRecommendationInfo(currentLoad.recommendation)

  return (
    <div className="space-y-6">
      {/* Current Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-2">
              <Battery className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium">Training Stress Balance</h3>
            </div>
            <div className="text-2xl font-bold">{currentLoad.trainingStressBalance.toFixed(1)}</div>
            <Badge className={tsbStatus.color}>{tsbStatus.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="font-medium">Acute Load (7d)</h3>
            </div>
            <div className="text-2xl font-bold">{currentLoad.acuteLoad.toFixed(0)}</div>
            <div className="flex items-center space-x-1 mt-1">
              {currentLoad.rampRate > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className="text-sm text-gray-600">
                {Math.abs(currentLoad.rampRate).toFixed(1)}% vs last week
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-2">
              <recommendationInfo.icon className="h-5 w-5" />
              <h3 className="font-medium">Recommendation</h3>
            </div>
            <Badge className={recommendationInfo.color + ' text-lg py-1 px-2'}>
              {recommendationInfo.label}
            </Badge>
            <p className="text-sm text-gray-600 mt-2">
              {recommendationInfo.description}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Load Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Acute Load (7-day average)</span>
                  <span className="font-bold">{currentLoad.acuteLoad.toFixed(1)}</span>
                </div>
                <Progress value={Math.min(currentLoad.acuteLoad / 200 * 100, 100)} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span>Chronic Load (42-day average)</span>
                  <span className="font-bold">{currentLoad.chronicLoad.toFixed(1)}</span>
                </div>
                <Progress value={Math.min(currentLoad.chronicLoad / 200 * 100, 100)} className="h-2" />
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>Acute Load:</strong> Your training load over the last 7 days. Shows recent training stress.</p>
                  <p><strong>Chronic Load:</strong> Your training load over the last 6 weeks. Shows your fitness baseline.</p>
                  <p><strong>TSB:</strong> Training Stress Balance. Negative values indicate fatigue, positive values indicate freshness.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Training Load Trends</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Weekly Load Comparison */}
                <div>
                  <h4 className="font-medium mb-2">Weekly Load Changes</h4>
                  <div className="space-y-2">
                    {loadData.slice(-4).map((data, index) => {
                      const weekStart = new Date(data.date)
                      weekStart.setDate(weekStart.getDate() - 6)
                      return (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">
                            {weekStart.toLocaleDateString()} - {data.date.toLocaleDateString()}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{data.acuteLoad.toFixed(0)}</span>
                            {data.rampRate !== 0 && (
                              <Badge variant={data.rampRate > 0 ? "default" : "secondary"}>
                                {data.rampRate > 0 ? '+' : ''}{data.rampRate.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recommendations History */}
                <div>
                  <h4 className="font-medium mb-2">Recent Recommendations</h4>
                  <div className="space-y-2">
                    {loadData.slice(-7).reverse().map((data, index) => {
                      const recInfo = getRecommendationInfo(data.recommendation)
                      return (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{data.date.toLocaleDateString()}</span>
                          <Badge className={recInfo.color}>
                            {recInfo.label}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border-l-4 border-l-blue-500 bg-blue-50">
                <div className="flex items-center space-x-2 mb-2">
                  <recommendationInfo.icon className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium">Current Recommendation: {recommendationInfo.label}</h4>
                </div>
                <p className="text-sm text-gray-700">{recommendationInfo.description}</p>
              </div>

              {/* Specific Guidance */}
              <div className="space-y-3">
                <h4 className="font-medium">Training Guidance</h4>
                {currentLoad.recommendation === 'rest' && (
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Take 1-2 complete rest days</li>
                    <li>Focus on sleep and nutrition</li>
                    <li>Consider light stretching or yoga</li>
                    <li>Monitor your resting heart rate</li>
                  </ul>
                )}
                {currentLoad.recommendation === 'easy' && (
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Keep all runs at conversational pace</li>
                    <li>Limit weekly mileage increase to 5-10%</li>
                    <li>Focus on aerobic base building</li>
                    <li>Avoid intense workouts this week</li>
                  </ul>
                )}
                {currentLoad.recommendation === 'moderate' && (
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Mix easy runs with 1-2 moderate efforts</li>
                    <li>Include tempo runs or threshold intervals</li>
                    <li>Maintain current training volume</li>
                    <li>Monitor recovery between sessions</li>
                  </ul>
                )}
                {currentLoad.recommendation === 'hard' && (
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Good time for high-intensity workouts</li>
                    <li>Include VO2 max intervals or speed work</li>
                    <li>Can handle increased training load</li>
                    <li>Focus on quality over quantity</li>
                  </ul>
                )}
                {currentLoad.recommendation === 'peak' && (
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Excellent condition for racing</li>
                    <li>Maintain current fitness with shorter, sharp sessions</li>
                    <li>Focus on race-specific paces</li>
                    <li>Prioritize recovery and nutrition</li>
                  </ul>
                )}
              </div>

              {/* Warning Signs */}
              {(currentLoad.trainingStressBalance < -25 || currentLoad.rampRate > 25) && (
                <div className="p-4 rounded-lg border-l-4 border-l-orange-500 bg-orange-50">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h4 className="font-medium text-orange-800">Warning Signs Detected</h4>
                  </div>
                  <div className="text-sm text-orange-700 space-y-1">
                    {currentLoad.trainingStressBalance < -25 && (
                      <p>• Very high fatigue levels detected - prioritize recovery</p>
                    )}
                    {currentLoad.rampRate > 25 && (
                      <p>• Training load increasing too rapidly - risk of overtraining</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
