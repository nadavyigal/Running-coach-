import { db, isDatabaseAvailable, safeDbOperation, getDatabase, resetDatabaseInstance } from './db';
import type {
  ActiveRecordingSession,
  ChallengeProgress,
  ChatMessage as ChatMessageEntity,
  CoachingFeedback,
  CoachingInteraction,
  CoachingProfile,
  DataConflict,
  DataFusionRule,
  DataSource,
  FusedDataPoint,
  Goal,
  GoalMilestone,
  GoalProgressHistory,
  GoalRecommendation,
  HRVMeasurement,
  LocationQuality,
  Plan,
  RaceGoal,
  RecoveryScore,
  Run,
  SleepData,
  SubjectiveWellness,
  User,
  UserBehaviorPattern,
  Workout,
} from './db';
import {
  nowUTC,
  addDaysUTC,
  getUserTimezone,
  startOfDayUTC,
  migrateLocalDateToUTC
} from './timezone-utils';
import { SyncService } from './sync/sync-service';

/**
 * Database Utilities - Comprehensive database operations with error handling
 * Provides safe, consistent database operations across the application
 */

/**
 * Validate and sanitize user ID
 * @param userId - The user ID to validate
 * @returns Validated user ID or throws error
 */
function validateUserId(userId: number | string | undefined | null): number {
  if (userId === undefined || userId === null) {
    throw new Error('User ID is required');
  }

  const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
    throw new Error('Invalid user ID format');
  }

  return id;
}

/**
 * Trigger incremental sync after data changes
 * This is called after critical operations like adding/updating runs, goals, shoes
 */
function triggerSync(): void {
  if (typeof window === 'undefined') return;

  try {
    const syncService = SyncService.getInstance();
    // Trigger sync asynchronously without blocking
    setTimeout(() => {
      syncService.syncIncrementalChanges().catch((error) => {
        console.warn('[dbUtils] Background sync failed:', error);
      });
    }, 100);
  } catch (error) {
    console.warn('[dbUtils] Failed to trigger sync:', error);
  }
}

// ============================================================================
// CORE DATABASE UTILITIES
// ============================================================================

/**
 * Initialize database and verify connectivity
 * Enhanced with production-resilient retry logic
 */
export async function initializeDatabase(): Promise<boolean> {
  const MAX_RETRIES = process.env.NODE_ENV === 'production' ? 3 : 2;
  const RETRY_DELAY_BASE = 500; // ms
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
        console.log(`✅ Database initialized successfully (attempt ${attempt})`);
        return true;
      }
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Database initialization attempt ${attempt}/${MAX_RETRIES} failed:`, errorMsg);
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE * attempt;
        console.log(`⏳ Retrying database initialization in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('❌ All database initialization attempts failed');
        return false;
      }
    }
  }
  return false;
}

/**
 * Close database connection safely
 */
export async function closeDatabase(): Promise<void> {
  try {
    if (db && typeof db.isOpen === 'function' && db.isOpen()) {
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

export async function ensureUserReady(): Promise<User> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) {
      throw new Error('Database not available');
    }

    const user = await database.users.toCollection().first();

    if (user) {
      // Verify localStorage matches database state
      if (typeof window !== 'undefined') {
        const localFlag = localStorage.getItem('onboarding-complete') === 'true';
        const dbFlag = user.onboardingComplete;

        if (dbFlag && !localFlag) {
          console.warn('[ensureUserReady] ⚠️ Fixing localStorage mismatch: DB=true, Local=false');
          localStorage.setItem('onboarding-complete', 'true');
        } else if (!dbFlag && localFlag) {
          console.warn('[ensureUserReady] ⚠️ Fixing localStorage mismatch: DB=false, Local=true');
          localStorage.removeItem('onboarding-complete');
        }
      }
      return user as User;
    }

    const newUserId = await createUser({});
    const newUser = await database.users.get(newUserId);
    return newUser as User;
  }, 'ensureUserReady');
}

/**
 * Get current user - now wraps ensureUserReady() for backward compatibility
 * This function now GUARANTEES a user will exist (returns null only on critical errors)
 */
export async function getCurrentUser(): Promise<User | null> {
  const phase = 'getCurrentUser';
  const traceId = `${phase}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  try {
    console.log(`[${phase}:start] traceId=${traceId} Requesting user resolution...`);
    const user = await ensureUserReady();
    console.log(`[${phase}:success] traceId=${traceId} User resolved: id=${user.id} onboarding=${user.onboardingComplete}`);
    return user;
  } catch (error) {
    console.error(`[${phase}:error] traceId=${traceId} Critical failure in user resolution:`, error);
    
    // Log detailed error info for debugging "user not found" scenarios
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      phase: 'getCurrentUser_fallback'
    };
    console.error(`[${phase}:debug] traceId=${traceId} Error details:`, errorDetails);
    
    return null;
  }
}

/**
 * Database startup migration - handles schema changes and user promotion
 */
export async function performStartupMigration(): Promise<boolean> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) {
      console.log('[migration:skip] Database not available');
      return true; // Don't block startup
    }

    console.log('[migration:start] Performing startup migration...');

    try {
      // Ensure database is open and ready
      await database.open();

      // Migration 1: Clear Tel Aviv demo routes (one-time)
      try {
        const { runClearTelAvivRoutesMigration } = await import('./migrations/clearTelAvivRoutesMigration');
        const migrationResult = await runClearTelAvivRoutesMigration();
        if (migrationResult.migrationRun) {
          console.log(`[migration:routes] Cleared ${migrationResult.routesCleared} Tel Aviv demo routes`);
        }
      } catch (migrationError) {
        console.warn('[migration:routes] Route migration failed (non-critical):', migrationError);
        // Don't block startup on route migration failure
      }

      // Migration 2: Clean up orphaned user profiles
      // Never auto-promote draft users to "completed" (can skip onboarding after a reload).
      const allUsers = await database.users.toArray();
      const completedUsers = allUsers.filter((u) => Boolean(u.onboardingComplete));
      const draftUsers = allUsers.filter((u) => !u.onboardingComplete);

      const byUpdatedAtDesc = (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

      if (completedUsers.length > 0) {
        const canonicalCompleted = completedUsers.sort(byUpdatedAtDesc).at(0);
        if (!canonicalCompleted || typeof canonicalCompleted.id !== 'number') {
          return true;
        }
        const idsToDelete: number[] = [];

        const redundantCompletedIds = completedUsers
          .filter((u) => typeof u.id === 'number' && u.id !== canonicalCompleted.id)
          .map((u) => u.id as number);

        const draftIds = draftUsers
          .filter((u) => typeof u.id === 'number')
          .map((u) => u.id as number);

        idsToDelete.push(...redundantCompletedIds, ...draftIds);

        if (idsToDelete.length > 0) {
          await database.users.where('id').anyOf(idsToDelete).delete();
          console.log(
            `[migration:users] Kept user ${canonicalCompleted.id}; removed ${idsToDelete.length} duplicates/drafts`
          );
        }
      } else if (draftUsers.length > 1) {
        // Keep the most recent draft; remove any redundant drafts.
        const latestDraft = draftUsers.sort(byUpdatedAtDesc).at(0);
        if (!latestDraft || typeof latestDraft.id !== 'number') {
          return true;
        }
        const redundantDraftIds = draftUsers
          .filter((u) => typeof u.id === 'number' && u.id !== latestDraft.id)
          .map((u) => u.id as number);

        if (redundantDraftIds.length > 0) {
          await database.users.where('id').anyOf(redundantDraftIds).delete();
          console.log(
            `[migration:users] Kept draft user ${latestDraft.id}; removed ${redundantDraftIds.length} redundant drafts`
          );
        }
      }

      // Migration 3: Set existing goals as primary and regenerate plans (one-time)
      try {
        const migrationFlag = 'goals-migration-v1-complete';
        const migrationRun = typeof window !== 'undefined' ? localStorage.getItem(migrationFlag) : null;

        if (!migrationRun) {
          console.log('[migration:goals] Running existing goals migration...');
          const { migrateExistingGoals } = await import('./migrations/migrateExistingGoals');
          const result = await migrateExistingGoals();

          if (result.errors.length === 0) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(migrationFlag, 'true');
            }
            console.log(`[migration:goals] ✅ Migrated ${result.migrated} users successfully`);
          } else {
            console.warn(`[migration:goals] ⚠️ Migrated ${result.migrated} users with ${result.errors.length} errors:`, result.errors);
          }
        }
      } catch (migrationError) {
        console.warn('[migration:goals] Goals migration failed (non-critical):', migrationError);
        // Don't block startup on goals migration failure
      }

      console.log('[migration:complete] Startup migration completed successfully');
      return true;
    } catch (error) {
      console.error('[migration:error] Startup migration failed:', error);
      return false; // Don't block startup on migration failure
    }
  }, 'performStartupMigration', false);
}

// ----------------------------------------------------------------------------
// Onboarding atomic completion helpers
// ----------------------------------------------------------------------------

/** Validate minimal `User` contract expected by first consumers (Today/Plan). */
function validateUserContract(candidate: Partial<User>): asserts candidate is Partial<User> {
  const missing: string[] = [];
  if (!candidate.goal) missing.push('goal');
  if (!candidate.experience) missing.push('experience');
  if (!candidate.preferredTimes || candidate.preferredTimes.length === 0) missing.push('preferredTimes');
  if (typeof candidate.daysPerWeek !== 'number') missing.push('daysPerWeek');
  if (!candidate.consents || typeof candidate.consents.data !== 'boolean' || typeof candidate.consents.gdpr !== 'boolean') {
    missing.push('consents.data/gdpr');
  }
  if (!candidate.onboardingComplete) missing.push('onboardingComplete');
  if (missing.length) {
    throw new Error(`Invalid profile. Missing fields: ${missing.join(', ')}`);
  }
}

/** Validate minimal `Plan` contract expected by first consumers (Today/Plan). */
function validatePlanContract(candidate: Partial<Plan>): void {
  const missing: string[] = [];
  if (typeof candidate.userId !== 'number') missing.push('userId');
  if (!candidate.title) missing.push('title');
  if (!(candidate.startDate instanceof Date)) missing.push('startDate');
  if (!(candidate.endDate instanceof Date)) missing.push('endDate');
  if (typeof candidate.totalWeeks !== 'number') missing.push('totalWeeks');
  if (candidate.isActive !== true) missing.push('isActive');
  if (missing.length) {
    throw new Error(`Plan creation failed. Missing fields: ${missing.join(', ')}`);
  }
}

/**
 * Atomically persist onboarding profile and a minimal active plan, idempotent.
 * Returns when profile is fully written and readable in the same transaction.
 */
export async function completeOnboardingAtomic(profile: Partial<User>, options?: { traceId?: string; artificialDelayMs?: number }): Promise<{ userId: number; planId: number }> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    // Trace and payload size instrumentation
    const traceId = options?.traceId || `onb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payloadSize = (() => { try { return JSON.stringify(profile).length; } catch { return -1; } })();
    console.log(`[onboarding:begin] traceId=${traceId} size=${payloadSize}B`);

    // Normalize + validate input against consumer contract
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    const normalizedProfileRequired: Partial<User> = {
      goal: profile.goal || 'habit',
      experience: profile.experience || 'beginner',
      preferredTimes: profile.preferredTimes && profile.preferredTimes.length > 0 ? profile.preferredTimes : ['morning'],
      daysPerWeek: typeof profile.daysPerWeek === 'number' ? profile.daysPerWeek : 3,
      consents: (profile.consents as any) ?? { data: true, gdpr: true, push: (typeof (profile as any).consents?.push === 'boolean' ? (profile as any).consents.push : false) },
      onboardingComplete: true,
      // Initialize 14-day trial for new users
      subscriptionTier: 'free',
      subscriptionStatus: 'trial',
      trialStartDate: now,
      trialEndDate: trialEndDate,
    };
    if (typeof profile.rpe === 'number') (normalizedProfileRequired as any).rpe = profile.rpe;
    if (typeof profile.age === 'number') (normalizedProfileRequired as any).age = profile.age;
    if (typeof profile.averageWeeklyKm === 'number' && profile.averageWeeklyKm > 0) {
      (normalizedProfileRequired as any).averageWeeklyKm = profile.averageWeeklyKm;
    }
    if (Array.isArray(profile.motivations)) (normalizedProfileRequired as any).motivations = profile.motivations;
    if (Array.isArray(profile.barriers)) (normalizedProfileRequired as any).barriers = profile.barriers;
    if (profile.coachingStyle) (normalizedProfileRequired as any).coachingStyle = profile.coachingStyle as any;
    if (profile.privacySettings) (normalizedProfileRequired as any).privacySettings = profile.privacySettings as any;
    if (profile.planPreferences) (normalizedProfileRequired as any).planPreferences = profile.planPreferences as any;

    validateUserContract(normalizedProfileRequired);

    const result = await database.transaction('rw', [database.users, database.plans, database.workouts], async () => {
      const allUsers = await database.users.toArray();
      const byUpdatedAtDesc = (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

      // Idempotency: if a completed user exists, reuse it and ensure a plan.
      // Otherwise, upgrade the most recent draft user instead of creating duplicates.
      const existingCompleted = allUsers
        .filter((u) => Boolean(u.onboardingComplete))
        .sort(byUpdatedAtDesc)[0];
      const existingAny = allUsers
        .filter((u) => typeof u.id === 'number')
        .sort(byUpdatedAtDesc)[0];
      let userId: number;
      const updatedAt = new Date();
      if (existingCompleted?.id) {
        userId = existingCompleted.id;
        // Soft update to latest profile attrs
        await database.users.update(userId, { ...normalizedProfileRequired, updatedAt });
      } else if (existingAny?.id) {
        userId = existingAny.id;
        await database.users.update(userId, { ...normalizedProfileRequired, updatedAt });
      } else {
        // Create fresh user
        const toAdd: Omit<User, 'id'> = {
          ...(normalizedProfileRequired as Omit<User, 'id'>),
          createdAt: updatedAt,
          updatedAt,
        };
        userId = (await database.users.add(toAdd)) as number;
      }

      // REMOVED: artificial delay (sleep) - causes TransactionInactiveError on mobile
      // Mobile browsers have strict transaction timeouts (~500ms)
      // setTimeout/sleep inside transactions is forbidden by Dexie.js

      // Ensure one active plan exists
      const activePlan = await database.plans.where('userId').equals(userId).and(p => p.isActive).first();
      let planId: number;
      if (!activePlan) {
        const planData: Omit<Plan, 'id'> = {
          userId,
          title: 'Default Running Plan',
          description: 'A basic running plan to get you started',
          startDate: nowUTC(),
          endDate: addDaysUTC(14),
          totalWeeks: 2,
          isActive: true,
          planType: 'basic',
          trainingDaysPerWeek: normalizedProfileRequired.daysPerWeek || 3,
          peakWeeklyVolume: 20,
          complexityScore: 25,
          complexityLevel: 'basic',
          createdInTimezone: getUserTimezone(),
          createdAt: nowUTC(),
          updatedAt: nowUTC(),
        } as any;
        validatePlanContract(planData);
        planId = (await database.plans.add(planData)) as number;

        // Seed a few workouts so Today/Plan screens render content immediately
        // Use bulkAdd for better performance and faster transaction completion on mobile
        const workoutDays = ['Mon', 'Wed', 'Fri'];
        const workoutsToAdd: Omit<Workout, 'id'>[] = [];
        for (let week = 1; week <= 2; week++) {
          for (const day of workoutDays.slice(0, planData.trainingDaysPerWeek || 3)) {
            workoutsToAdd.push({
              planId,
              week,
              day,
              type: 'easy',
              distance: 3,
              duration: 30,
              intensity: 'easy',
              completed: false,
              scheduledDate: addDaysUTC((week - 1) * 7),
              createdAt: nowUTC(),
              updatedAt: nowUTC(),
            } as Omit<Workout, 'id'>);
          }
        }
        await database.workouts.bulkAdd(workoutsToAdd);
      } else {
        planId = activePlan.id!;
      }

      return { userId, planId };
    });

    // CRITICAL: Force localStorage sync to prevent redirect issues
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding-complete', 'true');
      console.log(`[onboarding:sync] traceId=${traceId} localStorage force-synced`);
    }

    console.log(`[onboarding:commit] traceId=${traceId} userId=${result.userId} planId=${result.planId}`);
    return result;
  }, 'completeOnboardingAtomic');
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
      const allUsers = await database.users.toArray();
      return allUsers.filter((u) => Boolean(u.onboardingComplete) === completed);
    }
    return [];
  }, 'getUsersByOnboardingStatus', []);
}

