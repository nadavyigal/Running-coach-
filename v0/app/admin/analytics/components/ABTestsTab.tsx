'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function ABTestsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A/B Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">A/B test dashboard coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 2: Running experiments with statistical significance, winner badges, p-values
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
