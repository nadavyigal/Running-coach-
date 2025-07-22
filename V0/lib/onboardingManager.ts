import { dbUtils, type User } from '@/lib/db'
import { generatePlan, generateFallbackPlan, type PlanData } from '@/lib/planGenerator'
import { trackEngagementEvent } from '@/lib/analytics'

export interface OnboardingResult {
  user: User;
  planId?: number;
  success: boolean;
  errors?: string[];
}

export interface OnboardingProfile {
  goal: 'habit' | 'distance' | 'speed';
  experience: 'beginner' | 'intermediate' | 'advanced';
  preferredTimes: string[];
  daysPerWeek: number;
  consents: {
    data: boolean;
    gdpr: boolean;
    push: boolean;
  };
  rpe?: number;
  age?: number;
  motivations?: string[];
  barriers?: string[];
  coachingStyle?: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
  goalInferred?: boolean;
  onboardingSession?: any;
  onboardingComplete: boolean;
}

export class OnboardingManager {
  private static instance: OnboardingManager;
  private onboardingInProgress = false;
  private currentUserId: number | null = null;
  private planCreationMutex = false; // Race condition guard

  private constructor() {}

  public static getInstance(): OnboardingManager {
    if (!OnboardingManager.instance) {
      OnboardingManager.instance = new OnboardingManager();
    }
    return OnboardingManager.instance;
  }

  /**
   * Create plan with conflict prevention and atomic transaction
   */
  private async createPlanWithConflictPrevention(user: User, planData: PlanData): Promise<number> {
    if (this.planCreationMutex) {
      console.warn('⚠️ Plan creation already in progress, preventing race condition');
      throw new Error('Plan creation already in progress');
    }

    this.planCreationMutex = true;
    
    try {
      console.log('🔒 Starting atomic plan creation for user:', user.id);
      
      // Step 1: Deactivate any existing active plans
      await dbUtils.deactivateAllUserPlans(user.id!);
      console.log('✅ Deactivated existing active plans');
      
      // Step 2: Create the plan
      const planId = await dbUtils.createPlan(planData.plan);
      console.log('✅ Plan created with ID:', planId);
      
      // Step 3: Create all workouts with proper planId
      const workoutPromises = planData.workouts.map(async (workoutData) => {
        const workoutWithPlanId = {
          ...workoutData,
          planId: planId
        };
        return await dbUtils.createWorkout(workoutWithPlanId);
      });
      
      const workoutIds = await Promise.all(workoutPromises);
      console.log('✅ Created', workoutIds.length, 'workouts for plan:', planId);
      
      return planId;
    } catch (error) {
      console.error('❌ Plan creation failed, rolling back:', error);
      
      // Attempt cleanup on failure
      try {
        await this.cleanupFailedPlanCreation(user.id!);
      } catch (cleanupError) {
        console.error('❌ Cleanup also failed:', cleanupError);
      }
      
      throw error;
    } finally {
      this.planCreationMutex = false;
    }
  }

