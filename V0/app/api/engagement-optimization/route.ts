import { NextRequest, NextResponse } from 'next/server';
import { dbUtils } from '@/lib/db';
import { engagementOptimizationService } from '@/lib/engagement-optimization';

export async function GET(request: NextRequest) {
  try {
    const user = await dbUtils.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's engagement data
    const runs = await dbUtils.getRuns(user.id!);
    const goals = await dbUtils.getGoals(user.id!);
    const badges = await dbUtils.getBadges(user.id!);

    // Calculate engagement metrics
    const engagementScore = await engagementOptimizationService.calculateEngagementScore(user, runs, goals, badges);
    const optimalTiming = await engagementOptimizationService.determineOptimalTiming(user, runs);
    const motivationalTriggers = await engagementOptimizationService.generateMotivationalTriggers(user, runs, goals);

    return NextResponse.json({
      engagementScore,
      optimalTiming,
      motivationalTriggers,
      notificationPreferences: user.notificationPreferences || {
        frequency: 'medium',
        timing: 'morning',
        types: [
          { id: 'motivational', name: 'Motivational Messages', description: 'Daily encouragement and tips', enabled: true, category: 'motivational' },
          { id: 'reminder', name: 'Workout Reminders', description: 'Gentle reminders to stay active', enabled: true, category: 'reminder' },
          { id: 'achievement', name: 'Achievement Celebrations', description: 'Celebrate your milestones', enabled: true, category: 'achievement' },
          { id: 'milestone', name: 'Milestone Alerts', description: 'Progress towards your goals', enabled: true, category: 'milestone' }
        ],
        quietHours: { start: '22:00', end: '07:00' }
      }
    });
  } catch (error) {
    console.error('Error fetching engagement optimization data:', error);
    return NextResponse.json({ error: 'Failed to fetch engagement data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await dbUtils.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { notificationPreferences } = body;

    // Validate notification preferences
    if (!notificationPreferences) {
      return NextResponse.json({ error: 'Notification preferences are required' }, { status: 400 });
    }

    // Update user's notification preferences
    const updatedUser = await dbUtils.updateUser(user.id!, {
      ...user,
      notificationPreferences
    });

    return NextResponse.json({
      message: 'Engagement preferences updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating engagement preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await dbUtils.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { type, enabled } = body;

    // Validate request
    if (!type || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Type and enabled status are required' }, { status: 400 });
    }

    // Update specific notification type
    const currentPreferences = user.notificationPreferences || {
      frequency: 'medium',
      timing: 'morning',
      types: [
        { id: 'motivational', name: 'Motivational Messages', description: 'Daily encouragement and tips', enabled: true, category: 'motivational' },
        { id: 'reminder', name: 'Workout Reminders', description: 'Gentle reminders to stay active', enabled: true, category: 'reminder' },
        { id: 'achievement', name: 'Achievement Celebrations', description: 'Celebrate your milestones', enabled: true, category: 'achievement' },
        { id: 'milestone', name: 'Milestone Alerts', description: 'Progress towards your goals', enabled: true, category: 'milestone' }
      ],
      quietHours: { start: '22:00', end: '07:00' }
    };

    const updatedTypes = currentPreferences.types.map(t => 
      t.id === type ? { ...t, enabled } : t
    );

    const updatedPreferences = {
      ...currentPreferences,
      types: updatedTypes
    };

    const updatedUser = await dbUtils.updateUser(user.id!, {
      ...user,
      notificationPreferences: updatedPreferences
    });

    return NextResponse.json({
      message: 'Notification type updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating notification type:', error);
    return NextResponse.json({ error: 'Failed to update notification type' }, { status: 500 });
  }
}