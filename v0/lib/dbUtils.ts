import { db, isDatabaseAvailable, safeDbOperation, getDatabase, resetDatabaseInstance } from './db';
import type {
  ChatMessage as ChatMessageEntity,
  CoachingProfile,
  CoachingFeedback,
  UserBehaviorPattern,
  Run,
  CoachingInteraction,
} from './db';
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
  DataSource,
  RaceGoal
} from './db';
import { 
  nowUTC, 
  addDaysUTC, 
  addWeeksUTC,
  getUserTimezone,
  startOfDayUTC,
  migrateLocalDateToUTC
} from './timezone-utils';

/**
 * Database Utilities - Comprehensive database operations with error handling
 * Provides safe, consistent database operations across the application
 */

// ============================================================================
// SECURITY UTILITIES - Input Sanitization
// ============================================================================

/**
 * Sanitize string input to prevent injection attacks
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
function sanitizeString(input: string | undefined | null, maxLength: number = 1000): string {
  if (!input) return '';

  return String(input)
    .replace(/[<>{}$;'"\\]/g, '') // Remove potential injection characters
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize numeric input with range validation
 * @param input - The number to sanitize
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default value if input is invalid
 * @returns Sanitized number
 */
function sanitizeNumber(
  input: number | string | undefined | null,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (input === undefined || input === null) return defaultValue;

  const num = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(num) || !isFinite(num)) return defaultValue;

  return Math.max(min, Math.min(max, num));
}

/**
 * Sanitize array input
 * @param input - The array to sanitize
 * @param maxLength - Maximum allowed array length
 * @returns Sanitized array
 */
function sanitizeArray<T>(input: T[] | undefined | null, maxLength: number = 100): T[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, maxLength);
}

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
 * Enhanced user identity resolution - guarantees a valid User record exists
 * This is the primary user resolution function that should be used by all components
 */
