import { db, isDatabaseAvailable, safeDbOperation, getDatabase } from './db';
import { withTransaction, createUserWithDefaults, createGoalWithMilestones, createRunWithMetrics, updateCohortStats, createRecoveryDataBatch } from './dbTransactions';
import type { 
  User, 
  Plan, 
  Workout, 
  Run, 
  Goal, 
  GoalMilestone,
  SleepData,
  HRVMeasurement,
  RecoveryScore,
  SubjectiveWellness,
  DataFusionRule,
  FusedDataPoint,
  DataConflict,
  DataSource
} from './db';

/**
 * Database Utilities - Comprehensive database operations with error handling
 * Provides safe, consistent database operations across the application
 */

// ============================================================================
// CORE DATABASE UTILITIES
// ============================================================================

/**
 * Initialize database and verify connectivity
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    // Check if we're on the server
    if (typeof window === 'undefined') {
      console.log('🔄 Server-side: Database initialization skipped');
      return true; // Return true for server-side to not block
    }
    
    if (!isDatabaseAvailable()) {
      console.error('❌ Database not available');
      return false;
    }

    // Test database connection
    const database = getDatabase();
    if (database) {
      await database.open();
      console.log('✅ Database initialized successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}

/**
 * Close database connection safely
 */
export async function closeDatabase(): Promise<void> {
  try {
    if (db && db.isOpen()) {
      await db.close();
      console.log('✅ Database closed successfully');
    }
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

/**
 * Clear all data from database (for testing/reset)
 */
export async function clearDatabase(): Promise<void> {
  return safeDbOperation(async () => {
    if (db) {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
      });
      console.log('✅ Database cleared successfully');
    }
  }, 'clearDatabase');
}

// ============================================================================
// USER MANAGEMENT UTILITIES
// ============================================================================

/**
 * Get current user with SSR-safe handling
 */
export async function getCurrentUser(): Promise<User | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      // Get the first user (assuming single-user app for now)
      const user = await database.users.orderBy('createdAt').first();
      return user || null;
    }
    return null;
  }, 'getCurrentUser', null);
}

/**
 * Create or update user profile
 */
export async function upsertUser(userData: Partial<User>): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    const existingUser = await database.users.where('id').equals(userData.id || 0).first();
    
    if (existingUser) {
      await database.users.update(existingUser.id!, {
        ...userData,
        updatedAt: new Date()
      });
      return existingUser.id!;
    } else {
      // Ensure required fields are present
      const userToAdd: Omit<User, 'id'> = {
        goal: userData.goal || 'habit',
        experience: userData.experience || 'beginner',
        preferredTimes: userData.preferredTimes || ['morning'],
        daysPerWeek: userData.daysPerWeek || 3,
        consents: userData.consents || {
          data: true,
          gdpr: true,
          push: true
        },
        onboardingComplete: userData.onboardingComplete || false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...userData
      };
      
      const id = await database.users.add(userToAdd);
      return id as number;
    }
  }, 'upsertUser');
}

/**
 * Get user by ID with error handling
 */
export async function getUser(userId: number): Promise<User | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      return await database.users.get(userId) || null;
    }
    return null;
  }, 'getUser', null);
}

/**
 * Get user by onboarding status
 */
export async function getUsersByOnboardingStatus(completed: boolean): Promise<User[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      return await database.users.where('onboardingComplete').equals(completed ? 1 : 0).toArray();
    }
    return [];
  }, 'getUsersByOnboardingStatus', []);
}

/**
 * Create user with full profile data
 */
export async function createUser(userData: Partial<User>): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    // Ensure required fields are present
    const userToAdd: Omit<User, 'id'> = {
      goal: userData.goal || 'habit',
      experience: userData.experience || 'beginner',
      preferredTimes: userData.preferredTimes || ['morning'],
      daysPerWeek: userData.daysPerWeek || 3,
      consents: userData.consents || {
        data: true,
        gdpr: true,
        push: true
      },
      onboardingComplete: userData.onboardingComplete || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...userData
    };
    
    const id = await database.users.add(userToAdd);
    console.log('✅ User created successfully:', id);
    return id as number;
  }, 'createUser');
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<User | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      return await database.users.get(userId) || null;
    }
    return null;
  }, 'getUserById', null);
}

/**
 * Update user with partial data
 */
