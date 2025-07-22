import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateMaxHRZones, calculateHRRZones, calculateLTZones } from '@/lib/heartRateZones';

// GET - Get zone-based workout recommendations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const targetZone = searchParams.get('targetZone');
    const workoutType = searchParams.get('workoutType');
    const duration = searchParams.get('duration');
    
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
    
    if (zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No heart rate zones configured for this user' },
        { status: 404 }
      );
    }

    // Get user profile for context
    const user = await db.users.get(userIdNumber);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate zone-based workout recommendations
    const recommendations = generateZoneBasedWorkouts(
      zones,
      targetZone ? parseInt(targetZone) : null,
      workoutType || 'general',
      duration ? parseInt(duration) : 45
    );

    return NextResponse.json({
      success: true,
      recommendations,
      userContext: {
        age: user.age,
        experience: user.experience,
        maxHR: user.age ? (220 - user.age) : 190,
        restingHR: 60 // Default resting HR since not stored in User interface
      }
    });
  } catch (error) {
    console.error('Error generating zone-based workouts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate zone-based workouts' },
      { status: 500 }
    );
  }
}

// POST - Create custom zone-based workout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, targetZone, workoutType, duration, intervals } = body;
    
    if (!userId || !targetZone) {
      return NextResponse.json(
        { success: false, error: 'User ID and target zone are required' },
        { status: 400 }
      );
    }

    const userIdNumber = parseInt(userId);
    
    // Get user's heart rate zones
    const zones = await db.heartRateZones
      .where('userId')
      .equals(userIdNumber)
      .sortBy('zoneNumber');
    
    if (zones.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No heart rate zones configured for this user' },
        { status: 404 }
      );
    }

    // Create custom zone-based workout
    const customWorkout = createCustomZoneWorkout(
      zones,
      targetZone,
      workoutType || 'intervals',
      duration || 45,
      intervals
    );

    return NextResponse.json({
      success: true,
      workout: customWorkout,
      message: 'Custom zone-based workout created successfully'
    });
  } catch (error) {
    console.error('Error creating custom zone workout:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create custom zone workout' },
      { status: 500 }
    );
  }
}

interface ZoneWorkoutRecommendation {
  id: string;
  name: string;
  description: string;
  targetZone: number;
  duration: number; // minutes
  type: 'recovery' | 'base' | 'tempo' | 'threshold' | 'vo2max' | 'intervals';
  structure: {
    warmup: { duration: number; zone: number };
    main: { duration: number; zone: number; intervals?: Array<{ duration: number; zone: number; recovery: number }> };
    cooldown: { duration: number; zone: number };
  };
  benefits: string[];
  tips: string[];
  difficulty: 'easy' | 'moderate' | 'hard';
}

