'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { useFunnelData, FunnelType } from '../hooks/useFunnelData'

const FUNNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export function FunnelsTab() {
  const [funnelType, setFunnelType] = useState<FunnelType>('activation')
  const [days, setDays] = useState(30)
  const { data, loading, error } = useFunnelData(funnelType, days)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Funnel Type Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Funnel Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFunnelType('activation')}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  funnelType === 'activation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Activation
              </button>
              <button
                onClick={() => setFunnelType('challenge')}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  funnelType === 'challenge'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Challenge
              </button>
              <button
                onClick={() => setFunnelType('retention')}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  funnelType === 'retention'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Retention
              </button>
            </div>
          </div>

          {/* Date Range Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Date Range</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDays(7)}
                className={`px-3 py-1 rounded text-sm transition ${
                  days === 7
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 days
              </button>
              <button
                onClick={() => setDays(30)}
                className={`px-3 py-1 rounded text-sm transition ${
                  days === 30
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 days
              </button>
              <button
                onClick={() => setDays(90)}
                className={`px-3 py-1 rounded text-sm transition ${
                  days === 90
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                90 days
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading funnel data...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="text-red-600 font-medium">Error loading funnel data</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Funnel Summary */}
      {data && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500 mb-1">Total Started</div>
                <div className="text-3xl font-bold text-blue-600">
                  {data.totalStarted.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500 mb-1">Total Completed</div>
                <div className="text-3xl font-bold text-green-600">
                  {data.totalCompleted.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500 mb-1">Overall Conversion</div>
                <div className="text-3xl font-bold text-purple-600">
                  {data.overallConversion}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Funnel Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                {funnelType.charAt(0).toUpperCase() + funnelType.slice(1)} Funnel - Last {days}{' '}
                Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.steps} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <XAxis
                    dataKey="stepName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis label={{ value: 'Users', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-4 rounded shadow-lg border">
                            <p className="font-medium text-sm mb-2">{data.stepName}</p>
                            <p className="text-sm">
                              <span className="text-gray-600">Users:</span>{' '}
                              <span className="font-bold">{data.users.toLocaleString()}</span>
                            </p>
                            <p className="text-sm">
                              <span className="text-gray-600">Conversion:</span>{' '}
                              <span className="font-bold text-blue-600">{data.conversion}%</span>
                            </p>
                            <p className="text-sm">
                              <span className="text-gray-600">Drop-off:</span>{' '}
                              <span className="font-bold text-red-600">{data.dropOff}%</span>
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Bar dataKey="users" fill="#3b82f6" name="Users">
                    {data.steps.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Step-by-Step Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.steps.map((step, index) => (
                  <div
                    key={step.step}
                    className="flex items-center justify-between p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length] }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{step.stepName}</p>
                        <p className="text-sm text-gray-500">{step.step}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Users</p>
                        <p className="font-bold text-lg">{step.users.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Conversion</p>
                        <Badge variant="default" className="bg-blue-600">
                          {step.conversion}%
                        </Badge>
                      </div>
                      {step.dropOff > 0 && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Drop-off</p>
                          <Badge variant="destructive">{step.dropOff}%</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-blue-800">
                • {data.steps.length > 1 && data.steps[1].dropOff > 50 && (
                  <>
                    <strong>High drop-off at Step 2:</strong> {data.steps[1].dropOff}% of users don&apos;t
                    reach {data.steps[1].stepName}. Consider simplifying onboarding.
                  </>
                )}
                {data.steps.length > 1 && data.steps[1].dropOff <= 50 && (
                  <>
                    <strong>Strong Step 1-2 retention:</strong> {100 - data.steps[1].dropOff}% of users
                    continue to {data.steps[1].stepName}.
                  </>
                )}
              </p>
              <p className="text-sm text-blue-800">
                • Overall conversion rate of {data.overallConversion}% from start to completion.
              </p>
              <p className="text-sm text-blue-800">
                • {data.totalStarted} users entered the funnel in the last {days} days.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* No Data State */}
      {data && !loading && data.totalStarted === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <p className="font-medium">No funnel data available</p>
              <p className="text-sm mt-2">
                No {funnelType} events recorded in the last {days} days
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