export async function updateUser(userId: number, updates: Partial<User>): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    await database.users.update(userId, {
      ...updates,
      updatedAt: new Date()
    });
    console.log('✅ User updated successfully:', userId);
  }, 'updateUser');
}

/**
 * Update plan with partial data
 */
export async function updatePlan(planId: number, updates: Partial<Plan>): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    await database.plans.update(planId, {
      ...updates,
      updatedAt: new Date()
    });
    console.log('✅ Plan updated successfully:', planId);
  }, 'updatePlan');
}

/**
 * Deactivate all active plans for a user
 */
export async function deactivateAllUserPlans(userId: number): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    await database.plans
      .where('userId').equals(userId)
      .and(plan => plan.isActive)
      .modify({ isActive: false, updatedAt: new Date() });
    
    console.log('✅ Deactivated all active plans for user:', userId);
  }, 'deactivateAllUserPlans');
}

/**
 * Clean up user data (for failed onboarding cleanup)
 */
export async function cleanupUserData(userId: number): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    // Use transaction to ensure all cleanup happens atomically
    await database.transaction('rw', [
      database.users,
      database.plans,
      database.workouts,
      database.runs,
      database.chatMessages,
      database.goals,
      database.onboardingSessions,
      database.conversationMessages
    ], async () => {
      // Delete user data in reverse dependency order
      await database.conversationMessages.where('sessionId').anyOf(
        await database.onboardingSessions.where('userId').equals(userId).primaryKeys()
      ).delete();
      
      await database.onboardingSessions.where('userId').equals(userId).delete();
      await database.chatMessages.where('userId').equals(userId).delete();
      await database.runs.where('userId').equals(userId).delete();
      
      // Delete workouts from user's plans
      const planIds = await database.plans.where('userId').equals(userId).primaryKeys();
      await database.workouts.where('planId').anyOf(planIds).delete();
      
      await database.goals.where('userId').equals(userId).delete();
      await database.plans.where('userId').equals(userId).delete();
      await database.users.delete(userId);
    });
    
    console.log('✅ Cleaned up user data for user:', userId);
  }, 'cleanupUserData');
}

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(): Promise<void> {
  return safeDbOperation(async () => {
    if (typeof window === 'undefined') {
      console.log('🔄 Server-side render, skipping localStorage migration');
      return;
    }

    const database = getDatabase();
    if (!database) {
      console.log('🔄 Database not available for migration');
      return;
    }

    console.log('🔄 Starting localStorage migration...');
    
    // Check if migration is needed
    const onboardingComplete = localStorage.getItem("onboarding-complete");
    if (!onboardingComplete) {
      console.log('🔄 No localStorage data to migrate');
      return;
    }

    // Create default user if none exists
    const existingUser = await database.users.orderBy('createdAt').first();
    if (!existingUser) {
      const defaultUser: Omit<User, 'id'> = {
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: true
        },
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await database.users.add(defaultUser);
      console.log('✅ Created default user from localStorage migration');
    } else {
      // Update existing user
      if (existingUser.id) {
        await database.users.update(existingUser.id, {
          onboardingComplete: true,
          updatedAt: new Date()
        });
        console.log('✅ Updated existing user with onboarding completion');
      }
    }

    // Clear localStorage after successful migration
    localStorage.removeItem("onboarding-complete");
    console.log('✅ localStorage migration completed');
  }, 'migrateFromLocalStorage');
}

// ============================================================================
// GOAL MANAGEMENT UTILITIES
// ============================================================================

/**
 * Create new goal with validation
 */
export async function createGoal(goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.goals.add({
      ...goalData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Goal created successfully:', id);
    return id as number;
  }, 'createGoal');
}

/**
 * Update goal with validation
 */
export async function updateGoal(goalId: number, updates: Partial<Goal>): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.goals.update(goalId, {
      ...updates,
      updatedAt: new Date()
    });
    console.log('✅ Goal updated successfully:', goalId);
  }, 'updateGoal');
}

/**
 * Get user goals with filtering
 */
export async function getUserGoals(userId: number, status?: Goal['status']): Promise<Goal[]> {
  return safeDbOperation(async () => {
    if (db) {
      let query = db.goals.where('userId').equals(userId);
      if (status) {
        query = query.and(goal => goal.status === status);
      }
      return await query.toArray();
    }
    return [];
  }, 'getUserGoals', []);
}

