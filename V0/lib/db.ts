import Dexie, { type EntityTable } from 'dexie';

// User preferences and profile
export interface User {
  id?: number;
  name?: string;
  goal: 'habit' | 'distance' | 'speed';
  experience: 'beginner' | 'intermediate' | 'advanced';
  preferredTimes: string[];
  daysPerWeek: number;
  consents: {
    data: boolean;
    gdpr: boolean;
    push: boolean;
  };
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  rpe?: number; // Optional Rate of Perceived Exertion
  // Streak tracking fields
  currentStreak?: number; // Current consecutive days of activity
  longestStreak?: number; // All-time best streak
  lastActivityDate?: Date | null; // Last day with recorded activity
  streakLastUpdated?: Date | null; // Timestamp of last streak calculation
  // Habit reminder fields
  reminderTime?: string | null; // HH:mm format
  reminderEnabled?: boolean;
  reminderSnoozedUntil?: Date | null;
  cohortId?: number | null; // New field for cohort association
}

// Cohort interface
export interface Cohort {
  id?: number;
  name: string;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cohort Member interface (for many-to-many if needed, or direct user-cohort link)
export interface CohortMember {
  id?: number;
  userId: number;
  cohortId: number;
  joinDate: Date;
}

// Performance Analytics interfaces
export interface PerformanceMetrics {
  id?: number;
  userId: number;
  date: Date;
  averagePace: number; // seconds per km
  totalDistance: number; // km
  totalDuration: number; // seconds
  consistencyScore: number; // 0-100
  performanceScore: number; // 0-100
  trainingLoad: number; // calculated load
  recoveryScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalRecord {
  id?: number;
  userId: number;
  recordType: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_run' | 'best_pace' | 'most_consistent_week';
  value: number; // time in seconds or distance in km
  achievedAt: Date;
  runId?: number; // reference to the run that achieved this record
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceInsight {
  id?: number;
  userId: number;
  type: 'improvement' | 'trend' | 'warning' | 'achievement' | 'recommendation';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  data?: any; // JSON data for charts/visualizations
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Race goal interface for advanced plan customization
export interface RaceGoal {
  id?: number;
  userId: number;
  raceName: string;
  raceDate: Date;
  distance: number; // in kilometers
  targetTime?: number; // in seconds
  priority: 'A' | 'B' | 'C'; // A = primary, B = secondary, C = tune-up
  location?: string;
  raceType: 'road' | 'trail' | 'track' | 'virtual';
  elevationGain?: number; // meters
  courseDifficulty?: 'easy' | 'moderate' | 'hard';
  registrationStatus?: 'registered' | 'planned' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workout template for specialized training
export interface WorkoutTemplate {
  id?: number;
  name: string;
  workoutType: 'easy' | 'tempo' | 'intervals' | 'long' | 'race-pace' | 'recovery' | 'time-trial' | 'hill' | 'fartlek';
  trainingPhase: 'base' | 'build' | 'peak' | 'taper';
  intensityZone: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  structure: any; // JSON structure for workout details
  description: string;
  coachingNotes?: string;
  createdAt: Date;
}

// Periodization phase structure
export interface PeriodizationPhase {
  phase: 'base' | 'build' | 'peak' | 'taper';
  duration: number; // weeks
  weeklyVolumePercentage: number; // percentage of peak volume
  intensityDistribution: {
    easy: number; // percentage
    moderate: number; // percentage
    hard: number; // percentage
  };
  keyWorkouts: string[]; // workout types for this phase
  focus: string; // phase description
}

// Enhanced training plan structure with periodization
export interface Plan {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  isActive: boolean;
  planType: 'basic' | 'advanced' | 'periodized';
  raceGoalId?: number; // Link to race goal
  periodization?: PeriodizationPhase[]; // Periodization phases
  targetDistance?: number; // kilometers
  targetTime?: number; // seconds
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek?: number;
  peakWeeklyVolume?: number; // kilometers
  createdAt: Date;
  updatedAt: Date;
}

// Individual workout in a plan
export interface Workout {
  id?: number;
  planId: number;
  week: number;
  day: string; // 'Mon', 'Tue', etc.
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest' | 'race-pace' | 'recovery' | 'fartlek';
  distance: number; // in km
  duration?: number; // in minutes
  pace?: number; // target pace in seconds per km
  intensity?: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  trainingPhase?: 'base' | 'build' | 'peak' | 'taper';
  workoutStructure?: any; // JSON structure for complex workouts
  notes?: string;
  completed: boolean;
  scheduledDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Completed runs/activities
export interface Run {
  id?: number;
  workoutId?: number; // Optional link to planned workout
  userId: number;
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'other';
  distance: number; // in km
  duration: number; // in seconds
  pace?: number; // in seconds per km
  heartRate?: number;
  calories?: number;
  notes?: string;
  route?: string;
  gpsPath?: string; // JSON string of GPS coordinates
  shoeId?: number;
  completedAt: Date;
  createdAt: Date;
}

// Running shoes tracking
export interface Shoe {
  id?: number;
  userId: number;
  name: string;
  brand: string;
  model: string;
  initialKm: number;
  currentKm: number;
  maxKm: number;
  startDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Chat messages for AI coach conversations
export interface ChatMessage {
  id?: number;
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  conversationId?: string;
}

// Badge interface
export interface Badge {
  id?: number;
  userId: number;
  type: 'bronze' | 'silver' | 'gold';
  milestone: number; // 3, 7, 30
  unlockedAt: Date;
  streakValueAchieved: number;
}

// Database class
export class RunSmartDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  runs!: EntityTable<Run, 'id'>;
  shoes!: EntityTable<Shoe, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;
  badges!: EntityTable<Badge, 'id'>;
  cohorts!: EntityTable<Cohort, 'id'>;
  cohortMembers!: EntityTable<CohortMember, 'id'>;
  performanceMetrics!: EntityTable<PerformanceMetrics, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  performanceInsights!: EntityTable<PerformanceInsight, 'id'>;
  raceGoals!: EntityTable<RaceGoal, 'id'>;
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>;

  constructor() {
    super('RunSmartDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
    });

    // Version 2: Add streak tracking fields and indexes
    this.version(2).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
    }).upgrade(async tx => {
      // Migrate existing users to have streak fields with default values
      await tx.table('users').toCollection().modify(user => {
        user.currentStreak = 0;
        user.longestStreak = 0;
        user.lastActivityDate = null;
        user.streakLastUpdated = new Date();
      });
    });

    // Version 3: Add badges table
    this.version(3).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
    }).upgrade(async tx => {
      // No migration needed for badges (new table)
    });

    // Version 4: Habit reminder fields
    this.version(4).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
    }).upgrade(async tx => {
      await tx.table('users').toCollection().modify(user => {
        if (user.reminderEnabled === undefined) user.reminderEnabled = false;
        if (user.reminderTime === undefined) user.reminderTime = null;
        user.reminderSnoozedUntil = null;
      });
    });

