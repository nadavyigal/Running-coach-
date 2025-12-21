import { db } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';
import { regenerateTrainingPlan } from '@/lib/plan-regeneration';

export async function migrateExistingGoals() {
  console.log('🔄 Starting existing goals migration...');

  try {
    // Get all goals that don't have isPrimary set
    const goals = await db.goals.toArray();

    if (goals.length === 0) {
      console.log('✅ No goals to migrate');
      return { migrated: 0, errors: [] };
    }

    let migrated = 0;
    const errors: string[] = [];

    // Group goals by user
    const goalsByUser = goals.reduce((acc, goal) => {
      const bucket = acc[goal.userId] ?? (acc[goal.userId] = []);
      bucket.push(goal);
      return acc;
    }, {} as Record<number, typeof goals>);

    for (const [userId, userGoals] of Object.entries(goalsByUser)) {
      try {
        // Find the most recent active goal to make primary
        const activeGoals = userGoals.filter(g => g.status === 'active');

        if (activeGoals.length === 0) {
          console.log(`⚠️ User ${userId} has no active goals, skipping`);
          continue;
        }

        // Sort by most recent
        activeGoals.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        const primaryGoal = activeGoals.at(0);
        if (!primaryGoal || typeof primaryGoal.id !== 'number') {
          continue;
        }
        console.log(`Setting goal "${primaryGoal.title}" as primary for user ${userId}`);

        // Set as primary
        await dbUtils.setPrimaryGoal(Number(userId), primaryGoal.id);

        // Regenerate plan for this goal
        try {
          const plan = await regenerateTrainingPlan(Number(userId), primaryGoal);
          if (plan) {
            console.log(`✅ Plan regenerated for user ${userId}`);
            migrated++;
          } else {
            errors.push(`Failed to regenerate plan for user ${userId}`);
          }
        } catch (planError) {
          console.error(`❌ Plan regeneration failed for user ${userId}:`, planError);
          errors.push(`Plan regeneration failed for user ${userId}: ${(planError as Error).message}`);
        }

      } catch (userError) {
        console.error(`❌ Migration failed for user ${userId}:`, userError);
        errors.push(`User ${userId}: ${(userError as Error).message}`);
      }
    }

    console.log(`✅ Migration complete: ${migrated} users migrated, ${errors.length} errors`);
    return { migrated, errors };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