export async function createUser(userData: Partial<User>): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    return await database.transaction('rw', database.users, async () => {
      // Check for existing completed user
      // CRITICAL FIX: Use filter() for boolean fields instead of where().equals()
      // Dexie doesn't support boolean in .equals() for indexed queries
      const existingUser = await database.users
        .filter(u => u.onboardingComplete === true)
        .first();
      if (existingUser) {
        console.log('[createUser] Found existing completed user:', existingUser.id);
        return existingUser.id!;
      }

      // Create a new user
      const userToAdd: Omit<User, 'id'> = {
        goal: userData.goal || 'habit',
        experience: userData.experience || 'beginner',
        preferredTimes: userData.preferredTimes || ['morning'],
        daysPerWeek: userData.daysPerWeek || 3,
        consents: userData.consents || {
          data: true,
          gdpr: true,
          push: true,
        },
        onboardingComplete: userData.onboardingComplete || false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...userData,
      };

      const newId = await database.users.add(userToAdd);
      console.log('User created successfully:', newId);
      return newId as number;
    });
  }, 'createUser');
}

/**
 * Create chat message with validation
 */
export async function createChatMessage(messageData: {
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  conversationId?: string;
  tokenCount?: number;
}): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    const messageToAdd = {
      ...messageData,
      timestamp: new Date(),
      conversationId: messageData.conversationId || 'default'
    };
    
    const id = await database.chatMessages.add(messageToAdd);
    console.log('✅ Chat message created successfully:', id);
    return id as number;
  }, 'createChatMessage');
}

/**
 * Get chat messages for a user and optional conversationId
 */
export async function getChatMessages(userId: number, conversationId?: string): Promise<ChatMessageEntity[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    let query = database.chatMessages.where('userId').equals(userId);
    if (conversationId) {
      query = query.and((m) => m.conversationId === conversationId);
    }

    const messages = await query.sortBy('timestamp');
    return messages as ChatMessageEntity[];
  }, 'getChatMessages', [] as unknown as ChatMessageEntity[]);
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
 * Get user experience level for workout personalization
 */
export async function getUserExperience(userId: number): Promise<'beginner' | 'intermediate' | 'advanced'> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (database) {
      const user = await database.users.get(userId);
      return user?.experience || 'beginner';
    }
    return 'beginner';
  }, 'getUserExperience', 'beginner' as 'beginner' | 'intermediate' | 'advanced');
}

/**
 * Get coaching profile for user
 */
export async function getCoachingProfile(userId: number): Promise<CoachingProfile | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const profile = await database.coachingProfiles.where('userId').equals(userId).first();
    return (profile as CoachingProfile) ?? null;
  }, 'getCoachingProfile', null as unknown as CoachingProfile | null);
}

/**
 * Get behavior patterns for user
 */
export async function getBehaviorPatterns(userId: number): Promise<UserBehaviorPattern[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const patterns = await database.userBehaviorPatterns.where('userId').equals(userId).toArray();
    return patterns as UserBehaviorPattern[];
  }, 'getBehaviorPatterns', [] as unknown as UserBehaviorPattern[]);
}

/**
 * Record a user behavior pattern for adaptive coaching.
 */
export async function recordBehaviorPattern(
  data: Omit<UserBehaviorPattern, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  if (typeof window === 'undefined') {
    return 0;
  }

  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const now = new Date();
    const id = await database.userBehaviorPatterns.add({
      ...data,
      createdAt: now,
      updatedAt: now,
    } as Omit<UserBehaviorPattern, 'id'>);
    return id as number;
  }, 'recordBehaviorPattern', 0);
}

/**
 * Get coaching feedback for a user, most recent first
 */
export async function getCoachingFeedback(userId: number, limit: number = 10): Promise<CoachingFeedback[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const feedback = await database.coachingFeedback
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');
    // sortBy ascending; reverse() above only affects collections. Ensure most recent first:
    const ordered = feedback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ordered.slice(0, limit) as CoachingFeedback[];
  }, 'getCoachingFeedback', [] as unknown as CoachingFeedback[]);
}

/**
 * Get runs by user, most recent first
 */
export async function getRunsByUser(userId: number): Promise<Run[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const runs = await database.runs.where('userId').equals(userId).toArray();
    return (runs as Run[]).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, 'getRunsByUser', [] as unknown as Run[]);
}

/**
 * Get user badges from badges table
 */
export async function getUserBadges(userId: number) {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const items = await database.badges.where('userId').equals(userId).toArray();
    return items as any[];
  }, 'getUserBadges', [] as any[]);
}

/** Ensure coaching-related tables exist in the current schema */
export async function ensureCoachingTablesExist(): Promise<boolean> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return false;
    const tableNames = (database as any).tables?.map((t: any) => t.name) || [];
    const required = [
      'coachingProfiles',
      'coachingFeedback',
      'coachingInteractions',
      'userBehaviorPatterns',
    ];
    return required.every((t) => tableNames.includes(t));
  }, 'ensureCoachingTablesExist', false);
}

/** Create a coaching profile with defaults */
export async function createCoachingProfile(
  profile: Omit<CoachingProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const id = await database.coachingProfiles.add({
      ...profile,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Omit<CoachingProfile, 'id'>);
    return id as number;
  }, 'createCoachingProfile');
}

/** Record a coaching feedback entry */
export async function recordCoachingFeedback(
  data: Omit<CoachingFeedback, 'id' | 'createdAt'>
): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const id = await database.coachingFeedback.add({
      ...data,
      createdAt: new Date(),
    } as Omit<CoachingFeedback, 'id'>);
    return id as number;
  }, 'recordCoachingFeedback');
}

/** Record a coaching interaction entry */
export async function recordCoachingInteraction(
  data: Omit<CoachingInteraction, 'id' | 'createdAt'>
): Promise<number> {
  if (typeof window === 'undefined') {
    return 0;
  }

  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const id = await database.coachingInteractions.add({
      ...data,
      createdAt: new Date(),
    } as Omit<CoachingInteraction, 'id'>);
    return id as number;
  }, 'recordCoachingInteraction', 0);
}

/** Get recent coaching interactions */
export async function getCoachingInteractions(userId: number, limit: number = 30): Promise<CoachingInteraction[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const items = await database.coachingInteractions.where('userId').equals(userId).toArray();
    const ordered = (items as CoachingInteraction[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return ordered.slice(0, limit);
  }, 'getCoachingInteractions', [] as unknown as CoachingInteraction[]);
}

/**
 * Update coaching profile fields for a user
 */
export async function updateCoachingProfile(userId: number, updates: Partial<CoachingProfile>): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    const existing = await database.coachingProfiles.where('userId').equals(userId).first();
    if (existing?.id) {
      await database.coachingProfiles.update(existing.id, { ...updates, updatedAt: new Date() });
    }
  }, 'updateCoachingProfile');
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

export async function updateReminderSettings(
  userId: number,
  updates: Partial<Pick<User, 'reminderTime' | 'reminderEnabled' | 'reminderSnoozedUntil'>>
): Promise<void> {
  const sanitizedUpdates: Partial<User> = {}

  if ('reminderTime' in updates && updates.reminderTime !== undefined) {
    sanitizedUpdates.reminderTime = updates.reminderTime
  }
  if ('reminderEnabled' in updates && updates.reminderEnabled !== undefined) {
    sanitizedUpdates.reminderEnabled = updates.reminderEnabled
  }
  if ('reminderSnoozedUntil' in updates && updates.reminderSnoozedUntil !== undefined) {
    sanitizedUpdates.reminderSnoozedUntil = updates.reminderSnoozedUntil
  }

  if (Object.keys(sanitizedUpdates).length === 0) return

  return updateUser(userId, sanitizedUpdates)
}

export async function getReminderSettings(userId: number): Promise<{
  time: string
  enabled: boolean
  snoozedUntil: Date | null
}> {
  return safeDbOperation(
    async () => {
      const database = getDatabase()
      if (!database) throw new Error('Database not available')

      const user = await database.users.get(userId)
      return {
        time: user?.reminderTime ?? '',
        enabled: Boolean(user?.reminderEnabled),
        snoozedUntil: user?.reminderSnoozedUntil ?? null,
      }
    },
    'getReminderSettings',
    { time: '', enabled: false, snoozedUntil: null }
  )
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
 * Update plan with AI-generated workouts
 */
export async function updatePlanWithAIWorkouts(planId: number, aiPlan: any): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    // Update plan metadata
    await database.plans.update(planId, {
      title: aiPlan.title || 'AI-Generated Running Plan',
      description: aiPlan.description || 'Personalized training plan',
      totalWeeks: aiPlan.totalWeeks || 4,
      updatedAt: new Date()
    });

    // Delete existing workouts for this plan
    await database.workouts.where('planId').equals(planId).delete();

    // Add AI-generated workouts
    if (aiPlan.workouts && Array.isArray(aiPlan.workouts)) {
      for (const aiWorkout of aiPlan.workouts) {
        // Calculate scheduled date based on week and day
        const weekOffset = (aiWorkout.week - 1) * 7;
        const dayMap: Record<string, number> = {
          'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6
        };
        const dayOffset = dayMap[aiWorkout.day] || 0;
        const scheduledDate = addDaysUTC(weekOffset + dayOffset);

        await database.workouts.add({
          planId,
          week: aiWorkout.week,
          day: aiWorkout.day,
          type: aiWorkout.type,
          distance: aiWorkout.distance,
          duration: aiWorkout.duration,
          notes: aiWorkout.notes,
          intensity: aiWorkout.type === 'easy' ? 'easy' : aiWorkout.type === 'tempo' ? 'threshold' : 'moderate',
          completed: false,
          scheduledDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log('✅ Plan updated with AI workouts:', planId);
  }, 'updatePlanWithAIWorkouts');
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
      const sessionIds = (await database.onboardingSessions.where('userId').equals(userId).primaryKeys()).filter((id): id is number => typeof id === 'number');
      if (sessionIds.length > 0) {
        await database.conversationMessages.where('sessionId').anyOf(sessionIds as number[]).delete();
      }
      
      await database.onboardingSessions.where('userId').equals(userId).delete();
      await database.chatMessages.where('userId').equals(userId).delete();
      await database.runs.where('userId').equals(userId).delete();
      
      // Delete workouts from user's plans
      const planIds = (await database.plans.where('userId').equals(userId).primaryKeys()).filter((id): id is number => typeof id === 'number');
      if (planIds.length > 0) {
        await database.workouts.where('planId').anyOf(planIds as number[]).delete();
      }
      
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

    // Create default user if none exists - avoid orderBy on non-indexed fields
    const allUsers = await database.users.toArray();
    const existingUser = allUsers
      .filter(u => u.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
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

    // Trigger sync after goal creation
    triggerSync();

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

    // Trigger sync after goal update
    triggerSync();
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

export async function getGoalsByUser(userId: number, status?: Goal['status']): Promise<Goal[]> {
  return getUserGoals(userId, status);
}

export async function getPrimaryGoal(userId: number): Promise<Goal | null> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    const goal = await db.goals
      .where('userId')
      .equals(userId)
      .and(g => g.isPrimary === true)
      .first();
    return goal || null;
  }, 'getPrimaryGoal', null);
}

export async function setPrimaryGoal(userId: number, goalId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    await db.transaction('rw', db.goals, async () => {
      // Clear existing primary flags for this user
      await db.goals.where('userId').equals(userId).modify({ isPrimary: false });
      // Mark specified goal as primary and active
      await db.goals.update(goalId, { isPrimary: true, status: 'active', updatedAt: new Date() });
    });
  }, 'setPrimaryGoal');
}

/**
 * Get a single goal by ID
 */
export async function getGoal(goalId: number): Promise<Goal | null> {
  return safeDbOperation(async () => {
    if (db) {
      const goal = await db.goals.get(goalId);
      return goal || null;
    }
    return null;
  }, 'getGoal', null);
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

/**
 * Delete a goal and its related data
 */
export async function deleteGoal(goalId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (db) {
      // Delete related milestones first
      await db.goalMilestones.where('goalId').equals(goalId).delete();
      // Delete progress history
      await db.goalProgressHistory.where('goalId').equals(goalId).delete();
      // Delete the goal
      await db.goals.delete(goalId);
      console.log('✅ Goal and related data deleted successfully:', goalId);
    }
  }, 'deleteGoal');
}

