'use client';

import { useCallback, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Trash2, Save, ListChecks } from 'lucide-react';
import { RouteMap } from '@/components/maps/RouteMap';
import { MapErrorBoundary } from '@/components/maps/MapErrorBoundary';
import { db, type Route } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import {
  calculateWaypointDistance,
  stringifyGpsPath,
  estimateRouteTime,
  formatDistance,
} from '@/lib/routeUtils';
import { trackCustomRouteSaved } from '@/lib/analytics';
import type { LatLng } from '@/lib/mapConfig';
import {
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_DISTANCE_KM,
  isValidLatitude,
  isValidLongitude,
  isDevelopment
} from '@/lib/routeHelpers';

interface CustomRouteCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: Route) => void;
}

const MAX_WAYPOINTS = 20;

export function CustomRouteCreator({ isOpen, onClose, onRouteSaved }: CustomRouteCreatorProps) {
  const { toast } = useToast();

  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [routeName, setRouteName] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [surfaceType, setSurfaceType] = useState<string>('paved');
  const [isSaving, setIsSaving] = useState(false);

  const distance = waypoints.length >= 2 ? calculateWaypointDistance(waypoints) : 0;
  const estimatedTime = distance > 0 ? estimateRouteTime(distance) : 0;

  const previewRoute: Route | null = useMemo(() => {
    if (waypoints.length < 2) return null;

    return {
      id: Number.MAX_SAFE_INTEGER, // map-only preview id
      name: routeName || 'Custom Route Preview',
      distance,
      difficulty,
      safetyScore: 50,
      popularity: 0,
      elevationGain: 0,
      surfaceType: [surfaceType],
      wellLit: false,
      lowTraffic: false,
      scenicScore: 50,
      estimatedTime,
      description: notes || 'Custom route preview',
      tags: ['custom'],
      gpsPath: stringifyGpsPath(waypoints),
      location: 'Custom Route',
      startLat: waypoints[0].lat,
      startLng: waypoints[0].lng,
      endLat: waypoints[waypoints.length - 1].lat,
      endLng: waypoints[waypoints.length - 1].lng,
      routeType: 'custom',
      createdBy: 'user',
      isActive: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }, [waypoints, routeName, difficulty, notes, surfaceType, distance, estimatedTime]);

  const mapRoutes = previewRoute ? [previewRoute] : [];

  const handleMapClick = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      setWaypoints((prev) => {
        if (prev.length >= MAX_WAYPOINTS) {
          toast({
            title: 'Maximum Waypoints Reached',
            description: `You can add up to ${MAX_WAYPOINTS} waypoints per route.`,
            variant: 'destructive',
          });
          return prev;
        }
        return [...prev, { lat: lngLat.lat, lng: lngLat.lng }];
      });
    },
    [toast]
  );

  const clearWaypoints = () => {
    setWaypoints([]);
  };

  const handleSave = async () => {
    // Validate name
    if (!routeName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your route.',
        variant: 'destructive',
      });
      return;
    }

    if (routeName.length > MAX_NAME_LENGTH) {
      toast({
        title: 'Name Too Long',
        description: `Route name must be ${MAX_NAME_LENGTH} characters or less.`,
        variant: 'destructive',
      });
      return;
    }

    // Validate waypoints
    if (waypoints.length < 2) {
      toast({
        title: 'Add Waypoints',
        description: 'Please add at least a start and end point.',
        variant: 'destructive',
      });
      return;
    }

    // Validate coordinates
    const hasInvalidCoords = waypoints.some(wp =>
      !isValidLatitude(wp.lat) || !isValidLongitude(wp.lng)
    );

    if (hasInvalidCoords) {
      toast({
        title: 'Invalid Coordinates',
        description: 'Some waypoints have invalid GPS coordinates.',
        variant: 'destructive',
      });
      return;
    }

    // Validate distance
    if (distance > MAX_DISTANCE_KM) {
      toast({
        title: 'Route Too Long',
        description: `Route distance exceeds ${MAX_DISTANCE_KM}km limit.`,
        variant: 'destructive',
      });
      return;
    }

    // Validate notes length
    if (notes.length > MAX_NOTES_LENGTH) {
      toast({
        title: 'Notes Too Long',
        description: `Notes must be ${MAX_NOTES_LENGTH} characters or less.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const newRoute: Omit<Route, 'id'> = {
        name: routeName.trim(),
        distance,
        difficulty,
        safetyScore: 50,
        popularity: 0,
        elevationGain: 0,
        surfaceType: [surfaceType],
        wellLit: false,
        lowTraffic: false,
        scenicScore: 50,
        estimatedTime,
        description: notes || `Custom ${formatDistance(distance, 1)} route`,
        tags: ['custom'],
        gpsPath: stringifyGpsPath(waypoints),
        location: 'Custom Route',
        startLat: waypoints[0].lat,
        startLng: waypoints[0].lng,
        endLat: waypoints[waypoints.length - 1].lat,
        endLng: waypoints[waypoints.length - 1].lng,
        routeType: 'custom',
        createdBy: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const routeId = await db.routes.add(newRoute);
      const savedRoute = { ...newRoute, id: routeId };

      // Await analytics tracking
      try {
        await trackCustomRouteSaved({
          route_id: routeId,
          waypoint_count: waypoints.length,
          distance_km: distance,
          difficulty,
        });
      } catch (error) {
        if (isDevelopment()) {
          console.warn('Analytics tracking failed:', error);
        }
      }

      toast({
        title: 'Route Saved',
        description: `"${newRoute.name}" has been added to your routes.`,
      });

      // Call onRouteSaved before clearing state
      onRouteSaved(savedRoute);

      // Clear state
      setWaypoints([]);
      setRouteName('');
      setNotes('');
      setDifficulty('beginner');
      setSurfaceType('paved');

      // Close modal last
      onClose();
    } catch (error) {
      if (isDevelopment()) {
        console.error('Error saving custom route:', error);
      }
      toast({
        title: 'Save Failed',
        description: 'Unable to save route. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Custom Route</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Map area */}
          <div className="flex-1 lg:w-3/5">
            <div className="h-full min-h-[400px] rounded-lg border">
              <MapErrorBoundary fallbackMessage="Click the map to create route waypoints">
                <RouteMap
                  routes={mapRoutes as any}
                  onMapClick={handleMapClick}
                  height="100%"
                  className="rounded-lg"
                />
              </MapErrorBoundary>
            </div>
          </div>

          {/* Form area */}
          <div className="lg:w-2/5 space-y-4 overflow-y-auto">
            <div>
              <label className="text-sm font-medium">Route Name *</label>
              <Input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="My Morning Run"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this route..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={difficulty} onValueChange={(value: any) => setDifficulty(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Surface Type</label>
              <Select value={surfaceType} onValueChange={(value: any) => setSurfaceType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paved">Paved</SelectItem>
                  <SelectItem value="gravel">Gravel</SelectItem>
                  <SelectItem value="trail">Trail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Waypoints</span>
                  <Button variant="ghost" size="sm" onClick={clearWaypoints} disabled={!waypoints.length}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Count:</span>
                    <span className="font-medium">{waypoints.length} / {MAX_WAYPOINTS}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance:</span>
                    <span className="font-medium">{distance > 0 ? formatDistance(distance, 2) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Time:</span>
                    <span className="font-medium">{estimatedTime > 0 ? `${estimatedTime} min` : '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50">
              <CardContent className="p-3 text-sm text-gray-700 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ListChecks className="h-4 w-4" />
                  How to create:
                </div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click on the map to add waypoints (start/end at minimum).</li>
                  <li>Adjust details like name, notes, and difficulty.</li>
                  <li>Save to add the route to your library.</li>
                </ol>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || waypoints.length < 2 || !routeName.trim()}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Route'}
              </Button>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
