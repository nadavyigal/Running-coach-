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

// Database class
export class RunSmartDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  runs!: EntityTable<Run, 'id'>;
  shoes!: EntityTable<Shoe, 'id'>;

  constructor() {
    super('RunSmartDB');
    
    this.version(1).stores({
      users: '++id, goal, experience, onboardingComplete, createdAt',
      plans: '++id, userId, isActive, startDate, endDate, createdAt',
      workouts: '++id, planId, week, day, type, completed, scheduledDate, createdAt',
      runs: '++id, workoutId, userId, type, distance, duration, completedAt, createdAt',
      shoes: '++id, userId, isActive, createdAt'
    });
  }
}

// Create database instance
export const db = new RunSmartDB();

// Database utilities
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

  async updateWorkout(id: number, updates: Partial<Workout>): Promise<void> {
    await db.workouts.update(id, { ...updates, updatedAt: new Date() });
  },

  async markWorkoutCompleted(workoutId: number): Promise<void> {
    await this.updateWorkout(workoutId, { completed: true });
  },

  // Run operations
  async createRun(runData: Omit<Run, 'id' | 'createdAt'>): Promise<number> {
    return await db.runs.add({
      ...runData,
      createdAt: new Date()
    });
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
    const shoe = await db.shoes.get(shoeId);
    if (shoe) {
      await this.updateShoe(shoeId, { currentKm: shoe.currentKm + distance });
    }
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
  }
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