/**
 * Merge two goals - combines progress history and milestones from source into target
 */
export async function mergeGoals(
  userId: number,
  sourceGoalId: number,
  targetGoalId: number,
  options: { deleteSource: boolean; combineProgress: boolean }
): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    const sourceGoal = await db.goals.get(sourceGoalId);
    const targetGoal = await db.goals.get(targetGoalId);

    if (!sourceGoal || !targetGoal) {
      throw new Error('One or both goals not found');
    }

    if (sourceGoal.userId !== userId || targetGoal.userId !== userId) {
      throw new Error('Goals do not belong to the specified user');
    }

    await db.transaction('rw', [db.goals, db.goalMilestones, db.goalProgressHistory], async () => {
      // Move progress history from source to target
      if (options.combineProgress) {
        await db.goalProgressHistory
          .where('goalId')
          .equals(sourceGoalId)
          .modify({ goalId: targetGoalId });
      }

      // Move milestones from source to target
      await db.goalMilestones
        .where('goalId')
        .equals(sourceGoalId)
        .modify({ goalId: targetGoalId });

      // Delete or archive source goal
      if (options.deleteSource) {
        await db.goals.delete(sourceGoalId);
      } else {
        await db.goals.update(sourceGoalId, {
          status: 'cancelled',
          updatedAt: nowUTC()
        });
      }

      // Update target goal timestamp
      await db.goals.update(targetGoalId, { updatedAt: nowUTC() });
    });

    console.log('✅ Goals merged successfully:', sourceGoalId, '->', targetGoalId);
  }, 'mergeGoals');
}

export async function generateGoalMilestones(goalId: number): Promise<GoalMilestone[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];

    const goal = await database.goals.get(goalId);
    if (!goal) return [];

    const schedule = Array.isArray(goal.timeBound?.milestoneSchedule) && goal.timeBound.milestoneSchedule.length > 0
      ? [...goal.timeBound.milestoneSchedule].sort((a, b) => a - b)
      : [25, 50, 75];

    const startDate = goal.timeBound?.startDate instanceof Date ? goal.timeBound.startDate : new Date();
    const deadline = goal.timeBound?.deadline instanceof Date
      ? goal.timeBound.deadline
      : new Date(startDate.getTime() + (goal.timeBound?.totalDuration ?? 0) * 24 * 60 * 60 * 1000);

    const durationMs = Math.max(1, deadline.getTime() - startDate.getTime());
    const roundValue = (value: number) => Math.round(value * 100) / 100;

    await database.goalMilestones.where('goalId').equals(goalId).delete();

    const milestones: Omit<GoalMilestone, 'id'>[] = schedule.map((percent, index) => {
      const ratio = percent / 100;
      const targetValue = roundValue(goal.baselineValue + (goal.targetValue - goal.baselineValue) * ratio);

      return {
        goalId,
        milestoneOrder: index + 1,
        title: `Milestone ${percent}%`,
        description: `Reach ${targetValue}${goal.specificTarget?.unit ? ` ${goal.specificTarget.unit}` : ''}`,
        targetValue,
        targetDate: new Date(startDate.getTime() + durationMs * ratio),
        status: 'pending',
        achievedDate: undefined,
        achievedValue: undefined,
        celebrationShown: false,
        createdAt: new Date(),
      };
    });

    if (milestones.length === 0) return [];

    await database.goalMilestones.bulkAdd(milestones);
    return await database.goalMilestones.where('goalId').equals(goalId).toArray();
  }, 'generateGoalMilestones', []);
}

