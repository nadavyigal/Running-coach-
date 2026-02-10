'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function JourneysTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Journey Replay</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded border border-dashed">
          <div className="text-center">
            <p className="text-gray-500 font-medium">User journey timeline coming soon</p>
            <p className="text-sm text-gray-400 mt-2">
              Week 3: Search users and view their complete event timeline with timestamps
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
