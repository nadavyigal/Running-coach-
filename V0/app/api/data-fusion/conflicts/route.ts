import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

// GET /api/data-fusion/conflicts - Get unresolved data conflicts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'unresolved';
    
    let conflicts;
    
    // Filter by user when possible; Dexie only allows a single indexed where,
    // so we filter by userId first and refine in memory for status.
    const baseByUser = await db.dataConflicts
      .where('userId')
      .equals(userId)
      .toArray();

    conflicts = (status === 'unresolved')
      ? baseByUser.filter(c => c.manuallyResolved === false)
      : baseByUser.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply limit after filtering/sorting
    conflicts = conflicts.slice(0, limit);
    
    // Enhance conflicts with source information
    const enhancedConflicts = await Promise.all(
      conflicts.map(async (conflict) => {
        const source1 = await db.dataSources
          .where('deviceId')
          .equals(conflict.sourceDevice1)
          .first();
        
        const source2 = await db.dataSources
          .where('deviceId')
          .equals(conflict.sourceDevice2)
          .first();
        
        return {
          ...conflict,
          source1Info: source1 ? {
            deviceType: source1.deviceType,
            accuracy: source1.accuracy,
            reliability: source1.reliability
          } : null,
          source2Info: source2 ? {
            deviceType: source2.deviceType,
            accuracy: source2.accuracy,
            reliability: source2.reliability
          } : null,
          percentageDifference: conflict.difference > 0 ? 
            ((conflict.difference / Math.max(conflict.value1, conflict.value2)) * 100).toFixed(1) + '%' : '0%'
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      data: {
        conflicts: enhancedConflicts,
        totalConflicts: enhancedConflicts.length,
        unresolvedCount: status === 'all'
          ? baseByUser.filter(c => c.manuallyResolved === false).length
          : enhancedConflicts.length
      }
    });
    
  } catch (error) {
    console.error('Error getting data conflicts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve data conflicts'
      },
      { status: 500 }
    );
  }
}

// POST /api/data-fusion/conflicts/resolve - Manually resolve multiple conflicts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conflicts } = body;
    
    if (!conflicts || !Array.isArray(conflicts)) {
      return NextResponse.json(
        {
          success: false,
          error: 'conflicts array is required'
        },
        { status: 400 }
      );
    }
    
    const resolvedConflicts = [];
    
    for (const conflictResolution of conflicts) {
      const { conflictId, resolution, customValue } = conflictResolution;
      
      const conflict = await db.dataConflicts.get(conflictId);
      if (!conflict) {
        continue;
      }
      
      let resolvedValue;
      let resolutionMethod;
      
      switch (resolution) {
        case 'use_source1':
          resolvedValue = conflict.value1;
          resolutionMethod = 'manual_source1';
          break;
        case 'use_source2':
          resolvedValue = conflict.value2;
          resolutionMethod = 'manual_source2';
          break;
        case 'average':
          resolvedValue = (conflict.value1 + conflict.value2) / 2;
          resolutionMethod = 'manual_average';
          break;
        case 'custom':
          resolvedValue = customValue;
          resolutionMethod = 'manual_custom';
          break;
        default:
          resolvedValue = conflict.value1;
          resolutionMethod = 'manual_default';
      }
      
      // Update conflict
      await db.dataConflicts.update(conflictId, {
        resolvedValue,
        resolutionMethod,
        manuallyResolved: true
      });
      
      // Update corresponding fused data point if it exists
      if (conflict.fusedDataPointId) {
        await db.fusedDataPoints.update(conflict.fusedDataPointId, {
          value: resolvedValue,
          fusionMethod: 'manual_resolution',
          // call helper directly (no `this` in module scope)
          confidence: calculatePostResolutionConfidence(conflict as any, resolution)
        });
      }
      
      resolvedConflicts.push({
        conflictId,
        resolvedValue,
        resolutionMethod
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        resolvedConflicts,
        message: `Resolved ${resolvedConflicts.length} conflicts`
      }
    });
    
  } catch (error) {
    console.error('Error resolving conflicts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resolve conflicts'
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate confidence after manual resolution
function calculatePostResolutionConfidence(conflict: any, resolution: string): number {
  let baseConfidence = 70; // Manual resolution gets decent confidence
  
  switch (resolution) {
    case 'use_source1':
    case 'use_source2':
      baseConfidence += 10; // Choosing a source is more confident
      break;
    case 'average':
      baseConfidence += 5; // Averaging is moderately confident
      break;
    case 'custom':
      baseConfidence += 15; // Custom value shows user knowledge
      break;
  }
  
  // Reduce confidence based on how large the conflict was
  const percentDiff = (conflict.difference / Math.max(conflict.value1, conflict.value2)) * 100;
  if (percentDiff > 50) {
    baseConfidence -= 20;
  } else if (percentDiff > 25) {
    baseConfidence -= 10;
  }
  
  return Math.max(30, Math.min(95, baseConfidence));
}