export async function markMilestoneAchieved(milestoneId: number, achievedValue?: number): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    const updates: Partial<GoalMilestone> = {
      status: 'achieved',
      achievedDate: new Date(),
    };

    if (typeof achievedValue === 'number') {
      updates.achievedValue = achievedValue;
    }

    await database.goalMilestones.update(milestoneId, updates);
  }, 'markMilestoneAchieved');
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
      createdAt: nowUTC(),
      updatedAt: nowUTC()
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
    const phase = 'getActivePlan';
    const traceId = `${phase}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    console.log(`[${phase}:start] traceId=${traceId} Fetching active plan for userId=${userId}`);
    
    const database = getDatabase();
    if (!database) {
      console.error(`[${phase}:error] traceId=${traceId} Database not available`);
      return null;
    }
    
    const plan = await database.plans.where('userId').equals(userId).and(plan => plan.isActive).first();
    
    if (plan) {
      console.log(`[${phase}:success] traceId=${traceId} Active plan found: planId=${plan.id} title="${plan.title}"`);
    } else {
      console.log(`[${phase}:not_found] traceId=${traceId} No active plan found for userId=${userId}`);
    }
    
    return plan || null;
  }, 'getActivePlan', null);
}

export async function getPlan(planId: number): Promise<Plan | null> {
  return safeDbOperation(async () => {
    const database = getDatabase()
    if (!database) throw new Error('Database not available')

    const plan = await database.plans.get(planId)
    return plan ?? null
  }, 'getPlan', null)
}

// Race condition prevention for concurrent plan creation
const activePlanCreationLocks = new Map<number, Promise<Plan>>();

/**
 * Clear all plan creation locks - used during reset/cleanup
 */
export function clearPlanCreationLocks(): void {
  activePlanCreationLocks.clear();
  console.log('✅ Plan creation locks cleared');
}

/**
 * Ensure user has an active plan - create one if they don't
 * Uses locking mechanism to prevent race conditions
 */
export async function ensureUserHasActivePlan(userId: number): Promise<Plan> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    // Check if there's already a plan creation in progress for this user
    if (activePlanCreationLocks.has(userId)) {
      console.log(`⏳ Plan creation already in progress for userId=${userId}, waiting...`);
      return await activePlanCreationLocks.get(userId)!;
    }
    
    // Check if user exists and has completed onboarding
    const user = await database.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.onboardingComplete) {
      throw new Error('User has not completed onboarding');
    }
    
    // Check for existing active plan (double-check after potential wait)
    const activePlan = await database.plans.where('userId').equals(userId).and(plan => plan.isActive).first();
    
    if (activePlan) {
      return activePlan;
    }
    
    // Create a promise for plan creation and lock it
    const planCreationPromise = (async (): Promise<Plan> => {
      try {
        // Check for inactive plans to reactivate
        const inactivePlan = await database.plans.where('userId').equals(userId).and(plan => !plan.isActive).first();
        
        if (inactivePlan) {
          await database.plans.update(inactivePlan.id!, { 
            isActive: true, 
            updatedAt: nowUTC() 
          });
          const reactivatedPlan = await database.plans.get(inactivePlan.id!) as Plan;
          console.log(`♻️ Reactivated existing plan for userId=${userId}, planId=${reactivatedPlan.id}`);
          return reactivatedPlan;
        }
        
        // Create a new basic plan
        const planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
          userId,
          title: 'Default Running Plan',
          description: 'A basic running plan to get you started',
          startDate: nowUTC(),
          endDate: addDaysUTC(14), // 14 days from now in UTC
          totalWeeks: 2,
          isActive: true,
          planType: 'basic',
          trainingDaysPerWeek: user.daysPerWeek || 3,
          peakWeeklyVolume: 20, // km
          complexityScore: 25,
          complexityLevel: 'basic',
          createdInTimezone: user.timezone || getUserTimezone()
        };
        
        const planId = await createPlan(planData);
        const newPlan = await database.plans.get(planId) as Plan;
        console.log(`✅ Created new plan for userId=${userId}, planId=${newPlan.id}`);
        
        // Create some basic workouts for the plan (use short day names to align with UI sorting)
        const workoutDays = ['Mon', 'Wed', 'Fri'];
        for (let week = 1; week <= 2; week++) {
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
              scheduledDate: addDaysUTC((week - 1) * 7) // Spread across weeks in UTC
            };
            
            await createWorkout(workoutData);
          }
        }
        
        return newPlan;
      } finally {
        // Always clean up the lock when done
        activePlanCreationLocks.delete(userId);
      }
    })();
    
    // Set the lock before starting the operation
    activePlanCreationLocks.set(userId, planCreationPromise);
    
    return await planCreationPromise;
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
      // Normalize scheduledDate for all workouts
      const normalizedWorkouts = workouts.map(workout => {
        const normalizedScheduledDate = normalizeDate(workout.scheduledDate);
        if (!normalizedScheduledDate) {
          console.warn(`Workout ${workout.id} has invalid scheduledDate:`, workout.scheduledDate);
          return { ...workout, scheduledDate: new Date() };
        }
        return { ...workout, scheduledDate: normalizedScheduledDate };
      });
      return { plan: plan || null, workouts: normalizedWorkouts };
    }
    return { plan: null, workouts: [] };
  }, 'getPlanWithWorkouts', { plan: null, workouts: [] });
}

// ============================================================================
// WORKOUT MANAGEMENT UTILITIES
// ============================================================================

/**
 * Normalize a date value - converts strings or Date objects to proper Date instances
 * This must be defined before functions that use it
 */
export function normalizeDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    // Check if it's a valid date
    if (isNaN(dateValue.getTime())) return null;
    const normalized = new Date(dateValue.getTime());
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  if (typeof dateValue === 'number') {
    const parsed = new Date(dateValue);
    if (isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  return null;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  if (!normalized1 || !normalized2) return false;
  return normalized1.getTime() === normalized2.getTime();
}

export function getDaysDifference(date1: Date, date2: Date): number {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  if (!normalized1 || !normalized2) return 0;
  const diffMs = Math.abs(normalized1.getTime() - normalized2.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Create workout with validation
 */
export async function createWorkout(workoutData: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    // Ensure scheduledDate is a valid Date object
    const normalizedScheduledDate = normalizeDate(workoutData.scheduledDate);
    if (!normalizedScheduledDate) {
      throw new Error(`Invalid scheduledDate provided: ${workoutData.scheduledDate}`);
    }
    
    const id = await db.workouts.add({
      ...workoutData,
      scheduledDate: normalizedScheduledDate,
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
      const workouts = await query.toArray();
      // Normalize scheduledDate for all workouts
      return workouts.map(workout => {
        const normalizedScheduledDate = normalizeDate(workout.scheduledDate);
        if (!normalizedScheduledDate) {
          console.warn(`Workout ${workout.id} has invalid scheduledDate:`, workout.scheduledDate);
          // Return workout with a fallback date (today) to prevent errors
          return { ...workout, scheduledDate: new Date() };
        }
        return { ...workout, scheduledDate: normalizedScheduledDate };
      });
    }
    return [];
  }, 'getPlanWorkouts', []);
}

/**
 * Get workouts for user within date range
 * Security: Added pagination and limits to prevent memory exhaustion
 */
export async function getWorkoutsForDateRange(
  userId: number,
  startDate: Date,
  endDate: Date,
  options?: { limit?: number; offset?: number }
): Promise<Workout[]> {
  return safeDbOperation(async () => {
    if (!db) return [];

    // Security: Validate userId
    const validatedUserId = validateUserId(userId);

    // Security: Set reasonable limits
    const limit = Math.min(options?.limit || 1000, 1000); // Max 1000 workouts
    const offset = Math.max(options?.offset || 0, 0);

    // Normalize input dates
    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = normalizeDate(endDate);

    if (!normalizedStart || !normalizedEnd) {
      console.warn('Invalid date range provided to getWorkoutsForDateRange');
      return [];
    }

    // Security: Validate date range (max 1 year)
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
    if (normalizedEnd.getTime() - normalizedStart.getTime() > maxRangeMs) {
      console.warn('Date range exceeds maximum of 1 year');
      return [];
    }

    // Get plans for the user with limit
    const plans = await db.plans.where('userId').equals(validatedUserId).limit(100).toArray();
    const planIds = plans.map(p => p.id!);

    if (planIds.length === 0) return [];

    // Get workouts within date range with pagination
    const allWorkouts = await db.workouts.limit(limit + offset).toArray();
    const workouts = allWorkouts
      .map(workout => {
        // Normalize scheduledDate
        const normalizedScheduledDate = normalizeDate(workout.scheduledDate);
        if (!normalizedScheduledDate) {
          console.warn(`Workout ${workout.id} has invalid scheduledDate:`, workout.scheduledDate);
          return null;
        }
        return { ...workout, scheduledDate: normalizedScheduledDate };
      })
      .filter((workout): workout is Workout =>
        workout !== null &&
        planIds.includes(workout.planId) &&
        workout.scheduledDate >= normalizedStart &&
        workout.scheduledDate <= normalizedEnd
      )
      .slice(offset, offset + limit);

    return workouts;
  }, 'getWorkoutsForDateRange', []);
}

/**
 * Get today's workout for user
 */
export async function getTodaysWorkout(userId: number): Promise<Workout | null> {
  return safeDbOperation(async () => {
    if (!db) return null;

    const today = startOfDayUTC(nowUTC());
    const tomorrow = addDaysUTC(1, today);
    
    // Get all plans for the user
    const plans = await db.plans.where('userId').equals(userId).toArray();
    const planIds = plans.map(p => p.id!).filter(Boolean);
    
    if (planIds.length === 0) return null;
    
    const allWorkouts = await db.workouts.toArray();
    const todaysWorkout = allWorkouts
      .map(workout => {
        // Normalize scheduledDate
        const normalizedScheduledDate = normalizeDate(workout.scheduledDate);
        if (!normalizedScheduledDate) {
          return null;
        }
        return { ...workout, scheduledDate: normalizedScheduledDate };
      })
      .find(workout => 
        workout !== null &&
        planIds.includes(workout.planId) &&
        workout.scheduledDate >= today && 
        workout.scheduledDate < tomorrow
      );
    
    return todaysWorkout || null;
  }, 'getTodaysWorkout', null);
}

export async function getNextWorkoutForPlan(
  planId: number,
  referenceDate?: Date
): Promise<Workout | null> {
  return safeDbOperation(
    async () => {
      if (!db) return null;
      if (!planId || Number.isNaN(planId)) return null;

      const refDate =
        referenceDate instanceof Date
          ? referenceDate
          : referenceDate
          ? new Date(referenceDate)
          : new Date();
      if (Number.isNaN(refDate.getTime())) {
        refDate.setTime(Date.now());
      }

      const workouts = await db.workouts.where('planId').equals(planId).toArray();
      const upcoming = workouts
        .map((workout) => {
          if (!workout.scheduledDate) return null;
          const scheduled =
            workout.scheduledDate instanceof Date
              ? workout.scheduledDate
              : typeof workout.scheduledDate === 'string' || typeof workout.scheduledDate === 'number'
              ? new Date(workout.scheduledDate)
              : null;
          if (!scheduled || Number.isNaN(scheduled.getTime())) return null;
          return { ...workout, scheduledDate: scheduled };
        })
        .filter((workout): workout is Workout => workout !== null)
        .filter((workout) => !workout.completed && workout.scheduledDate > refDate)
        .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

      return upcoming[0] ?? null;
    },
    'getNextWorkoutForPlan',
    null
  );
}

/**
 * Update workout with validation
 */
export async function updateWorkout(workoutId: number, updates: Partial<Omit<Workout, 'id' | 'createdAt'>>): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    // Normalize scheduledDate if provided
    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.scheduledDate !== undefined) {
      const normalizedScheduledDate = normalizeDate(updates.scheduledDate);
      if (!normalizedScheduledDate) {
        throw new Error(`Invalid scheduledDate provided: ${updates.scheduledDate}`);
      }
      updateData.scheduledDate = normalizedScheduledDate;
    }
    
    await db.workouts.update(workoutId, updateData);
  }, 'updateWorkout');
}

/**
 * Mark workout as completed
 */
export async function markWorkoutCompleted(workoutId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.workouts.update(workoutId, {
      completed: true,
      completedAt: new Date(),
      updatedAt: new Date()
    });

    const workout = await db.workouts.get(workoutId);
    if (workout?.planId) {
      const plan = await db.plans.get(workout.planId);
      if (plan?.userId) {
        await updateUserStreak(plan.userId);
      }
    }
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

    // Trigger sync for critical data
    triggerSync();

    return id as number;
  }, 'recordRun');
}

/**
 * Create run with GPS accuracy data
 */
export async function createRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
  const runId = await recordRun(runData);
  if (runData.userId) {
    await updateUserStreak(runData.userId);
  }
  return runId;
}

const LOCATION_COORD_PRECISION = 3;

const roundCoordinate = (value: number, precision: number = LOCATION_COORD_PRECISION) => {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
};

export type LocationQualityUpdateInput = {
  location: string;
  lat: number;
  lng: number;
  accuracy: number;
  rejectionRate: number;
  lastRun: Date;
};

export async function upsertLocationQuality(update: LocationQualityUpdateInput): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) return;
    const lat = roundCoordinate(update.lat);
    const lng = roundCoordinate(update.lng);
    const existing = await db.locationQuality.where('[lat+lng]').equals([lat, lng]).first();

    if (existing) {
      const existingRuns = Number.isFinite(existing.runsRecorded) ? existing.runsRecorded : 0;
      const existingAvgAccuracy = Number.isFinite(existing.avgAccuracy) ? existing.avgAccuracy : 0;
      const existingAvgRejectionRate = Number.isFinite(existing.avgRejectionRate)
        ? existing.avgRejectionRate
        : 0;
      const nextRuns = existingRuns + 1;
      const nextAvgAccuracy =
        (existingAvgAccuracy * existingRuns + update.accuracy) / nextRuns;
      const nextAvgRejectionRate =
        (existingAvgRejectionRate * existingRuns + update.rejectionRate) / nextRuns;

      await db.locationQuality.update(existing.id!, {
        location: update.location,
        lat,
        lng,
        avgAccuracy: nextAvgAccuracy,
        avgRejectionRate: nextAvgRejectionRate,
        runsRecorded: nextRuns,
        lastRun: update.lastRun,
      });
      return;
    }

    await db.locationQuality.add({
      location: update.location,
      lat,
      lng,
      avgAccuracy: update.accuracy,
      avgRejectionRate: update.rejectionRate,
      runsRecorded: 1,
      lastRun: update.lastRun,
    } as LocationQuality);
  }, 'upsertLocationQuality');
}

export async function getRunById(runId: number): Promise<Run | null> {
  return safeDbOperation(async () => {
    if (!db) return null
    const run = await db.runs.get(runId)
    return run ?? null
  }, 'getRunById', null)
}

export async function updateRun(runId: number, updates: Partial<Run>): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) return
    await db.runs.update(runId, { ...updates, updatedAt: new Date() })

    // Trigger sync after update
    triggerSync();
  }, 'updateRun')
}

/**
 * Get user runs with filtering
 */
export async function getUserRuns(userId: number, limit?: number): Promise<Run[]> {
  return safeDbOperation(async () => {
    if (db) {
      // sortBy returns a Promise of array; do not chain toArray() afterwards
      const runs = await db.runs.where('userId').equals(userId).sortBy('completedAt');
      const sortedDesc = runs.reverse();
      return typeof limit === 'number' ? sortedDesc.slice(0, limit) : sortedDesc;
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

// ========================================================================
// STREAK UTILITIES
// ========================================================================

export async function calculateCurrentStreak(userId: number): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return 0;

    const runs = await database.runs.where('userId').equals(userId).toArray();
    if (runs.length === 0) return 0;

    const sortedRuns = runs
      .map((run) => {
        const activityDate = new Date(run.completedAt ?? run.createdAt ?? 0);
        return { activityDate };
      })
      .filter((run) => !Number.isNaN(run.activityDate.getTime()))
      .sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());

    if (sortedRuns.length === 0) return 0;

    const now = new Date();
    const lastRunAt = sortedRuns[0].activityDate;
    const diffMs = now.getTime() - lastRunAt.getTime();
    const withinGrace = diffMs <= 24 * 60 * 60 * 1000 || isSameDay(now, lastRunAt);
    if (!withinGrace) return 0;

    const uniqueDates: Date[] = [];
    const seen = new Set<string>();
    for (const run of sortedRuns) {
      const normalized = normalizeDate(run.activityDate);
      if (!normalized) continue;
      const key = normalized.toISOString();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueDates.push(normalized);
    }

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i += 1) {
      const diffDays = getDaysDifference(uniqueDates[i - 1], uniqueDates[i]);
      if (diffDays === 1) {
        streak += 1;
      } else {
        break;
      }
      if (streak >= 365) break;
    }

    return streak;
  }, 'calculateCurrentStreak', 0);
}

export async function updateUserStreak(userId: number): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return;

    const user = await database.users.get(userId);
    if (!user) return;

    const runs = await database.runs.where('userId').equals(userId).toArray();
    let lastActivityDate: Date | null = null;
    if (runs.length > 0) {
      const lastRun = runs.reduce((latest, run) => {
        const runDate = new Date(run.completedAt ?? run.createdAt ?? 0);
        return runDate.getTime() > latest.getTime() ? runDate : latest;
      }, new Date(0));
      lastActivityDate = normalizeDate(lastRun);
    }

    const currentStreak = await calculateCurrentStreak(userId);
    const longestStreak = Math.max(user.longestStreak ?? 0, currentStreak);

    if (currentStreak > 0) {
      const badgeMilestones: Array<{ milestone: number; type: 'bronze' | 'silver' | 'gold' }> = [
        { milestone: 3, type: 'bronze' },
        { milestone: 7, type: 'silver' },
        { milestone: 30, type: 'gold' }
      ];
      const existingBadges = await database.badges.where('userId').equals(userId).toArray();
      const toAward = badgeMilestones.filter((badge) =>
        currentStreak >= badge.milestone &&
        !existingBadges.some((existing) => existing.milestone === badge.milestone && existing.type === badge.type)
      );

      for (const badge of toAward) {
        await database.badges.add({
          userId,
          type: badge.type,
          milestone: badge.milestone,
          unlockedAt: new Date(),
          streakValueAchieved: currentStreak,
        });
      }
    }

    await database.users.update(userId, {
      currentStreak,
      longestStreak,
      lastActivityDate,
      streakLastUpdated: new Date()
    });
  }, 'updateUserStreak');
}

export async function getStreakStats(userId: number): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  streakLastUpdated: Date | null;
}> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakLastUpdated: null
      };
    }

    const user = await database.users.get(userId);
    if (!user) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakLastUpdated: null
      };
    }

    return {
      currentStreak: user.currentStreak ?? 0,
      longestStreak: user.longestStreak ?? 0,
      lastActivityDate: user.lastActivityDate ?? null,
      streakLastUpdated: user.streakLastUpdated ?? null
    };
  }, 'getStreakStats', {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    streakLastUpdated: null
  });
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

    const resolvedSleepDate =
      sleepData.sleepDate ?? sleepData.date ?? new Date()
    const id = await db.sleepData.add({
      ...sleepData,
      sleepDate: resolvedSleepDate,
      date: sleepData.date ?? resolvedSleepDate,
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

    const resolvedDate =
      wellnessData.assessmentDate ?? wellnessData.date ?? new Date()
    const id = await db.subjectiveWellness.add({
      ...wellnessData,
      assessmentDate: resolvedDate,
      date: wellnessData.date ?? resolvedDate,
      createdAt: new Date()
    });
    console.log('✅ Subjective wellness saved successfully:', id);
    return id as number;
  }, 'saveSubjectiveWellness');
}

/**
 * Get recovery data for date range
 * Security: Added pagination and limits to prevent memory exhaustion
 */
export async function getRecoveryData(
  userId: number,
  startDate: Date,
  endDate: Date,
  options?: { limit?: number }
): Promise<{
  sleepData: SleepData[];
  hrvMeasurements: HRVMeasurement[];
  recoveryScores: RecoveryScore[];
  subjectiveWellness: SubjectiveWellness[];
}> {
  return safeDbOperation(async () => {
    if (db) {
      // Security: Validate userId
      const validatedUserId = validateUserId(userId);

      // Security: Set reasonable limits (max 365 days of data)
      const limit = Math.min(options?.limit || 365, 365);

      // Security: Validate date range (max 1 year)
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        console.warn('Date range exceeds maximum of 1 year');
        return {
          sleepData: [],
          hrvMeasurements: [],
          recoveryScores: [],
          subjectiveWellness: []
        };
      }

      const [sleepData, hrvMeasurements, recoveryScores, subjectiveWellness] = await Promise.all([
        db.sleepData.where('userId').equals(validatedUserId).and((sleep: any) => sleep.sleepDate >= startDate && sleep.sleepDate <= endDate).limit(limit).toArray(),
        db.hrvMeasurements.where('userId').equals(validatedUserId).and((hrv: any) => hrv.measurementDate >= startDate && hrv.measurementDate <= endDate).limit(limit).toArray(),
        db.recoveryScores.where('userId').equals(validatedUserId).and((score: any) => score.scoreDate >= startDate && score.scoreDate <= endDate).limit(limit).toArray(),
        db.subjectiveWellness.where('userId').equals(validatedUserId).and((wellness: any) => wellness.assessmentDate >= startDate && wellness.assessmentDate <= endDate).limit(limit).toArray()
      ]);

      return {
        sleepData,
        hrvMeasurements,
        recoveryScores,
        subjectiveWellness
      };
    }
    return {
      sleepData: [],
      hrvMeasurements: [],
      recoveryScores: [],
      subjectiveWellness: []
    };
  }, 'getRecoveryData', {
    sleepData: [],
    hrvMeasurements: [],
    recoveryScores: [],
    subjectiveWellness: []
  });
}

// ============================================================================
// ENHANCED SIMPLIFIED OPERATIONS
// ============================================================================

/**
 * Create user with default data
 */
export async function createUserWithInitialData(
  userData: Partial<User>,
  initialGoals: Partial<Goal>[] = [],
  initialPlans: Partial<Plan>[] = []
): Promise<{ success: boolean; userId?: number; error?: any }> {
  try {
    const userId = await createUser(userData);
    
    // Create goals if provided
    for (const goalData of initialGoals) {
      await createGoal({ ...goalData, userId } as any);
    }
    
    // Create plans if provided  
    for (const planData of initialPlans) {
      await createPlan({ ...planData, userId } as any);
    }
    
    return { success: true, userId };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Create goal with milestones
 */
export async function createGoalAndMilestones(
  goalData: Partial<Goal>,
  milestones: Partial<GoalMilestone>[] = []
): Promise<{ success: boolean; goalId?: number; milestoneIds?: number[]; error?: any }> {
  try {
    const goalId = await createGoal(goalData as any);
    const milestoneIds: number[] = [];
    
    // Create milestones if provided
    if (milestones.length > 0) {
      const database = getDatabase();
      if (database) {
        for (const milestone of milestones) {
          const milestoneId = await database.goalMilestones.add({
            // Required fields for GoalMilestone
            goalId,
            milestoneOrder: milestone.milestoneOrder ?? 1,
            title: milestone.title ?? 'Milestone',
            description: milestone.description ?? '',
            targetValue: milestone.targetValue ?? 0,
            targetDate: milestone.targetDate ?? new Date(),
            status: milestone.status ?? 'pending',
            achievedDate: milestone.achievedDate ?? undefined,
            achievedValue: milestone.achievedValue ?? undefined,
            celebrationShown: milestone.celebrationShown ?? false,
            // Timestamps
            createdAt: new Date()
          } as Omit<GoalMilestone, 'id'>);
          milestoneIds.push(milestoneId as number);
        }
      }
    }
    
    return { success: true, goalId, milestoneIds };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Create run with automatic goal progress updates
 */
export async function createRunAndUpdateProgress(
  runData: Partial<Run>,
  updateGoals: boolean = true
): Promise<{ success: boolean; runId?: number; error?: any }> {
  try {
    const runId = await recordRun(runData as any);
    
    // Update goal progress if enabled
    if (updateGoals && runData.userId) {
      const goals = await getUserGoals(runData.userId, 'active');
      
      for (const goal of goals) {
        let progressUpdate = 0;
        
        switch (goal.goalType) {
          case 'distance_achievement':
            progressUpdate = runData.distance || 0;
            break;
          case 'frequency':
            progressUpdate = 1; // One run completed
            break;
          case 'time_improvement':
            // Calculate pace improvement
            if (runData.duration && runData.distance) {
              // Custom logic for pace improvement tracking
            }
            break;
        }
        
        if (progressUpdate > 0) {
          await updateGoal(goal.id!, {
            currentValue: goal.currentValue + progressUpdate,
            updatedAt: new Date()
          });
        }
      }
    }
    
    return { success: true, runId };
  } catch (error) {
    return { success: false, error };
  }
}

// ============================================================================
// RACE GOAL MANAGEMENT UTILITIES
// ============================================================================

/**
 * Get race goals for user
 */
export async function getRaceGoalsByUser(userId: number): Promise<RaceGoal[]> {
  return safeDbOperation(async () => {
    if (db) {
      return await db.raceGoals.where('userId').equals(userId).toArray();
    }
    return [];
  }, 'getRaceGoalsByUser', []);
}

/**
 * Create race goal
 */
export async function createRaceGoal(goalData: Omit<RaceGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    const id = await db.raceGoals.add({
      ...goalData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Race goal created successfully:', id);
    return id as number;
  }, 'createRaceGoal');
}

/**
 * Update race goal
 */
export async function updateRaceGoal(goalId: number, updates: Partial<RaceGoal>): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.raceGoals.update(goalId, {
      ...updates,
      updatedAt: new Date()
    });
    console.log('✅ Race goal updated successfully:', goalId);
  }, 'updateRaceGoal');
}

/**
 * Delete race goal
 */
export async function deleteRaceGoal(goalId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.raceGoals.delete(goalId);
    console.log('✅ Race goal deleted successfully:', goalId);
  }, 'deleteRaceGoal');
}

/**
 * Get race goal by ID
 */
export async function getRaceGoalById(goalId: number): Promise<RaceGoal | null> {
  return safeDbOperation(async () => {
    if (db) {
      return await db.raceGoals.get(goalId) || null;
    }
    return null;
  }, 'getRaceGoalById', null);
}

/**
 * Get workouts by plan ID
 */
export async function getWorkoutsByPlan(planId: number): Promise<Workout[]> {
  return safeDbOperation(async () => {
    if (db) {
      return await db.workouts.where('planId').equals(planId).toArray();
    }
    return [];
  }, 'getWorkoutsByPlan', []);
}


/**
 * Delete workout
 */
export async function deleteWorkout(workoutId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');
    
    await db.workouts.delete(workoutId);
    console.log('✅ Workout deleted successfully:', workoutId);
  }, 'deleteWorkout');
}

/**
 * Assess fitness level for user
 */
export async function assessFitnessLevel(userId: number): Promise<{ level: string; score: number } | null> {
  return safeDbOperation(async () => {
    if (!db) return null;
    
    // Get recent runs to assess fitness
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => run.completedAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .toArray();
    
    if (recentRuns.length === 0) {
      return { level: 'beginner', score: 0 };
    }
    
    // Calculate average pace and distance
    const avgDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length;
    const avgPace = recentRuns.reduce((sum, run) => sum + (run.duration / run.distance), 0) / recentRuns.length;
    
    // Simple fitness scoring based on distance and pace
    let score = 0;
    if (avgDistance >= 10) score += 40;
    else if (avgDistance >= 5) score += 20;
    else if (avgDistance >= 3) score += 10;
    
    if (avgPace <= 4) score += 40; // sub 4 min/km
    else if (avgPace <= 5) score += 30; // sub 5 min/km
    else if (avgPace <= 6) score += 20; // sub 6 min/km
    else if (avgPace <= 7) score += 10; // sub 7 min/km
    
    // Frequency bonus
    if (recentRuns.length >= 12) score += 20; // 3+ runs per week
    else if (recentRuns.length >= 8) score += 15; // 2+ runs per week
    else if (recentRuns.length >= 4) score += 10; // 1+ runs per week
    
    let level = 'beginner';
    if (score >= 80) level = 'advanced';
    else if (score >= 50) level = 'intermediate';
    
    return { level, score };
  }, 'assessFitnessLevel', null);
}

/**
 * Calculate target paces for race goal
 */
export async function calculateTargetPaces(raceGoal: RaceGoal): Promise<{ easy: number; tempo: number; threshold: number; interval: number } | null> {
  return safeDbOperation(async () => {
    if (!raceGoal.targetTime || !raceGoal.distance) return null;
    
    // Calculate race pace (minutes per km)
    const racePaceMinPerKm = (raceGoal.targetTime / 60) / raceGoal.distance;
    
    // Calculate training paces based on Jack Daniels' Running Formula
    const easy = racePaceMinPerKm + 1.5; // Easy pace: race pace + 1.5 min/km
    const tempo = racePaceMinPerKm + 0.5; // Tempo pace: race pace + 0.5 min/km
    const threshold = racePaceMinPerKm + 0.3; // Threshold: race pace + 0.3 min/km
    const interval = racePaceMinPerKm - 0.2; // Interval: race pace - 0.2 min/km
    
    return { easy, tempo, threshold, interval };
  }, 'calculateTargetPaces', null);
}

// ============================================================================
// PACE ZONES & VDOT UTILITIES
// ============================================================================

import {
  calculateVDOT,
  getPaceZonesFromVDOT,
  getDefaultPaceZones,
  type PaceZones
} from './pace-zones';

/**
 * Set reference race for a user and calculate VDOT
 * @param userId - User ID
 * @param distance - Race distance in km (5, 10, 21.1, 42.2)
 * @param timeSeconds - Race time in seconds
 */
export async function setReferenceRace(
  userId: number,
  distance: number,
  timeSeconds: number
): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    const vdot = calculateVDOT(distance, timeSeconds);

    await db.users.update(userId, {
      referenceRaceDistance: distance,
      referenceRaceTime: timeSeconds,
      referenceRaceDate: new Date(),
      calculatedVDOT: vdot,
      updatedAt: new Date()
    });

    console.log(`✅ Reference race set for user ${userId}: ${distance}km in ${timeSeconds}s (VDOT: ${vdot})`);
  }, 'setReferenceRace');
}

/**
 * Get pace zones for a user based on their reference race or defaults
 * @param userId - User ID
 * @returns PaceZones object with all training paces
 */
export async function getUserPaceZones(userId: number): Promise<PaceZones | null> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    const user = await db.users.get(userId);
    if (!user) return null;

    // If user has a calculated VDOT, use it
    if (user.calculatedVDOT) {
      return getPaceZonesFromVDOT(user.calculatedVDOT);
    }

    // If user has reference race data, calculate VDOT
    if (user.referenceRaceDistance && user.referenceRaceTime) {
      const vdot = calculateVDOT(user.referenceRaceDistance, user.referenceRaceTime);

      // Cache the VDOT for future use
      await db.users.update(userId, {
        calculatedVDOT: vdot,
        updatedAt: new Date()
      });

      return getPaceZonesFromVDOT(vdot);
    }

    // Fall back to experience-based defaults
    return getDefaultPaceZones(user.experience);
  }, 'getUserPaceZones', null);
}

/**
 * Recalculate VDOT for a user from their reference race
 * @param userId - User ID
 * @returns New VDOT value or null if no reference race
 */
export async function recalculateVDOT(userId: number): Promise<number | null> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    const user = await db.users.get(userId);
    if (!user || !user.referenceRaceDistance || !user.referenceRaceTime) {
      return null;
    }

    const vdot = calculateVDOT(user.referenceRaceDistance, user.referenceRaceTime);

    await db.users.update(userId, {
      calculatedVDOT: vdot,
      updatedAt: new Date()
    });

    console.log(`✅ VDOT recalculated for user ${userId}: ${vdot}`);
    return vdot;
  }, 'recalculateVDOT', null);
}

/**
 * Clear reference race data for a user (reset to defaults)
 * @param userId - User ID
 */
export async function clearReferenceRace(userId: number): Promise<void> {
  return safeDbOperation(async () => {
    if (!db) throw new Error('Database not available');

    await db.users.update(userId, {
      referenceRaceDistance: undefined,
      referenceRaceTime: undefined,
      referenceRaceDate: undefined,
      calculatedVDOT: undefined,
      updatedAt: new Date()
    });

    console.log(`✅ Reference race cleared for user ${userId}`);
  }, 'clearReferenceRace');
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
      await database.users.limit(1).toArray();
      canRead = true;
      details.push('Read operation successful');
    } catch (readError) {
      canRead = false;
      isHealthy = false;
      error = `Read operation failed: ${readError instanceof Error ? readError.message : String(readError)}`;
      details.push(error);
    }

    // Test write operation (use auto-increment key to avoid ConstraintError)
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
      
      const testId = await database.users.add(testUser as any);
      if (typeof testId === 'number') {
        await database.users.delete(testId);
      }
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
    // Omit error field if undefined to satisfy exactOptionalPropertyTypes
    const result: { isHealthy: boolean; canRead: boolean; canWrite: boolean; error?: string; details: string[] } = {
      isHealthy,
      canRead,
      canWrite,
      details
    };
    if (typeof error === 'string') {
      result.error = error;
    }
    return result;
    
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
    if (db && typeof db.isOpen === 'function' && db.isOpen()) {
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

/**
 * Migrate existing plans and workouts from local timezone to UTC
 * This should be run once to migrate existing data
 */
export async function migrateExistingPlansToUTC(): Promise<{ success: boolean; migratedPlans: number; migratedWorkouts: number; error?: any }> {
  return safeDbOperation<{ success: boolean; migratedPlans: number; migratedWorkouts: number; error?: unknown }>(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');
    
    let migratedPlans = 0;
    let migratedWorkouts = 0;
    
    console.log('🔄 Starting UTC migration for existing plans and workouts...');
    
    // Get all plans that don't have timezone info (need migration)
    const plansToMigrate = await database.plans
      .where('createdInTimezone')
      .equals(undefined as any)
      .toArray();
    
    console.log(`📋 Found ${plansToMigrate.length} plans to migrate`);
    
    for (const plan of plansToMigrate) {
      try {
        // Assume the plan was created in the user's current timezone if unknown
        const userTimezone = getUserTimezone();
        
        // Migrate plan dates
        const migratedStartDate = migrateLocalDateToUTC(plan.startDate, userTimezone);
        const migratedEndDate = migrateLocalDateToUTC(plan.endDate, userTimezone);
        
        await database.plans.update(plan.id!, {
          startDate: migratedStartDate,
          endDate: migratedEndDate,
          createdInTimezone: userTimezone,
          updatedAt: nowUTC()
        });
        
        migratedPlans++;
        console.log(`✅ Migrated plan ${plan.id} (${plan.title}) to UTC`);
        
        // Migrate associated workouts
        const workouts = await database.workouts.where('planId').equals(plan.id!).toArray();
        
        for (const workout of workouts) {
          const migratedScheduledDate = migrateLocalDateToUTC(workout.scheduledDate, userTimezone);
          
          await database.workouts.update(workout.id!, {
            scheduledDate: migratedScheduledDate,
            updatedAt: nowUTC()
          });
          
          migratedWorkouts++;
        }
        
        console.log(`📅 Migrated ${workouts.length} workouts for plan ${plan.id}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate plan ${plan.id}:`, error);
        // Continue with other plans even if one fails
      }
    }
    
    // Update user timezone if not set
    const users = await database.users.where('timezone').equals(undefined as any).toArray();
    for (const user of users) {
      if (user.id) {
        await database.users.update(user.id, {
          timezone: getUserTimezone(),
          updatedAt: nowUTC()
        });
      }
    }
    
    console.log(`✅ UTC migration complete: ${migratedPlans} plans, ${migratedWorkouts} workouts`);
    
    return { 
      success: true, 
      migratedPlans, 
      migratedWorkouts 
    };
    
  }, 'migrateExistingPlansToUTC', { success: false, migratedPlans: 0, migratedWorkouts: 0 });
}

// ============================================================================
// PERFORMANCE ANALYTICS UTILITIES
// ============================================================================

/**
 * Get runs within a specific time range for a user
 */
async function getRunsInTimeRange(userId: number, startDate: Date, endDate: Date): Promise<Run[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];
    const runs = await database.runs
      .where('userId')
      .equals(userId)
      .toArray();

    // Filter by date range in JavaScript since completedAt is not indexed
    return runs.filter(run => {
      const runDate = new Date(run.completedAt ?? run.createdAt);
      return runDate >= startDate && runDate <= endDate;
    }).sort((a, b) => new Date(a.completedAt ?? a.createdAt).getTime() - new Date(b.completedAt ?? b.createdAt).getTime());
  }, 'getRunsInTimeRange', []);
}

/**
 * Calculate performance trends from runs data
 */
async function calculatePerformanceTrends(runs: Run[]) {
  return safeDbOperation(async () => {
    if (runs.length === 0) {
      return {
        averagePace: 0,
        consistencyScore: 0,
        performanceScore: 0,
        paceProgression: [],
        distanceProgression: [],
        consistencyProgression: [],
        performanceProgression: []
      };
    }

    // Calculate average pace (seconds per km) - filter out unrealistic paces
    // Valid pace range: 2-20 min/km (120-1200 sec/km)
    const validPaces = runs
      .filter(run => run.distance >= 0.1 && run.duration > 0)
      .map(run => run.duration / run.distance)
      .filter(pace => pace >= 120 && pace <= 1200);

    const averagePace = validPaces.length > 0
      ? validPaces.reduce((sum, pace) => sum + pace, 0) / validPaces.length
      : 0;

    // Calculate consistency score (based on regularity of runs)
    const firstRun = runs.at(0);
    const lastRun = runs.at(-1);
    if (!firstRun || !lastRun) {
      return {
        averagePace: 0,
        consistencyScore: 0,
        performanceScore: 0,
        paceProgression: [],
        distanceProgression: [],
        consistencyProgression: [],
        performanceProgression: []
      };
    }
    const daysSinceFirstRun = Math.ceil(
      (new Date(lastRun.completedAt ?? lastRun.createdAt).getTime() -
        new Date(firstRun.completedAt ?? firstRun.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const expectedRuns = Math.max(1, Math.ceil(daysSinceFirstRun / 3)); // Expect run every 3 days
    const consistencyScore = Math.min(100, (runs.length / expectedRuns) * 100);

    // Calculate performance score (combination of consistency and pace improvement)
    const firstHalfRuns = runs.slice(0, Math.ceil(runs.length / 2));
    const secondHalfRuns = runs.slice(Math.ceil(runs.length / 2));

    const firstHalfAvgPace = firstHalfRuns.reduce((sum, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : 0;
      return sum + pace;
    }, 0) / (firstHalfRuns.length || 1);

    const secondHalfAvgPace = secondHalfRuns.reduce((sum, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : 0;
      return sum + pace;
    }, 0) / (secondHalfRuns.length || 1);

    const paceImprovement = firstHalfAvgPace > 0 ? ((firstHalfAvgPace - secondHalfAvgPace) / firstHalfAvgPace) * 100 : 0;
    const performanceScore = Math.max(0, Math.min(100, 50 + (consistencyScore * 0.3) + (paceImprovement * 0.7)));

    // Generate progression data - filter unrealistic paces (2-20 min/km = 120-1200 sec/km)
    const paceProgression = runs
      .filter(run => run.distance >= 0.1 && run.duration > 0)
      .map(run => {
        const pace = run.duration / run.distance;
        return { date: new Date(run.completedAt ?? run.createdAt), pace };
      })
      .filter(p => p.pace >= 120 && p.pace <= 1200);

    const distanceProgression = runs.map(run => ({
      date: new Date(run.completedAt ?? run.createdAt),
      distance: run.distance
    }));

    // Calculate rolling consistency
    const consistencyProgression = runs.map((_, index) => {
      const runAtIndex = runs.at(index);
      if (!runAtIndex) {
        return { date: new Date(), consistency: 0 };
      }
      const runsToDate = runs.slice(0, index + 1);
      const days = Math.ceil(
        (new Date(runAtIndex.createdAt).getTime() - new Date(firstRun.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const expected = Math.max(1, Math.ceil(days / 3));
      const score = Math.min(100, (runsToDate.length / expected) * 100);

      return {
        date: new Date(runAtIndex.completedAt ?? runAtIndex.createdAt),
        consistency: score
      };
    });

    // Calculate rolling performance
    const performanceProgression = runs.map((_, index) => {
      const runAtIndex = runs.at(index);
      if (!runAtIndex) {
        return { date: new Date(), performance: 50 };
      }
      const runsToDate = runs.slice(0, index + 1);
      const halfPoint = Math.ceil(runsToDate.length / 2);
      const firstHalf = runsToDate.slice(0, halfPoint);
      const secondHalf = runsToDate.slice(halfPoint);

      if (firstHalf.length === 0 || secondHalf.length === 0) {
        return {
          date: new Date(runAtIndex.completedAt ?? runAtIndex.createdAt),
          performance: 50
        };
      }

      const firstAvg = firstHalf.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / secondHalf.length;
      const improvement = firstAvg > 0 ? ((firstAvg - secondAvg) / firstAvg) * 100 : 0;

      return {
        date: new Date(runAtIndex.completedAt ?? runAtIndex.createdAt),
        performance: Math.max(0, Math.min(100, 50 + improvement))
      };
    });

    return {
      averagePace,
      consistencyScore,
      performanceScore,
      paceProgression,
      distanceProgression,
      consistencyProgression,
      performanceProgression
    };
  }, 'calculatePerformanceTrends', {
    averagePace: 0,
    consistencyScore: 0,
    performanceScore: 0,
    paceProgression: [],
    distanceProgression: [],
    consistencyProgression: [],
    performanceProgression: []
  });
}

/**
 * Get personal records for a user
 */
async function getPersonalRecords(userId: number) {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];
    const storedRecords = await database.personalRecords.where('userId').equals(userId).toArray();
    if (storedRecords.length > 0) {
      return storedRecords;
    }
    const runs = await database.runs.where('userId').equals(userId).toArray();

    if (runs.length === 0) {
      return [];
    }

    const firstRun = runs.at(0);
    if (!firstRun) return [];

    // Calculate various PRs
    const longestRun = runs.reduce((max, run) => run.distance > max.distance ? run : max, firstRun);
    const fastestPace = runs.reduce((fastest, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : Infinity;
      const fastestPace = fastest.distance > 0 ? fastest.duration / fastest.distance : Infinity;
      return pace < fastestPace ? run : fastest;
    }, firstRun);
    const longestDuration = runs.reduce((max, run) => run.duration > max.duration ? run : max, firstRun);

    const records = [
      {
        type: 'Longest Run',
        value: longestRun.distance.toFixed(2) + ' km',
        date: new Date(longestRun.createdAt).toLocaleDateString(),
        icon: 'target'
      },
      {
        type: 'Fastest Pace',
        value: formatPace(fastestPace.distance > 0 ? fastestPace.duration / fastestPace.distance : 0),
        date: new Date(fastestPace.createdAt).toLocaleDateString(),
        icon: 'zap'
      },
      {
        type: 'Longest Duration',
        value: formatDuration(longestDuration.duration),
        date: new Date(longestDuration.createdAt).toLocaleDateString(),
        icon: 'clock'
      },
      {
        type: 'Total Runs',
        value: runs.length.toString(),
        date: 'All time',
        icon: 'activity'
      }
    ];

    return records;
  }, 'getPersonalRecords', []);
}

/**
 * Format pace in min:sec per km
 */
function formatPace(paceSecondsPerKm: number): string {
  if (paceSecondsPerKm === 0) return '--:--';
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.floor(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration in hours and minutes
 */
function formatDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get performance insights for a user
 */
async function getPerformanceInsights(userId: number, startDate: Date, endDate: Date) {
  return safeDbOperation(async () => {
    const runs = await getRunsInTimeRange(userId, startDate, endDate);
    const trends = await calculatePerformanceTrends(runs);

    const now = new Date();
    const validUntil = new Date(endDate);

    const insights: Array<{
      type: 'improvement' | 'warning' | 'achievement' | 'recommendation' | 'info';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
      createdAt: Date;
      validUntil?: Date;
      metric?: string;
    }> = [];

    // Consistency insight
    if (trends.consistencyScore >= 80) {
      insights.push({
        type: 'achievement',
        title: 'Excellent Consistency',
        description: 'You\'re maintaining a great running schedule! Keep it up!',
        metric: `${trends.consistencyScore.toFixed(0)}% consistency`,
        priority: 'medium',
        actionable: false,
        createdAt: now,
        validUntil
      });
    } else if (trends.consistencyScore < 50) {
      insights.push({
        type: 'recommendation',
        title: 'Improve Consistency',
        description: 'Try to run more regularly to build momentum and see better results.',
        metric: `${trends.consistencyScore.toFixed(0)}% consistency`,
        priority: 'high',
        actionable: true,
        createdAt: now,
        validUntil
      });
    }

    // Pace improvement insight
    if (runs.length >= 4) {
      const firstQuarter = runs.slice(0, Math.ceil(runs.length / 4));
      const lastQuarter = runs.slice(-Math.ceil(runs.length / 4));

      const firstAvgPace = firstQuarter.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / firstQuarter.length;
      const lastAvgPace = lastQuarter.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / lastQuarter.length;

      const improvement = ((firstAvgPace - lastAvgPace) / firstAvgPace) * 100;

      if (improvement > 5) {
        insights.push({
          type: 'improvement',
          title: 'Pace Improvement',
          description: `Your pace has improved by ${improvement.toFixed(1)}%! You're getting faster!`,
          metric: formatPace(lastAvgPace),
          priority: 'medium',
          actionable: false,
          createdAt: now,
          validUntil
        });
      } else if (improvement < -5) {
        insights.push({
          type: 'warning',
          title: 'Pace Variation',
          description: 'Your pace has slowed recently. Consider adjusting your training intensity or ensuring adequate recovery.',
          metric: formatPace(lastAvgPace),
          priority: 'high',
          actionable: true,
          createdAt: now,
          validUntil
        });
      }
    }

    // Distance insight
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    if (totalDistance > 50) {
      insights.push({
        type: 'achievement',
        title: 'Distance Milestone',
        description: `You've run ${totalDistance.toFixed(1)} km in this period! Great work!`,
        metric: `${totalDistance.toFixed(1)} km`,
        priority: 'low',
        actionable: false,
        createdAt: now,
        validUntil
      });
    }

    // If no insights yet, add a motivational one
    if (insights.length === 0 && runs.length > 0) {
      insights.push({
        type: 'info',
        title: 'Keep Going',
        description: 'Every run counts! You\'re building a strong foundation.',
        metric: `${runs.length} runs completed`,
        priority: 'low',
        actionable: false,
        createdAt: now,
        validUntil
      });
    }

    return insights;
  }, 'getPerformanceInsights', []);
}

