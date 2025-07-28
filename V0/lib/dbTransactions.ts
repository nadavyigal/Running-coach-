/**
 * Database Transaction Management
 * 
 * Provides safe, atomic database operations with proper rollback
 * and error handling for complex multi-step operations.
 */

import { db, isDatabaseAvailable } from './db';
import { handleDatabaseError } from './errorHandler.middleware';

export interface TransactionOptions {
  timeout?: number; // Timeout in milliseconds
  retries?: number; // Number of retry attempts
  readOnly?: boolean; // Read-only transaction
}

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  rollbackPerformed?: boolean;
}

/**
 * Execute operations within a database transaction
 * 
 * Ensures atomicity - either all operations succeed or all are rolled back.
 * Includes automatic retry logic and timeout handling.
 */
export async function withTransaction<T>(
  operations: (transaction: any) => Promise<T>,
  options: TransactionOptions = {}
): Promise<TransactionResult<T>> {
  const { timeout = 30000, retries = 3, readOnly = false } = options;
  
  if (!isDatabaseAvailable() || !db) {
    return {
      success: false,
      error: handleDatabaseError(new Error('Database not available'), 'transaction')
    };
  }
  
  let attempt = 0;
  let lastError: any;
  
  while (attempt < retries) {
    attempt++;
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Transaction timeout after ${timeout}ms`)), timeout);
      });
      
      // Execute transaction with timeout
      const result = await Promise.race([
        executeTransaction(operations, readOnly),
        timeoutPromise
      ]) as T;
      
      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      lastError = error;
      console.warn(`❌ Transaction attempt ${attempt} failed:`, error);
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('timeout') || 
            error.message.includes('validation') ||
            error.message.includes('constraint')) {
          break;
        }
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return {
    success: false,
    error: handleDatabaseError(lastError, 'transaction'),
    rollbackPerformed: true
  };
}

/**
 * Execute the actual transaction
 */
async function executeTransaction<T>(
  operations: (transaction: any) => Promise<T>,
  readOnly: boolean
): Promise<T> {
  if (readOnly) {
    // For read-only operations, we don't need a full transaction
    return await operations(db);
  }
  
  // Dexie transaction
  return await db.transaction('rw', 
    [
      db.users, 
      db.plans, 
      db.workouts, 
      db.runs, 
      db.goals, 
      db.goalMilestones,
      db.chatMessages,
      db.badges,
      db.cohorts,
      db.sleepData,
      db.hrvMeasurements,
      db.recoveryScores,
      db.subjectiveWellness,
      db.dataFusionRules,
      db.fusedDataPoints,
      db.dataConflicts,
      db.dataSources
    ], 
    async (transaction) => {
      return await operations(transaction);
    }
  );
}

/**
 * Batch operations for improved performance
 */
export async function batchInsert<T>(
  table: string,
  items: T[],
  batchSize: number = 100
): Promise<TransactionResult<number[]>> {
  return withTransaction(async (tx) => {
    const results: number[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await tx[table].bulkAdd(batch);
      results.push(...batchResults);
    }
    
    return results;
  }, { timeout: 60000 }); // Longer timeout for batch operations
}

/**
 * Batch update operations
 */
export async function batchUpdate<T>(
  table: string,
  updates: Array<{ key: any; changes: Partial<T> }>,
  batchSize: number = 100
): Promise<TransactionResult<number>> {
  return withTransaction(async (tx) => {
    let updatedCount = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const result = await tx[table].update(update.key, update.changes);
        if (result) updatedCount++;
      }
    }
    
    return updatedCount;
  }, { timeout: 60000 });
}

/**
 * Safe multi-table operations
 */
export async function createUserWithDefaults(
  userData: any,
  defaultGoals: any[] = [],
  defaultPlans: any[] = []
): Promise<TransactionResult<number>> {
  return withTransaction(async (tx) => {
    // Create user first
    const userId = await tx.users.add({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create default goals if provided
    if (defaultGoals.length > 0) {
      const goalsWithUserId = defaultGoals.map(goal => ({
        ...goal,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      await tx.goals.bulkAdd(goalsWithUserId);
    }
    
    // Create default plans if provided
    if (defaultPlans.length > 0) {
      const plansWithUserId = defaultPlans.map(plan => ({
        ...plan,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      await tx.plans.bulkAdd(plansWithUserId);
    }
    
    return userId;
  });
}

/**
 * Safe goal milestone creation with progress tracking
 */
export async function createGoalWithMilestones(
  goalData: any,
  milestones: any[] = []
): Promise<TransactionResult<{ goalId: number; milestoneIds: number[] }>> {
  return withTransaction(async (tx) => {
    // Create goal
    const goalId = await tx.goals.add({
      ...goalData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create milestones
    let milestoneIds: number[] = [];
    if (milestones.length > 0) {
      const milestonesWithGoalId = milestones.map(milestone => ({
        ...milestone,
        goalId,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      milestoneIds = await tx.goalMilestones.bulkAdd(milestonesWithGoalId);
    }
    
    return { goalId, milestoneIds };
  });
}

/**
 * Safe run data creation with metrics update
 */
export async function createRunWithMetrics(
  runData: any,
  updateGoalProgress: boolean = true
): Promise<TransactionResult<number>> {
  return withTransaction(async (tx) => {
    // Create run
    const runId = await tx.runs.add({
      ...runData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update goal progress if enabled
    if (updateGoalProgress && runData.userId) {
      const activeGoals = await tx.goals
        .where('userId').equals(runData.userId)
        .and(goal => goal.status === 'active')
        .toArray();
      
      for (const goal of activeGoals) {
        // Update goal progress based on run data
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
          await tx.goals.update(goal.id!, {
            currentValue: goal.currentValue + progressUpdate,
            updatedAt: new Date()
          });
        }
      }
    }
    
    return runId;
  });
}

/**
 * Safe cohort data updates
 */
export async function updateCohortStats(
  cohortId: number,
  statsUpdate: any
): Promise<TransactionResult<boolean>> {
  return withTransaction(async (tx) => {
    // Get current cohort data
    const cohort = await tx.cohorts.get(cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }
    
    // Update stats atomically
    const updatedStats = {
      ...cohort.stats,
      ...statsUpdate,
      lastUpdated: new Date()
    };
    
    const result = await tx.cohorts.update(cohortId, {
      stats: updatedStats,
      updatedAt: new Date()
    });
    
    return result > 0;
  });
}

/**
 * Recovery data batch insertion with validation
 */
export async function createRecoveryDataBatch(
  userId: number,
  sleepData: any[] = [],
  hrvData: any[] = [],
  wellnessData: any[] = []
): Promise<TransactionResult<{ sleepIds: number[]; hrvIds: number[]; wellnessIds: number[] }>> {
  return withTransaction(async (tx) => {
    const now = new Date();
    
    // Insert sleep data
    const sleepIds = sleepData.length > 0 ? await tx.sleepData.bulkAdd(
      sleepData.map(data => ({ ...data, userId, createdAt: now, updatedAt: now }))
    ) : [];
    
    // Insert HRV data
    const hrvIds = hrvData.length > 0 ? await tx.hrvMeasurements.bulkAdd(
      hrvData.map(data => ({ ...data, userId, createdAt: now, updatedAt: now }))
    ) : [];
    
    // Insert wellness data
    const wellnessIds = wellnessData.length > 0 ? await tx.subjectiveWellness.bulkAdd(
      wellnessData.map(data => ({ ...data, userId, createdAt: now, updatedAt: now }))
    ) : [];
    
    return { sleepIds, hrvIds, wellnessIds };
  });
}

/**
 * Safe data cleanup operations
 */
export async function cleanupOldData(
  retentionDays: number = 365
): Promise<TransactionResult<number>> {
  return withTransaction(async (tx) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    
    // Clean up old chat messages
    deletedCount += await tx.chatMessages.where('createdAt').below(cutoffDate).delete();
    
    // Clean up old recovery data
    deletedCount += await tx.sleepData.where('createdAt').below(cutoffDate).delete();
    deletedCount += await tx.hrvMeasurements.where('createdAt').below(cutoffDate).delete();
    deletedCount += await tx.recoveryScores.where('createdAt').below(cutoffDate).delete();
    
    // Clean up old fused data points
    deletedCount += await tx.fusedDataPoints.where('createdAt').below(cutoffDate).delete();
    
    return deletedCount;
  }, { timeout: 120000 }); // Longer timeout for cleanup operations
}