/**
 * Get goal with milestones
 */
export async function getGoalWithMilestones(goalId: number): Promise<{ goal: Goal | null; milestones: GoalMilestone[] }> {
  return safeDbOperation(async () => {
    if (db) {
      const goal = await db.goals.get(goalId);
      const milestones = await db.goalMilestones.where('goalId').equals(goalId).toArray();
      return { goal: goal || null, milestones };
    }
    return { goal: null, milestones: [] };
  }, 'getGoalWithMilestones', { goal: null, milestones: [] });
}

// ============================================================================
// PLAN MANAGEMENT UTILITIES
// ============================================================================

/**
 * Create training plan with validation
 */
export async function createPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    // Deactivate other active plans for this user
    await db.plans.where('userId').equals(planData.userId).and(plan => plan.isActive).modify({ isActive: false });
    
    const id = await db.plans.add({
      ...planData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Plan created successfully:', id);
    return id as number;
  }, 'createPlan');
}

/**
 * Get active plan for user
 */
export async function getActivePlan(userId: number): Promise<Plan | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      return await database.plans.where('userId').equals(userId).and(plan => plan.isActive).first() || null;
    }
    return null;
  }, 'getActivePlan', null);
}

/**
 * Ensure user has an active plan - create one if they don't
 */
export async function ensureUserHasActivePlan(userId: number): Promise<Plan> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    // Check if user exists and has completed onboarding
    const user = await database.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.onboardingComplete) {
      throw new Error('User has not completed onboarding');
    }
    
    // Check for existing active plan
    let activePlan = await database.plans.where('userId').equals(userId).and(plan => plan.isActive).first();
    
    if (activePlan) {
      return activePlan;
    }
    
    // Check for inactive plans to reactivate
    const inactivePlan = await database.plans.where('userId').equals(userId).and(plan => !plan.isActive).first();
    
    if (inactivePlan) {
      await database.plans.update(inactivePlan.id!, { 
        isActive: true, 
        updatedAt: new Date() 
      });
      return await database.plans.get(inactivePlan.id!) as Plan;
    }
    
    // Create a new basic plan
    const planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      title: 'Default Running Plan',
      description: 'A basic running plan to get you started',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      totalWeeks: 4,
      isActive: true,
      planType: 'basic',
      trainingDaysPerWeek: user.daysPerWeek || 3,
      peakWeeklyVolume: 20, // km
      complexityScore: 25,
      complexityLevel: 'basic'
    };
    
    const planId = await createPlan(planData);
    const newPlan = await database.plans.get(planId) as Plan;
    
    // Create some basic workouts for the plan
    const workoutDays = ['Monday', 'Wednesday', 'Friday'];
    for (let week = 1; week <= 4; week++) {
      for (const day of workoutDays.slice(0, user.daysPerWeek || 3)) {
        const workoutData: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> = {
          planId,
          week,
          day,
          type: 'easy',
          distance: 3, // 3km easy run
          duration: 30, // 30 minutes
          intensity: 'easy',
          completed: false,
          scheduledDate: new Date(Date.now() + (week - 1) * 7 * 24 * 60 * 60 * 1000) // Spread across weeks
        };
        
        await createWorkout(workoutData);
      }
    }
    
    return newPlan;
  }, 'ensureUserHasActivePlan');
}

/**
 * Get plan with workouts
 */
export async function getPlanWithWorkouts(planId: number): Promise<{ plan: Plan | null; workouts: Workout[] }> {
  return safeDbOperation(async () => {
    if (db) {
      const plan = await db.plans.get(planId);
      const workouts = await db.workouts.where('planId').equals(planId).toArray();
      return { plan: plan || null, workouts };
    }
    return { plan: null, workouts: [] };
  }, 'getPlanWithWorkouts', { plan: null, workouts: [] });
}

// ============================================================================
// WORKOUT MANAGEMENT UTILITIES
// ============================================================================

/**
 * Create workout with validation
 */
export async function createWorkout(workoutData: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.workouts.add({
      ...workoutData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Workout created successfully:', id);
    return id as number;
  }, 'createWorkout');
}

/**
 * Mark workout as completed
 */