/**
 * Get performance metrics for a user in a time range
 */
async function getPerformanceMetrics(userId: number, startDate: Date, endDate: Date) {
  return safeDbOperation(async () => {
    const runs = await getRunsInTimeRange(userId, startDate, endDate);
    const trends = await calculatePerformanceTrends(runs);

    return {
      totalRuns: runs.length,
      totalDistance: runs.reduce((sum, run) => sum + run.distance, 0),
      totalDuration: runs.reduce((sum, run) => sum + run.duration, 0),
      averagePace: trends.averagePace,
      consistencyScore: trends.consistencyScore,
      performanceScore: trends.performanceScore
    };
  }, 'getPerformanceMetrics', {
    totalRuns: 0,
    totalDistance: 0,
    totalDuration: 0,
    averagePace: 0,
    consistencyScore: 0,
    performanceScore: 0
  });
}

/**
 * Get personal record progression for a specific distance
 */
async function getPersonalRecordProgression(userId: number, distance: number) {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];
    const runs = await database.runs.where('userId').equals(userId).toArray();

    // Filter runs for this specific distance (within 5% tolerance)
    const relevantRuns = runs.filter(run => {
      const distanceDiff = Math.abs(run.distance - distance);
      const tolerance = distance * 0.05; // 5% tolerance
      return distanceDiff <= tolerance;
    }).sort((a, b) => new Date(a.completedAt ?? a.createdAt).getTime() - new Date(b.completedAt ?? b.createdAt).getTime());

    if (relevantRuns.length === 0) {
      return [];
    }

    // Track personal record progression over time
    let currentBest = Infinity;
    const progression = [];

    for (const run of relevantRuns) {
      const pace = run.distance > 0 ? run.duration / run.distance : Infinity;

      if (pace < currentBest) {
        currentBest = pace;
        progression.push({
          date: new Date(run.completedAt ?? run.createdAt),
          pace: pace,
          duration: run.duration,
          distance: run.distance,
          isPR: true
        });
      }
    }

    return progression;
  }, 'getPersonalRecordProgression', []);
}