    // Version 5: Add Cohort and CohortMember tables
    this.version(5).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
    }).upgrade(async tx => {
      await tx.table('users').toCollection().modify(user => {
        user.cohortId = null;
      });
    });

    // Version 6: Add Performance Analytics tables
    this.version(6).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
      performanceMetrics: '++id, userId, date, createdAt',
      personalRecords: '++id, userId, recordType, achievedAt, createdAt',
      performanceInsights: '++id, userId, type, priority, createdAt, validUntil',
    }).upgrade(async tx => {
      // No migration needed for new tables
    });

    // Version 7: Add RaceGoal and WorkoutTemplate tables for advanced plan customization
    this.version(7).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt, currentStreak, longestStreak, lastActivityDate, reminderTime, reminderEnabled, cohortId',
      plans: '++id, userId, isActive, startDate, endDate, createdAt, planType, raceGoalId',
      workouts: '++id, planId, week, day, completed, scheduledDate, createdAt, type, trainingPhase',
      runs: '++id, workoutId, userId, type, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt',
      chatMessages: '++id, userId, role, timestamp, conversationId',
      badges: '++id, userId, type, milestone, unlockedAt',
      cohorts: '++id, inviteCode, name',
      cohortMembers: '++id, userId, cohortId, [userId+cohortId]',
      performanceMetrics: '++id, userId, date, createdAt',
      personalRecords: '++id, userId, recordType, achievedAt, createdAt',
      performanceInsights: '++id, userId, type, priority, createdAt, validUntil',
      raceGoals: '++id, userId, raceDate, priority, createdAt',
      workoutTemplates: '++id, workoutType, trainingPhase, intensityZone, createdAt',
    }).upgrade(async tx => {
      // Migrate existing plans to add planType
      await tx.table('plans').toCollection().modify(plan => {
        plan.planType = 'basic';
      });
    });
  }
}

// Create database instance
export const db = new RunSmartDB();

// Database utilities
export const badgeMilestones = [3, 7, 30];
export const badgeTypes: { [key: number]: 'bronze' | 'silver' | 'gold' } = {
  3: 'bronze',
  7: 'silver',
  30: 'gold',
};

