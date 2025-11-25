'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { 
  Smartphone, 
  Watch, 
  Activity, 
  Wifi, 
  WifiOff, 
  Settings, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus
} from 'lucide-react';

interface DataSource {
  id?: number;
  userId: number;
  deviceId: string;
  deviceType: 'apple_watch' | 'garmin' | 'fitbit' | 'phone' | 'ring' | 'scale';
  dataTypes: string[];
  priority: number;
  accuracy: number;
  reliability: number;
  lastSync: Date;
  isActive: boolean;
  capabilities: string[];
  syncStatus?: 'online' | 'syncing' | 'offline' | 'error';
  dataFreshness?: number;
  recentDataCount?: number;
}

interface DataSourcesManagerProps {
  userId?: number;
  onSourceUpdate?: (sources: DataSource[]) => void;
}

export function DataSourcesManager({ userId = 1, onSourceUpdate }: DataSourcesManagerProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadDataSources();
  }, [userId]);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/data-fusion/sources?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setDataSources(result.data.sources || []);
        onSourceUpdate?.(result.data.sources || []);
      } else {
        throw new Error(result.error || 'Failed to load data sources');
      }
    } catch (err) {
      console.error('Error loading data sources:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateSourcePriority = async (deviceId: string, newPriority: number) => {
    try {
      // Optimistically update UI
      setDataSources(prev => prev.map(source => 
        source.deviceId === deviceId 
          ? { ...source, priority: newPriority }
          : source
      ));

      // Update server
      const response = await fetch('/api/data-fusion/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          deviceId,
          priority: newPriority
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      // Reload to get fresh data
      await loadDataSources();
    } catch (err) {
      console.error('Error updating priority:', err);
      // Revert optimistic update
      await loadDataSources();
    }
  };

  const toggleSourceActive = async (deviceId: string, isActive: boolean) => {
    try {
      // Optimistically update UI
      setDataSources(prev => prev.map(source => 
        source.deviceId === deviceId 
          ? { ...source, isActive }
          : source
      ));

      const response = await fetch('/api/data-fusion/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          deviceId,
          isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update source status');
      }

      await loadDataSources();
    } catch (err) {
      console.error('Error updating source status:', err);
      await loadDataSources();
    }
  };

  const triggerSync = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/data-fusion/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          devices: dataSources.filter(s => s.isActive).map(s => s.deviceId)
        }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      console.log('Sync completed:', result);
      
      // Reload data sources to get fresh sync status
      await loadDataSources();
    } catch (err) {
      console.error('Error during sync:', err);
      setError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'apple_watch':
      case 'garmin':
      case 'fitbit':
        return <Watch className="h-5 w-5" />;
      case 'phone':
        return <Smartphone className="h-5 w-5" />;
      case 'ring':
      case 'scale':
        return <Activity className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'syncing': return 'bg-blue-100 text-blue-800';
      case 'offline': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading data sources...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Data Sources ({dataSources.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={triggerSync}
                disabled={syncing || dataSources.filter(s => s.isActive).length === 0}
                size="sm"
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                {syncing ? 'Syncing...' : 'Sync All'}
              </Button>
              <Button onClick={loadDataSources} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {error && (
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Data Sources List */}
      {dataSources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No Data Sources Connected
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your devices to start collecting and fusing data from multiple sources.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Connect Device
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {dataSources.map((source) => (
            <Card key={source.deviceId} className={`${!source.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  {/* Device Info */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {getDeviceIcon(source.deviceType)}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{source.deviceId}</h3>
                        <Badge variant="outline" className="text-xs">
                          {source.deviceType.replace('_', ' ')}
                        </Badge>
                        <Badge 
                          className={`text-xs ${getSyncStatusColor(source.syncStatus || 'offline')}`}
                        >
                          <span className="flex items-center gap-1">
                            {getSyncStatusIcon(source.syncStatus || 'offline')}
                            {source.syncStatus || 'offline'}
                          </span>
                        </Badge>
                      </div>
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1">
                        {(source.capabilities || []).map((capability) => (
                          <Badge key={capability} variant="secondary" className="text-xs">
                            {capability.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Stats */}
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Last sync: {new Date(source.lastSync).toLocaleDateString()}</div>
                        <div>Recent data points: {source.recentDataCount ?? 0}</div>
                        <div>Data freshness: {source.dataFreshness ?? 0}%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div className="flex flex-col gap-4 min-w-[200px]">
                    {/* Active Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active</span>
                      <Switch
                        checked={source.isActive}
                        onCheckedChange={(checked) => toggleSourceActive(source.deviceId, checked)}
                      />
                    </div>
                    
                    {/* Priority Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Priority</span>
                        <span className="text-sm text-muted-foreground">{source.priority ?? 0}/10</span>
                      </div>
                      <Slider
                        value={[source.priority ?? 0]}
                        onValueChange={([value]) => updateSourcePriority(source.deviceId, value ?? 0)}
                        max={10}
                        min={1}
                        step={1}
                        className="w-full"
                        disabled={!source.isActive}
                      />
                    </div>
                    
                    {/* Quality Metrics */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <span className="font-medium">{source.accuracy ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reliability:</span>
                        <span className="font-medium">{source.reliability ?? 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