/**
 * Check and update personal records based on new run
 */
async function checkAndUpdatePersonalRecords(
  userId: number,
  runId: number,
  distance: number,
  duration: number,
  pace: number,
  date: Date
) {
  return safeDbOperation(async () => {
    const updatedRecords = [];
    const database = getDatabase();
    if (!database) return [];
    const allRuns = await database.runs.where('userId').equals(userId).toArray();
    const firstRun = allRuns.at(0);
    if (!firstRun) return [];

    // Check various record types
    const longestRun = allRuns.reduce((max, run) => run.distance > max.distance ? run : max, firstRun);
    const fastestPace = allRuns.reduce((fastest, run) => {
      const runPace = run.distance > 0 ? run.duration / run.distance : Infinity;
      const fastestPace = fastest.distance > 0 ? fastest.duration / fastest.distance : Infinity;
      return runPace < fastestPace ? run : fastest;
    }, firstRun);
    const longestDuration = allRuns.reduce((max, run) => run.duration > max.duration ? run : max, firstRun);

    // Check if this run set any records
    if (longestRun.id === runId) {
      updatedRecords.push({
        type: 'Longest Distance',
        value: distance,
        date: date,
        runId: runId
      });
    }

    if (fastestPace.id === runId) {
      updatedRecords.push({
        type: 'Fastest Pace',
        value: pace,
        date: date,
        runId: runId
      });
    }

    if (longestDuration.id === runId) {
      updatedRecords.push({
        type: 'Longest Duration',
        value: duration,
        date: date,
        runId: runId
      });
    }

    return updatedRecords;
  }, 'checkAndUpdatePersonalRecords', []);
}

/**
 * Delete a personal record (admin functionality)
 */
async function deletePersonalRecord(_userId: number, recordId: number) {
  return safeDbOperation(async () => {
    // Personal records are derived from runs, so this would delete the run
    const database = getDatabase();
    if (!database) return false;
    await database.runs.delete(recordId);
    return true;
  }, 'deletePersonalRecord', false);
}

/**
 * Get goal progress history
 */
async function getGoalProgressHistory(goalId: number, limit: number = 30) {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];

    const history = await database.goalProgressHistory.where('goalId').equals(goalId).toArray();

    const getDate = (entry: any): number => {
      const date = entry.measurementDate ?? entry.recordedAt ?? entry.createdAt;
      return date instanceof Date ? date.getTime() : new Date(date).getTime();
    };

    return history
      .slice()
      .sort((a, b) => getDate(b) - getDate(a))
      .slice(0, Math.max(0, limit));
  }, 'getGoalProgressHistory', []);
}

function calculateGoalProgressPercentage(
  baselineValue: number,
  currentValue: number,
  targetValue: number,
  goalType: Goal['goalType']
): number {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));

  if (![baselineValue, currentValue, targetValue].every(Number.isFinite)) return 0;
  if (baselineValue === targetValue) return clamp(currentValue === targetValue ? 100 : 0);

  const raw =
    goalType === 'time_improvement'
      ? ((baselineValue - currentValue) / (baselineValue - targetValue)) * 100
      : ((currentValue - baselineValue) / (targetValue - baselineValue)) * 100;

  return clamp(raw);
}

type RecordGoalProgressInput = {
  goalId: number;
  measurementDate: Date;
  measuredValue: number;
  progressPercentage: number;
  contributingActivityId?: number | null;
  contributingActivityType?: string;
  notes?: string;
  autoRecorded: boolean;
  context?: Record<string, unknown>;
};

async function recordGoalProgress(progress: RecordGoalProgressInput): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    const goal = await database.goals.get(progress.goalId);
    if (!goal) throw new Error('Goal not found');

    const measurementDate = progress.measurementDate instanceof Date ? progress.measurementDate : new Date(progress.measurementDate);

    const historyEntry: Omit<GoalProgressHistory, 'id'> = {
      goalId: progress.goalId,
      measurementDate,
      recordedAt: measurementDate,
      measuredValue: progress.measuredValue,
      progressValue: progress.measuredValue,
      progressPercentage: progress.progressPercentage,
      autoRecorded: progress.autoRecorded,
      contributingActivityId: progress.contributingActivityId ?? null,
      createdAt: new Date(),
      ...(typeof progress.contributingActivityType === 'string'
        ? { contributingActivityType: progress.contributingActivityType }
        : {}),
      ...(progress.context ? { context: progress.context } : {}),
      ...(typeof progress.notes === 'string' ? { notes: progress.notes } : {}),
    };

    const progressId = await database.goalProgressHistory.add(historyEntry);

    const nextGoalStatus: Goal['status'] = progress.progressPercentage >= 100 ? 'completed' : goal.status;

    const goalUpdate: Partial<Goal> = {
      currentValue: progress.measuredValue,
      progressPercentage: progress.progressPercentage,
      status: nextGoalStatus,
      updatedAt: new Date(),
    };

    if (nextGoalStatus === 'completed') {
      goalUpdate.completedAt = measurementDate;
    }

    await database.goals.update(progress.goalId, goalUpdate);

    return progressId as number;
  }, 'recordGoalProgress');
}