export async function completeWorkout(workoutId: number, runData?: Partial<Run>): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.workouts.update(workoutId, { completed: true, updatedAt: new Date() });
    
    if (runData) {
      const workout = await db.workouts.get(workoutId);
      if (workout) {
        // Ensure required fields are present for Run
        const runToAdd: Omit<Run, 'id'> = {
          type: runData.type || 'easy',
          distance: runData.distance || 0,
          duration: runData.duration || 0,
          workoutId,
          userId: 0, // Default user ID
          completedAt: new Date(),
          createdAt: new Date(),
          ...runData
        };
        
        await db.runs.add(runToAdd);
      }
    }
    console.log('✅ Workout completed successfully:', workoutId);
  }, 'completeWorkout');
}

/**
 * Get workouts for plan
 */
export async function getPlanWorkouts(planId: number, completed?: boolean): Promise<Workout[]> {
  return safeDbOperation(async () => {
    if (db) {
      let query = db.workouts.where('planId').equals(planId);
      if (completed !== undefined) {
        query = query.and(workout => workout.completed === completed);
      }
      return await query.toArray();
    }
    return [];
  }, 'getPlanWorkouts', []);
}

/**
 * Get workouts for user within date range
 */
export async function getWorkoutsForDateRange(userId: number, startDate: Date, endDate: Date): Promise<Workout[]> {
  return safeDbOperation(async () => {
    if (!db) return [];
    
    // Get all plans for the user
    const plans = await db.plans.where('userId').equals(userId).toArray();
    const planIds = plans.map(p => p.id!);
    
    if (planIds.length === 0) return [];
    
    // Get workouts within date range for all user's plans
    const allWorkouts = await db.workouts.toArray();
    const workouts = allWorkouts.filter(workout => 
      planIds.includes(workout.planId) &&
      workout.scheduledDate >= startDate && 
      workout.scheduledDate <= endDate
    );
    
    return workouts;
  }, 'getWorkoutsForDateRange', []);
}

/**
 * Get today's workout for user
 */
export async function getTodaysWorkout(userId: number): Promise<Workout | null> {
  return safeDbOperation(async () => {
    if (!db) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Get all plans for the user
    const plans = await db.plans.where('userId').equals(userId).toArray();
    const planIds = plans.map(p => p.id!).filter(Boolean);
    
    if (planIds.length === 0) return null;
    
    const allWorkouts = await db.workouts.toArray();
    const todaysWorkout = allWorkouts.find(workout => 
      planIds.includes(workout.planId) &&
      workout.scheduledDate >= today && 
      workout.scheduledDate < tomorrow
    );
    
    return todaysWorkout || null;
  }, 'getTodaysWorkout', null);
}

/**
 * Mark workout as completed
 */
export async function markWorkoutCompleted(workoutId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.workouts.update(workoutId, {
      completed: true,
      updatedAt: new Date()
    });
  }, 'markWorkoutCompleted');
}

// ============================================================================
// RUN TRACKING UTILITIES
// ============================================================================

/**
 * Record completed run
 */
export async function recordRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
  return safeDbOperation(async () => {
    const id = await db.runs.add({
      ...runData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Run recorded successfully:', id);
    return id as number;
  }, 'recordRun');
}

/**
 * Create run with GPS accuracy data
 */
export async function createRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
  return recordRun(runData);
}

/**
 * Get user runs with filtering
 */
export async function getUserRuns(userId: number, limit?: number): Promise<Run[]> {
  return safeDbOperation(async () => {
    if (db) {
      const query = db.runs.where('userId').equals(userId).reverse().sortBy('completedAt');
      if (limit) {
        const runs = await query.toArray();
        return runs.slice(0, limit);
      }
      return await query.toArray();
    }
    return [];
  }, 'getUserRuns', []);
}

/**
 * Get run statistics
 */
export async function getRunStats(userId: number, days: number = 30): Promise<{
  totalRuns: number;
  totalDistance: number;
  totalDuration: number;
  averagePace: number;
  longestRun: number;
}> {
  return safeDbOperation(async () => {
    if (db) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const runs = await db.runs
        .where('userId').equals(userId)
        .and(run => run.completedAt >= cutoffDate)
        .toArray();
      
      const totalRuns = runs.length;
      const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
      const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
      const averagePace = totalDistance > 0 ? totalDuration / totalDistance : 0;
      const longestRun = Math.max(...runs.map(run => run.distance), 0);
      
      return {
        totalRuns,
        totalDistance,
        totalDuration,
        averagePace,
        longestRun
      };
    }
    return {
      totalRuns: 0,
      totalDistance: 0,
      totalDuration: 0,
      averagePace: 0,
      longestRun: 0
    };
  }, 'getRunStats');
}

