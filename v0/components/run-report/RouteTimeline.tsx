import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { MapErrorBoundary } from '@/components/maps/MapErrorBoundary'
import { RunMap } from '@/components/maps/RunMap'
import { PaceChart } from '@/components/pace-chart'
import type { LatLng } from '@/lib/mapConfig'
import type { GPSPoint } from '@/lib/pace-calculations'
import { Map, Activity, Layers } from 'lucide-react'

interface RouteTimelineProps {
    gpsPath?: LatLng[]
    pacePath?: GPSPoint[]
    hasPaceChart?: boolean
}

export function RouteTimeline({ gpsPath, pacePath, hasPaceChart }: RouteTimelineProps) {
    const [activeTab, setActiveTab] = useState<'map' | 'timeline'>('map')

    if (!gpsPath || gpsPath.length === 0) {
        return null
    }

    return (
        <Card className="overflow-hidden border-none shadow-sm bg-[oklch(var(--surface-2))]">
            <CardContent className="p-0">

                {/* Header Tabs */}
                <div className="flex items-center border-b border-border/50 bg-[oklch(var(--surface-3))]/50">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-semibold transition-colors ${activeTab === 'map' ? 'text-primary border-b-2 border-primary bg-[oklch(var(--surface-2))]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Map className="w-4 h-4" /> Route
                    </button>

                    {hasPaceChart && pacePath && pacePath.length > 0 && (
                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`flex-1 flex justify-center items-center gap-2 py-3 text-sm font-semibold transition-colors ${activeTab === 'timeline' ? 'text-primary border-b-2 border-primary bg-[oklch(var(--surface-2))]' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Activity className="w-4 h-4" /> Timeline
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-4 relative">

                    {/* Controls Overlay (Mockup for future linked map/chart) */}
                    <div className="absolute top-6 right-6 z-10 hidden">
                        <button className="p-2 bg-background/80 backdrop-blur rounded-full shadow-sm text-foreground/70 hover:text-foreground border border-border">
                            <Layers className="w-4 h-4" />
                        </button>
                    </div>

                    <div className={activeTab === 'map' ? 'block' : 'hidden'}>
                        <div className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-border/50">
                            <MapErrorBoundary fallbackMessage="Route map temporarily unavailable">
                                <RunMap
                                    height="100%"
                                    userLocation={null}
                                    path={gpsPath}
                                    followUser={false}
                                    interactive={true}
                                    showStartEndMarkers={true}
                                />
                            </MapErrorBoundary>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-3">Interactive route map. Pinch to zoom, drag to pan.</p>
                    </div>

                    {activeTab === 'timeline' && hasPaceChart && pacePath && (
                        <div className="animate-in fade-in duration-300">
                            <div className="h-64 md:h-80 w-full pt-4">
                                <PaceChart gpsPath={pacePath} />
                            </div>
                            <p className="text-xs text-center text-muted-foreground mt-3">Your pace (min/km) throughout the run.</p>
                        </div>
                    )}

                </div>
            </CardContent>
        </Card>
    )
}
