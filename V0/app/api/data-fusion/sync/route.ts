import { NextRequest, NextResponse } from 'next/server';
import { DataFusionEngine, RawDataPoint, UserPreferences } from '../../../../lib/dataFusionEngine';
import { db } from '../../../../lib/db';

const fusionEngine = new DataFusionEngine();

// POST /api/data-fusion/sync - Trigger multi-device sync and data fusion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, devices, dataPoints, preferences } = body;
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId is required'
        },
        { status: 400 }
      );
    }
    
    console.log(`🔄 Starting multi-device sync for user ${userId}`);
    
    // Get user's data sources
    const dataSources = await fusionEngine.getDataSources(userId);
    
    if (dataSources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No data sources configured for user',
          suggestion: 'Please connect at least one device first'
        },
        { status: 400 }
      );
    }
    
    // Update data source sync status
    for (const source of dataSources) {
      if (devices && devices.includes(source.deviceId)) {
        await db.dataSources.update(source.id!, {
          lastSync: new Date(),
          reliability: Math.min(100, source.reliability + 1) // Slightly improve reliability on successful sync
        });
      }
    }
    
    const fusedPoints = [];
    
    // If data points are provided, process them
    if (dataPoints && dataPoints.length > 0) {
      console.log(`📊 Processing ${dataPoints.length} data points`);
      
      // Validate and convert data points
      const validDataPoints: RawDataPoint[] = dataPoints
        .filter((point: any) => point.deviceId && point.dataType && point.value !== undefined && point.timestamp)
        .map((point: any) => ({
          id: point.id || `${point.deviceId}_${point.dataType}_${Date.now()}`,
          deviceId: point.deviceId,
          dataType: point.dataType,
          value: parseFloat(point.value),
          timestamp: new Date(point.timestamp),
          accuracy: point.accuracy || 80,
          quality: point.quality || 75,
          metadata: point.metadata
        }));
      
      if (validDataPoints.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No valid data points provided',
            invalidCount: dataPoints.length
          },
          { status: 400 }
        );
      }
      
      // Set up user preferences
      const userPrefs: UserPreferences = {
        conflictResolutionStrategy: preferences?.conflictResolutionStrategy || 'automatic',
        qualityThreshold: preferences?.qualityThreshold || 50,
        gapFillingEnabled: preferences?.gapFillingEnabled !== false,
        interpolationMethod: preferences?.interpolationMethod || 'linear'
      };
      
      // Get fusion rules for different data types
      const dataTypes = [...new Set(validDataPoints.map(p => p.dataType))];
      const fusionResults = [];
      
      for (const dataType of dataTypes) {
        const typePoints = validDataPoints.filter(p => p.dataType === dataType);
        const rule = await db.dataFusionRules
          .where({ userId, dataType })
          .first();
        
        if (rule && typePoints.length > 0) {
          try {
            const fusedTypePoints = await fusionEngine.fuseDataPoints(
              typePoints,
              rule,
              userPrefs
            );
            
            // Store fused points in database
            for (const fusedPoint of fusedTypePoints) {
              const id = await db.fusedDataPoints.add(fusedPoint);
              fusedPoints.push({ ...fusedPoint, id });
            }
            
            fusionResults.push({
              dataType,
              originalPoints: typePoints.length,
              fusedPoints: fusedTypePoints.length,
              conflicts: fusedTypePoints.filter(p => p.conflicts && p.conflicts.length > 0).length
            });
          } catch (fusionError) {
            console.error(`Fusion error for ${dataType}:`, fusionError);
            fusionResults.push({
              dataType,
              originalPoints: typePoints.length,
              fusedPoints: 0,
              error: fusionError instanceof Error ? fusionError.message : 'Unknown fusion error'
            });
          }
        }
      }
      
      console.log(`✅ Data fusion completed: ${fusedPoints.length} fused points created`);
    }
    
    // Generate sync summary
    const syncSummary = await generateSyncSummary(userId, dataSources, fusedPoints);
    
    return NextResponse.json({
      success: true,
      data: {
        syncTimestamp: new Date(),
        syncedDevices: devices || dataSources.map(s => s.deviceId),
        fusedDataPoints: fusedPoints.length,
        dataTypes: [...new Set(fusedPoints.map(p => p.dataType))],
        summary: syncSummary,
        message: `Successfully synced ${dataSources.length} data sources and created ${fusedPoints.length} fused data points`
      }
    });
    
  } catch (error) {
    console.error('Error during multi-device sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync multi-device data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Generate sync summary with quality metrics
async function generateSyncSummary(userId: number, dataSources: any[], fusedPoints: any[]) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Get conflicts from last 24 hours
  const recentConflicts = await db.dataConflicts
    .where('createdAt')
    .above(oneDayAgo)
    .toArray();
  
  // Calculate device health scores
  const deviceHealth = dataSources.map(source => {
    const sourcePoints = fusedPoints.filter(p => p.primarySource === source.deviceId);
    const avgQuality = sourcePoints.length > 0 ? 
      sourcePoints.reduce((sum, p) => sum + p.qualityScore, 0) / sourcePoints.length : 0;
    
    return {
      deviceId: source.deviceId,
      deviceType: source.deviceType,
      healthScore: Math.round((source.reliability * 0.4) + (avgQuality * 0.4) + (source.accuracy * 0.2)),
      lastSync: source.lastSync,
      dataPoints: sourcePoints.length,
      isActive: source.isActive
    };
  });
  
  // Calculate overall sync quality
  const avgConfidence = fusedPoints.length > 0 ? 
    fusedPoints.reduce((sum, p) => sum + p.confidence, 0) / fusedPoints.length : 0;
    
  const conflictRate = fusedPoints.length > 0 ? 
    (recentConflicts.length / fusedPoints.length) * 100 : 0;
    
  const overallQuality = Math.round(avgConfidence * (1 - conflictRate / 100));
  
  return {
    overallQuality,
    avgConfidence: Math.round(avgConfidence),
    conflictRate: Math.round(conflictRate * 100) / 100,
    totalConflicts: recentConflicts.length,
    unresolvedConflicts: recentConflicts.filter(c => !c.manuallyResolved).length,
    deviceHealth,
    recommendations: generateSyncRecommendations(deviceHealth, conflictRate, avgConfidence)
  };
}

// Generate recommendations based on sync results
function generateSyncRecommendations(deviceHealth: any[], conflictRate: number, avgConfidence: number) {
  const recommendations = [];
  
  // Check for low-health devices
  const lowHealthDevices = deviceHealth.filter(d => d.healthScore < 60);
  if (lowHealthDevices.length > 0) {
    recommendations.push({
      type: 'device_health',
      priority: 'high',
      message: `${lowHealthDevices.length} device(s) have low health scores`,
      action: 'Check device connections and sync settings'
    });
  }
  
  // Check for high conflict rate
  if (conflictRate > 10) {
    recommendations.push({
      type: 'conflict_rate',
      priority: 'medium',
      message: 'High conflict rate detected between devices',
      action: 'Review device priorities and fusion rules'
    });
  }
  
  // Check for low confidence
  if (avgConfidence < 70) {
    recommendations.push({
      type: 'data_quality',
      priority: 'medium',
      message: 'Average data confidence is below optimal level',
      action: 'Consider updating device priorities or checking data accuracy'
    });
  }
  
  // Check for inactive devices
  const inactiveDevices = deviceHealth.filter(d => !d.isActive);
  if (inactiveDevices.length > 0) {
    recommendations.push({
      type: 'inactive_devices',
      priority: 'low',
      message: `${inactiveDevices.length} inactive device(s) found`,
      action: 'Reactivate devices or remove them from your setup'
    });
  }
  
  return recommendations;
}