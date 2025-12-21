"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface HeartRateZone {
  id: number
  zoneNumber: number
  name: string
  minBpm: number
  maxBpm: number
  color: string
}

interface ZoneDistribution {
  totalTime: number
  zone1Percentage: number
  zone2Percentage: number
  zone3Percentage: number
  zone4Percentage: number
  zone5Percentage: number
}

interface ZoneAnalysisDashboardProps {
  runId: number;
  userId: number;
  zones: HeartRateZone[];
  distribution?: ZoneDistribution;
  targetDistribution?: { [key: number]: number };
  onLoadDistribution?: (distribution: ZoneDistribution) => void;
}

export function ZoneAnalysisDashboard(_props: ZoneAnalysisDashboardProps) {
  // Temporary simplified version to fix chunk loading issue
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zone Analysis Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Zone analysis functionality temporarily disabled for debugging.</p>
        </CardContent>
      </Card>
    </div>
  )
}
