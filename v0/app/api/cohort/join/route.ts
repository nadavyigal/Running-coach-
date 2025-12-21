import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const joinCohortSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  userId: z.number().min(1, 'User ID is required'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inviteCode, userId } = joinCohortSchema.parse(body);

    // Find the cohort by invite code
    const cohort = await db.cohorts.where('inviteCode').equals(inviteCode).first();

    if (!cohort) {
      return NextResponse.json({ message: 'Invalid invite code' }, { status: 404 });
    }

    // Check if the user is already a member of this cohort
    const existingMember = await db.cohortMembers
      .where('userId').equals(userId)
      .and(member => member.cohortId === cohort.id)
      .first();

    if (existingMember) {
      return NextResponse.json({ message: 'User is already a member of this cohort' }, { status: 409 });
    }

    const cohortId = cohort.id
    if (typeof cohortId !== 'number') {
      logger.error('Cohort is missing an id:', cohort)
      return NextResponse.json({ message: 'Invalid cohort data' }, { status: 500 })
    }

    // Add the user to the cohort
    await db.cohortMembers.add({
      userId,
      cohortId,
      joinDate: new Date(),
    });

    // Update the user's cohortId if they can only be in one cohort
    // This assumes a 1:1 relationship between user and cohort.
    // If a user can be in multiple cohorts, this update should be removed.
    await db.users.update(userId, { cohortId });

    return NextResponse.json({ message: 'Successfully joined cohort', cohortId }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    logger.error('Error joining cohort:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