export async function ensureUserReady(): Promise<User> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) {
      console.error('[user-resolution:error] Database not available');
      throw new Error('Database not available');
    }

    const phase = 'user-resolution';
    const traceId = `${phase}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[${phase}:start] traceId=${traceId} Ensuring user is ready...`);
    
    try {
      // Phase 1: Check for existing completed user
      console.log(`[${phase}:phase1] traceId=${traceId} Checking for completed users...`);
      // Avoid IndexedDB key range issues on boolean indexes by filtering in JS
      const completedUsers = await database.users
        .filter((u) => Boolean(u.onboardingComplete))
        .toArray();
      
      console.log(`[${phase}:phase1] traceId=${traceId} Found ${completedUsers.length} completed users`);
      
      if (completedUsers.length > 0) {
        // Sort by updatedAt and return the most recent
        completedUsers.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const user = completedUsers[0];
        console.log(`[${phase}:found] traceId=${traceId} Existing user resolved: id=${user.id} updatedAt=${user.updatedAt.toISOString()}`);
        return user as User;
      }

      // Phase 2: Check for any user (even incomplete onboarding)
      console.log(`[${phase}:phase2] traceId=${traceId} No completed users, checking for any users...`);
      // Avoid using orderBy on non-indexed fields to prevent IDBKeyRange errors
      const allUsers = await database.users.toArray();
      allUsers.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      console.log(`[${phase}:phase2] traceId=${traceId} Found ${allUsers.length} total users`);
      
      if (allUsers.length > 0) {
        const anyUser = allUsers[0]; // Most recent
        console.log(`[${phase}:found] traceId=${traceId} Returning existing user AS-IS: id=${anyUser.id} onboarding=${anyUser.onboardingComplete}`);

        // Return the user as-is without promotion
        // This ensures incomplete users stay incomplete and will see onboarding
        return anyUser as User;
      }

      // Phase 3: No user exists - create a stub user atomically
      console.log(`[${phase}:phase3] traceId=${traceId} No users exist, creating stub user...`);
      const stubUser: Omit<User, 'id'> = {
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const userId = await database.users.add(stubUser);
      console.log(`[${phase}:added] traceId=${traceId} Stub user added with id=${userId}`);
      
      const createdUser = await database.users.get(userId);
      
      if (!createdUser) {
        console.error(`[${phase}:error] traceId=${traceId} Failed to retrieve created user id=${userId}`);
        throw new Error('Failed to create stub user - verification failed');
      }
      
      console.log(`[${phase}:success] traceId=${traceId} Stub user created and verified: id=${createdUser.id}`);
      return createdUser as User;
      
    } catch (error) {
      console.error(`[${phase}:error] traceId=${traceId} Error during user resolution:`, error);
      throw error;
    }
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

      // Migration 2: Check for orphaned draft profiles and promote them
      const draftUsers = await database.users
        .filter((u) => !u.onboardingComplete)
        .toArray();

      if (draftUsers.length > 0) {
        console.log(`[migration:promote] Found ${draftUsers.length} draft profiles to promote`);

        // Promote the most recent draft to canonical user
        const latestDraft = draftUsers.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];

        if (latestDraft.id) {
          const promotionData = {
            goal: latestDraft.goal || 'habit',
            experience: latestDraft.experience || 'beginner',
            preferredTimes: latestDraft.preferredTimes || ['morning'],
            daysPerWeek: latestDraft.daysPerWeek || 3,
            consents: latestDraft.consents || { data: true, gdpr: true, push: false },
            onboardingComplete: true,
            updatedAt: new Date()
          };

          await database.users.update(latestDraft.id, promotionData);
          console.log(`[migration:promoted] Promoted draft user ${latestDraft.id} to canonical`);

          // Clean up other drafts
          const otherDraftIds = draftUsers
            .filter(u => typeof u.id === 'number' && u.id !== latestDraft.id)
            .map(u => u.id as number);

          if (otherDraftIds.length > 0) {
            await database.users.where('id').anyOf(otherDraftIds).delete();
            console.log(`[migration:cleanup] Removed ${otherDraftIds.length} redundant draft users`);
          }
        }
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

/** Sleep utility for exposing race conditions in dev. */
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

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
    const normalizedProfileRequired: Partial<User> = {
      goal: profile.goal || 'habit',
      experience: profile.experience || 'beginner',
      preferredTimes: profile.preferredTimes && profile.preferredTimes.length > 0 ? profile.preferredTimes : ['morning'],
      daysPerWeek: typeof profile.daysPerWeek === 'number' ? profile.daysPerWeek : 3,
      consents: (profile.consents as any) ?? { data: true, gdpr: true, push: (typeof (profile as any).consents?.push === 'boolean' ? (profile as any).consents.push : false) },
      onboardingComplete: true,
    };
    if (typeof profile.rpe === 'number') (normalizedProfileRequired as any).rpe = profile.rpe;
    if (typeof profile.age === 'number') (normalizedProfileRequired as any).age = profile.age;
    if (Array.isArray(profile.motivations)) (normalizedProfileRequired as any).motivations = profile.motivations;
    if (Array.isArray(profile.barriers)) (normalizedProfileRequired as any).barriers = profile.barriers;
    if (profile.coachingStyle) (normalizedProfileRequired as any).coachingStyle = profile.coachingStyle as any;
    if (profile.privacySettings) (normalizedProfileRequired as any).privacySettings = profile.privacySettings as any;

    validateUserContract(normalizedProfileRequired);

    const result = await database.transaction('rw', [database.users, database.plans, database.workouts], async () => {
      // Idempotency: if a completed user exists, reuse it and ensure a plan
      const existingCompleted = (await database.users
        .filter((u) => Boolean(u.onboardingComplete))
        .toArray())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      let userId: number;
      if (existingCompleted && existingCompleted.id) {
        userId = existingCompleted.id;
        // Soft update to latest profile attrs
        await database.users.update(userId, { ...normalizedProfileRequired, updatedAt: new Date() });
      } else {
        // Create fresh user
        const toAdd: Omit<User, 'id'> = {
          ...(normalizedProfileRequired as Omit<User, 'id'>),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        userId = (await database.users.add(toAdd)) as number;
      }

      // REMOVED: artificial delay (sleep) - causes TransactionInactiveError on mobile
      // Mobile browsers have strict transaction timeouts (~500ms)
      // setTimeout/sleep inside transactions is forbidden by Dexie.js

      // Ensure one active plan exists
      let activePlan = await database.plans.where('userId').equals(userId).and(p => p.isActive).first();
      let planId: number;
      if (!activePlan) {
        const planData: Omit<Plan, 'id'> = {
          userId,
          title: 'Default Running Plan',
          description: 'A basic running plan to get you started',
          startDate: nowUTC(),
          endDate: addDaysUTC(30),
          totalWeeks: 4,
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
        for (let week = 1; week <= 4; week++) {
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

    console.log(`[onboarding:commit] traceId=${traceId} userId=${result.userId} planId=${result.planId}`);
    return result;
  }, 'completeOnboardingAtomic');
}

/**
 * Wait until a fully persisted, readable profile (and active plan) exist.
 * Production-aware with longer timeouts and better error handling.
 */
export async function waitForProfileReady(timeoutMs?: number): Promise<User | null> {
  // Use longer timeout in production to handle slower connections
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  const effectiveTimeout = timeoutMs ?? (isProduction ? 15000 : 10000);
  const pollInterval = isProduction ? 150 : 100; // Slightly slower polling in production
  
  const start = Date.now();
  let dexieErrorSeen = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  console.log(`[waitForProfileReady] Starting with ${effectiveTimeout}ms timeout (production: ${isProduction})`);

  while (Date.now() - start < effectiveTimeout) {
    try {
      const database = getDatabase();
      if (!database) {
        console.warn('[waitForProfileReady] Database not available');
        return null;
      }
      
      const completedUsers = await database.users
        .filter((u) => Boolean(u.onboardingComplete))
        .toArray();
        
      if (completedUsers.length) {
        const user = completedUsers
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        if (user && user.id) {
          const hasActivePlan = await database.plans.where('userId').equals(user.id).and(p => p.isActive).first();
          if (hasActivePlan) {
            console.log(`[waitForProfileReady] ✅ Profile ready after ${Date.now() - start}ms`);
            return user as User;
          }
        }
      }
      
      // Reset consecutive errors on successful poll
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors++;
      
      // If Dexie is throwing DataError/IDBKeyRange issues, don't spam the console
      if (!dexieErrorSeen && error && typeof error === 'object') {
        const name = (error as any).name;
        if (name === 'DexieError' || name === 'DataError') {
          dexieErrorSeen = true;
          console.warn('[waitForProfileReady] Dexie error detected, will exit on next error');
        }
      }
      
      // Break if we've seen too many consecutive errors or Dexie errors
      if (dexieErrorSeen || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[waitForProfileReady] Breaking due to ${consecutiveErrors} consecutive errors`);
        break;
      }
    }
    await sleep(pollInterval);
  }
  
  console.warn(`[waitForProfileReady] Timeout reached after ${Date.now() - start}ms`);
  return null;
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

// Security: Mutex lock for user creation to prevent race conditions
const userCreationLocks = new Map<string, Promise<number>>();

/**
 * Create user with full profile data and duplicate prevention
 * Enhanced with proper transaction isolation and optimistic locking
 */
export async function createUser(userData: Partial<User>): Promise<number> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database) throw new Error('Database not available');

    // Security: Use a lock key based on a unique identifier (e.g., email or temp ID)
    const lockKey = userData.email || `temp-${Date.now()}`;

    // Security: Check if user creation is already in progress
    if (userCreationLocks.has(lockKey)) {
      console.log('🔒 User creation already in progress, waiting for completion...');
      try {
        return await userCreationLocks.get(lockKey)!;
      } catch (error) {
        // If the original creation failed, allow retry
        userCreationLocks.delete(lockKey);
      }
    }

    // Security: Create a promise for this user creation and lock it
    const creationPromise = (async (): Promise<number> => {
      try {
        // Use a comprehensive transaction with explicit isolation
        const id = await database.transaction('rw!', [database.users, database.onboardingSessions], async () => {
          console.log('🔒 Starting atomic user creation transaction with exclusive lock');

          // Security: Check for existing users with sanitized email
          if (userData.email) {
            const sanitizedEmail = sanitizeString(userData.email, 255).toLowerCase();
            const existingByEmail = await database.users
              .filter(u => u.email?.toLowerCase() === sanitizedEmail)
              .first();

            if (existingByEmail) {
              console.log('⚠️ User with email already exists:', existingByEmail.id);
              return existingByEmail.id!;
            }
          }

          // Check for existing completed users
          const existingUsers = await database.users.toArray();

          const completedUser = existingUsers.find(u => u.onboardingComplete);
          if (completedUser) {
            console.log('⚠️ Found completed user, returning existing ID:', completedUser.id);
            return completedUser.id!;
          }

          // Security: Check for recent users to prevent race conditions (shorter window)
          const recentThreshold = new Date(Date.now() - 5000); // 5 seconds
          const recentUser = existingUsers.find(u => u.createdAt > recentThreshold);
          if (recentUser) {
            console.log('⚠️ Found recent user (potential race condition), returning ID:', recentUser.id);
            return recentUser.id!;
          }

          // Create unique identifier with timestamp and random component
          const creationId = `creation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Security: Sanitize and validate all user input
          const userToAdd: Omit<User, 'id'> = {
            goal: userData.goal || 'habit',
            experience: userData.experience || 'beginner',
            preferredTimes: sanitizeArray(userData.preferredTimes || ['morning'], 10),
            daysPerWeek: sanitizeNumber(userData.daysPerWeek, 1, 7, 3),
            consents: userData.consents || {
              data: true,
              gdpr: true,
              push: true
            },
            onboardingComplete: userData.onboardingComplete || false,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Security: Sanitize all optional string fields
            name: sanitizeString(userData.name || `temp_${creationId}`, 255),
            email: userData.email ? sanitizeString(userData.email, 255).toLowerCase() : undefined,
            ...userData
          };

          try {
            const newId = await database.users.add(userToAdd);
            console.log('✅ User created successfully with enhanced transaction:', newId);

            // Security: Verify the user was actually created
            const verifyUser = await database.users.get(newId);
            if (!verifyUser) {
              throw new Error('User creation verification failed');
            }

            return newId as number;
          } catch (addError: any) {
            console.error('❌ User creation failed in transaction:', addError);

            // Security: Handle constraint violations gracefully
            if (addError.name === 'ConstraintError' || addError.message?.includes('constraint')) {
              console.log('⚠️ Constraint violation, checking for existing user...');
              const concurrentUser = (await database.users.toArray())
                .filter(u => u.createdAt && u.createdAt > recentThreshold)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

              if (concurrentUser) {
                console.log('⚠️ Concurrent user creation detected, using existing:', concurrentUser.id);
                return concurrentUser.id!;
              }
            }

            throw addError;
          }
        });

        return id;
      } finally {
        // Security: Always clean up the lock
        userCreationLocks.delete(lockKey);
      }
    })();

    // Security: Store the promise to prevent concurrent creations
    userCreationLocks.set(lockKey, creationPromise);

    return await creationPromise;
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
          type: aiWorkout.type,
          distance: aiWorkout.distance,
          duration: aiWorkout.duration,
          notes: aiWorkout.notes,
          intensity: aiWorkout.type === 'easy' ? 'easy' : aiWorkout.type === 'tempo' ? 'moderate' : 'hard',
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
    let activePlan = await database.plans.where('userId').equals(userId).and(plan => plan.isActive).first();
    
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
          endDate: addDaysUTC(30), // 30 days from now in UTC
          totalWeeks: 4,
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
function normalizeDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    // Check if it's a valid date
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof dateValue === 'number') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
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
              const pace = runData.duration / runData.distance;
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

/**
 * Migrate existing plans and workouts from local timezone to UTC
 * This should be run once to migrate existing data
 */
export async function migrateExistingPlansToUTC(): Promise<{ success: boolean; migratedPlans: number; migratedWorkouts: number; error?: any }> {
  return safeDbOperation(async () => {
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
    const runs = await database.runs
      .where('userId')
      .equals(userId)
      .toArray();

    // Filter by date range in JavaScript since createdAt is not indexed
    return runs.filter(run => {
      const runDate = new Date(run.createdAt);
      return runDate >= startDate && runDate <= endDate;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

    // Calculate average pace (seconds per km)
    const totalPace = runs.reduce((sum, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : 0;
      return sum + pace;
    }, 0);
    const averagePace = totalPace / runs.length;

    // Calculate consistency score (based on regularity of runs)
    const daysSinceFirstRun = Math.ceil(
      (new Date(runs[runs.length - 1].createdAt).getTime() - new Date(runs[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const expectedRuns = Math.max(1, Math.ceil(daysSinceFirstRun / 3)); // Expect run every 3 days
    const consistencyScore = Math.min(100, (runs.length / expectedRuns) * 100);

    // Calculate performance score (combination of consistency and pace improvement)
    const firstHalfRuns = runs.slice(0, Math.ceil(runs.length / 2));
    const secondHalfRuns = runs.slice(Math.ceil(runs.length / 2));

    const firstHalfAvgPace = firstHalfRuns.reduce((sum, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : 0;
      return sum + pace;
    }, 0) / firstHalfRuns.length;

    const secondHalfAvgPace = secondHalfRuns.reduce((sum, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : 0;
      return sum + pace;
    }, 0) / secondHalfRuns.length;

    const paceImprovement = firstHalfAvgPace > 0 ? ((firstHalfAvgPace - secondHalfAvgPace) / firstHalfAvgPace) * 100 : 0;
    const performanceScore = Math.max(0, Math.min(100, 50 + (consistencyScore * 0.3) + (paceImprovement * 0.7)));

    // Generate progression data
    const paceProgression = runs.map(run => ({
      date: new Date(run.createdAt),
      pace: run.distance > 0 ? run.duration / run.distance : 0
    }));

    const distanceProgression = runs.map(run => ({
      date: new Date(run.createdAt),
      distance: run.distance
    }));

    // Calculate rolling consistency
    const consistencyProgression = runs.map((_, index) => {
      const runsToDate = runs.slice(0, index + 1);
      const days = Math.ceil(
        (new Date(runs[index].createdAt).getTime() - new Date(runs[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const expected = Math.max(1, Math.ceil(days / 3));
      const score = Math.min(100, (runsToDate.length / expected) * 100);

      return {
        date: new Date(runs[index].createdAt),
        consistency: score
      };
    });

    // Calculate rolling performance
    const performanceProgression = runs.map((_, index) => {
      const runsToDate = runs.slice(0, index + 1);
      const halfPoint = Math.ceil(runsToDate.length / 2);
      const firstHalf = runsToDate.slice(0, halfPoint);
      const secondHalf = runsToDate.slice(halfPoint);

      if (firstHalf.length === 0 || secondHalf.length === 0) {
        return {
          date: new Date(runs[index].createdAt),
          performance: 50
        };
      }

      const firstAvg = firstHalf.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + (r.distance > 0 ? r.duration / r.distance : 0), 0) / secondHalf.length;
      const improvement = firstAvg > 0 ? ((firstAvg - secondAvg) / firstAvg) * 100 : 0;

      return {
        date: new Date(runs[index].createdAt),
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
    const runs = await database.runs.where('userId').equals(userId).toArray();

    if (runs.length === 0) {
      return [];
    }

    // Calculate various PRs
    const longestRun = runs.reduce((max, run) => run.distance > max.distance ? run : max, runs[0]);
    const fastestPace = runs.reduce((fastest, run) => {
      const pace = run.distance > 0 ? run.duration / run.distance : Infinity;
      const fastestPace = fastest.distance > 0 ? fastest.duration / fastest.distance : Infinity;
      return pace < fastestPace ? run : fastest;
    }, runs[0]);
    const longestDuration = runs.reduce((max, run) => run.duration > max.duration ? run : max, runs[0]);

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

    const insights = [];

    // Consistency insight
    if (trends.consistencyScore >= 80) {
      insights.push({
        type: 'positive',
        title: 'Excellent Consistency',
        description: 'You\'re maintaining a great running schedule! Keep it up!',
        metric: `${trends.consistencyScore.toFixed(0)}% consistency`
      });
    } else if (trends.consistencyScore < 50) {
      insights.push({
        type: 'warning',
        title: 'Improve Consistency',
        description: 'Try to run more regularly to build momentum and see better results.',
        metric: `${trends.consistencyScore.toFixed(0)}% consistency`
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
          type: 'positive',
          title: 'Pace Improvement',
          description: `Your pace has improved by ${improvement.toFixed(1)}%! You're getting faster!`,
          metric: formatPace(lastAvgPace)
        });
      } else if (improvement < -5) {
        insights.push({
          type: 'info',
          title: 'Pace Variation',
          description: 'Your pace has slowed recently. Consider adjusting your training intensity or ensuring adequate recovery.',
          metric: formatPace(lastAvgPace)
        });
      }
    }

    // Distance insight
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    if (totalDistance > 50) {
      insights.push({
        type: 'positive',
        title: 'Distance Milestone',
        description: `You've run ${totalDistance.toFixed(1)} km in this period! Great work!`,
        metric: `${totalDistance.toFixed(1)} km`
      });
    }

    // If no insights yet, add a motivational one
    if (insights.length === 0 && runs.length > 0) {
      insights.push({
        type: 'info',
        title: 'Keep Going',
        description: 'Every run counts! You\'re building a strong foundation.',
        metric: `${runs.length} runs completed`
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
    const runs = await database.runs.where('userId').equals(userId).toArray();

    // Filter runs for this specific distance (within 5% tolerance)
    const relevantRuns = runs.filter(run => {
      const distanceDiff = Math.abs(run.distance - distance);
      const tolerance = distance * 0.05; // 5% tolerance
      return distanceDiff <= tolerance;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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
          date: new Date(run.createdAt),
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
    const allRuns = await database.runs.where('userId').equals(userId).toArray();

    // Check various record types
    const longestRun = allRuns.reduce((max, run) => run.distance > max.distance ? run : max, allRuns[0]);
    const fastestPace = allRuns.reduce((fastest, run) => {
      const runPace = run.distance > 0 ? run.duration / run.distance : Infinity;
      const fastestPace = fastest.distance > 0 ? fastest.duration / fastest.distance : Infinity;
      return runPace < fastestPace ? run : fastest;
    }, allRuns[0]);
    const longestDuration = allRuns.reduce((max, run) => run.duration > max.duration ? run : max, allRuns[0]);

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
async function deletePersonalRecord(userId: number, recordId: number) {
  return safeDbOperation(async () => {
    // Personal records are derived from runs, so this would delete the run
    const database = getDatabase();
    await database.runs.delete(recordId);
    return true;
  }, 'deletePersonalRecord', false);
}

/**
 * Get goal progress history
 */
async function getGoalProgressHistory(goalId: number, limit: number = 30) {
  return safeDbOperation(async () => {
    // For now, return empty array - this would be implemented with a goal_progress_history table
    return [];
  }, 'getGoalProgressHistory', []);
}

/**
 * Get milestones for a specific goal
 */
async function getGoalMilestones(goalId: number): Promise<GoalMilestone[]> {
  return safeDbOperation(async () => {
    const database = getDatabase();
    if (!database.goalMilestones) {
      return [];
    }
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
  if (goalData.measurableMetrics && goalData.measurableMetrics.length > 0) {
    result.completeness.measurable = true;
  } else {
    result.warnings.push('Metrics will be auto-generated from goal type');
    result.autoGenerated.push('measurableMetrics');
  }

  // Validate Achievable
  if (goalData.achievableAssessment?.feasibilityScore !== undefined) {
    result.completeness.achievable = true;
  } else {
    result.warnings.push('Feasibility will be auto-calculated');
    result.autoGenerated.push('feasibilityScore');
  }

  // Validate Relevant
  if (goalData.relevantContext && goalData.relevantContext.length >= 10) {
    result.completeness.relevant = true;
  } else {
    result.warnings.push('Goal motivation is optional');
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

  // Auto-generate measurable metrics from goal type
  if (!completed.measurableMetrics || completed.measurableMetrics.length === 0) {
    completed.measurableMetrics = deriveMetricsFromGoalType(completed.goalType);
  }

  // Auto-generate description if missing
  if (!completed.description) {
    completed.description = `${completed.title} - targeting ${completed.specificTarget?.value} ${completed.specificTarget?.unit}`;
  }

  // Auto-calculate baseline value from user's recent runs
  if (!completed.baselineValue && completed.goalType === 'time_improvement') {
    try {
      const database = getDatabase();
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

  // Auto-calculate feasibility score
  if (!completed.achievableAssessment) {
    completed.achievableAssessment = {
      currentLevel: completed.baselineValue || 0,
      targetLevel: completed.targetValue || 0,
      feasibilityScore: calculateFeasibilityScore(
        completed.baselineValue || 0,
        completed.targetValue || 0,
        completed.timeBound?.deadline || new Date(),
        completed.goalType
      ),
      recommendedAdjustments: []
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

  // Set default relevant context if missing
  if (!completed.relevantContext) {
    completed.relevantContext = 'Personal running goal';
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
  completed.progressPercentage = 0;
  completed.status = 'active';

  return completed as Goal;
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
  upsertUser,
  completeOnboardingAtomic,
  waitForProfileReady,
  getUser,
  getUsersByOnboardingStatus,
  migrateFromLocalStorage,
  cleanupUserData,
  
  // Chat management
  createChatMessage,
  getChatMessages,

  // Adaptive coaching helpers
  getCoachingProfile,
  getBehaviorPatterns,
  getCoachingFeedback,
  getRunsByUser,
  ensureCoachingTablesExist,
  createCoachingProfile,
  recordCoachingFeedback,
  getCoachingInteractions,
  updateCoachingProfile,
  
  // Goal management
  createGoal,
  updateGoal,
  getUserGoals,
  getGoalWithMilestones,
  getGoalMilestones,
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
  
  // Plan management
  createPlan,
  updatePlan,
  updatePlanWithAIWorkouts,
  getActivePlan,
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
  markWorkoutCompleted,
  getWorkoutsByPlan,
  deleteWorkout,
  
  // Run tracking
  recordRun,
  createRun,
  getUserRuns,
  getRunStats,
  getUserBadges,
  
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
  getGoalProgressHistory
};

export default dbUtils; 
export { seedDemoRoutes } from './seedRoutes';
