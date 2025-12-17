import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { logger } from '@/lib/logger';

// POST /api/data-fusion/conflicts/{id}/resolve - Manually resolve specific conflict
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conflictId = parseInt(params.id);
    const body = await request.json();
    const { resolution, customValue } = body;
    
    if (!resolution) {
      return NextResponse.json(
        {
          success: false,
          error: 'resolution is required'
        },
        { status: 400 }
      );
    }
    
    // Get the conflict
    const conflict = await db.dataConflicts.get(conflictId);
    if (!conflict) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict not found'
        },
        { status: 404 }
      );
    }
    
    if (conflict.manuallyResolved) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict has already been resolved'
        },
        { status: 400 }
      );
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
        if (customValue === undefined || customValue === null) {
          return NextResponse.json(
            {
              success: false,
              error: 'customValue is required when resolution is "custom"'
            },
            { status: 400 }
          );
        }
        resolvedValue = customValue;
        resolutionMethod = 'manual_custom';
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid resolution method. Must be one of: use_source1, use_source2, average, custom'
          },
          { status: 400 }
        );
    }
    
    // Update the conflict
    await db.dataConflicts.update(conflictId, {
      resolvedValue,
      resolutionMethod,
      manuallyResolved: true
    });
    
    // Update corresponding fused data point if it exists
    if (conflict.fusedDataPointId) {
      const postResolutionConfidence = calculatePostResolutionConfidence(conflict, resolution);
      
      await db.fusedDataPoints.update(conflict.fusedDataPointId, {
        value: resolvedValue,
        fusionMethod: 'manual_resolution',
        confidence: postResolutionConfidence
      });
    }
    
    // Get the updated conflict
    const updatedConflict = await db.dataConflicts.get(conflictId);
    
    return NextResponse.json({
      success: true,
      data: {
        conflict: updatedConflict,
        resolvedValue,
        resolutionMethod,
        message: 'Conflict resolved successfully'
      }
    });
    
  } catch (error) {
    logger.error('Error resolving conflict:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resolve conflict'
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