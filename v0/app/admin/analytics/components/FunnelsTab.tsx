'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function FunnelsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activation Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">Funnel visualization coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 2: Recharts funnel visualization will display signup → first run conversion rates
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
