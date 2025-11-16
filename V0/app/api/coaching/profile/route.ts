import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type CoachingProfile } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';

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
    console.log('Fetching coaching profile for userId:', userId);
    
    // Check database version and ensure coaching tables exist
    console.log('Verifying database schema...');
    const coachingTablesExist = await dbUtils.ensureCoachingTablesExist();
    
    if (!coachingTablesExist) {
      console.error('Coaching tables do not exist or database version is outdated');
      return NextResponse.json(
        { error: 'Database schema outdated. Please refresh the page to update.' },
        { status: 500 }
      );
    }
    
    // Get coaching profile
    console.log('Step 1: Fetching coaching profile...');
    const profile = await dbUtils.getCoachingProfile(userId);
    console.log('Coaching profile result:', profile ? 'Found' : 'Not found');
    
    if (!profile) {
      console.log('No coaching profile found for user:', userId, 'attempting to create one...');
      
      // Try to create a coaching profile automatically
      try {
        await dbUtils.createCoachingProfile({
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
        
        // Fetch the newly created profile
        const newProfile = await dbUtils.getCoachingProfile(userId);
        if (newProfile) {
          console.log('Successfully created coaching profile for user:', userId);
          return await buildProfileResponse(newProfile, userId);
        }
      } catch (createError) {
        console.error('Failed to create coaching profile:', createError);
      }
      
      return NextResponse.json(
        { error: 'Coaching profile not found and could not be created' },
        { status: 404 }
      );
    }

    console.log('Found coaching profile for user:', userId);
    return await buildProfileResponse(profile, userId);

  } catch (error) {
    console.error('Error fetching coaching profile:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch coaching profile',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

async function buildProfileResponse(profile: CoachingProfile, userId: number) {
  try {
    console.log('Building profile response for userId:', userId);
    
    // Get recent adaptations
    console.log('Step 2: Processing adaptation history...');
    const recentAdaptations = (profile.adaptationHistory || [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    console.log('Recent adaptations count:', recentAdaptations.length);

    // Get behavior patterns with error handling
    console.log('Step 3: Fetching behavior patterns...');
    let patterns = [];
    try {
      patterns = await dbUtils.getBehaviorPatterns(userId);
      console.log('Behavior patterns retrieved:', patterns.length);
    } catch (error) {
      console.error('Failed to fetch behavior patterns:', error);
      patterns = [];
    }
    
    // Get recent feedback for effectiveness metrics with error handling
    console.log('Step 4: Fetching coaching feedback...');
    let recentFeedback = [];
    try {
      recentFeedback = await dbUtils.getCoachingFeedback(userId, 20);
      console.log('Coaching feedback retrieved:', recentFeedback.length);
    } catch (error) {
      console.error('Failed to fetch coaching feedback:', error);
      recentFeedback = [];
    }
    
    const averageRating = recentFeedback.length > 0 
      ? recentFeedback.reduce((sum, f) => sum + (f.rating || 3), 0) / recentFeedback.length
      : 3.5;
    console.log('Average rating calculated:', averageRating);

    // Calculate engagement metrics with error handling
    console.log('Step 5: Fetching coaching interactions...');
    let recentInteractions = [];
    try {
      recentInteractions = await dbUtils.getCoachingInteractions(userId, 30);
      console.log('Coaching interactions retrieved:', recentInteractions.length);
    } catch (error) {
      console.error('Failed to fetch coaching interactions:', error);
      recentInteractions = [];
    }
    
    const engagementImprovement = recentInteractions.length > 10 
      ? ((recentInteractions.slice(0, 5).reduce((sum, i) => sum + (i.effectivenessScore || 0), 0) / 5) -
         (recentInteractions.slice(5, 10).reduce((sum, i) => sum + (i.effectivenessScore || 0), 0) / 5)) * 100
      : 0;
    console.log('Engagement improvement calculated:', engagementImprovement);

    console.log('Step 6: Building response object...');
    
    // Validate profile structure and provide safe defaults
    const communicationStyle = profile.communicationStyle || {
      motivationLevel: 'medium',
      detailPreference: 'medium', 
      personalityType: 'encouraging',
      preferredTone: 'friendly'
    };
    
    const behavioralPatterns = profile.behavioralPatterns || {
      workoutPreferences: { preferredDays: [], workoutTypeAffinities: {}, difficultyPreference: 5 },
      contextualPatterns: { weatherSensitivity: 5, stressResponse: 'maintain' }
    };
    
    console.log('Communication style:', communicationStyle);
    console.log('Behavioral patterns:', behavioralPatterns);

    const response = {
      coachingProfile: {
        communicationStyle,
        learnedPreferences: {
          workoutDays: behavioralPatterns.workoutPreferences?.preferredDays || [],
          preferredWorkoutTypes: Object.entries(behavioralPatterns.workoutPreferences?.workoutTypeAffinities || {})
            .filter(([, score]) => (score as number) > 50)
            .map(([type]) => type),
          difficultyPreference: behavioralPatterns.workoutPreferences?.difficultyPreference || 5,
          weatherSensitivity: behavioralPatterns.contextualPatterns?.weatherSensitivity || 5,
          stressResponse: behavioralPatterns.contextualPatterns?.stressResponse || 'maintain',
        },
        effectivenessMetrics: {
          overallSatisfaction: Number(averageRating.toFixed(1)),
          coachingScore: Math.round(profile.coachingEffectivenessScore || 50),
          engagementImprovement: Math.round(engagementImprovement),
          totalInteractions: recentInteractions.length,
          totalFeedback: recentFeedback.length,
        },
        behaviorPatterns: patterns.map(pattern => ({
          type: pattern.patternType || 'unknown',
          confidence: pattern.confidenceScore || 0,
          lastObserved: pattern.lastObserved || new Date().toISOString(),
          observationCount: pattern.observationCount || 0,
          pattern: pattern.patternData?.pattern || 'No pattern data',
        })),
      },
      adaptationHistory: recentAdaptations.map(adaptation => ({
        date: adaptation.date || new Date().toISOString(),
        adaptation: adaptation.adaptation || 'No adaptation data',
        effectiveness: adaptation.effectiveness || 0,
        reason: adaptation.reason || 'No reason provided',
      })),
      metadata: {
        userId,
        lastUpdated: profile.updatedAt || new Date().toISOString(),
        profileAge: Math.floor((new Date().getTime() - new Date(profile.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)),
      },
    };

    console.log('Step 7: Response built successfully');
    return NextResponse.json(response);
  } catch (buildError) {
    console.error('Error building profile response:', buildError);
    return NextResponse.json(
      { error: 'Failed to build coaching profile response' },
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