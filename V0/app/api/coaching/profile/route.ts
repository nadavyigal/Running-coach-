import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbUtils } from '@/lib/db';

const ProfileQuerySchema = z.object({
  userId: z.string().transform(Number).optional(),
});

const ProfileUpdateSchema = z.object({
  userId: z.number(),
  communicationStyle: z.object({
    motivationLevel: z.enum(['low', 'medium', 'high']).optional(),
    detailPreference: z.enum(['minimal', 'medium', 'detailed']).optional(),
    personalityType: z.enum(['analytical', 'encouraging', 'direct', 'supportive']).optional(),
    preferredTone: z.enum(['professional', 'friendly', 'enthusiastic', 'calm']).optional(),
  }).optional(),
  feedbackPatterns: z.object({
    preferredFeedbackFrequency: z.enum(['after_every_workout', 'weekly', 'monthly']).optional(),
  }).optional(),
  behavioralPatterns: z.object({
    workoutPreferences: z.object({
      difficultyPreference: z.number().min(0).max(10).optional(),
    }).optional(),
    contextualPatterns: z.object({
      weatherSensitivity: z.number().min(0).max(10).optional(),
      scheduleFlexibility: z.number().min(0).max(10).optional(),
      stressResponse: z.enum(['reduce_intensity', 'maintain', 'increase_focus']).optional(),
    }).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = ProfileQuerySchema.parse({
      userId: searchParams.get('userId'),
    });

    const userId = params.userId || 1; // Default to user 1 for now
    
    // Get coaching profile
    const profile = await dbUtils.getCoachingProfile(userId);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Coaching profile not found' },
        { status: 404 }
      );
    }

    // Get recent adaptations
    const recentAdaptations = profile.adaptationHistory
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Get behavior patterns
    const patterns = await dbUtils.getBehaviorPatterns(userId);
    
    // Get recent feedback for effectiveness metrics
    const recentFeedback = await dbUtils.getCoachingFeedback(userId, 20);
    const averageRating = recentFeedback.length > 0 
      ? recentFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / recentFeedback.length
      : 3.5;

    // Calculate engagement metrics
    const recentInteractions = await dbUtils.getCoachingInteractions(userId, 30);
    const engagementImprovement = recentInteractions.length > 10 
      ? ((recentInteractions.slice(0, 5).reduce((sum, i) => sum + (i.effectivenessScore || 0), 0) / 5) -
         (recentInteractions.slice(5, 10).reduce((sum, i) => sum + (i.effectivenessScore || 0), 0) / 5)) * 100
      : 0;

    const response = {
      coachingProfile: {
        communicationStyle: profile.communicationStyle,
        learnedPreferences: {
          workoutDays: profile.behavioralPatterns.workoutPreferences.preferredDays,
          preferredWorkoutTypes: Object.entries(profile.behavioralPatterns.workoutPreferences.workoutTypeAffinities || {})
            .filter(([, score]) => score > 50)
            .map(([type]) => type),
          difficultyPreference: profile.behavioralPatterns.workoutPreferences.difficultyPreference,
          weatherSensitivity: profile.behavioralPatterns.contextualPatterns.weatherSensitivity,
          stressResponse: profile.behavioralPatterns.contextualPatterns.stressResponse,
        },
        effectivenessMetrics: {
          overallSatisfaction: Number(averageRating.toFixed(1)),
          coachingScore: Math.round(profile.coachingEffectivenessScore),
          engagementImprovement: Math.round(engagementImprovement),
          totalInteractions: recentInteractions.length,
          totalFeedback: recentFeedback.length,
        },
        behaviorPatterns: patterns.map(pattern => ({
          type: pattern.patternType,
          confidence: pattern.confidenceScore,
          lastObserved: pattern.lastObserved,
          observationCount: pattern.observationCount,
          pattern: pattern.patternData.pattern,
        })),
      },
      adaptationHistory: recentAdaptations.map(adaptation => ({
        date: adaptation.date,
        adaptation: adaptation.adaptation,
        effectiveness: adaptation.effectiveness,
        reason: adaptation.reason,
      })),
      metadata: {
        userId,
        lastUpdated: profile.updatedAt,
        profileAge: Math.floor((new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching coaching profile:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch coaching profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data = ProfileUpdateSchema.parse(body);
    
    // Get current profile
    const currentProfile = await dbUtils.getCoachingProfile(data.userId);
    
    if (!currentProfile) {
      return NextResponse.json(
        { error: 'Coaching profile not found' },
        { status: 404 }
      );
    }

    // Merge updates with current profile
    const updates: any = {};
    
    if (data.communicationStyle) {
      updates.communicationStyle = {
        ...currentProfile.communicationStyle,
        ...data.communicationStyle
      };
    }
    
    if (data.feedbackPatterns) {
      updates.feedbackPatterns = {
        ...currentProfile.feedbackPatterns,
        ...data.feedbackPatterns
      };
    }
    
    if (data.behavioralPatterns) {
      updates.behavioralPatterns = {
        ...currentProfile.behavioralPatterns,
        workoutPreferences: {
          ...currentProfile.behavioralPatterns.workoutPreferences,
          ...data.behavioralPatterns.workoutPreferences
        },
        contextualPatterns: {
          ...currentProfile.behavioralPatterns.contextualPatterns,
          ...data.behavioralPatterns.contextualPatterns
        }
      };
    }

    // Record adaptation if communication style changed
    const adaptations = [];
    if (data.communicationStyle) {
      Object.entries(data.communicationStyle).forEach(([key, value]) => {
        if (value !== (currentProfile.communicationStyle as any)[key]) {
          adaptations.push(`${key} changed to ${value}`);
        }
      });
    }

    if (adaptations.length > 0) {
      updates.adaptationHistory = [
        ...currentProfile.adaptationHistory,
        {
          date: new Date(),
          adaptation: adaptations.join(', '),
          effectiveness: 0, // Will be measured over time
          reason: 'Manual user preference update'
        }
      ];
      updates.lastAdaptationDate = new Date();
    }

    // Update profile
    await dbUtils.updateCoachingProfile(data.userId, updates);
    
    // Get updated profile
    const updatedProfile = await dbUtils.getCoachingProfile(data.userId);
    
    return NextResponse.json({
      success: true,
      message: adaptations.length > 0 
        ? `Profile updated with ${adaptations.length} adaptation(s)`
        : 'Profile updated successfully',
      adaptations,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('Error updating coaching profile:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update coaching profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const existingProfile = await dbUtils.getCoachingProfile(userId);
    
    if (existingProfile) {
      return NextResponse.json(
        { error: 'Coaching profile already exists for this user' },
        { status: 409 }
      );
    }

    // Create new coaching profile with defaults
    const profileId = await dbUtils.createCoachingProfile({
      userId,
      communicationStyle: {
        motivationLevel: 'medium',
        detailPreference: 'medium',
        personalityType: 'encouraging',
        preferredTone: 'friendly'
      },
      feedbackPatterns: {
        averageRating: 3.5,
        commonConcerns: [],
        responsiveness: 'immediate',
        preferredFeedbackFrequency: 'weekly'
      },
      behavioralPatterns: {
        workoutPreferences: {
          preferredDays: [],
          preferredTimes: [],
          workoutTypeAffinities: {},
          difficultyPreference: 5
        },
        contextualPatterns: {
          weatherSensitivity: 5,
          scheduleFlexibility: 5,
          stressResponse: 'maintain',
          energyPatterns: {}
        }
      },
      coachingEffectivenessScore: 50,
      lastAdaptationDate: new Date(),
      adaptationHistory: []
    });

    return NextResponse.json({
      success: true,
      message: 'Coaching profile created successfully',
      profileId,
    });
  } catch (error) {
    console.error('Error creating coaching profile:', error);
    
    return NextResponse.json(
      { error: 'Failed to create coaching profile' },
      { status: 500 }
    );
  }
}