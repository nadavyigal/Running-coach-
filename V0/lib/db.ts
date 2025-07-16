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
  lastActivityDate?: Date; // Last day with recorded activity
  streakLastUpdated?: Date; // Timestamp of last streak calculation
  // Habit reminder fields
  reminderTime?: string; // HH:mm format
  reminderEnabled?: boolean;
  reminderSnoozedUntil?: Date | null;
}

// Training plan structure
export interface Plan {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Individual workout in a plan
export interface Workout {
  id?: number;
  planId: number;
  week: number;
  day: string; // 'Mon', 'Tue', etc.
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest';
  distance: number; // in km
  duration?: number; // in minutes
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
    const now = new Date();
    return await db.users.add({
      ...userData,
      createdAt: now,
      updatedAt: now
    });
  },

  async getCurrentUser(): Promise<User | undefined> {
    return await db.users.where('onboardingComplete').equals(true).first();
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