'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function ChurnTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Churn Prediction</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">ML churn prediction coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 3: Predictive churn scoring based on user behavior and activity patterns
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