  /**
   * Clean up failed plan creation
   */
  private async cleanupFailedPlanCreation(userId: number): Promise<void> {
    try {
      console.log('🧹 Cleaning up failed plan creation for user:', userId);
      
      // Get any recently created plans for this user and deactivate them
      const activePlan = await dbUtils.getActivePlan(userId);
      if (activePlan) {
        console.log('🗑️ Deactivating failed plan:', activePlan.id);
        await dbUtils.updatePlan(activePlan.id!, { isActive: false });
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Centralized user creation with conflict prevention
   */
  public async createUserWithProfile(profile: OnboardingProfile): Promise<OnboardingResult> {
    if (this.onboardingInProgress) {
      console.warn('⚠️ Onboarding already in progress, preventing duplicate user creation');
      return {
        user: await this.getCurrentUserOrFail(),
        success: false,
        errors: ['Onboarding already in progress']
      };
    }

    this.onboardingInProgress = true;
    const errors: string[] = [];

    try {
      console.log('🚀 Starting centralized user creation with profile:', profile);

      // Step 1: Check if user already exists
      const existingUser = await this.checkExistingUser();
      if (existingUser) {
        console.log('👤 User already exists, updating instead of creating new:', existingUser.id);
        const updatedUser = await this.updateExistingUser(existingUser, profile);
        return {
          user: updatedUser,
          success: true
        };
      }

      // Step 2: Validate profile data
      const validationResult = this.validateProfile(profile);
      if (!validationResult.isValid) {
        return {
          user: null as any,
          success: false,
          errors: validationResult.errors
        };
      }

      // Step 3: Create user with retry logic
      let userId: number;
      try {
        userId = await dbUtils.createUser(profile);
        this.currentUserId = userId;
        console.log('✅ User created successfully with ID:', userId);
      } catch (error) {
        console.error('❌ User creation failed:', error);
        
        // Check if it's a duplicate user error and try to recover
        const existingUserRetry = await this.checkExistingUser();
        if (existingUserRetry) {
          console.log('🔄 Found existing user during retry, using existing user');
          this.currentUserId = existingUserRetry.id!;
          userId = existingUserRetry.id!;
        } else {
          throw error;
        }
      }

      // Step 4: Generate training plan
      const user = await dbUtils.getUserById(userId);
      if (!user) {
        throw new Error('Failed to retrieve created user');
      }

      const planId = await this.generateTrainingPlan(user);
      console.log('✅ Training plan created with ID:', planId);

      // Step 5: Mark onboarding as complete
      await dbUtils.updateUser(userId, { onboardingComplete: true });
      console.log('✅ Onboarding marked as complete');

      // Step 6: Reset onboarding state
      this.onboardingInProgress = false;
      this.currentUserId = null;

      return {
        user,
        planId,
        success: true
      };

    } catch (error) {
      console.error('❌ User creation failed:', error);
      await this.cleanupFailedOnboarding();
      
      return {
        user: null as any,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  /**
   * Check if a user already exists (basic check)
   */
  private async checkExistingUser(): Promise<User | null> {
    try {
      const user = await dbUtils.getCurrentUser();
      return user || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update existing user with new profile data
   */
  private async updateExistingUser(existingUser: User, profile: OnboardingProfile): Promise<User> {
    const updateData = {
      ...profile,
      updatedAt: new Date(),
      onboardingComplete: true
    };

    await dbUtils.updateUser(existingUser.id!, updateData);
    
    // Get the updated user
    const updatedUser = await dbUtils.getCurrentUser();
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    console.log('✅ User updated successfully:', updatedUser.id);
    return updatedUser;
  }

  /**
   * Validate profile data before user creation
   */
  private validateProfile(profile: OnboardingProfile): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!profile.goal || !['habit', 'distance', 'speed'].includes(profile.goal)) {
      errors.push('Invalid or missing goal');
    }

    if (!profile.experience || !['beginner', 'intermediate', 'advanced'].includes(profile.experience)) {
      errors.push('Invalid or missing experience level');
    }

    if (!profile.preferredTimes || profile.preferredTimes.length === 0) {
      errors.push('At least one preferred time must be selected');
    }

    if (!profile.daysPerWeek || profile.daysPerWeek < 2 || profile.daysPerWeek > 7) {
      errors.push('Days per week must be between 2 and 7');
    }

    if (!profile.consents.data || !profile.consents.gdpr) {
      errors.push('Data usage and GDPR consent are required');
    }

    if (profile.age && (profile.age < 10 || profile.age > 100)) {
      errors.push('Age must be between 10 and 100 if provided');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate training plan with unified logic
   */
  private async generateTrainingPlan(user: User): Promise<number> {
    try {
      console.log('🎯 Generating training plan for user:', user.id);
      
      // Try AI-powered plan generation first
      const planData = await generatePlan({ user });
      console.log('✅ AI plan generation successful');
      
      // Create plan with conflict prevention
      const planId = await this.createPlanWithConflictPrevention(user, planData);
      return planId;
    } catch (error) {
      console.warn('⚠️ AI plan generation failed, using fallback:', error);
      
      // Use fallback plan generation
      const fallbackPlanData = await generateFallbackPlan(user);
      console.log('✅ Fallback plan generation successful');
      
      // Create fallback plan with conflict prevention
      const planId = await this.createPlanWithConflictPrevention(user, fallbackPlanData);
      return planId;
    }
  }

  /**
   * Clean up any partial state from failed onboarding
   */
  private async cleanupFailedOnboarding(): Promise<void> {
    if (this.currentUserId) {
      try {
        console.log('🧹 Cleaning up failed onboarding for user:', this.currentUserId);
        
        // Delete any partially created plans
        await dbUtils.cleanupUserData(this.currentUserId);
        
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
    }
  }

  /**
   * Get current user or throw error
   */
  private async getCurrentUserOrFail(): Promise<User> {
    const user = await dbUtils.getCurrentUser();
    if (!user) {
      throw new Error('No user found');
    }
    return user;
  }

  /**
   * Check if onboarding is currently in progress
   */
  public isOnboardingInProgress(): boolean {
    return this.onboardingInProgress;
  }

  /**
   * Reset onboarding state (for testing or error recovery)
   */
  public resetOnboardingState(): void {
    this.onboardingInProgress = false;
    this.currentUserId = null;
  }

  /**
   * Handle onboarding completion from chat overlay
   */
  public async completeAIChatOnboarding(
    goals: any[], 
    userProfile: any, 
    conversationHistory: any[]
  ): Promise<OnboardingResult> {
    // Convert AI chat data to standardized profile format
    const profile: OnboardingProfile = {
      goal: userProfile.goal || 'habit',
      experience: userProfile.experience || 'beginner',
      preferredTimes: userProfile.preferredTimes || ['morning'],
      daysPerWeek: userProfile.daysPerWeek || 3,
      consents: {
        data: true, // Implied consent from completing chat onboarding
        gdpr: true,
        push: userProfile.consents?.push || false
      },
      rpe: userProfile.rpe,
      age: userProfile.age,
      motivations: userProfile.motivations,
      barriers: userProfile.barriers,
      coachingStyle: userProfile.coachingStyle,
      goalInferred: userProfile.goalInferred || true,
      onboardingSession: {
        conversationId: userProfile.conversationId || `chat-${Date.now()}`,
        goalDiscoveryPhase: 'complete',
        discoveredGoals: goals,
        coachingStyle: userProfile.coachingStyle || 'supportive',
        conversationHistory: conversationHistory
      },
      onboardingComplete: true
    };

    return await this.createUserWithProfile(profile);
  }

  /**
   * Handle onboarding completion from form
   */
  public async completeFormOnboarding(formData: {
    goal: string;
    experience: string;
    selectedTimes: string[];
    daysPerWeek: number;
    rpe: number | null;
    age: number | null;
    consents: { data: boolean; gdpr: boolean; push: boolean };
  }): Promise<OnboardingResult> {
    const profile: OnboardingProfile = {
      goal: formData.goal as 'habit' | 'distance' | 'speed',
      experience: formData.experience as 'beginner' | 'intermediate' | 'advanced',
      preferredTimes: formData.selectedTimes,
      daysPerWeek: formData.daysPerWeek,
      consents: formData.consents,
      rpe: formData.rpe || undefined,
      age: formData.age || undefined,
      goalInferred: false,
      onboardingComplete: true
    };

    return await this.createUserWithProfile(profile);
  }
}

// Export singleton instance
export const onboardingManager = OnboardingManager.getInstance();