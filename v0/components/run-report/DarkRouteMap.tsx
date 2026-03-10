'use client'

import { Map } from 'lucide-react'
import { MapErrorBoundary } from '@/components/maps/MapErrorBoundary'
import { RunMap } from '@/components/maps/RunMap'
import type { LatLng } from '@/lib/mapConfig'

interface DarkRouteMapProps {
  path: LatLng[]
}

export function DarkRouteMap({ path }: DarkRouteMapProps) {
  if (path.length === 0) return null

  return (
    <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-[#40DCBE]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#40DCBE]/70">Route</span>
      </div>
      <div className="h-64 rounded-xl overflow-hidden">
        <MapErrorBoundary fallbackMessage="Route map temporarily unavailable">
          <RunMap
            height="100%"
            userLocation={null}
            path={path}
            followUser={false}
            interactive={true}
            showStartEndMarkers={true}
            theme="dark"
          />
        </MapErrorBoundary>
      </div>
    </div>
  )
}