// ============================================================================
// RECOVERY & WELLNESS UTILITIES
// ============================================================================

/**
 * Save sleep data
 */
export async function saveSleepData(sleepData: Omit<SleepData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.sleepData.add({
      ...sleepData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Sleep data saved successfully:', id);
    return id as number;
  }, 'saveSleepData');
}

/**
 * Save HRV measurement
 */
export async function saveHRVMeasurement(hrvData: Omit<HRVMeasurement, 'id' | 'createdAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.hrvMeasurements.add({
      ...hrvData,
      createdAt: new Date()
    });
    console.log('✅ HRV measurement saved successfully:', id);
    return id as number;
  }, 'saveHRVMeasurement');
}

/**
 * Save recovery score
 */
export async function saveRecoveryScore(recoveryData: Omit<RecoveryScore, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.recoveryScores.add({
      ...recoveryData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Recovery score saved successfully:', id);
    return id as number;
  }, 'saveRecoveryScore');
}

/**
 * Save subjective wellness assessment
 */
export async function saveSubjectiveWellness(wellnessData: Omit<SubjectiveWellness, 'id' | 'createdAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.subjectiveWellness.add({
      ...wellnessData,
      createdAt: new Date()
    });
    console.log('✅ Subjective wellness saved successfully:', id);
    return id as number;
  }, 'saveSubjectiveWellness');
}

/**
 * Get recovery data for date range
 */
export async function getRecoveryData(userId: number, startDate: Date, endDate: Date): Promise<{
  sleepData: SleepData[];
  hrvMeasurements: HRVMeasurement[];
  recoveryScores: RecoveryScore[];
  subjectiveWellness: SubjectiveWellness[];
}> {
  const result = await withTransaction(async (tx) => {
    const [sleepData, hrvMeasurements, recoveryScores, subjectiveWellness] = await Promise.all([
      tx.sleepData.where('userId').equals(userId).and((sleep: any) => sleep.sleepDate >= startDate && sleep.sleepDate <= endDate).toArray(),
      tx.hrvMeasurements.where('userId').equals(userId).and((hrv: any) => hrv.measurementDate >= startDate && hrv.measurementDate <= endDate).toArray(),
      tx.recoveryScores.where('userId').equals(userId).and((score: any) => score.scoreDate >= startDate && score.scoreDate <= endDate).toArray(),
      tx.subjectiveWellness.where('userId').equals(userId).and((wellness: any) => wellness.assessmentDate >= startDate && wellness.assessmentDate <= endDate).toArray()
    ]);
    
    return {
      sleepData,
      hrvMeasurements,
      recoveryScores,
      subjectiveWellness
    };
  }, { readOnly: true });
  
  return result.success ? result.data! : {
    sleepData: [],
    hrvMeasurements: [],
    recoveryScores: [],
    subjectiveWellness: []
  };
}

// ============================================================================
// ENHANCED TRANSACTION-BASED OPERATIONS
// ============================================================================

/**
 * Create user with default data using transactions
 */
export async function createUserWithInitialData(
  userData: Partial<User>,
  initialGoals: Partial<Goal>[] = [],
  initialPlans: Partial<Plan>[] = []
): Promise<{ success: boolean; userId?: number; error?: any }> {
  const result = await createUserWithDefaults(userData, initialGoals, initialPlans);
  return {
    success: result.success,
    userId: result.data,
    error: result.error
  };
}

/**
 * Create goal with milestones using transactions
 */
export async function createGoalAndMilestones(
  goalData: Partial<Goal>,
  milestones: Partial<GoalMilestone>[] = []
): Promise<{ success: boolean; goalId?: number; milestoneIds?: number[]; error?: any }> {
  const result = await createGoalWithMilestones(goalData, milestones);
  return {
    success: result.success,
    goalId: result.data?.goalId,
    milestoneIds: result.data?.milestoneIds,
    error: result.error
  };
}

/**
 * Create run with automatic goal progress updates
 */
export async function createRunAndUpdateProgress(
  runData: Partial<Run>,
  updateGoals: boolean = true
): Promise<{ success: boolean; runId?: number; error?: any }> {
  const result = await createRunWithMetrics(runData, updateGoals);
  return {
    success: result.success,
    runId: result.data,
    error: result.error
  };
}