export const dbUtils = {
  // User operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    console.log("Creating user with data:", userData); // Added for debugging
    const now = new Date();
    return await db.users.add({
      ...userData,
      createdAt: now,
      updatedAt: now,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      streakLastUpdated: null,
      reminderTime: null,
      reminderEnabled: false,
      reminderSnoozedUntil: null,
      cohortId: null,
    });
  },

  async getCurrentUser(): Promise<User | undefined> {
    // Return the most recently created user
    return await db.users.orderBy('createdAt').last();
  },

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db.users.update(id, { ...updates, updatedAt: new Date() });
  },

  async getReminderSettings(userId: number): Promise<{ time?: string; enabled: boolean; snoozedUntil?: Date | null }> {
    const user = await db.users.get(userId);
    return {
      time: user?.reminderTime || undefined,
      enabled: user?.reminderEnabled ?? false,
      snoozedUntil: user?.reminderSnoozedUntil ?? null,
    };
  },

  async updateReminderSettings(userId: number, settings: Partial<User>): Promise<void> {
    await dbUtils.updateUser(userId, settings);
  },

  // Plan operations
  async createPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.plans.add({
      ...planData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getActivePlan(userId: number): Promise<Plan | undefined> {
    return await db.plans.where({ userId, isActive: true }).first();
  },

  async updatePlan(id: number, updates: Partial<Plan>): Promise<void> {
    await db.plans.update(id, { ...updates, updatedAt: new Date() });
  },

  // Workout operations
  async createWorkout(workoutData: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.workouts.add({
      ...workoutData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getWorkoutsByPlan(planId: number): Promise<Workout[]> {
    return await db.workouts.where('planId').equals(planId).toArray();
  },

  async getTodaysWorkout(userId: number): Promise<Workout | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activePlan = await this.getActivePlan(userId);
    if (!activePlan) return undefined;

    return await db.workouts
      .where('planId')
      .equals(activePlan.id!)
      .and(workout => 
        workout.scheduledDate >= today && 
        workout.scheduledDate < tomorrow
      )
      .first();
  },

  // Get workouts for a date range
  async getWorkoutsForDateRange(userId: number, startDate: Date, endDate: Date): Promise<Workout[]> {
    const activePlan = await this.getActivePlan(userId);
    if (!activePlan) return [];
    
    return await db.workouts
      .where('planId')
      .equals(activePlan.id!)
      .filter(workout => workout.scheduledDate >= startDate && workout.scheduledDate <= endDate)
      .toArray();
  },

  async updateWorkout(id: number, updates: Partial<Workout>): Promise<void> {
    await db.workouts.update(id, { ...updates, updatedAt: new Date() });
  },

  async markWorkoutCompleted(workoutId: number): Promise<void> {
    await this.updateWorkout(workoutId, { completed: true });
    
    // Update streak for the user after completing workout
    const workout = await db.workouts.get(workoutId);
    if (workout) {
      const plan = await db.plans.get(workout.planId);
      if (plan) {
        await this.updateUserStreak(plan.userId);
      }
    }
  },

  // Run operations
  async createRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
    const runId = await db.runs.add({
      ...runData,
      createdAt: new Date()
    });

    // Update user streak after recording activity
    await this.updateUserStreak(runData.userId);

    return runId;
  },

  async getRunsByUser(userId: number): Promise<Run[]> {
    return await db.runs.where('userId').equals(userId).reverse().toArray();
  },

  async getRunStats(userId: number): Promise<{
    totalRuns: number;
    totalDistance: number;
    totalTime: number;
    avgPace: number;
    currentStreak: number;
  }> {
    const runs = await this.getRunsByUser(userId);
    
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
    const totalTime = runs.reduce((sum, run) => sum + run.duration, 0);
    const avgPace = totalDistance > 0 ? totalTime / totalDistance : 0;
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < runs.length; i++) {
      const runDate = new Date(runs[i].completedAt);
      runDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === i) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalRuns,
      totalDistance,
      totalTime,
      avgPace,
      currentStreak
    };
  },

  // Shoe operations
  async createShoe(shoeData: Omit<Shoe, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.shoes.add({
      ...shoeData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getActiveShoes(userId: number): Promise<Shoe[]> {
    return await db.shoes.where({ userId, isActive: true }).toArray();
  },

  async updateShoe(id: number, updates: Partial<Shoe>): Promise<void> {
    await db.shoes.update(id, { ...updates, updatedAt: new Date() });
  },

  async addMileageToShoe(shoeId: number, distance: number): Promise<void> {
    await db.shoes.update(shoeId, {
      currentKm: (await db.shoes.get(shoeId))!.currentKm + distance,
      updatedAt: new Date(),
    });
  },

  // Chat message operations
  async createChatMessage(messageData: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<number> {
    return await db.chatMessages.add({
      ...messageData,
      timestamp: new Date(),
    });
  },

  async getChatMessages(userId: number, conversationId?: string): Promise<ChatMessage[]> {
    let collection = db.chatMessages.where('userId').equals(userId);
    if (conversationId) {
      collection = collection.and(msg => msg.conversationId === conversationId);
    }
    return await collection.orderBy('timestamp').toArray();
  },

  async getRecentChatMessages(userId: number, limit: number = 50): Promise<ChatMessage[]> {
    return await db.chatMessages
      .where('userId')
      .equals(userId)
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  },

  async deleteChatHistory(userId: number, conversationId?: string): Promise<void> {
    let collection = db.chatMessages.where('userId').equals(userId);
    if (conversationId) {
      collection = collection.and(msg => msg.conversationId === conversationId);
    }
    await collection.delete();
  },

  // Streak calculation utilities
  async calculateCurrentStreak(userId: number): Promise<number> {
    const runs = await db.runs
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('completedAt');

    if (!runs.length) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from today and work backwards
    let checkDate = new Date(today);
    
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) { // Limit to 1 year lookback
      const dayStart = new Date(checkDate);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Check if there's a run on this day
      const runOnDay = runs.find(run => {
        const runDate = new Date(run.completedAt);
        return runDate >= dayStart && runDate <= dayEnd;
      });

      if (runOnDay) {
        streak++;
      } else {
        // No run on this day
        if (dayOffset === 0) {
          // Today - check if within grace period (24 hours from yesterday)
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          
          const lastRun = runs[0];
          const lastRunDate = new Date(lastRun.completedAt);
          
          if (lastRunDate >= yesterday) {
            // Within grace period, continue checking
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        // Streak broken
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  },

  async updateUserStreak(userId: number): Promise<void> {
    try {
      const user = await db.users.get(userId);
      if (!user) return;

      const currentStreak = await this.calculateCurrentStreak(userId);
      const longestStreak = Math.max(currentStreak, user.longestStreak || 0);
      
      // Get last activity date
      const lastRun = await db.runs
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('completedAt')
        .then(runs => runs[0]);

      const lastActivityDate = lastRun ? new Date(lastRun.completedAt) : undefined;

      await this.updateUser(userId, {
        currentStreak,
        longestStreak,
        lastActivityDate,
        streakLastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error updating user streak:', error);
    }
    // After updating streak, check for badge unlocks
    const unlocked = await dbUtils.checkAndUnlockBadges(userId);
    // Optionally: trigger notification callback here (handled in UI)
  },

  async getStreakStats(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date | null;
    streakLastUpdated: Date | null;
  }> {
    const user = await db.users.get(userId);
    if (!user) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        streakLastUpdated: null
      };
    }

    return {
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      lastActivityDate: user.lastActivityDate || null,
      streakLastUpdated: user.streakLastUpdated || null
    };
  },

  // Timezone-aware date utilities
  normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  },

  isSameDay(date1: Date, date2: Date): boolean {
    return this.normalizeDate(date1).getTime() === this.normalizeDate(date2).getTime();
  },

  getDaysDifference(date1: Date, date2: Date): number {
    const normalizedDate1 = this.normalizeDate(date1);
    const normalizedDate2 = this.normalizeDate(date2);
    return Math.floor((normalizedDate1.getTime() - normalizedDate2.getTime()) / (1000 * 60 * 60 * 24));
  },

  // Migration utilities
  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Check if we already have data
      const existingUser = await this.getCurrentUser();
      if (existingUser) return;

      // Migrate onboarding data
      const onboardingComplete = localStorage.getItem('onboarding-complete');
      if (onboardingComplete) {
        // Create a default user since we don't have the original onboarding data
        await this.createUser({
          goal: 'habit',
          experience: 'beginner',
          preferredTimes: ['morning'],
          daysPerWeek: 3,
          consents: {
            data: true,
            gdpr: true,
            push: false
          },
          onboardingComplete: true
        });
      }

      // Migrate shoes data
      const shoesData = localStorage.getItem('running-shoes');
      if (shoesData) {
        const shoes = JSON.parse(shoesData);
        const user = await this.getCurrentUser();
        if (user) {
          for (const shoe of shoes) {
            await this.createShoe({
              userId: user.id!,
              name: shoe.name,
              brand: shoe.brand,
              model: shoe.model,
              initialKm: shoe.initialKm,
              currentKm: shoe.currentKm,
              maxKm: shoe.maxKm,
              startDate: new Date(shoe.startDate),
              isActive: true
            });
          }
        }
      }

      console.log('Migration from localStorage completed');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  },

  // Badge utility functions
  async checkAndUnlockBadges(userId: number): Promise<Badge[]> {
    const user = await db.users.get(userId);
    if (!user || !user.currentStreak) return [];
    const unlocked: Badge[] = [];
    for (const milestone of badgeMilestones) {
      if (user.currentStreak >= milestone) {
        const type = badgeTypes[milestone];
        const existing = await db.badges.where({ userId, milestone }).first();
        if (!existing) {
          const badge: Badge = {
            userId,
            type,
            milestone,
            unlockedAt: new Date(),
            streakValueAchieved: user.currentStreak,
          };
          const id = await db.badges.add(badge);
          unlocked.push({ ...badge, id });
        }
      }
    }
    return unlocked;
  },
  async getUserBadges(userId: number): Promise<Badge[]> {
    return await db.badges.where({ userId }).sortBy('milestone');
  },
  async unlockBadge(userId: number, milestone: number): Promise<Badge | undefined> {
    const user = await db.users.get(userId);
    if (!user) return undefined;
    const type = badgeTypes[milestone];
    const existing = await db.badges.where({ userId, milestone }).first();
    if (existing) return existing;
    const badge: Badge = {
      userId,
      type,
      milestone,
      unlockedAt: new Date(),
      streakValueAchieved: user.currentStreak || milestone,
    };
    const id = await db.badges.add(badge);
    return { ...badge, id };
  },

  // Cohort operations
  async getUserById(userId: number): Promise<User | undefined> {
    return await db.users.get(userId);
  },

  async getCohortStats(cohortId: number): Promise<{
    totalMembers: number;
    activeMembers: number;
    totalRuns: number;
    totalDistance: number;
    avgDistance: number;
    weeklyRuns: number;
    weeklyDistance: number;
    cohortName: string;
  }> {
    // Get cohort information
    const cohort = await db.cohorts.get(cohortId);
    if (!cohort) {
      throw new Error('Cohort not found');
    }

    // Get all cohort members
    const members = await db.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map(m => m.userId);

    // Get all runs from cohort members
    const allRuns = await db.runs.where('userId').anyOf(memberIds).toArray();
    
    // Calculate active members (members who have run in the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRuns = allRuns.filter(run => new Date(run.completedAt) >= sevenDaysAgo);
    const activeMemberIds = new Set(recentRuns.map(run => run.userId));

    // Calculate weekly stats
    const weeklyRuns = recentRuns.length;
    const weeklyDistance = recentRuns.reduce((total, run) => total + run.distance, 0);

    // Calculate total stats
    const totalRuns = allRuns.length;
    const totalDistance = allRuns.reduce((total, run) => total + run.distance, 0);
    const avgDistance = totalRuns > 0 ? totalDistance / totalRuns : 0;

    return {
      totalMembers: members.length,
      activeMembers: activeMemberIds.size,
      totalRuns,
      totalDistance,
      avgDistance,
      weeklyRuns,
      weeklyDistance,
      cohortName: cohort.name,
    };
  },

  // Performance Analytics operations
  async calculatePerformanceMetrics(userId: number, date: Date): Promise<PerformanceMetrics> {
    const runs = await db.runs.where('userId').equals(userId).toArray();
    const dateString = date.toISOString().split('T')[0];
    const dayRuns = runs.filter(run => 
      new Date(run.completedAt).toISOString().split('T')[0] === dateString
    );

    if (dayRuns.length === 0) {
      return {
        userId,
        date,
        averagePace: 0,
        totalDistance: 0,
        totalDuration: 0,
        consistencyScore: 0,
        performanceScore: 0,
        trainingLoad: 0,
        recoveryScore: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const totalDistance = dayRuns.reduce((sum, run) => sum + run.distance, 0);
    const totalDuration = dayRuns.reduce((sum, run) => sum + run.duration, 0);
    const averagePace = totalDistance > 0 ? totalDuration / totalDistance : 0;

    // Calculate consistency score (0-100) based on pace variation
    const paces = dayRuns.map(run => run.pace).filter(pace => pace > 0);
    const avgPace = paces.length > 0 ? paces.reduce((sum, pace) => sum + pace, 0) / paces.length : 0;
    const paceVariance = paces.length > 1 ? 
      paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length : 0;
    const consistencyScore = Math.max(0, 100 - (paceVariance / avgPace * 100));

    // Calculate performance score based on improvement trends
    const last7Days = new Date(date);
    last7Days.setDate(last7Days.getDate() - 7);
    const recentRuns = runs.filter(run => new Date(run.completedAt) >= last7Days);
    const recentAvgPace = recentRuns.length > 0 ? 
      recentRuns.reduce((sum, run) => sum + run.pace, 0) / recentRuns.length : averagePace;
    const performanceScore = Math.min(100, Math.max(0, 100 - (averagePace - recentAvgPace) * 10));

    // Calculate training load (simple formula based on distance and duration)
    const trainingLoad = totalDistance * 10 + totalDuration / 60;

    // Calculate recovery score (decreases with higher training load)
    const recoveryScore = Math.max(0, 100 - trainingLoad * 0.5);

    return {
      userId,
      date,
      averagePace,
      totalDistance,
      totalDuration,
      consistencyScore,
      performanceScore,
      trainingLoad,
      recoveryScore,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async savePerformanceMetrics(metrics: Omit<PerformanceMetrics, 'id'>): Promise<number> {
    return await db.performanceMetrics.add(metrics);
  },

  async getPerformanceMetrics(userId: number, startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    return await db.performanceMetrics
      .where('userId').equals(userId)
      .and(metrics => metrics.date >= startDate && metrics.date <= endDate)
      .toArray();
  },

  async checkAndUpdatePersonalRecordsFromRun(userId: number, runId: number): Promise<PersonalRecord[]> {
    const run = await db.runs.get(runId);
    if (!run) return [];

    const newRecords: PersonalRecord[] = [];
    const now = new Date();

    // Check fastest times for different distances
    const distanceRecords = [
      { distance: 1, type: 'fastest_1k' as const },
      { distance: 5, type: 'fastest_5k' as const },
      { distance: 10, type: 'fastest_10k' as const },
    ];

    for (const record of distanceRecords) {
      if (run.distance >= record.distance) {
        const timeForDistance = (run.duration / run.distance) * record.distance;
        const existingRecord = await db.personalRecords
          .where({ userId, recordType: record.type })
          .first();

        if (!existingRecord || timeForDistance < existingRecord.value) {
          const personalRecord: PersonalRecord = {
            userId,
            recordType: record.type,
            value: timeForDistance,
            achievedAt: new Date(run.completedAt),
            runId: run.id,
            createdAt: now,
            updatedAt: now,
          };

          if (existingRecord) {
            await db.personalRecords.update(existingRecord.id!, personalRecord);
          } else {
            await db.personalRecords.add(personalRecord);
          }
          newRecords.push(personalRecord);
        }
      }
    }

    // Check longest run
    const longestRecord = await db.personalRecords
      .where({ userId, recordType: 'longest_run' })
      .first();

    if (!longestRecord || run.distance > longestRecord.value) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'longest_run',
        value: run.distance,
        achievedAt: new Date(run.completedAt),
        runId: run.id,
        createdAt: now,
        updatedAt: now,
      };

      if (longestRecord) {
        await db.personalRecords.update(longestRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    // Check best pace
    const bestPaceRecord = await db.personalRecords
      .where({ userId, recordType: 'best_pace' })
      .first();

    if (run.pace > 0 && (!bestPaceRecord || run.pace < bestPaceRecord.value)) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'best_pace',
        value: run.pace,
        achievedAt: new Date(run.completedAt),
        runId: run.id,
        createdAt: now,
        updatedAt: now,
      };

      if (bestPaceRecord) {
        await db.personalRecords.update(bestPaceRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    return newRecords;
  },

  async getPersonalRecords(userId: number): Promise<PersonalRecord[]> {
    return await db.personalRecords.where('userId').equals(userId).toArray();
  },

  async generatePerformanceInsights(userId: number): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = [];
    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= last30Days)
      .toArray();

    if (recentRuns.length === 0) {
      return insights;
    }

    // Trend analysis
    const firstHalf = recentRuns.slice(0, Math.floor(recentRuns.length / 2));
    const secondHalf = recentRuns.slice(Math.floor(recentRuns.length / 2));
    
    const firstHalfAvgPace = firstHalf.reduce((sum, run) => sum + run.pace, 0) / firstHalf.length;
    const secondHalfAvgPace = secondHalf.reduce((sum, run) => sum + run.pace, 0) / secondHalf.length;

    if (secondHalfAvgPace < firstHalfAvgPace) {
      insights.push({
        userId,
        type: 'improvement',
        title: 'Pace Improvement Detected',
        description: `Your average pace has improved by ${Math.abs(firstHalfAvgPace - secondHalfAvgPace).toFixed(0)} seconds per km over the last 30 days!`,
        priority: 'high',
        actionable: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Volume analysis
    const avgDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length;
    const lastWeekRuns = recentRuns.filter(run => {
      const runDate = new Date(run.completedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return runDate >= weekAgo;
    });

    const lastWeekAvgDistance = lastWeekRuns.length > 0 ? 
      lastWeekRuns.reduce((sum, run) => sum + run.distance, 0) / lastWeekRuns.length : 0;

    if (lastWeekAvgDistance < avgDistance * 0.7) {
      insights.push({
        userId,
        type: 'warning',
        title: 'Reduced Training Volume',
        description: 'Your training volume has decreased significantly this week. Consider gradually increasing your mileage.',
        priority: 'medium',
        actionable: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Consistency analysis
    const runDates = recentRuns.map(run => new Date(run.completedAt).toDateString());
    const uniqueDates = new Set(runDates);
    const consistencyScore = (uniqueDates.size / 30) * 100;

    if (consistencyScore > 80) {
      insights.push({
        userId,
        type: 'achievement',
        title: 'Excellent Consistency',
        description: `You've maintained ${consistencyScore.toFixed(0)}% consistency this month. Keep it up!`,
        priority: 'high',
        actionable: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return insights;
  },

  async savePerformanceInsights(insights: Omit<PerformanceInsight, 'id'>[]): Promise<void> {
    for (const insight of insights) {
      await db.performanceInsights.add(insight);
    }
  },

  async getAllPerformanceInsights(userId: number): Promise<PerformanceInsight[]> {
    const now = new Date();
    return await db.performanceInsights
      .where('userId').equals(userId)
      .and(insight => !insight.validUntil || insight.validUntil > now)
      .reverse()
      .sortBy('createdAt');
  },

  async getCohortPerformanceComparison(cohortId: number, userId: number, timeRange: string = '30d'): Promise<{
    userRank: number;
    totalMembers: number;
    userAvgPace: number;
    cohortAvgPace: number;
    userTotalDistance: number;
    cohortAvgDistance: number;
    percentile: number;
  }> {
    const members = await db.cohortMembers.where('cohortId').equals(cohortId).toArray();
    const memberIds = members.map(m => m.userId);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    const allRuns = await db.runs
      .where('userId').anyOf(memberIds)
      .and(run => new Date(run.completedAt) >= startDate)
      .toArray();

    // Group runs by user
    const userRuns = new Map<number, typeof allRuns>();
    allRuns.forEach(run => {
      if (!userRuns.has(run.userId)) {
        userRuns.set(run.userId, []);
      }
      userRuns.get(run.userId)!.push(run);
    });

    // Calculate stats for each user
    const userStats = Array.from(userRuns.entries()).map(([uid, runs]) => {
      const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
      const avgPace = runs.length > 0 ? runs.reduce((sum, run) => sum + run.pace, 0) / runs.length : 0;
      return { userId: uid, totalDistance, avgPace };
    });

    // Sort by total distance for ranking
    userStats.sort((a, b) => b.totalDistance - a.totalDistance);
    const userRank = userStats.findIndex(stat => stat.userId === userId) + 1;

    // Calculate cohort averages
    const cohortAvgDistance = userStats.length > 0 ? 
      userStats.reduce((sum, stat) => sum + stat.totalDistance, 0) / userStats.length : 0;
    const cohortAvgPace = userStats.length > 0 ? 
      userStats.reduce((sum, stat) => sum + stat.avgPace, 0) / userStats.length : 0;

    // Get user's stats
    const userStat = userStats.find(stat => stat.userId === userId);
    const userTotalDistance = userStat?.totalDistance || 0;
    const userAvgPace = userStat?.avgPace || 0;

    // Calculate percentile
    const percentile = userStats.length > 0 ? 
      ((userStats.length - userRank + 1) / userStats.length) * 100 : 0;

    return {
      userRank,
      totalMembers: userStats.length,
      userAvgPace,
      cohortAvgPace,
      userTotalDistance,
      cohortAvgDistance,
      percentile,
    };
  },

  // Additional helper functions for the API endpoints
  async getRunsInTimeRange(userId: number, startDate: Date, endDate: Date): Promise<Run[]> {
    return await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= startDate && new Date(run.completedAt) <= endDate)
      .toArray();
  },

  async calculatePerformanceTrends(runs: Run[]): Promise<{
    averagePace: number;
    consistencyScore: number;
    performanceScore: number;
    paceProgression: Array<{ date: Date; pace: number }>;
    distanceProgression: Array<{ date: Date; distance: number }>;
    consistencyProgression: Array<{ date: Date; consistency: number }>;
    performanceProgression: Array<{ date: Date; performance: number }>;
  }> {
    if (runs.length === 0) {
      return {
        averagePace: 0,
        consistencyScore: 0,
        performanceScore: 0,
        paceProgression: [],
        distanceProgression: [],
        consistencyProgression: [],
        performanceProgression: [],
      };
    }

    const averagePace = runs.reduce((sum, run) => sum + run.pace, 0) / runs.length;
    
    // Calculate consistency score
    const paceVariance = runs.reduce((sum, run) => sum + Math.pow(run.pace - averagePace, 2), 0) / runs.length;
    const consistencyScore = Math.max(0, 100 - (paceVariance / averagePace * 100));
    
    // Calculate performance score (improvement over time)
    const firstHalf = runs.slice(0, Math.floor(runs.length / 2));
    const secondHalf = runs.slice(Math.floor(runs.length / 2));
    
    const firstHalfAvgPace = firstHalf.reduce((sum, run) => sum + run.pace, 0) / firstHalf.length;
    const secondHalfAvgPace = secondHalf.reduce((sum, run) => sum + run.pace, 0) / secondHalf.length;
    
    const paceImprovement = firstHalfAvgPace - secondHalfAvgPace;
    const performanceScore = Math.min(100, Math.max(0, 50 + paceImprovement * 10));

    // Create progression arrays
    const paceProgression = runs.map(run => ({
      date: new Date(run.completedAt),
      pace: run.pace,
    }));

    const distanceProgression = runs.map(run => ({
      date: new Date(run.completedAt),
      distance: run.distance,
    }));

    const consistencyProgression = runs.map((run, index) => {
      const windowSize = Math.min(5, index + 1);
      const window = runs.slice(Math.max(0, index - windowSize + 1), index + 1);
      const windowAvgPace = window.reduce((sum, r) => sum + r.pace, 0) / window.length;
      const windowVariance = window.reduce((sum, r) => sum + Math.pow(r.pace - windowAvgPace, 2), 0) / window.length;
      const consistency = Math.max(0, 100 - (windowVariance / windowAvgPace * 100));
      
      return {
        date: new Date(run.completedAt),
        consistency,
      };
    });

    const performanceProgression = runs.map((run, index) => {
      const windowSize = Math.min(10, index + 1);
      const window = runs.slice(Math.max(0, index - windowSize + 1), index + 1);
      const windowFirstHalf = window.slice(0, Math.floor(window.length / 2));
      const windowSecondHalf = window.slice(Math.floor(window.length / 2));
      
      if (windowFirstHalf.length === 0 || windowSecondHalf.length === 0) {
        return {
          date: new Date(run.completedAt),
          performance: 50,
        };
      }
      
      const firstHalfPace = windowFirstHalf.reduce((sum, r) => sum + r.pace, 0) / windowFirstHalf.length;
      const secondHalfPace = windowSecondHalf.reduce((sum, r) => sum + r.pace, 0) / windowSecondHalf.length;
      const improvement = firstHalfPace - secondHalfPace;
      const performance = Math.min(100, Math.max(0, 50 + improvement * 10));
      
      return {
        date: new Date(run.completedAt),
        performance,
      };
    });

    return {
      averagePace,
      consistencyScore,
      performanceScore,
      paceProgression,
      distanceProgression,
      consistencyProgression,
      performanceProgression,
    };
  },

  async getPerformanceInsights(userId: number, startDate: Date, endDate: Date): Promise<PerformanceInsight[]> {
    return await db.performanceInsights
      .where('userId').equals(userId)
      .and(insight => new Date(insight.createdAt) >= startDate && new Date(insight.createdAt) <= endDate)
      .and(insight => !insight.validUntil || insight.validUntil > new Date())
      .toArray();
  },

  async getPersonalRecordProgression(userId: number, distance: number): Promise<Array<{
    date: Date;
    time: number;
    pace: number;
  }>> {
    const runs = await db.runs
      .where('userId').equals(userId)
      .and(run => run.distance >= distance * 0.95 && run.distance <= distance * 1.05)
      .toArray();

    return runs
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .map(run => ({
        date: new Date(run.completedAt),
        time: run.duration,
        pace: run.pace,
      }));
  },

  async deletePersonalRecord(userId: number, recordId: number): Promise<void> {
    await db.personalRecords.where({ id: recordId, userId }).delete();
  },

  // Race Goal operations
  async createRaceGoal(raceGoalData: Omit<RaceGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.raceGoals.add({
      ...raceGoalData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getRaceGoalsByUser(userId: number): Promise<RaceGoal[]> {
    return await db.raceGoals.where('userId').equals(userId).toArray();
  },

  async getRaceGoalById(id: number): Promise<RaceGoal | undefined> {
    return await db.raceGoals.get(id);
  },

  async updateRaceGoal(id: number, updates: Partial<RaceGoal>): Promise<void> {
    await db.raceGoals.update(id, { ...updates, updatedAt: new Date() });
  },

  async deleteRaceGoal(id: number): Promise<void> {
    await db.raceGoals.delete(id);
  },

  async getPrimaryRaceGoal(userId: number): Promise<RaceGoal | undefined> {
    return await db.raceGoals
      .where('userId').equals(userId)
      .and(goal => goal.priority === 'A')
      .first();
  },

  // Workout Template operations
  async createWorkoutTemplate(templateData: Omit<WorkoutTemplate, 'id' | 'createdAt'>): Promise<number> {
    return await db.workoutTemplates.add({
      ...templateData,
      createdAt: new Date()
    });
  },

  async getWorkoutTemplatesByPhase(trainingPhase: 'base' | 'build' | 'peak' | 'taper'): Promise<WorkoutTemplate[]> {
    return await db.workoutTemplates.where('trainingPhase').equals(trainingPhase).toArray();
  },

  async getWorkoutTemplatesByType(workoutType: string): Promise<WorkoutTemplate[]> {
    return await db.workoutTemplates.where('workoutType').equals(workoutType).toArray();
  },

  // Advanced plan operations
  async createAdvancedPlan(planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.plans.add({
      ...planData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getPlansByRaceGoal(raceGoalId: number): Promise<Plan[]> {
    return await db.plans.where('raceGoalId').equals(raceGoalId).toArray();
  },

  // Fitness assessment based on recent runs
  async assessFitnessLevel(userId: number): Promise<'beginner' | 'intermediate' | 'advanced'> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= thirtyDaysAgo)
      .toArray();

    if (recentRuns.length === 0) return 'beginner';

    const avgDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0) / recentRuns.length;
    const avgPace = recentRuns.reduce((sum, run) => sum + (run.pace || 0), 0) / recentRuns.length;
    const weeklyVolume = recentRuns.reduce((sum, run) => sum + run.distance, 0) / 4; // 4 weeks

    // Advanced: >40km/week, sub-5:00/km average, >10km average distance
    if (weeklyVolume > 40 && avgPace < 300 && avgDistance > 10) {
      return 'advanced';
    }
    
    // Intermediate: 20-40km/week, 5:00-6:00/km average, 5-10km average distance
    if (weeklyVolume >= 20 && avgPace < 360 && avgDistance >= 5) {
      return 'intermediate';
    }
    
    return 'beginner';
  },

  // Calculate target pace based on race goal and current fitness
  async calculateTargetPaces(userId: number, raceGoalId: number): Promise<{
    easyPace: number;
    tempoPace: number;
    thresholdPace: number;
    intervalPace: number;
    racePace: number;
  }> {
    const raceGoal = await this.getRaceGoalById(raceGoalId);
    if (!raceGoal || !raceGoal.targetTime) {
      throw new Error('Race goal not found or target time not set');
    }

    const racePace = raceGoal.targetTime / raceGoal.distance; // seconds per km
    
    // Calculate training paces based on race pace
    return {
      easyPace: racePace * 1.2, // 20% slower than race pace
      tempoPace: racePace * 1.05, // 5% slower than race pace
      thresholdPace: racePace * 1.03, // 3% slower than race pace
      intervalPace: racePace * 0.95, // 5% faster than race pace
      racePace: racePace
    };
  },

  async checkAndUpdatePersonalRecords(userId: number, runId: number, distance: number, duration: number, pace: number, date: Date): Promise<PersonalRecord[]> {
    const newRecords: PersonalRecord[] = [];
    const now = new Date();

    // Check fastest times for different distances
    const distanceRecords = [
      { distance: 1, type: 'fastest_1k' as const },
      { distance: 5, type: 'fastest_5k' as const },
      { distance: 10, type: 'fastest_10k' as const },
      { distance: 21.1, type: 'fastest_half_marathon' as const },
      { distance: 42.2, type: 'fastest_marathon' as const },
    ];

    for (const record of distanceRecords) {
      if (distance >= record.distance) {
        const timeForDistance = (duration / distance) * record.distance;
        const existingRecord = await db.personalRecords
          .where({ userId, recordType: record.type })
          .first();

        if (!existingRecord || timeForDistance < existingRecord.value) {
          const personalRecord: PersonalRecord = {
            userId,
            recordType: record.type,
            distance: record.distance,
            timeForDistance,
            bestPace: pace,
            dateAchieved: date,
            runId,
            value: timeForDistance,
            achievedAt: date,
            createdAt: now,
            updatedAt: now,
          };

          if (existingRecord) {
            await db.personalRecords.update(existingRecord.id!, personalRecord);
          } else {
            await db.personalRecords.add(personalRecord);
          }
          newRecords.push(personalRecord);
        }
      }
    }

    // Check longest run
    const longestRecord = await db.personalRecords
      .where({ userId, recordType: 'longest_run' })
      .first();

    if (!longestRecord || distance > longestRecord.value) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'longest_run',
        distance,
        timeForDistance: duration,
        bestPace: pace,
        dateAchieved: date,
        runId,
        value: distance,
        achievedAt: date,
        createdAt: now,
        updatedAt: now,
      };

      if (longestRecord) {
        await db.personalRecords.update(longestRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    // Check best pace
    const bestPaceRecord = await db.personalRecords
      .where({ userId, recordType: 'best_pace' })
      .first();

    if (pace > 0 && (!bestPaceRecord || pace < bestPaceRecord.value)) {
      const personalRecord: PersonalRecord = {
        userId,
        recordType: 'best_pace',
        distance,
        timeForDistance: duration,
        bestPace: pace,
        dateAchieved: date,
        runId,
        value: pace,
        achievedAt: date,
        createdAt: now,
        updatedAt: now,
      };

      if (bestPaceRecord) {
        await db.personalRecords.update(bestPaceRecord.id!, personalRecord);
      } else {
        await db.personalRecords.add(personalRecord);
      }
      newRecords.push(personalRecord);
    }

    return newRecords;
  },
};

// Helper functions
export const calculatePace = (durationSeconds: number, distanceKm: number): number => {
  if (distanceKm === 0) return 0;
  return durationSeconds / distanceKm;
};

export const formatPace = (paceSecondsPerKm: number): string => {
  if (paceSecondsPerKm === 0) return '--:--';
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.floor(paceSecondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDuration = (durationSeconds: number): string => {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}; 