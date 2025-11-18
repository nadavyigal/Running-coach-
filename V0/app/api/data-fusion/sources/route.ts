import { NextRequest, NextResponse } from 'next/server';
import { DataFusionEngine } from '../../../../lib/dataFusionEngine';
import { db } from '../../../../lib/db';

const fusionEngine = new DataFusionEngine();

// GET /api/data-fusion/sources - List all connected data sources
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    
    // Get all data sources for the user
    const dataSources = await fusionEngine.getDataSources(userId);
    
    // Enhance with additional stats
    const enhancedSources = await Promise.all(
      dataSources.map(async (source) => {
        // Get recent data points count
        const recentDataCount = await db.fusedDataPoints
          .where('primarySource')
          .equals(source.deviceId)
          .and(point => point.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .count();
        
        return {
          ...source,
          recentDataCount,
          syncStatus: this.determineSyncStatus(source.lastSync),
          dataFreshness: this.calculateDataFreshness(source.lastSync)
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: {
        sources: enhancedSources,
        totalSources: enhancedSources.length,
        activeSources: enhancedSources.filter(s => s.isActive).length
      }
    });
    
  } catch (error) {
    console.error('Error getting data sources:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve data sources'
      },
      { status: 500 }
    );
  }
}

// POST /api/data-fusion/sources - Add or update a data source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, deviceId, deviceType, dataTypes, priority = 5 } = body;
    
    if (!userId || !deviceId || !deviceType) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId, deviceId, and deviceType are required'
        },
        { status: 400 }
      );
    }
    
    // Check if data source already exists
    const existingSource = await db.dataSources
      .where({ userId, deviceId })
      .first();
    
    const sourceData = {
      userId,
      deviceId,
      deviceType,
      dataTypes: JSON.stringify(dataTypes || []),
      priority,
      accuracy: this.getDefaultAccuracy(deviceType),
      reliability: 100, // Start with full reliability
      lastSync: new Date(),
      isActive: true,
      capabilities: JSON.stringify(this.getDeviceCapabilities(deviceType)),
      updatedAt: new Date()
    };
    
    let sourceId;
    if (existingSource) {
      // Update existing source
      await db.dataSources.update(existingSource.id!, sourceData);
      sourceId = existingSource.id!;
    } else {
      // Create new source
      sourceId = await db.dataSources.add({
        ...sourceData,
        createdAt: new Date()
      });
    }
    
    const updatedSource = await db.dataSources.get(sourceId);
    
    return NextResponse.json({
      success: true,
      data: {
        source: updatedSource,
        message: existingSource ? 'Data source updated' : 'Data source added'
      }
    });
    
  } catch (error) {
    console.error('Error managing data source:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to manage data source'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function _determineSyncStatus(lastSync: Date): 'online' | 'syncing' | 'offline' | 'error' {
  const now = new Date();
  const timeDiff = now.getTime() - lastSync.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  if (hoursDiff < 1) return 'online';
  if (hoursDiff < 6) return 'syncing';
  if (hoursDiff < 24) return 'offline';
  return 'error';
}

function _calculateDataFreshness(lastSync: Date): number {
  const now = new Date();
  const timeDiff = now.getTime() - lastSync.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  // Return freshness as percentage (100% = very fresh, 0% = very stale)
  if (hoursDiff < 1) return 100;
  if (hoursDiff < 6) return 80;
  if (hoursDiff < 24) return 60;
  if (hoursDiff < 72) return 40;
  return 20;
}

function _getDefaultAccuracy(deviceType: string): number {
  const accuracyMap: { [key: string]: number } = {
    'apple_watch': 90,
    'garmin': 95,
    'fitbit': 85,
    'phone': 70,
    'ring': 80,
    'scale': 95
  };

  return accuracyMap[deviceType] || 75;
}

function _getDeviceCapabilities(deviceType: string): string[] {
  const capabilityMap: { [key: string]: string[] } = {
    'apple_watch': ['heart_rate', 'steps', 'calories', 'distance', 'pace', 'gps'],
    'garmin': ['heart_rate', 'steps', 'calories', 'distance', 'pace', 'gps', 'sleep'],
    'fitbit': ['heart_rate', 'steps', 'calories', 'sleep'],
    'phone': ['steps', 'gps', 'distance', 'pace'],
    'ring': ['heart_rate', 'sleep', 'calories'],
    'scale': ['weight', 'body_fat', 'muscle_mass']
  };
  
  return capabilityMap[deviceType] || [];
}