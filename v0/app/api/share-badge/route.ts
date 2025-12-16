import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface ShareToken {
  id?: number;
  badgeId: number;
  userId: number;
  token: string;
  shareableLink: string;
  viewCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

export async function POST(request: Request) {
  try {
    const { badgeId, userId } = await request.json();

    // Input validation
    if (!badgeId || !userId) {
      return NextResponse.json(
        { message: 'Badge ID and User ID are required.' },
        { status: 400 }
      );
    }

    // Convert string badgeId to number if needed
    const numericBadgeId = typeof badgeId === 'string' ? parseInt(badgeId, 10) : badgeId;
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    if (isNaN(numericBadgeId) || isNaN(numericUserId)) {
      return NextResponse.json(
        { message: 'Invalid Badge ID or User ID format.' },
        { status: 400 }
      );
    }

    // Validate that the badge exists and belongs to the user
    const badge = await db.badges
      .where('id')
      .equals(numericBadgeId)
      .and(badge => badge.userId === numericUserId)
      .first();

    if (!badge) {
      return NextResponse.json(
        { message: 'Badge not found or does not belong to the user.' },
        { status: 404 }
      );
    }

    // Check if a share token already exists for this badge
    const existingShareTokens = await db.transaction('r', [db.badges], async () => {
      // Since we don't have a shareTokens table, we'll create a simple approach
      // using localStorage or generate a new token each time
      return [];
    });

    // Generate a unique token for this share
    const token = crypto.randomBytes(16).toString('hex');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://runsmart.app';
    const shareableLink = `${baseUrl}/share/badge/${token}`;

    // For now, we'll create a simplified tracking mechanism
    // In a real app, you'd want to store this in a dedicated shareTokens table
    logger.log('Generated share token:', {
      badgeId: numericBadgeId,
      userId: numericUserId,
      token,
      shareableLink,
      badgeType: badge.type,
      badgeMilestone: badge.milestone,
      createdAt: new Date()
    });

    // Track badge sharing event
    try {
      // We could store share analytics in a separate table
      // For now, just log the event
      logger.log(`Badge shared: ${badge.type} milestone ${badge.milestone} by user ${numericUserId}`);
    } catch (analyticsError) {
      logger.warn('Failed to track badge sharing event:', analyticsError);
      // Don't fail the request if analytics fails
    }

    return NextResponse.json({ 
      shareableLink,
      badgeName: badge.type,
      badgeMilestone: badge.milestone,
      token // Include token for potential future reference
    });

  } catch (error) {
    logger.error('Error generating shareable link:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Database')) {
        return NextResponse.json(
          { message: 'Database error occurred. Please try again.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}