async function getGoalRecommendations(
  userId: number,
  status?: GoalRecommendation['status']
): Promise<GoalRecommendation[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];

    const all = await database.goalRecommendations.where('userId').equals(userId).toArray();
    const filtered = status ? all.filter((r) => r.status === status) : all;

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, 'getGoalRecommendations', []);
}

async function getGoalRecommendationById(recommendationId: number): Promise<GoalRecommendation | null> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return null;
    const recommendation = await database.goalRecommendations.get(recommendationId);
    return recommendation ?? null;
  }, 'getGoalRecommendationById', null);
}

async function createGoalRecommendation(
  recommendation: Omit<GoalRecommendation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    const validUntil = recommendation.validUntil ?? recommendation.expiresAt;

    const data: Omit<GoalRecommendation, 'id'> = {
      userId: recommendation.userId,
      recommendationType: recommendation.recommendationType,
      title: recommendation.title,
      description: recommendation.description,
      reasoning: recommendation.reasoning,
      confidenceScore: recommendation.confidenceScore,
      status: recommendation.status,
      recommendationData: recommendation.recommendationData,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(typeof recommendation.priority === 'string' ? { priority: recommendation.priority } : {}),
      ...(recommendation.expiresAt ? { expiresAt: recommendation.expiresAt } : {}),
      ...(validUntil ? { validUntil } : {}),
    };

    const id = await database.goalRecommendations.add(data);

    return id as number;
  }, 'createGoalRecommendation');
}

async function updateGoalRecommendation(recommendationId: number, updates: Partial<GoalRecommendation>): Promise<void> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    const nextUpdates: Partial<GoalRecommendation> = { ...updates, updatedAt: new Date() };

    if (updates.expiresAt && !updates.validUntil) {
      nextUpdates.validUntil = updates.expiresAt;
    }

    await database.goalRecommendations.update(recommendationId, nextUpdates);
  }, 'updateGoalRecommendation');
}

/**
 * Get milestones for a specific goal
 */
async function getGoalMilestones(goalId: number): Promise<GoalMilestone[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return [];
    return await database.goalMilestones.where('goalId').equals(goalId).toArray();
  }, 'getGoalMilestones', []);
}

// ============================================================================
// SMART GOAL VALIDATION & AUTO-COMPLETION
// ============================================================================

/**
 * SMART validation result interface
 */
export interface SMARTValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  autoGenerated: string[];
  completeness: {
    specific: boolean;      // Has clear title and target
    measurable: boolean;    // Has metrics to track
    achievable: boolean;    // Feasibility assessed
    relevant: boolean;      // Has context/motivation
    timeBound: boolean;     // Has deadline
  };
  smartScore: number;       // 0-100 overall SMART quality
}

/**
 * Derive metrics from goal type
 */
function deriveMetricsFromGoalType(goalType: string): string[] {
  const metricMap: Record<string, string[]> = {
    time_improvement: ['pace', 'distance', 'time', 'weekly_speed_workouts'],
    distance_achievement: ['distance', 'weekly_distance', 'longest_run'],
    frequency: ['runs_per_week', 'total_runs', 'streak'],
    race_completion: ['race_pace', 'training_volume', 'long_run_distance'],
    consistency: ['streak', 'runs_per_week', 'adherence_rate'],
    health: ['hrv', 'resting_heart_rate', 'recovery_score']
  };

  return metricMap[goalType] || ['progress'];
}

/**
 * Calculate feasibility score for a goal
 */
function calculateFeasibilityScore(
  baseline: number,
  target: number,
  deadline: Date,
  goalType: string
): number {
  const daysAvailable = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const weeksAvailable = daysAvailable / 7;

  if (baseline <= 0 || target <= 0) return 50;

  const improvementNeeded = Math.abs(target - baseline);
  const improvementPercent = (improvementNeeded / baseline) * 100;

  if (goalType === 'time_improvement') {
    // For time goals, improvement per week matters
    const improvementPerWeek = improvementPercent / weeksAvailable;
    if (improvementPerWeek < 1) return 85;      // Very achievable
    if (improvementPerWeek < 2) return 70;      // Challenging
    if (improvementPerWeek < 4) return 50;      // Difficult
    return 30;                                   // Very difficult
  } else {
    // For distance/frequency goals
    const progressionRate = improvementNeeded / weeksAvailable;
    if (progressionRate < baseline * 0.1) return 85;
    if (progressionRate < baseline * 0.2) return 70;
    if (progressionRate < baseline * 0.4) return 50;
    return 30;
  }
}

/**
 * Validate SMART goal criteria
 * Returns validation result with warnings instead of hard failures
 */
export function validateSMARTGoal(goalData: Partial<Goal>): SMARTValidationResult {
  const result: SMARTValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    autoGenerated: [],
    completeness: {
      specific: false,
      measurable: false,
      achievable: false,
      relevant: false,
      timeBound: false
    },
    smartScore: 0
  };

  // Validate Specific
  if (goalData.title && goalData.title.length >= 3 && goalData.specificTarget?.metric) {
    result.completeness.specific = true;
  } else {
    result.warnings.push('Goal should have a clear title and target metric');
  }

  // Validate Measurable
  if (goalData.measurableOutcome?.successCriteria && goalData.measurableOutcome.successCriteria.length > 0) {
    result.completeness.measurable = true;
  } else {
    result.warnings.push('Measurable outcome will be auto-generated from goal type');
    result.autoGenerated.push('measurableOutcome');
  }

  // Validate Achievable
  if (goalData.achievabilityAssessment?.difficultyRating !== undefined) {
    result.completeness.achievable = true;
  } else {
    result.warnings.push('Achievability assessment will be auto-calculated');
    result.autoGenerated.push('achievabilityAssessment');
  }

  // Validate Relevant
  if (goalData.relevanceJustification?.alignmentWithValues && goalData.relevanceJustification.alignmentWithValues.length >= 10) {
    result.completeness.relevant = true;
  } else {
    result.warnings.push('Relevance justification will be auto-generated');
    result.autoGenerated.push('relevanceJustification');
  }

  // Validate Time-bound
  if (goalData.timeBound?.deadline) {
    const daysUntil = Math.ceil((goalData.timeBound.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 7) {
      result.completeness.timeBound = true;
    } else {
      result.errors.push('Deadline must be at least 7 days in the future');
      result.isValid = false;
    }
  } else {
    result.errors.push('Deadline is required');
    result.isValid = false;
  }

  // Calculate SMART score
  const criteriaCount = Object.values(result.completeness).filter(Boolean).length;
  result.smartScore = (criteriaCount / 5) * 100;

  // Add suggestions based on score
  if (result.smartScore < 60) {
    result.suggestions.push('Consider providing more details for a stronger goal');
  } else if (result.smartScore === 100) {
    result.suggestions.push('Excellent! This goal meets all SMART criteria');
  }

  return result;
}

/**
 * Auto-complete missing goal fields with intelligent defaults
 */
export async function autoCompleteGoalFields(
  goalData: Partial<Goal>,
  userId: number
): Promise<Goal> {
  const completed = { ...goalData } as any;

  // Auto-generate measurable outcome from goal type
  if (!completed.measurableOutcome) {
    const metrics = deriveMetricsFromGoalType(completed.goalType);
    completed.measurableOutcome = {
      successCriteria: metrics,
      trackingMethod: `Track ${metrics.join(', ')} regularly`,
      measurementFrequency: 'weekly' as const
    };
  }

  // Auto-generate description if missing
  if (!completed.description) {
    completed.description = `${completed.title} - targeting ${completed.specificTarget?.value} ${completed.specificTarget?.unit}`;
  }

  // Auto-calculate baseline value from user's recent runs
  if (!completed.baselineValue && completed.goalType === 'time_improvement') {
    try {
      const database = getDatabase();
      if (!database) throw new Error('Database not available');
      const recentRuns = await database.runs
        .where('userId')
        .equals(userId)
        .reverse()
        .limit(10)
        .toArray();

      if (recentRuns.length > 0) {
        const avgPace = recentRuns.reduce((sum: number, run: any) => sum + (run.duration / run.distance), 0) / recentRuns.length;
        completed.baselineValue = avgPace;
      } else {
        completed.baselineValue = completed.targetValue * 1.2; // Assume 20% improvement
      }
    } catch (error) {
      console.warn('Failed to calculate baseline from runs:', error);
      completed.baselineValue = completed.targetValue * 1.2; // Fallback
    }
  } else if (!completed.baselineValue) {
    // For other goal types, use target * 1.2 as default
    completed.baselineValue = completed.targetValue * 1.2;
  }

  // Auto-calculate achievability assessment
  if (!completed.achievabilityAssessment) {
    const feasibilityScore = calculateFeasibilityScore(
      completed.baselineValue || 0,
      completed.targetValue || 0,
      completed.timeBound?.deadline || new Date(),
      completed.goalType
    );

    completed.achievabilityAssessment = {
      difficultyRating: Math.min(10, Math.max(1, Math.round(10 - (feasibilityScore / 10)))),
      requiredResources: ['Running shoes', 'Consistent training schedule', 'Time commitment'],
      potentialObstacles: ['Weather conditions', 'Work schedule', 'Fatigue or injury risk'],
      mitigationStrategies: ['Have indoor training alternative', 'Plan workouts in advance', 'Follow proper recovery protocols']
    };
  }

  // Auto-generate milestone schedule
  if (!completed.timeBound?.milestoneSchedule) {
    completed.timeBound = {
      ...completed.timeBound,
      milestoneSchedule: [25, 50, 75, 100]
    };
  }

  // Set default start date if missing
  if (!completed.timeBound?.startDate) {
    completed.timeBound = {
      ...completed.timeBound,
      startDate: new Date()
    };
  }

  // Set default relevance justification if missing
  if (!completed.relevanceJustification) {
    completed.relevanceJustification = {
      personalImportance: 8,
      alignmentWithValues: 'Improving health and fitness through consistent running',
      motivationalFactors: ['Better health', 'Personal achievement', 'Increased energy levels']
    };
  }

  // Calculate duration if missing
  if (!completed.timeBound?.totalDuration && completed.timeBound?.deadline) {
    const start = completed.timeBound.startDate || new Date();
    const end = completed.timeBound.deadline;
    completed.timeBound.totalDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Set default priority if missing
  if (!completed.priority) {
    completed.priority = 2; // Medium priority
  }

  // Set initial values
  completed.currentValue = completed.baselineValue;
  if (typeof completed.progressPercentage !== 'number') {
    completed.progressPercentage = 0;
  }
  completed.status = 'active';
  completed.lastUpdated = new Date();

  return completed as Goal;
}

type CohortStats = {
  cohortId: number;
  cohortName?: string;
  totalMembers: number;
  activeMembers: number;
  totalRuns: number;
  totalDistance: number;
  avgDistance: number;
  weeklyRuns: number;
  weeklyDistance: number;
  performanceComparison?: unknown;
};

async function getCohortStats(cohortId: number): Promise<CohortStats> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) {
      return {
        cohortId,
        totalMembers: 0,
        activeMembers: 0,
        totalRuns: 0,
        totalDistance: 0,
        avgDistance: 0,
        weeklyRuns: 0,
        weeklyDistance: 0,
      };
    }

    const cohort = await database.cohorts.get(cohortId);
    const members = await database.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map((m) => m.userId);

    if (memberIds.length === 0) {
      return {
        cohortId,
        ...(cohort?.name ? { cohortName: cohort.name } : {}),
        totalMembers: 0,
        activeMembers: 0,
        totalRuns: 0,
        totalDistance: 0,
        avgDistance: 0,
        weeklyRuns: 0,
        weeklyDistance: 0,
      };
    }

    const runs = await database.runs.where('userId').anyOf(memberIds).toArray();
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const avgDistance = totalRuns > 0 ? totalDistance / totalRuns : 0;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyRunsList = runs.filter((run) => (run.completedAt ?? run.createdAt) >= oneWeekAgo);
    const weeklyRuns = weeklyRunsList.length;
    const weeklyDistance = weeklyRunsList.reduce((sum, run) => sum + run.distance, 0);

    const activeMemberIds = new Set(weeklyRunsList.map((run) => run.userId));

    return {
      cohortId,
      ...(cohort?.name ? { cohortName: cohort.name } : {}),
      totalMembers: memberIds.length,
      activeMembers: activeMemberIds.size,
      totalRuns,
      totalDistance,
      avgDistance,
      weeklyRuns,
      weeklyDistance,
    };
  }, 'getCohortStats', {
    cohortId,
    totalMembers: 0,
    activeMembers: 0,
    totalRuns: 0,
    totalDistance: 0,
    avgDistance: 0,
    weeklyRuns: 0,
    weeklyDistance: 0,
  });
}

async function getCohortPerformanceComparison(
  cohortId: number,
  userId: number,
  timeRange: '7d' | '30d' | '90d' | '1y'
): Promise<unknown> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) return null;

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const members = await database.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length === 0) return null;

    const runs = await database.runs.where('userId').anyOf(memberIds).toArray();
    const recentRuns = runs.filter((run) => (run.completedAt ?? run.createdAt) >= cutoff);

    const cohortDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0);
    const cohortRunCount = recentRuns.length;
    const cohortAvgDistance = cohortRunCount > 0 ? cohortDistance / cohortRunCount : 0;

    const userRuns = recentRuns.filter((run) => run.userId === userId);
    const userDistance = userRuns.reduce((sum, run) => sum + run.distance, 0);
    const userRunCount = userRuns.length;
    const userAvgDistance = userRunCount > 0 ? userDistance / userRunCount : 0;

    return {
      timeRange,
      user: {
        runs: userRunCount,
        totalDistance: userDistance,
        avgDistance: userAvgDistance,
      },
      cohort: {
        runs: cohortRunCount,
        totalDistance: cohortDistance,
        avgDistance: cohortAvgDistance,
      },
    };
  }, 'getCohortPerformanceComparison', null);
}

