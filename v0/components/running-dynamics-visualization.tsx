"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Timer, 
  Move, 
  ArrowUp, 
  ArrowDown, 
  Target,
  TrendingUp,
  Info,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { db } from "@/lib/db"

interface RunningDynamicsData {
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

interface RunningDynamicsVisualizationProps {
  userId: number
  runId?: number
  showTrends?: boolean
}

export function RunningDynamicsVisualization({ 
  userId, 
  runId, 
  showTrends = true 
}: RunningDynamicsVisualizationProps) {
  const [dynamicsData, setDynamicsData] = useState<RunningDynamicsData[]>([])
  const [currentDynamics, setCurrentDynamics] = useState<RunningDynamicsData | null>(null)
  const [averageDynamics, setAverageDynamics] = useState<Partial<RunningDynamicsData> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDynamicsData()
  }, [userId, runId])

  const loadDynamicsData = async () => {
    setIsLoading(true)
    try {
      if (runId) {
        // Load dynamics for specific run
        const runDynamics = await db.runningDynamicsData
          .where('runId')
          .equals(runId)
          .toArray()
        
        setDynamicsData(runDynamics)
        setCurrentDynamics(runDynamics[0] || null)
      } else {
        // Load all dynamics for user (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const runs = await db.runs
          .where('userId')
          .equals(userId)
          .and(run => run.completedAt >= thirtyDaysAgo)
          .toArray()

        const runIds = runs.map(run => run.id!)
        const allDynamics = await db.runningDynamicsData
          .where('runId')
          .anyOf(runIds)
          .toArray()

        setDynamicsData(allDynamics)
        
        // Calculate averages
        if (allDynamics.length > 0) {
          const avgDynamics = calculateAverages(allDynamics)
          setAverageDynamics(avgDynamics)
          
          // Set most recent as current
          const mostRecent = allDynamics.sort((a, b) => {
            const aDate = a.createdAt || new Date(0)
            const bDate = b.createdAt || new Date(0)
            return bDate.getTime() - aDate.getTime()
          })[0]
          setCurrentDynamics(mostRecent)
        }
      }
    } catch (error) {
      console.error('Error loading running dynamics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateAverages = (data: RunningDynamicsData[]): Partial<RunningDynamicsData> => {
    const validData = data.filter(d => d.averageCadence !== undefined)
    if (validData.length === 0) return {}

    const sum = validData.reduce((acc, curr) => ({
      averageCadence: (acc.averageCadence || 0) + (curr.averageCadence || 0),
      averageGroundContactTime: (acc.averageGroundContactTime || 0) + (curr.averageGroundContactTime || 0),
      averageVerticalOscillation: (acc.averageVerticalOscillation || 0) + (curr.averageVerticalOscillation || 0),
      averageStrideLength: (acc.averageStrideLength || 0) + (curr.averageStrideLength || 0),
      groundContactBalance: (acc.groundContactBalance || 0) + (curr.groundContactBalance || 0),
      verticalRatio: (acc.verticalRatio || 0) + (curr.verticalRatio || 0)
    }), {})

    return {
      averageCadence: Math.round((sum.averageCadence || 0) / validData.length),
      averageGroundContactTime: Math.round((sum.averageGroundContactTime || 0) / validData.length),
      averageVerticalOscillation: Number(((sum.averageVerticalOscillation || 0) / validData.length).toFixed(1)),
      averageStrideLength: Number(((sum.averageStrideLength || 0) / validData.length).toFixed(2)),
      groundContactBalance: Number(((sum.groundContactBalance || 0) / validData.length).toFixed(1)),
      verticalRatio: Number(((sum.verticalRatio || 0) / validData.length).toFixed(1))
    }
  }

  const getCadenceAssessment = (cadence: number) => {
    if (cadence >= 180) return { status: 'Excellent', color: 'text-green-600', icon: CheckCircle }
    if (cadence >= 170) return { status: 'Good', color: 'text-blue-600', icon: CheckCircle }
    if (cadence >= 160) return { status: 'Fair', color: 'text-yellow-600', icon: AlertCircle }
    return { status: 'Needs Improvement', color: 'text-red-600', icon: AlertCircle }
  }

  const getGroundContactAssessment = (gct: number) => {
    if (gct <= 200) return { status: 'Excellent', color: 'text-green-600', icon: CheckCircle }
    if (gct <= 250) return { status: 'Good', color: 'text-blue-600', icon: CheckCircle }
    if (gct <= 300) return { status: 'Fair', color: 'text-yellow-600', icon: AlertCircle }
    return { status: 'Needs Improvement', color: 'text-red-600', icon: AlertCircle }
  }

  const getVerticalOscillationAssessment = (vo: number) => {
    if (vo <= 7) return { status: 'Excellent', color: 'text-green-600', icon: CheckCircle }
    if (vo <= 9) return { status: 'Good', color: 'text-blue-600', icon: CheckCircle }
    if (vo <= 12) return { status: 'Fair', color: 'text-yellow-600', icon: AlertCircle }
    return { status: 'Needs Improvement', color: 'text-red-600', icon: AlertCircle }
  }

  const getBalanceAssessment = (balance: number) => {
    const deviation = Math.abs(balance - 50)
    if (deviation <= 2) return { status: 'Excellent', color: 'text-green-600', icon: CheckCircle }
    if (deviation <= 5) return { status: 'Good', color: 'text-blue-600', icon: CheckCircle }
    if (deviation <= 10) return { status: 'Fair', color: 'text-yellow-600', icon: AlertCircle }
    return { status: 'Needs Improvement', color: 'text-red-600', icon: AlertCircle }
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

  if (!currentDynamics && dynamicsData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Move className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Running Dynamics Data</h3>
          <p className="text-gray-600">
            Connect a device that supports running dynamics (like Garmin) to see detailed form analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  const displayData = currentDynamics || averageDynamics

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cadence */}
        {displayData?.averageCadence && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Timer className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium">Cadence</h3>
              </div>
              <div className="text-2xl font-bold">{displayData.averageCadence} spm</div>
              {(() => {
                const assessment = getCadenceAssessment(displayData.averageCadence)
                return (
                  <div className="flex items-center space-x-1 mt-1">
                    <assessment.icon className={`h-4 w-4 ${assessment.color}`} />
                    <Badge className={assessment.color}>{assessment.status}</Badge>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Ground Contact Time */}
        {displayData?.averageGroundContactTime && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <ArrowDown className="h-5 w-5 text-green-600" />
                <h3 className="font-medium">Ground Contact</h3>
              </div>
              <div className="text-2xl font-bold">{displayData.averageGroundContactTime} ms</div>
              {(() => {
                const assessment = getGroundContactAssessment(displayData.averageGroundContactTime)
                return (
                  <div className="flex items-center space-x-1 mt-1">
                    <assessment.icon className={`h-4 w-4 ${assessment.color}`} />
                    <Badge className={assessment.color}>{assessment.status}</Badge>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Vertical Oscillation */}
        {displayData?.averageVerticalOscillation && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <ArrowUp className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium">Vertical Oscillation</h3>
              </div>
              <div className="text-2xl font-bold">{displayData.averageVerticalOscillation} cm</div>
              {(() => {
                const assessment = getVerticalOscillationAssessment(displayData.averageVerticalOscillation)
                return (
                  <div className="flex items-center space-x-1 mt-1">
                    <assessment.icon className={`h-4 w-4 ${assessment.color}`} />
                    <Badge className={assessment.color}>{assessment.status}</Badge>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Stride Length */}
        {displayData?.averageStrideLength && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-2">
                <Move className="h-5 w-5 text-orange-600" />
                <h3 className="font-medium">Stride Length</h3>
              </div>
              <div className="text-2xl font-bold">{displayData.averageStrideLength} m</div>
              <p className="text-sm text-gray-500 mt-1">
                {displayData.averageStrideLength > 1.3 ? 'Long stride' : 
                 displayData.averageStrideLength > 1.0 ? 'Optimal' : 'Short stride'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="balance">Balance & Symmetry</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Form Efficiency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayData?.averageCadence && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Cadence</span>
                      <span className="font-medium">{displayData.averageCadence} spm</span>
                    </div>
                    <Progress 
                      value={Math.min(displayData.averageCadence / 200 * 100, 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-600">
                      Target: 170-180 spm for optimal efficiency
                    </p>
                  </div>
                )}

                {displayData?.averageGroundContactTime && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Ground Contact Time</span>
                      <span className="font-medium">{displayData.averageGroundContactTime} ms</span>
                    </div>
                    <Progress 
                      value={Math.max(0, 100 - (displayData.averageGroundContactTime / 300 * 100))} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-600">
                      Target: &lt;250ms for efficient ground contact
                    </p>
                  </div>
                )}

                {displayData?.averageVerticalOscillation && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Vertical Oscillation</span>
                      <span className="font-medium">{displayData.averageVerticalOscillation} cm</span>
                    </div>
                    <Progress 
                      value={Math.max(0, 100 - (displayData.averageVerticalOscillation / 15 * 100))} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-600">
                      Target: &lt;9cm for minimal energy waste
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Running Economy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayData?.verticalRatio && (
                  <div className="flex justify-between items-center">
                    <span>Vertical Ratio</span>
                    <span className="font-bold">{displayData.verticalRatio}%</span>
                  </div>
                )}

                {displayData?.averageCadence && displayData?.averageStrideLength && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Stride Analysis</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Cadence:</span>
                        <div className="font-medium">{displayData.averageCadence} spm</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Stride Length:</span>
                        <div className="font-medium">{displayData.averageStrideLength}m</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      Higher cadence with moderate stride length is typically more efficient
                    </p>
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Efficiency Score</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    Based on your current form metrics, focus on increasing cadence while maintaining stride length.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Left-Right Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayData?.groundContactBalance ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {displayData.groundContactBalance.toFixed(1)}% / {(100 - displayData.groundContactBalance).toFixed(1)}%
                    </div>
                    <p className="text-gray-600">Left / Right Ground Contact Balance</p>
                  </div>

                  <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium"
                      style={{ width: `${displayData.groundContactBalance}%` }}
                    >
                      L
                    </div>
                    <div 
                      className="absolute right-0 top-0 h-full bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                      style={{ width: `${100 - displayData.groundContactBalance}%` }}
                    >
                      R
                    </div>
                  </div>

                  {(() => {
                    const assessment = getBalanceAssessment(displayData.groundContactBalance)
                    return (
                      <div className="flex items-center justify-center space-x-2">
                        <assessment.icon className={`h-5 w-5 ${assessment.color}`} />
                        <Badge className={assessment.color + ' text-base py-1 px-3'}>
                          {assessment.status}
                        </Badge>
                      </div>
                    )
                  })()}

                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Ideal Balance:</strong> 48-52% for each side</p>
                    <p><strong>Your Balance:</strong> {Math.abs(displayData.groundContactBalance - 50).toFixed(1)}% deviation from center</p>
                    {Math.abs(displayData.groundContactBalance - 50) > 5 && (
                      <p className="text-orange-600">
                        <strong>Note:</strong> Significant imbalance detected. Consider form analysis or injury screening.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No balance data available. This requires advanced sensor data from compatible devices.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Improvement Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {displayData?.averageCadence && displayData.averageCadence < 170 && (
                <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50">
                  <h4 className="font-medium text-blue-800 mb-2">Increase Cadence</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Your cadence of {displayData.averageCadence} spm is below optimal. Target 170-180 spm.
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Practice running to a metronome at 180 bpm</li>
                    <li>Focus on quicker, lighter steps</li>
                    <li>Shorten your stride slightly to increase turnover</li>
                    <li>Count steps for 30 seconds, multiply by 4</li>
                  </ul>
                </div>
              )}

              {displayData?.averageGroundContactTime && displayData.averageGroundContactTime > 250 && (
                <div className="p-4 border-l-4 border-l-green-500 bg-green-50">
                  <h4 className="font-medium text-green-800 mb-2">Reduce Ground Contact Time</h4>
                  <p className="text-sm text-green-700 mb-2">
                    Your ground contact time of {displayData.averageGroundContactTime}ms could be improved.
                  </p>
                  <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                    <li>Focus on landing under your center of gravity</li>
                    <li>Practice quick, light steps</li>
                    <li>Work on calf strength and reactive power</li>
                    <li>Try running barefoot on grass occasionally</li>
                  </ul>
                </div>
              )}

              {displayData?.averageVerticalOscillation && displayData.averageVerticalOscillation > 9 && (
                <div className="p-4 border-l-4 border-l-purple-500 bg-purple-50">
                  <h4 className="font-medium text-purple-800 mb-2">Minimize Vertical Oscillation</h4>
                  <p className="text-sm text-purple-700 mb-2">
                    Your vertical oscillation of {displayData.averageVerticalOscillation}cm indicates energy waste.
                  </p>
                  <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                    <li>Focus on forward momentum, not upward bounce</li>
                    <li>Keep your head steady while running</li>
                    <li>Practice running past windows to check bounce</li>
                    <li>Strengthen your core for better stability</li>
                  </ul>
                </div>
              )}

              {displayData?.groundContactBalance && Math.abs(displayData.groundContactBalance - 50) > 5 && (
                <div className="p-4 border-l-4 border-l-orange-500 bg-orange-50">
                  <h4 className="font-medium text-orange-800 mb-2">Address Running Imbalance</h4>
                  <p className="text-sm text-orange-700 mb-2">
                    Significant left-right imbalance detected ({displayData.groundContactBalance.toFixed(1)}% vs {(100 - displayData.groundContactBalance).toFixed(1)}%).
                  </p>
                  <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                    <li>Consider gait analysis by a running specialist</li>
                    <li>Check for leg length discrepancies</li>
                    <li>Focus on single-leg strength exercises</li>
                    <li>Address any hip or ankle mobility issues</li>
                  </ul>
                </div>
              )}

              {/* General recommendations */}
              <div className="p-4 border-l-4 border-l-gray-500 bg-gray-50">
                <h4 className="font-medium text-gray-800 mb-2">General Form Tips</h4>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                  <li>Maintain an upright posture with slight forward lean</li>
                  <li>Keep arms relaxed and swing naturally</li>
                  <li>Focus on consistent, rhythmic breathing</li>
                  <li>Record yourself running to analyze form visually</li>
                  <li>Consider working with a running coach for personalized analysis</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}