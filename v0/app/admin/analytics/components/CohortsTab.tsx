'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function CohortsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohort Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">Cohort retention matrix coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 2: Heatmap showing Day 1, 7, 30 retention rates by signup cohort
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