// ============================================================================
// ONBOARDING & RECOMMENDATION HELPERS
// ============================================================================

/**
 * Check if a user has completed onboarding
 * @param userId - User ID to check
 * @returns True if onboarding is complete
 */
export async function isOnboardingComplete(userId: number): Promise<boolean> {
  return safeDbOperation(async () => {
    const validatedUserId = validateUserId(userId);
    const user = await db.users.get(validatedUserId);

    if (!user) {
      return false;
    }

    // Check if user has essential onboarding data
    return !!(
      user.name &&
      user.goal &&
      user.experience &&
      user.daysPerWeek &&
      user.preferredTimes &&
      user.preferredTimes.length > 0
    );
  }, 'isOnboardingComplete', false);
}

/**
 * Check if a user has minimal data for generating recommendations
 * @param userId - User ID to check
 * @returns True if user has sufficient data
 */
export async function hasMinimalDataForRecommendations(userId: number): Promise<boolean> {
  return safeDbOperation(async () => {
    const validatedUserId = validateUserId(userId);

    // Check if onboarding is complete
    const onboardingComplete = await isOnboardingComplete(validatedUserId);
    if (!onboardingComplete) {
      return false;
    }

    // Check if user has at least one of the following:
    // - Active plan
    // - Recent runs (last 30 days)
    // - Active goals

    const [plans, runs, goals] = await Promise.all([
      db.plans.where('userId').equals(validatedUserId).toArray(),
      db.runs.where('userId').equals(validatedUserId).toArray(),
      db.goals.where('userId').equals(validatedUserId).toArray(),
    ]);

    const hasActivePlan = plans.some(plan => plan.status === 'active');
    const hasRecentRuns = runs.some(run => {
      const runDate = run.completedAt ?? run.createdAt;
      const thirtyDaysAgo = nowUTC();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return runDate >= thirtyDaysAgo;
    });
    const hasActiveGoals = goals.some(goal => goal.status === 'active');

    // User needs at least one of these data points for meaningful recommendations
    return hasActivePlan || hasRecentRuns || hasActiveGoals;
  }, 'hasMinimalDataForRecommendations', false);
}

/**
 * Get user's onboarding status and data quality
 * @param userId - User ID to check
 * @returns Object with onboarding status and data quality metrics
 */
export async function getUserOnboardingStatus(userId: number): Promise<{
  onboardingComplete: boolean;
  hasMinimalData: boolean;
  dataQuality: {
    hasActivePlan: boolean;
    hasRecentRuns: boolean;
    hasActiveGoals: boolean;
    hasRecoveryData: boolean;
    runCount: number;
    goalCount: number;
  };
}> {
  return safeDbOperation(async () => {
    const validatedUserId = validateUserId(userId);

    const onboardingComplete = await isOnboardingComplete(validatedUserId);
    const hasMinimalData = await hasMinimalDataForRecommendations(validatedUserId);

    // Get detailed data quality metrics
    const [plans, runs, goals, sleepData, hrvData] = await Promise.all([
      db.plans.where('userId').equals(validatedUserId).toArray(),
      db.runs.where('userId').equals(validatedUserId).toArray(),
      db.goals.where('userId').equals(validatedUserId).toArray(),
      db.sleepData.where('userId').equals(validatedUserId).toArray(),
      db.hrvMeasurements.where('userId').equals(validatedUserId).toArray(),
    ]);

    const thirtyDaysAgo = nowUTC();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const hasActivePlan = plans.some(plan => plan.status === 'active');
    const hasRecentRuns = runs.some(run => {
      const runDate = run.completedAt ?? run.createdAt;
      return runDate >= thirtyDaysAgo;
    });
    const hasActiveGoals = goals.some(goal => goal.status === 'active');
    const hasRecoveryData = sleepData.length > 0 || hrvData.length > 0;

    return {
      onboardingComplete,
      hasMinimalData,
      dataQuality: {
        hasActivePlan,
        hasRecentRuns,
        hasActiveGoals,
        hasRecoveryData,
        runCount: runs.length,
        goalCount: goals.length,
      },
    };
  }, 'getUserOnboardingStatus', {
    onboardingComplete: false,
    hasMinimalData: false,
    dataQuality: {
      hasActivePlan: false,
      hasRecentRuns: false,
      hasActiveGoals: false,
      hasRecoveryData: false,
      runCount: 0,
      goalCount: 0,
    },
  });
}

// ============================================================================
// RECORDING CHECKPOINT UTILITIES
// ============================================================================

/**
 * Create or update an active recording session checkpoint
 */
export async function upsertActiveRecordingSession(
  session: Partial<ActiveRecordingSession>
): Promise<number> {
  return safeDbOperation(async () => {
    if (!session.userId) {
      throw new Error('User ID is required for recording session');
    }

    const validatedUserId = validateUserId(session.userId);
    const now = new Date();

    if (session.id) {
      // Update existing session
      await db.activeRecordingSessions.update(session.id, {
        ...session,
        updatedAt: now,
      });
      return session.id;
    } else {
      // Create new session
      const sessionData: ActiveRecordingSession = {
        userId: validatedUserId,
        status: session.status || 'recording',
        startedAt: session.startedAt || now,
        lastCheckpointAt: session.lastCheckpointAt || now,
        distanceKm: session.distanceKm || 0,
        durationSeconds: session.durationSeconds || 0,
        elapsedRunMs: session.elapsedRunMs || 0,
        gpsPath: session.gpsPath || '[]',
        lastRecordedPoint: session.lastRecordedPoint,
        workoutId: session.workoutId,
        routeId: session.routeId,
        routeName: session.routeName,
        autoPauseCount: session.autoPauseCount || 0,
        acceptedPointCount: session.acceptedPointCount || 0,
        rejectedPointCount: session.rejectedPointCount || 0,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.activeRecordingSessions.add(sessionData);
      return id;
    }
  }, 'upsertActiveRecordingSession', 0);
}

/**
 * Get an active recording session for a user
 */
export async function getActiveRecordingSession(
  userId: number
): Promise<ActiveRecordingSession | null> {
  return safeDbOperation(async () => {
    const validatedUserId = validateUserId(userId);

    const sessions = await db.activeRecordingSessions
      .where('userId')
      .equals(validatedUserId)
      .filter(s => s.status === 'recording' || s.status === 'paused')
      .toArray();

    if (sessions.length === 0) {
      return null;
    }

    // Return the most recent session
    return sessions.sort((a, b) => b.lastCheckpointAt.getTime() - a.lastCheckpointAt.getTime())[0];
  }, 'getActiveRecordingSession', null);
}

/**
 * Delete an active recording session
 */
export async function deleteActiveRecordingSession(sessionId: number): Promise<void> {
  return safeDbOperation(async () => {
    await db.activeRecordingSessions.delete(sessionId);
  }, 'deleteActiveRecordingSession', undefined);
}

/**
 * Mark a session as interrupted
 */
export async function markSessionAsInterrupted(sessionId: number): Promise<void> {
  return safeDbOperation(async () => {
    await db.activeRecordingSessions.update(sessionId, {
      status: 'interrupted',
      updatedAt: new Date(),
    });
  }, 'markSessionAsInterrupted', undefined);
}

/**
 * Clean up old interrupted sessions (older than 7 days)
 */
export async function cleanupOldRecordingSessions(userId: number): Promise<number> {
  return safeDbOperation(async () => {
    const validatedUserId = validateUserId(userId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldSessions = await db.activeRecordingSessions
      .where('userId')
      .equals(validatedUserId)
      .filter(s => s.lastCheckpointAt < sevenDaysAgo)
      .toArray();

    for (const session of oldSessions) {
      if (session.id) {
        await db.activeRecordingSessions.delete(session.id);
      }
    }

    return oldSessions.length;
  }, 'cleanupOldRecordingSessions', 0);
}

// ============================================================================
// CHALLENGE MANAGEMENT
// ============================================================================

/**
 * Seed challenge templates into the database
 */
export async function seedChallengeTemplates(): Promise<void> {
  return safeDbOperation(async () => {
    const { CHALLENGE_TEMPLATES } = await import('./challengeTemplates');

    for (const template of CHALLENGE_TEMPLATES) {
      // Check if template already exists
      const existing = await db.challengeTemplates
        .where('slug')
        .equals(template.slug)
        .first();

      if (!existing) {
        await db.challengeTemplates.add({
          ...template,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`[dbUtils] Seeded challenge template: ${template.name}`);
      }
    }
  }, 'seedChallengeTemplates');
}

/**
 * Get a challenge template by ID
 */
export async function getChallengeTemplate(id: number) {
  return safeDbOperation(async () => {
    return await db.challengeTemplates.get(id);
  }, 'getChallengeTemplate', null);
}

/**
 * Get all challenge templates
 */
export async function getAllChallengeTemplates() {
  return safeDbOperation(async () => {
    return await db.challengeTemplates
      .where('isActive')
      .equals(1)
      .sortBy('sortOrder');
  }, 'getAllChallengeTemplates', []);
}

/**
 * Get active challenges for a user
 */
export async function getActiveChallenges(userId: number) {
  return safeDbOperation(async () => {
    return await db.challengeProgress
      .where('[userId+status]')
      .equals([userId, 'active'])
      .toArray();
  }, 'getActiveChallenges', []);
}

/**
 * Create new challenge progress
 */
export async function createChallengeProgress(data: Omit<ChallengeProgress, 'id' | 'createdAt' | 'updatedAt'>) {
  return safeDbOperation(async () => {
    const id = await db.challengeProgress.add({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    triggerSync();
    return id;
  }, 'createChallengeProgress');
}

/**
 * Update challenge progress
 */
export async function updateChallengeProgress(
  id: number,
  updates: Partial<ChallengeProgress>
) {
  return safeDbOperation(async () => {
    await db.challengeProgress.update(id, {
      ...updates,
      updatedAt: new Date(),
    });

    triggerSync();
  }, 'updateChallengeProgress');
}

/**
 * Get challenge progress by plan ID
 */
export async function getChallengeProgressByPlan(planId: number) {
  return safeDbOperation(async () => {
    return await db.challengeProgress
      .where('planId')
      .equals(planId)
      .first();
  }, 'getChallengeProgressByPlan', null);
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export const dbUtils = {
  // Core utilities
  initializeDatabase,
  closeDatabase,
  clearDatabase,
  resetDatabaseInstance,
  checkDatabaseHealth,
  recoverFromDatabaseError,
  validateDatabaseSchema,
  migrateDatabase,
  
  // User management
  ensureUserReady,
  getCurrentUser,
  performStartupMigration,
	  createUser,
	  getUserById,
	  updateUser,
	  updateReminderSettings,
	  getReminderSettings,
	  upsertUser,
	  completeOnboardingAtomic,
  
  getUser,
  getUsersByOnboardingStatus,
  migrateFromLocalStorage,
  cleanupUserData,

  // Cohort stats
  getCohortStats,
  getCohortPerformanceComparison,
  
  // Chat management
  createChatMessage,
  getChatMessages,

  // Adaptive coaching helpers
  getCoachingProfile,
  getBehaviorPatterns,
  recordBehaviorPattern,
  getCoachingFeedback,
  getRunsByUser,
  ensureCoachingTablesExist,
  createCoachingProfile,
  recordCoachingFeedback,
  recordCoachingInteraction,
  getCoachingInteractions,
  updateCoachingProfile,
  
  // Goal management
  createGoal,
  deleteGoal,
  updateGoal,
  getUserGoals,
  getGoalsByUser,
  getPrimaryGoal,
  setPrimaryGoal,
  getGoal,
  getGoalWithMilestones,
  getGoalMilestones,
  generateGoalMilestones,
  markMilestoneAchieved,
  getGoalProgressHistory,
  calculateGoalProgressPercentage,
  recordGoalProgress,
  getGoalRecommendations,
  getGoalRecommendationById,
  createGoalRecommendation,
  updateGoalRecommendation,
  validateSMARTGoal,
  autoCompleteGoalFields,

  // Race goal management
  getRaceGoalsByUser,
  createRaceGoal,
  updateRaceGoal,
  deleteRaceGoal,
  getRaceGoalById,
  assessFitnessLevel,
  calculateTargetPaces,

  // Pace zones & VDOT
  setReferenceRace,
  getUserPaceZones,
  recalculateVDOT,
  clearReferenceRace,

  // Plan management
  createPlan,
	  updatePlan,
	  updatePlanWithAIWorkouts,
	  getActivePlan,
	  getPlan,
	  ensureUserHasActivePlan,
  clearPlanCreationLocks,
  getPlanWithWorkouts,
  deactivateAllUserPlans,
  
  // Workout management
  createWorkout,
  updateWorkout,
  completeWorkout,
  getPlanWorkouts,
  getWorkoutsForDateRange,
  getTodaysWorkout,
  getNextWorkoutForPlan,
  markWorkoutCompleted,
  getWorkoutsByPlan,
  deleteWorkout,
  
  // Run tracking
  recordRun,
  createRun,
  upsertLocationQuality,
  getRunById,
  updateRun,
  getUserRuns,
  getRunStats,
  getUserBadges,
  calculateCurrentStreak,
  updateUserStreak,
  getStreakStats,
  normalizeDate,
  isSameDay,
  getDaysDifference,
  
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

  // Recording checkpoints
  upsertActiveRecordingSession,
  getActiveRecordingSession,
  deleteActiveRecordingSession,
  markSessionAsInterrupted,
  cleanupOldRecordingSessions,

  // Error handling
  handleDatabaseError,

  // Plan-specific error handling (backward compatibility)
  handlePlanError: handleDatabaseError,

  // UTC Migration
  migrateExistingPlansToUTC,

  // Performance Analytics
  getRunsInTimeRange,
  calculatePerformanceTrends,
  getPersonalRecords,
  getPerformanceInsights,
  getPerformanceMetrics,
  getPersonalRecordProgression,
  checkAndUpdatePersonalRecords,
  deletePersonalRecord,

  // Onboarding & Recommendation Helpers
  isOnboardingComplete,
  hasMinimalDataForRecommendations,
  getUserOnboardingStatus,

  // Challenge Management
  seedChallengeTemplates,
  getChallengeTemplate,
  getAllChallengeTemplates,
  getActiveChallenges,
  createChallengeProgress,
  updateChallengeProgress,
  getChallengeProgressByPlan,
};

export default dbUtils;
export { seedDemoRoutes } from './seedRoutes';