function generateZoneBasedWorkouts(
  zones: any[],
  targetZone: number | null,
  workoutType: string,
  duration: number
): ZoneWorkoutRecommendation[] {
  const recommendations: ZoneWorkoutRecommendation[] = [];
  
  // Recovery workouts (Zone 1-2)
  if (!targetZone || targetZone <= 2) {
    recommendations.push({
      id: 'recovery-easy',
      name: 'Easy Recovery Run',
      description: 'Gentle aerobic base building with focus on recovery',
      targetZone: 1,
      duration: 30,
      type: 'recovery',
      structure: {
        warmup: { duration: 5, zone: 1 },
        main: { duration: 20, zone: 1 },
        cooldown: { duration: 5, zone: 1 }
      },
      benefits: ['Promotes recovery', 'Builds aerobic base', 'Improves fat burning'],
      tips: ['Keep conversation easy', 'Focus on form', 'Stay relaxed'],
      difficulty: 'easy'
    });
  }

  // Base building workouts (Zone 2-3)
  if (!targetZone || (targetZone >= 2 && targetZone <= 3)) {
    recommendations.push({
      id: 'base-building',
      name: 'Aerobic Base Run',
      description: 'Moderate effort for building endurance and aerobic capacity',
      targetZone: 2,
      duration: 45,
      type: 'base',
      structure: {
        warmup: { duration: 10, zone: 1 },
        main: { duration: 30, zone: 2 },
        cooldown: { duration: 5, zone: 1 }
      },
      benefits: ['Builds aerobic capacity', 'Improves endurance', 'Enhances fat burning'],
      tips: ['Maintain steady pace', 'Breathe comfortably', 'Can hold conversation'],
      difficulty: 'moderate'
    });
  }

  // Tempo workouts (Zone 3-4)
  if (!targetZone || (targetZone >= 3 && targetZone <= 4)) {
    recommendations.push({
      id: 'tempo-run',
      name: 'Tempo Run',
      description: 'Sustained effort at lactate threshold to improve race pace',
      targetZone: 3,
      duration: 40,
      type: 'tempo',
      structure: {
        warmup: { duration: 10, zone: 1 },
        main: { duration: 20, zone: 3 },
        cooldown: { duration: 10, zone: 1 }
      },
      benefits: ['Improves lactate threshold', 'Enhances race pace', 'Builds mental toughness'],
      tips: ['Start conservatively', 'Maintain steady effort', 'Focus on rhythm'],
      difficulty: 'hard'
    });
  }

  // Threshold workouts (Zone 4)
  if (!targetZone || targetZone === 4) {
    recommendations.push({
      id: 'threshold-intervals',
      name: 'Threshold Intervals',
      description: 'High-intensity intervals at lactate threshold',
      targetZone: 4,
      duration: 50,
      type: 'threshold',
      structure: {
        warmup: { duration: 15, zone: 1 },
        main: {
          duration: 25,
          zone: 4,
          intervals: [
            { duration: 5, zone: 4, recovery: 3 },
            { duration: 5, zone: 4, recovery: 3 },
            { duration: 5, zone: 4, recovery: 3 },
            { duration: 5, zone: 4, recovery: 3 },
            { duration: 5, zone: 4, recovery: 3 }
          ]
        },
        cooldown: { duration: 10, zone: 1 }
      },
      benefits: ['Increases lactate threshold', 'Improves race performance', 'Builds endurance'],
      tips: ['Recover fully between intervals', 'Maintain consistent effort', 'Focus on form'],
      difficulty: 'hard'
    });
  }

  // VO2 Max workouts (Zone 5)
  if (!targetZone || targetZone === 5) {
    recommendations.push({
      id: 'vo2max-intervals',
      name: 'VO2 Max Intervals',
      description: 'Maximum effort intervals to improve oxygen uptake',
      targetZone: 5,
      duration: 45,
      type: 'vo2max',
      structure: {
        warmup: { duration: 15, zone: 1 },
        main: {
          duration: 20,
          zone: 5,
          intervals: [
            { duration: 3, zone: 5, recovery: 3 },
            { duration: 3, zone: 5, recovery: 3 },
            { duration: 3, zone: 5, recovery: 3 },
            { duration: 3, zone: 5, recovery: 3 },
            { duration: 3, zone: 5, recovery: 3 },
            { duration: 3, zone: 5, recovery: 3 }
          ]
        },
        cooldown: { duration: 10, zone: 1 }
      },
      benefits: ['Improves VO2 max', 'Enhances speed', 'Builds power'],
      tips: ['Go all out during intervals', 'Recover completely', 'Focus on quality over quantity'],
      difficulty: 'hard'
    });
  }

  // Filter by workout type if specified
  if (workoutType !== 'general') {
    return recommendations.filter(r => r.type === workoutType);
  }

  return recommendations;
}

function createCustomZoneWorkout(
  zones: any[],
  targetZone: number,
  workoutType: string,
  duration: number,
  intervals?: any[]
): ZoneWorkoutRecommendation {
  const targetZoneInfo = zones.find(z => z.zoneNumber === targetZone);
  
  return {
    id: `custom-${Date.now()}`,
    name: `Custom ${targetZoneInfo?.name || `Zone ${targetZone}`} Workout`,
    description: `Custom workout targeting Zone ${targetZone}`,
    targetZone,
    duration,
    type: workoutType as any,
    structure: {
      warmup: { duration: Math.round(duration * 0.2), zone: 1 },
      main: {
        duration: Math.round(duration * 0.6),
        zone: targetZone,
        intervals: intervals || []
      },
      cooldown: { duration: Math.round(duration * 0.2), zone: 1 }
    },
    benefits: ['Customized to your needs', 'Targeted zone training', 'Progressive overload'],
    tips: ['Follow the structure', 'Listen to your body', 'Adjust intensity as needed'],
    difficulty: 'moderate'
  };
} 