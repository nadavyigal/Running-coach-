import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { badgeId } = await request.json();

    if (!badgeId) {
      return NextResponse.json({ message: 'Badge ID is required.' }, { status: 400 });
    }

    const badgeIdValue = typeof badgeId === 'string' || typeof badgeId === 'number' ? String(badgeId).trim() : '';
    if (!badgeIdValue) {
      return NextResponse.json({ message: 'Invalid Badge ID format.' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://runsmart.com';
    const shareableLink = `${baseUrl}/share/badge/${badgeIdValue}`;

    logger.log('Generated badge share link:', {
      badgeId: badgeIdValue,
      shareableLink,
      createdAt: new Date(),
    });

    return NextResponse.json({
      shareableLink,
    });

  } catch (error) {
    logger.error('Error generating shareable link:', error);
    return NextResponse.json({ message: 'Error generating shareable link' }, { status: 500 });
  }
}
