import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  calculateMaxHRZones, 
  calculateLTZones, 
  calculateHRRZones,
  estimateMaxHeartRate,
  validateHeartRateZones 
} from '@/lib/heartRateZones';

export const dynamic = 'force-dynamic';

// GET - Get user's heart rate zones and settings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userIdNumber = parseInt(userId);
    
    // Get user's heart rate zones
    const zones = await db.heartRateZones
      .where('userId')
      .equals(userIdNumber)
      .sortBy('zoneNumber');
    
    // Get user's zone settings
    const settings = await db.heartRateZoneSettings
      .where('userId')
      .equals(userIdNumber)
      .first();

    if (zones.length === 0) {
      // No zones found, get user info to calculate defaults
      const user = await db.users.get(userIdNumber);
      
      if (!user) {
        return NextResponse.json({
          success: false,
          error: 'User not found'
        }, { status: 404 });
      }

      const age = user.age || 30;
      const estimatedMaxHR = estimateMaxHeartRate(age);
      
      return NextResponse.json({
        success: true,
        zones: [],
        settings: null,
        suggestions: {
          age,
          estimatedMaxHR,
          restingHR: 60,
          calculationMethods: ['max_hr', 'hrr', 'lactate_threshold']
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      zones,
      settings
    });
  } catch (error) {
    console.error('Error fetching heart rate zones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch heart rate zones' },
      { status: 500 }
    );
  }
}

// POST - Calculate and create heart rate zones using different methods
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, calculationMethod, maxHeartRate, restingHeartRate, lactateThresholdHR, zoneSystem, autoUpdate } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userIdNumber = parseInt(userId);
    
    // Validate calculation method parameters
    if (calculationMethod === 'max_hr' && !maxHeartRate) {
      return NextResponse.json(
        { success: false, error: 'Max heart rate is required for max HR method' },
        { status: 400 }
      );
    }
    
    if (calculationMethod === 'lactate_threshold' && !lactateThresholdHR) {
      return NextResponse.json(
        { success: false, error: 'Lactate threshold HR is required for LT method' },
        { status: 400 }
      );
    }
    
    if (calculationMethod === 'hrr' && (!maxHeartRate || !restingHeartRate)) {
      return NextResponse.json(
        { success: false, error: 'Max and resting heart rates are required for HRR method' },
        { status: 400 }
      );
    }

    // Calculate zones based on method
    let newZones;
    switch (calculationMethod) {
      case 'max_hr':
        newZones = calculateMaxHRZones(maxHeartRate, userIdNumber);
        break;
      case 'lactate_threshold':
        newZones = calculateLTZones(lactateThresholdHR, userIdNumber);
        break;
      case 'hrr':
        newZones = calculateHRRZones(maxHeartRate, restingHeartRate, userIdNumber);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid calculation method' },
          { status: 400 }
        );
    }

    // Validate the calculated zones
    const validationErrors = validateHeartRateZones(newZones as any);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: `Zone validation failed: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // Start transaction
    await db.transaction('rw', [db.heartRateZones, db.heartRateZoneSettings], async () => {
      // Delete existing zones for this user
      await db.heartRateZones.where('userId').equals(userIdNumber).delete();
      
      // Delete existing settings for this user
      await db.heartRateZoneSettings.where('userId').equals(userIdNumber).delete();
      
      // Add new zones
      for (const zone of newZones) {
        await db.heartRateZones.add({
          ...zone,
          id: undefined // Let the database assign the ID
        });
      }
      
      // Add new settings
      await db.heartRateZoneSettings.add({
        userId: userIdNumber,
        calculationMethod,
        maxHeartRate,
        restingHeartRate,
        lactateThresholdHR,
        zoneSystem: zoneSystem || 'five_zone',
        autoUpdate: autoUpdate ?? true,
        lastCalculated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Fetch the newly created zones and settings
    const zones = await db.heartRateZones
      .where('userId')
      .equals(userIdNumber)
      .sortBy('zoneNumber');
    
    const settings = await db.heartRateZoneSettings
      .where('userId')
      .equals(userIdNumber)
      .first();

    return NextResponse.json({
      success: true,
      zones,
      settings,
      message: 'Heart rate zones calculated and saved successfully'
    });
  } catch (error) {
    console.error('Error calculating heart rate zones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate heart rate zones' },
      { status: 500 }
    );
  }
}

// PUT - Manually update heart rate zones
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, zones } = body;
    
    if (!userId || !zones) {
      return NextResponse.json(
        { success: false, error: 'User ID and zones are required' },
        { status: 400 }
      );
    }

    const userIdNumber = parseInt(userId);
    
    // Validate the zones
    const validationErrors = validateHeartRateZones(zones);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: `Zone validation failed: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // Update zones in transaction
    await db.transaction('rw', [db.heartRateZones, db.heartRateZoneSettings], async () => {
      for (const zone of zones) {
        if (zone.id) {
          await db.heartRateZones.update(zone.id, {
            ...zone,
            updatedAt: new Date()
          });
        }
      }
      
      // Update settings to manual method and last calculated time
      await db.heartRateZoneSettings
        .where('userId')
        .equals(userIdNumber)
        .modify({
          calculationMethod: 'manual',
          lastCalculated: new Date(),
          updatedAt: new Date()
        });
    });

    // Fetch updated zones
    const updatedZones = await db.heartRateZones
      .where('userId')
      .equals(userIdNumber)
      .sortBy('zoneNumber');

    return NextResponse.json({
      success: true,
      zones: updatedZones,
      message: 'Heart rate zones updated successfully'
    });
  } catch (error) {
    console.error('Error updating heart rate zones:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update heart rate zones' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user's heart rate zones and settings
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    const userIdNumber = parseInt(userId);

    // Delete zones and settings in transaction
    await db.transaction('rw', [db.heartRateZones, db.heartRateZoneSettings], async () => {
      await db.heartRateZones.where('userId').equals(userIdNumber).delete();
      await db.heartRateZoneSettings.where('userId').equals(userIdNumber).delete();
    });

    return NextResponse.json({
      success: true,
      message: 'Heart rate zones and settings deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting heart rate zones:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete heart rate zones'
    }, { status: 500 });
  }
}