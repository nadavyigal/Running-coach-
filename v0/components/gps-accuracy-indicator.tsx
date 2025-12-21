'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Satellite,
  MapPin,
  Signal,
  TrendingUp,
	  TrendingDown,
	  Minus,
	  AlertTriangle,
	  CheckCircle,
	  Info,
	  ChevronDown,
	  ChevronUp
	} from 'lucide-react';
import { GPSMonitoringService, type GPSAccuracyData } from '@/lib/gps-monitoring';

interface GPSAccuracyIndicatorProps {
  accuracy?: GPSAccuracyData;
  onAccuracyChange?: (accuracy: GPSAccuracyData) => void;
  className?: string;
  compact?: boolean;
  showTroubleshooting?: boolean;
}

export function GPSAccuracyIndicator({
  accuracy,
  onAccuracyChange,
  className = '',
  compact = false,
  showTroubleshooting = true
}: GPSAccuracyIndicatorProps) {
  const [gpsService] = useState(() => new GPSMonitoringService());
  const [currentAccuracy, setCurrentAccuracy] = useState<GPSAccuracyData | null>(accuracy || null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showGuide, setShowGuide] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Subscribe to GPS accuracy updates from the service
    unsubscribeRef.current = gpsService.onAccuracyUpdate((accuracyData) => {
      setCurrentAccuracy(accuracyData);
      onAccuracyChange?.(accuracyData);
    });

    return () => {
      unsubscribeRef.current?.();
    };
  }, [gpsService, onAccuracyChange]);

  useEffect(() => {
    if (accuracy) {
      setCurrentAccuracy(accuracy);
    }
  }, [accuracy]);

  const stats = gpsService.getAccuracyStats();
  const readyStatus = gpsService.isReadyForTracking(currentAccuracy || undefined);
  const troubleshootingGuide = showTroubleshooting ? gpsService.getTroubleshootingGuide(currentAccuracy || undefined) : null;

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500 bg-green-50 border-green-200';
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSignalIcon = (signalStrength: number) => {
    if (signalStrength >= 80) return <Signal className="h-4 w-4 text-green-500" />;
    if (signalStrength >= 60) return <Signal className="h-4 w-4 text-yellow-500" />;
    if (signalStrength >= 40) return <Signal className="h-4 w-4 text-orange-500" />;
    return <Signal className="h-4 w-4 text-red-500" />;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'degrading': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getReadyStatusIcon = () => {
    if (readyStatus.ready) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  if (!currentAccuracy) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Satellite className="h-5 w-5 text-gray-400 animate-pulse" />
            <div>
              <h3 className="font-medium text-gray-600">GPS Initializing...</h3>
              <p className="text-sm text-gray-500">Waiting for location signal</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const message = gpsService.getAccuracyMessage(currentAccuracy);

  if (compact) {
    return (
      <Card className={`${className} ${getQualityColor(currentAccuracy.locationQuality)}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Satellite className="h-4 w-4" />
              <span className="text-sm font-medium">{message.title}</span>
              <Badge variant="outline" className="text-xs">
                ±{Math.round(currentAccuracy.accuracyRadius)}m
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {getSignalIcon(currentAccuracy.signalStrength)}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-600">Signal:</span>
                  <span className="ml-1 font-medium">{Math.round(currentAccuracy.signalStrength)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Satellites:</span>
                  <span className="ml-1 font-medium">{currentAccuracy.satellitesVisible}</span>
                </div>
              </div>
              
              {!readyStatus.ready && (
                <Alert className="py-2">
                  <AlertTriangle className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    {readyStatus.reason}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Satellite className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">GPS Accuracy</h3>
          </div>
          <div className="flex items-center gap-2">
            {getReadyStatusIcon()}
            <Badge className={getQualityColor(currentAccuracy.locationQuality)}>
              {currentAccuracy.locationQuality.charAt(0).toUpperCase() + currentAccuracy.locationQuality.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              {getSignalIcon(currentAccuracy.signalStrength)}
              <span className="text-xl font-bold">
                {Math.round(currentAccuracy.signalStrength)}%
              </span>
            </div>
            <div className="text-xs text-gray-600">Signal Strength</div>
          </div>
          
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span className="text-xl font-bold">
                ±{Math.round(currentAccuracy.accuracyRadius)}m
              </span>
            </div>
            <div className="text-xs text-gray-600">Accuracy Radius</div>
          </div>
          
          <div>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Satellite className="h-4 w-4 text-purple-500" />
              <span className="text-xl font-bold">
                {currentAccuracy.satellitesVisible}
              </span>
            </div>
            <div className="text-xs text-gray-600">Satellites</div>
          </div>
        </div>

        {/* Signal Strength Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Signal Quality</span>
            <span className="font-medium">{Math.round(currentAccuracy.signalStrength)}%</span>
          </div>
          <Progress 
            value={currentAccuracy.signalStrength} 
            className="h-2"
          />
        </div>

        {/* Status Message */}
        <Alert className={getQualityColor(currentAccuracy.locationQuality)}>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">{message.title}</div>
            <div className="text-sm">{message.description}</div>
            {!readyStatus.ready && (
              <div className="text-sm mt-1 font-medium">
                {readyStatus.recommendation}
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Statistics (if available) */}
        {stats.current && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Session Statistics</h4>
              <div className="flex items-center gap-1">
                {getTrendIcon(stats.trend)}
                <span className="text-xs capitalize">{stats.trend}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-xs text-center">
              <div>
                <div className="font-semibold text-green-500">±{stats.best}m</div>
                <div className="text-gray-600">Best</div>
              </div>
              <div>
                <div className="font-semibold text-blue-500">±{stats.average}m</div>
                <div className="text-gray-600">Average</div>
              </div>
              <div>
                <div className="font-semibold text-red-500">±{stats.worst}m</div>
                <div className="text-gray-600">Worst</div>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Guide */}
        {troubleshootingGuide && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm text-yellow-700">GPS Tips</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs h-6"
              >
                {showGuide ? 'Hide' : 'Show'}
              </Button>
            </div>
            
            {showGuide && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div className="font-medium text-yellow-800 mb-1">
                    {troubleshootingGuide.description}
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {troubleshootingGuide.solutions.slice(0, 3).map((solution, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Coordinates (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="pt-3 border-t text-xs text-gray-500">
            <div>Lat: {currentAccuracy.coordinates.latitude.toFixed(6)}</div>
            <div>Lng: {currentAccuracy.coordinates.longitude.toFixed(6)}</div>
            {currentAccuracy.altitude && (
              <div>Alt: {Math.round(currentAccuracy.altitude)}m</div>
            )}
            <div>Updated: {currentAccuracy.timestamp.toLocaleTimeString()}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