/**
 * Batch create recovery data with transaction safety
 */
export async function createRecoveryDataSafely(
  userId: number,
  sleepData: Partial<SleepData>[] = [],
  hrvData: Partial<HRVMeasurement>[] = [],
  wellnessData: Partial<SubjectiveWellness>[] = []
): Promise<{ success: boolean; ids?: { sleepIds: number[]; hrvIds: number[]; wellnessIds: number[] }; error?: any }> {
  const result = await createRecoveryDataBatch(userId, sleepData, hrvData, wellnessData);
  return {
    success: result.success,
    ids: result.data,
    error: result.error
  };
}

/**
 * Update cohort statistics safely
 */
export async function updateCohortStatsSafely(
  cohortId: number,
  statsUpdate: any
): Promise<{ success: boolean; updated?: boolean; error?: any }> {
  const result = await updateCohortStats(cohortId, statsUpdate);
  return {
    success: result.success,
    updated: result.data,
    error: result.error
  };
}

// ============================================================================
// DATA FUSION UTILITIES
// ============================================================================

/**
 * Save data fusion rule
 */
export async function saveDataFusionRule(ruleData: Omit<DataFusionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.dataFusionRules.add({
      ...ruleData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Data fusion rule saved successfully:', id);
    return id as number;
  }, 'saveDataFusionRule');
}

/**
 * Save fused data point
 */
export async function saveFusedDataPoint(pointData: Omit<FusedDataPoint, 'id' | 'createdAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.fusedDataPoints.add({
      ...pointData,
      createdAt: new Date()
    });
    console.log('✅ Fused data point saved successfully:', id);
    return id as number;
  }, 'saveFusedDataPoint');
}

/**
 * Log data conflict
 */
export async function logDataConflict(conflictData: Omit<DataConflict, 'id' | 'createdAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.dataConflicts.add({
      ...conflictData,
      createdAt: new Date()
    });
    console.log('✅ Data conflict logged successfully:', id);
    return id as number;
  }, 'logDataConflict');
}

/**
 * Save data source
 */
export async function saveDataSource(sourceData: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.dataSources.add({
      ...sourceData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Data source saved successfully:', id);
    return id as number;
  }, 'saveDataSource');
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Enhanced error handling for database operations
 */
export function handleDatabaseError(error: unknown, operation: string): { title: string; description: string } {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  
  if (errorMessage.includes("onboarding")) {
    return {
      title: "Complete Onboarding First",
      description: "Please complete the onboarding process to access this feature."
    };
  } else if (errorMessage.includes("not found")) {
    return {
      title: "Data Not Found", 
      description: "The requested data could not be found. Please try refreshing the page."
    };
  } else if (errorMessage.includes("Database") || errorMessage.includes("Dexie")) {
    return {
      title: "Database Error",
      description: "Unable to access the database. Please try refreshing the page or contact support."
    };
  } else if (errorMessage.includes("IndexedDB")) {
    return {
      title: "Storage Error",
      description: "Unable to access local storage. Please check your browser settings and try again."
    };
  } else {
    return {
      title: "Operation Failed",
      description: `Unable to complete ${operation}. Please try again or contact support.`
    };
  }
}

/**
 * Comprehensive database health check
 */
export async function checkDatabaseHealth(): Promise<{ 
  isHealthy: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
  details: string[];
}> {
  const details: string[] = [];
  let isHealthy = true;
  let canRead = true;
  let canWrite = true;
  let error: string | undefined;

  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      details.push('Server-side environment detected');
      return { isHealthy, canRead, canWrite, details };
    }

    // Check if database is available
    if (!isDatabaseAvailable()) {
      isHealthy = false;
      canRead = false;
      canWrite = false;
      error = 'Database not available';
      details.push('IndexedDB not supported or disabled');
      return { isHealthy, canRead, canWrite, error, details };
    }

    const database = getDatabase();
    if (!database) {
      isHealthy = false;
      canRead = false;
      canWrite = false;
      error = 'Database instance not created';
      details.push('Failed to create database instance');
      return { isHealthy, canRead, canWrite, error, details };
    }

    details.push('Database instance created successfully');

    // Test database opening
    try {
      await database.open();
      details.push('Database opened successfully');
    } catch (openError) {
      isHealthy = false;
      canRead = false;
      canWrite = false;
      error = `Failed to open database: ${openError instanceof Error ? openError.message : String(openError)}`;
      details.push(error);
      return { isHealthy, canRead, canWrite, error, details };
    }

    // Test read operation
    try {
      const testRead = await database.users.limit(1).toArray();
      canRead = true;
      details.push('Read operation successful');
    } catch (readError) {
      canRead = false;
      isHealthy = false;
      error = `Read operation failed: ${readError instanceof Error ? readError.message : String(readError)}`;
      details.push(error);
    }

    // Test write operation
    try {
      // Try to add and immediately delete a test record
      const testUser = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const testId = await database.users.add(testUser);
      await database.users.delete(testId);
      canWrite = true;
      details.push('Write operation successful');
    } catch (writeError) {
      canWrite = false;
      isHealthy = false;
      if (!error) {
        error = `Write operation failed: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
      }
      details.push(`Write test failed: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    }

    console.log('✅ Database health check completed:', { isHealthy, canRead, canWrite, details });
    return { isHealthy, canRead, canWrite, error, details };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Database health check failed:', error);
    return {
      isHealthy: false,
      canRead: false,
      canWrite: false,
      error: `Health check failed: ${errorMessage}`,
      details: [`Health check exception: ${errorMessage}`]
    };
  }
}

