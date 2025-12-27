import { NextRequest, NextResponse } from 'next/server';
import { RecoveryEngine } from '../../../../lib/recoveryEngine';
import { PersonalizationContextBuilder } from '../../../../lib/personalizationContext';
import { SubscriptionGate, ProFeature } from '../../../../lib/subscriptionGates';
import { dbUtils } from '../../../../lib/dbUtils';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '1');
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    // Check if user has Pro access
    const hasAccess = await SubscriptionGate.hasAccess(userId, ProFeature.RECOVERY_RECOMMENDATIONS);

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'pro_required',
          message: SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS),
          upgradeUrl: '/pricing',
          preview: {
            recoveryScore: 75,
            recommendations: ['Upgrade to Pro for personalized recovery insights based on your data'],
            confidence: 50,
            breakdown: {
              sleepScore: 75,
              hrvScore: 75,
              restingHRScore: 75,
              subjectiveWellnessScore: 75,
              trainingLoadImpact: 25,
              stressLevel: 25,
            },
          },
        },
        { status: 403 }
      );
    }

    // Check if onboarding is complete
    const user = await dbUtils.getUser(userId);
    if (!user || !user.onboardingComplete) {
      return NextResponse.json({
        success: true,
        data: {
          recommendations: ['Complete onboarding to unlock personalized recovery recommendations'],
          recoveryScore: 50,
          confidence: 0,
          isOnboarding: true,
          breakdown: {
            sleepScore: 50,
            hrvScore: 50,
            restingHRScore: 50,
            subjectiveWellnessScore: 50,
            trainingLoadImpact: 0,
            stressLevel: 50,
          },
        },
      });
    }

    // Get current recovery score
    let recoveryScore;
    try {
      recoveryScore = await RecoveryEngine.getRecoveryScore(userId, date);
    } catch (error) {
      logger.warn('Failed to get existing recovery score, will calculate new one:', error);
      recoveryScore = null;
    }

    // Calculate recovery score if none exists
    if (!recoveryScore) {
      try {
        recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, date);
      } catch (calcError) {
        logger.error('Failed to calculate recovery score:', calcError);

        // Return graceful fallback recommendations
        return NextResponse.json({
          success: true,
          data: {
            recommendations: [
              'Get adequate sleep (7-9 hours) for optimal recovery',
              'Stay hydrated throughout the day',
              'Consider light stretching or mobility work',
              'Monitor how you feel before intense training',
            ],
            recoveryScore: 50,
            confidence: 30,
            breakdown: {
              sleepScore: 50,
              hrvScore: 50,
              restingHRScore: 50,
              subjectiveWellnessScore: 50,
              trainingLoadImpact: 0,
              stressLevel: 50,
            },
          },
        });
      }
    }

    // Build personalization context
    let personalizedRecs: string[];
    try {
      const context = await PersonalizationContextBuilder.build(userId);

      // Generate personalized recommendations
      personalizedRecs = await RecoveryEngine.generatePersonalizedRecommendations(
        userId,
        recoveryScore,
        context
      );

      logger.info(
        `Generated ${personalizedRecs.length} personalized recommendations for user ${userId}`
      );
    } catch (contextError) {
      logger.warn('Failed to build personalization context, using base recommendations:', contextError);
      // Fall back to base recommendations
      personalizedRecs = recoveryScore.recommendations;
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendations: personalizedRecs,
        recoveryScore: recoveryScore.overallScore,
        confidence: recoveryScore.confidence,
        breakdown: {
          sleepScore: recoveryScore.sleepScore,
          hrvScore: recoveryScore.hrvScore,
          restingHRScore: recoveryScore.restingHRScore,
          subjectiveWellnessScore: recoveryScore.subjectiveWellnessScore,
          trainingLoadImpact: recoveryScore.trainingLoadImpact,
          stressLevel: recoveryScore.stressLevel,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting recovery recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get recovery recommendations',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date = new Date() } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
        },
        { status: 400 }
      );
    }

    // Check if user has Pro access
    const hasAccess = await SubscriptionGate.hasAccess(userId, ProFeature.RECOVERY_RECOMMENDATIONS);

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'pro_required',
          message: SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS),
        },
        { status: 403 }
      );
    }

    // Calculate recovery score
    const recoveryScore = await RecoveryEngine.calculateRecoveryScore(userId, new Date(date));

    // Build personalization context and generate personalized recommendations
    let personalizedRecs: string[];
    try {
      const context = await PersonalizationContextBuilder.build(userId);
      personalizedRecs = await RecoveryEngine.generatePersonalizedRecommendations(
        userId,
        recoveryScore,
        context
      );
    } catch (contextError) {
      logger.warn('Failed to personalize recommendations, using base recommendations:', contextError);
      personalizedRecs = recoveryScore.recommendations;
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendations: personalizedRecs,
        recoveryScore: recoveryScore.overallScore,
        confidence: recoveryScore.confidence,
        breakdown: {
          sleepScore: recoveryScore.sleepScore,
          hrvScore: recoveryScore.hrvScore,
          restingHRScore: recoveryScore.restingHRScore,
          subjectiveWellnessScore: recoveryScore.subjectiveWellnessScore,
          trainingLoadImpact: recoveryScore.trainingLoadImpact,
          stressLevel: recoveryScore.stressLevel,
        },
      },
    });
  } catch (error) {
    logger.error('Error calculating recovery recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate recovery recommendations',
      },
      { status: 500 }
    );
  }
}
