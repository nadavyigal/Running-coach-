'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Zap
} from 'lucide-react';

interface DataConflict {
  id?: number;
  fusedDataPointId: number;
  sourceDevice1: string;
  sourceDevice2: string;
  value1: number;
  value2: number;
  difference: number;
  resolutionMethod: string;
  resolvedValue: number;
  manuallyResolved: boolean;
  createdAt: Date;
  source1Info?: {
    deviceType: string;
    accuracy: number;
    reliability: number;
  };
  source2Info?: {
    deviceType: string;
    accuracy: number;
    reliability: number;
  };
  percentageDifference?: string;
}

interface ConflictResolutionCenterProps {
  userId?: number;
  onConflictResolved?: (conflictId: number) => void;
}

export function ConflictResolutionCenter({ userId = 1, onConflictResolved }: ConflictResolutionCenterProps) {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Set<number>>(new Set());
  const [customValues, setCustomValues] = useState<{ [key: number]: string }>({});
  const [activeTab, setActiveTab] = useState('unresolved');

  useEffect(() => {
    loadConflicts();
  }, [userId, activeTab]);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/data-fusion/conflicts?userId=${userId}&status=${activeTab}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setConflicts(result.data.conflicts || []);
      } else {
        throw new Error(result.error || 'Failed to load conflicts');
      }
    } catch (err) {
      console.error('Error loading conflicts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (conflictId: number, resolution: string, customValue?: number) => {
    try {
      setResolving(prev => new Set(prev).add(conflictId));

      const response = await fetch(`/api/data-fusion/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution,
          customValue
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflict');
      }

      const result = await response.json();
      
      if (result.success) {
        // Remove resolved conflict from list
        setConflicts(prev => prev.filter(c => c.id !== conflictId));
        onConflictResolved?.(conflictId);
        
        // Clear custom value
        setCustomValues(prev => {
          const newValues = { ...prev };
          delete newValues[conflictId];
          return newValues;
        });
      } else {
        throw new Error(result.error || 'Failed to resolve conflict');
      }
    } catch (err) {
      console.error('Error resolving conflict:', err);
      setError(`Failed to resolve conflict: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setResolving(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflictId);
        return newSet;
      });
    }
  };

  const resolveMultipleConflicts = async (conflictResolutions: Array<{conflictId: number, resolution: string, customValue?: number}>) => {
    try {
      setLoading(true);

      const response = await fetch('/api/data-fusion/conflicts/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conflicts: conflictResolutions
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflicts');
      }

      const result = await response.json();
      
      if (result.success) {
        // Reload conflicts to get fresh data
        await loadConflicts();
      } else {
        throw new Error(result.error || 'Failed to resolve conflicts');
      }
    } catch (err) {
      console.error('Error resolving multiple conflicts:', err);
      setError(`Failed to resolve conflicts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const bulkResolveWithAverage = async () => {
    const resolutions = conflicts.map(conflict => ({
      conflictId: conflict.id!,
      resolution: 'average'
    }));
    
    await resolveMultipleConflicts(resolutions);
  };

  const getDeviceTypeIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'apple_watch':
      case 'garmin':
      case 'fitbit':
        return '⌚';
      case 'phone':
        return '📱';
      case 'ring':
        return '💍';
      case 'scale':
        return '⚖️';
      default:
        return '📊';
    }
  };

  const getConflictSeverity = (percentageDiff: string): { level: string; color: string; icon: React.ReactNode } => {
    const percent = parseFloat(percentageDiff.replace('%', ''));
    
    if (percent > 50) {
      return { 
        level: 'High', 
        color: 'bg-red-100 text-red-800', 
        icon: <AlertTriangle className="h-4 w-4" /> 
      };
    } else if (percent > 25) {
      return { 
        level: 'Medium', 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: <TrendingUp className="h-4 w-4" /> 
      };
    } else {
      return { 
        level: 'Low', 
        color: 'bg-green-100 text-green-800', 
        icon: <Activity className="h-4 w-4" /> 
      };
    }
  };

  if (loading && conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Conflict Resolution Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading conflicts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Conflict Resolution Center
            </CardTitle>
            <div className="flex gap-2">
              {conflicts.length > 0 && activeTab === 'unresolved' && (
                <Button
                  onClick={bulkResolveWithAverage}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Resolve All with Average
                </Button>
              )}
              <Button onClick={loadConflicts} variant="outline" size="sm">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unresolved">
            Unresolved ({conflicts.filter(c => !c.manuallyResolved).length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Conflicts
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {conflicts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    {activeTab === 'unresolved' ? 'No Unresolved Conflicts' : 'No Conflicts Found'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === 'unresolved' 
                      ? 'All data conflicts have been resolved. Great job!'
                      : 'No data conflicts have been detected yet.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {conflicts.map((conflict) => {
                const severity = getConflictSeverity(conflict.percentageDifference || '0%');
                const isResolving = resolving.has(conflict.id!);
                
                return (
                  <Card key={conflict.id} className={conflict.manuallyResolved ? 'opacity-60' : ''}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={severity.color}>
                              <span className="flex items-center gap-1">
                                {severity.icon}
                                {severity.level} Conflict
                              </span>
                            </Badge>
                            <Badge variant="outline">
                              {conflict.percentageDifference} difference
                            </Badge>
                            {conflict.manuallyResolved && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {new Date(conflict.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Conflicting Values */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Source 1 */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{getDeviceTypeIcon(conflict.source1Info?.deviceType || '')}</span>
                                <span className="font-medium">{conflict.sourceDevice1}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {conflict.source1Info?.deviceType || 'Unknown'}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold text-blue-600">
                                {conflict.value1.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Accuracy: {conflict.source1Info?.accuracy || 0}%</div>
                                <div>Reliability: {conflict.source1Info?.reliability || 0}%</div>
                              </div>
                            </div>
                          </div>

                          {/* Source 2 */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{getDeviceTypeIcon(conflict.source2Info?.deviceType || '')}</span>
                                <span className="font-medium">{conflict.sourceDevice2}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {conflict.source2Info?.deviceType || 'Unknown'}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="text-2xl font-bold text-green-600">
                                {conflict.value2.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Accuracy: {conflict.source2Info?.accuracy || 0}%</div>
                                <div>Reliability: {conflict.source2Info?.reliability || 0}%</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Resolution Actions */}
                        {!conflict.manuallyResolved && (
                          <div className="space-y-3">
                            <div className="text-sm font-medium">Choose Resolution:</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => resolveConflict(conflict.id!, 'use_source1')}
                                disabled={isResolving}
                                size="sm"
                                variant="outline"
                              >
                                Use {conflict.sourceDevice1} ({conflict.value1.toFixed(2)})
                              </Button>
                              <Button
                                onClick={() => resolveConflict(conflict.id!, 'use_source2')}
                                disabled={isResolving}
                                size="sm"
                                variant="outline"
                              >
                                Use {conflict.sourceDevice2} ({conflict.value2.toFixed(2)})
                              </Button>
                              <Button
                                onClick={() => resolveConflict(conflict.id!, 'average')}
                                disabled={isResolving}
                                size="sm"
                                variant="outline"
                              >
                                Average ({((conflict.value1 + conflict.value2) / 2).toFixed(2)})
                              </Button>
                            </div>
                            
                            {/* Custom Value Input */}
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="text-sm font-medium">Custom Value:</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter custom value"
                                  value={customValues[conflict.id!] || ''}
                                  onChange={(e) => setCustomValues(prev => ({
                                    ...prev,
                                    [conflict.id!]: e.target.value
                                  }))}
                                  disabled={isResolving}
                                />
                              </div>
                              <Button
                                onClick={() => resolveConflict(
                                  conflict.id!, 
                                  'custom', 
                                  parseFloat(customValues[conflict.id!] || '0')
                                )}
                                disabled={isResolving || !customValues[conflict.id!]}
                                size="sm"
                              >
                                {isResolving ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Use Custom'
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Resolution Info (if resolved) */}
                        {conflict.manuallyResolved && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-green-800">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-medium">Resolved</span>
                            </div>
                            <div className="text-sm text-green-700 mt-1">
                              Method: {conflict.resolutionMethod} | 
                              Final Value: {conflict.resolvedValue.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}