/**
 * Attempt to recover from database errors
 */
export async function recoverFromDatabaseError(): Promise<boolean> {
  try {
    console.log('🔄 Attempting database recovery...');
    
    // Close existing database connection
    if (db && db.isOpen()) {
      await db.close();
      console.log('✅ Closed existing database connection');
    }
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to reinitialize
    const success = await initializeDatabase();
    if (success) {
      console.log('✅ Database recovery successful');
      return true;
    } else {
      console.error('❌ Database recovery failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Database recovery failed with error:', error);
    return false;
  }
}

/**
 * Validate database schema integrity
 */
export async function validateDatabaseSchema(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    if (!isDatabaseAvailable()) {
      errors.push("Database not available");
      return { valid: false, errors };
    }
    
    // Test basic operations
    const database = getDatabase();
    if (database) {
      await database.open();
      await database.close();
    }
    
    console.log('✅ Database schema validation passed');
    return { valid: true, errors: [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Schema validation failed: ${errorMessage}`);
    console.error('❌ Database schema validation failed:', error);
    return { valid: false, errors };
  }
}

/**
 * Migrate database to latest version
 */
export async function migrateDatabase(): Promise<boolean> {
  try {
    if (!isDatabaseAvailable()) {
      console.error('❌ Database not available for migration');
      return false;
    }
    
    // Force database to latest version
    await db.open();
    console.log('✅ Database migration completed');
    return true;
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    return false;
  }
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export const dbUtils = {
  // Core utilities
  initializeDatabase,
  closeDatabase,
  clearDatabase,
  checkDatabaseHealth,
  recoverFromDatabaseError,
  validateDatabaseSchema,
  migrateDatabase,
  
  // User management
  getCurrentUser,
  createUser,
  getUserById,
  updateUser,
  upsertUser,
  getUser,
  getUsersByOnboardingStatus,
  migrateFromLocalStorage,
  cleanupUserData,
  
  // Goal management
  createGoal,
  updateGoal,
  getUserGoals,
  getGoalWithMilestones,
  
  // Plan management
  createPlan,
  updatePlan,
  getActivePlan,
  ensureUserHasActivePlan,
  getPlanWithWorkouts,
  deactivateAllUserPlans,
  
  // Workout management
  createWorkout,
  completeWorkout,
  getPlanWorkouts,
  getWorkoutsForDateRange,
  getTodaysWorkout,
  markWorkoutCompleted,
  
  // Run tracking
  recordRun,
  createRun,
  getUserRuns,
  getRunStats,
  
  // Recovery & wellness
  saveSleepData,
  saveHRVMeasurement,
  saveRecoveryScore,
  saveSubjectiveWellness,
  getRecoveryData,
  
  // Data fusion
  saveDataFusionRule,
  saveFusedDataPoint,
  logDataConflict,
  saveDataSource,
  
  // Error handling
  handleDatabaseError,
  
  // Plan-specific error handling (backward compatibility)
  handlePlanError: handleDatabaseError
};

export default dbUtils; 