import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const joinCohortSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  userId: z.union([z.string().min(1, 'User ID is required'), z.number().min(1, 'User ID is required')]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inviteCode, userId } = joinCohortSchema.parse(body);

    const prismaDb = (db as any).cohort && (db as any).cohortMember && (db as any).user;

    if (prismaDb) {
      const cohort = await (db as any).cohort.findUnique({ where: { inviteCode } });

      if (!cohort) {
        return NextResponse.json({ message: 'Invalid invite code' }, { status: 404 });
      }

      const existingMember = await (db as any).cohortMember.findUnique({
        where: {
          userId_cohortId: {
            userId,
            cohortId: cohort.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json({ message: 'User is already a member of this cohort' }, { status: 409 });
      }

      await (db as any).cohortMember.create({
        data: {
          userId,
          cohortId: cohort.id,
          joinDate: new Date(),
        },
      });

      await (db as any).user.update({
        where: { id: userId },
        data: { cohortId: cohort.id },
      });

      return NextResponse.json({ message: 'Successfully joined cohort', cohortId: cohort.id }, { status: 200 });
    }

    const numericUserId =
      typeof userId === 'number' ? userId : Number.parseInt(String(userId), 10);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json({ message: 'Invalid request data' }, { status: 400 });
    }

    // Find the cohort by invite code
    const cohort = await db.cohorts.where('inviteCode').equals(inviteCode).first();

    if (!cohort) {
      return NextResponse.json({ message: 'Invalid invite code' }, { status: 404 });
    }

    // Check if the user is already a member of this cohort
    const existingMember = await db.cohortMembers
      .where('userId').equals(numericUserId)
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
      userId: numericUserId,
      cohortId,
      joinDate: new Date(),
    });

    // Update the user's cohortId if they can only be in one cohort
    // This assumes a 1:1 relationship between user and cohort.
    // If a user can be in multiple cohorts, this update should be removed.
    await db.users.update(numericUserId, { cohortId });

    return NextResponse.json({ message: 'Successfully joined cohort', cohortId }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    logger.error('Error joining cohort:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
