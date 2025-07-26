'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DataSourcesManager } from './data-sources-manager';
import { ConflictResolutionCenter } from './conflict-resolution-center';
import { 
  Activity, 
  BarChart3, 
  Settings, 
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  RefreshCw,
  Zap,
  Shield
} from 'lucide-react';

interface QualityMetrics {
  overallScore: number;
  confidenceScore: number;
  accuracyScore: number;
  reliabilityScore: number;
  conflictScore: number;
}

interface DataFusionDashboardProps {
  userId?: number;
}

export function DataFusionDashboard({ userId = 1 }: DataFusionDashboardProps) {
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadQualityMetrics();
  }, [userId]);

  const loadQualityMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/data-fusion/quality?userId=${userId}&days=7`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setQualityMetrics(result.data.overallQuality);
      } else {
        throw new Error(result.error || 'Failed to load quality metrics');
      }
    } catch (err) {
      console.error('Error loading quality metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Fusion Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your connected devices and resolve data conflicts
          </p>
        </div>
        <Button onClick={loadQualityMetrics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quality Overview Cards */}
      {qualityMetrics && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Quality</p>
                  <p className={`text-2xl font-bold ${getScoreColor(qualityMetrics.overallScore)}`}>
                    {qualityMetrics.overallScore}%
                  </p>
                </div>
                <Shield className={`h-8 w-8 ${getScoreColor(qualityMetrics.overallScore)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Confidence</p>
                  <p className={`text-2xl font-bold ${getScoreColor(qualityMetrics.confidenceScore)}`}>
                    {qualityMetrics.confidenceScore}%
                  </p>
                </div>
                <TrendingUp className={`h-8 w-8 ${getScoreColor(qualityMetrics.confidenceScore)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
                  <p className={`text-2xl font-bold ${getScoreColor(qualityMetrics.accuracyScore)}`}>
                    {qualityMetrics.accuracyScore}%
                  </p>
                </div>
                <Activity className={`h-8 w-8 ${getScoreColor(qualityMetrics.accuracyScore)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reliability</p>
                  <p className={`text-2xl font-bold ${getScoreColor(qualityMetrics.reliabilityScore)}`}>
                    {qualityMetrics.reliabilityScore}%
                  </p>
                </div>
                <CheckCircle className={`h-8 w-8 ${getScoreColor(qualityMetrics.reliabilityScore)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conflict Resolution</p>
                  <p className={`text-2xl font-bold ${getScoreColor(qualityMetrics.conflictScore)}`}>
                    {qualityMetrics.conflictScore}%
                  </p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${getScoreColor(qualityMetrics.conflictScore)}`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Data Fusion Health
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qualityMetrics ? (
                    <Badge className={getScoreBadgeColor(qualityMetrics.overallScore)}>
                      {qualityMetrics.overallScore >= 80 ? 'Excellent' :
                       qualityMetrics.overallScore >= 60 ? 'Good' : 'Needs Attention'}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Loading...</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Based on accuracy, reliability, and conflict resolution
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Devices
                </CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Connected and syncing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Conflicts
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Requiring manual resolution
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => setActiveTab('sources')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Data Sources
                </Button>
                <Button onClick={() => setActiveTab('conflicts')} variant="outline">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Resolve Conflicts
                </Button>
                <Button onClick={() => setActiveTab('analytics')} variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Recent fusion activity will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <DataSourcesManager 
            userId={userId} 
            onSourceUpdate={() => loadQualityMetrics()} 
          />
        </TabsContent>

        <TabsContent value="conflicts">
          <ConflictResolutionCenter 
            userId={userId}
            onConflictResolved={() => loadQualityMetrics()}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Data Fusion Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Advanced analytics and insights coming soon</p>
                <p className="text-sm mt-2">
                  This will include trend analysis, prediction models, and optimization recommendations
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}