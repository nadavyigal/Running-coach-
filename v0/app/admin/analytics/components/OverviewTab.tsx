'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useRealtimeEvents } from '../hooks/useRealtimeEvents'

export function OverviewTab() {
  const { events, isConnected } = useRealtimeEvents({ limit: 50 })

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Real-Time Status</CardTitle>
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            {isConnected
              ? '✓ Connected to live event stream'
              : '✗ Disconnected from event stream'}
          </p>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events (Last 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-sm text-gray-500">No events yet...</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between p-2 border rounded text-sm"
                >
                  <div>
                    <p className="font-medium">{event.event_name}</p>
                    <p className="text-xs text-gray-500">{event.user_id}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Count */}
      <Card>
        <CardHeader>
          <CardTitle>Events Received</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-blue-600">{events.length}</p>
          <p className="text-sm text-gray-600 mt-2">
            Showing last 50 events in real-time
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
