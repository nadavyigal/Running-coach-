'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function AnomaliesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Detection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">Anomaly alerts coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 3: Statistical anomaly detection using Z-score analysis
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
