'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function RetentionTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">Retention curves coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 2: Line charts showing Day 1/7/30 retention trends and churn analysis
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
