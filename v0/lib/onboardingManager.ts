import { type User } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'
import { generatePlan, generateFallbackPlan, type PlanData } from '@/lib/planGenerator'
import { validateOnboardingState } from '@/lib/onboardingStateValidator'

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
  onboardingSession?: Record<string, unknown>;
  onboardingComplete: boolean;
  privacySettings?: any;
}

export class OnboardingManager {
  private static instance: OnboardingManager;
  private onboardingInProgress = false;
  private currentUserId: number | null = null;
  private planCreationMutex = false; // Race condition guard
  private activeOperations = new Map<string, Promise<any>>(); // Track active operations
  private operationTimeouts = new Map<string, NodeJS.Timeout>(); // Track operation timeouts
  private maxConcurrentOperations = 1; // Limit concurrent onboarding operations
  private operationTimeout = 60000; // 60 seconds timeout for operations

  private constructor() {}

  private buildUserPatch(profile: OnboardingProfile): Partial<User> {
    return {
      goal: profile.goal,
      experience: profile.experience,
      preferredTimes: profile.preferredTimes,
      daysPerWeek: profile.daysPerWeek,
      consents: profile.consents,
      onboardingComplete: profile.onboardingComplete,
      ...(typeof profile.rpe === 'number' ? { rpe: profile.rpe } : {}),
      ...(typeof profile.age === 'number' ? { age: profile.age } : {}),
      ...(Array.isArray(profile.motivations) ? { motivations: profile.motivations } : {}),
      ...(Array.isArray(profile.barriers) ? { barriers: profile.barriers } : {}),
      ...(typeof profile.coachingStyle === 'string' ? { coachingStyle: profile.coachingStyle } : {}),
      ...(typeof profile.goalInferred === 'boolean' ? { goalInferred: profile.goalInferred } : {}),
      ...(profile.privacySettings ? { privacySettings: profile.privacySettings } : {}),
    }
  }

  public static getInstance(): OnboardingManager {
    if (!OnboardingManager.instance) {
      OnboardingManager.instance = new OnboardingManager();
    }
    return OnboardingManager.instance;
  }

  /**
   * Enhanced operation management with concurrency control and timeouts
   */
  private async executeWithConcurrencyControl<T>(
    operationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Check if operation is already running
    const existingOperation = this.activeOperations.get(operationId);
    if (existingOperation) {
      console.log(`⏳ Operation ${operationId} already running, waiting for completion`);
      return existingOperation as Promise<T>;
    }

    // Check concurrent operation limit
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      await Promise.race(this.activeOperations.values());
    }

    console.log(`🚀 Starting operation ${operationId}`);

    // Create timeout for operation
    const timeoutId = setTimeout(() => {
      console.error(`⏰ Operation ${operationId} timed out after ${this.operationTimeout}ms`);
      this.cleanupOperation(operationId);
    }, this.operationTimeout);

    this.operationTimeouts.set(operationId, timeoutId);

    // Execute operation with cleanup
    const operationPromise = operation()
      .then(result => {
        console.log(`✅ Operation ${operationId} completed successfully`);
        this.cleanupOperation(operationId);
        return result;
      })
      .catch(error => {
        console.error(`❌ Operation ${operationId} failed:`, error);
        this.cleanupOperation(operationId);
        throw error;
      });

    this.activeOperations.set(operationId, operationPromise);
    return operationPromise;
  }

  /**
   * Clean up operation tracking and timeouts
   */
  private cleanupOperation(operationId: string): void {
    const timeout = this.operationTimeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.operationTimeouts.delete(operationId);
    }
    this.activeOperations.delete(operationId);
  }

  /**
   * Generate unique operation ID for tracking
   */
  private generateOperationId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Centralized user creation with enhanced conflict prevention and concurrency control
   */
  public async createUserWithProfile(profile: OnboardingProfile): Promise<OnboardingResult> {
    const operationId = this.generateOperationId('create_user');
    
    return this.executeWithConcurrencyControl(operationId, async () => {
      return await this.internalCreateUserWithProfile(profile);
    });
  }

  /**
   * Internal user creation implementation
   */
  private async internalCreateUserWithProfile(profile: OnboardingProfile): Promise<OnboardingResult> {
    console.log('🎯 OnboardingManager.createUserWithProfile called with profile:', {
      goal: profile.goal,
      experience: profile.experience,
      onboardingComplete: profile.onboardingComplete,
      hasPrivacySettings: !!profile.privacySettings
    });
    
    if (this.onboardingInProgress) {
      console.warn('⚠️ Onboarding already in progress, checking if user exists or allowing retry...');
      
      // Check if this is a legitimate retry attempt or duplicate user creation
      try {
        const existingUser = await this.checkExistingUser();
        if (existingUser && existingUser.onboardingComplete) {
          console.log('✅ User already exists and completed onboarding, returning existing user');
          return {
            user: existingUser,
            success: true
          };
        }
        
        // If no completed user exists, reset state and allow retry
        console.log('🔄 No completed user found, resetting state and allowing retry');
        this.resetOnboardingState();
      } catch (error) {
        console.error('Error checking existing user during retry:', error);
        // Reset state and continue
        this.resetOnboardingState();
      }
    }

    this.onboardingInProgress = true;

    try {
      console.log('🚀 Starting centralized user creation with profile:', profile);

      // Step 1: Check if user already exists
      const existingUser = await this.checkExistingUser();
      if (existingUser) {
        console.log('👤 User already exists, updating instead of creating new:', existingUser.id);
        const updatedUser = await this.updateExistingUser(existingUser, profile);
        const planId = await this.generateTrainingPlanForUser(updatedUser);
        return {
          user: updatedUser,
          planId,
          success: true
        };
      }

      // Step 2: Validate profile data and state consistency
      const validationResult = await validateOnboardingState(profile, this.currentUserId);
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
        userId = await dbUtils.createUser(this.buildUserPatch(profile));
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

      const planId = await this.generateTrainingPlanForUser(user);
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
      console.error('❌ User creation failed during createUserWithProfile:', error);
      await this.cleanupFailedOnboarding(error); // Pass error for logging
      
      return {
        user: null as any,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  /**
   * Clean up any partial state from failed onboarding
   */
  private async cleanupFailedOnboarding(error?: any): Promise<void> {
    if (this.currentUserId) {
      try {
        console.log('🧹 Cleaning up failed onboarding for user:', this.currentUserId);
        if (error) {
          console.error('Reason for cleanup:', error);
        }
        
        // Delete any partially created plans and user data
        await dbUtils.cleanupUserData(this.currentUserId);
        
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed during cleanupFailedOnboarding:', cleanupError);
      } finally {
        this.onboardingInProgress = false;
        this.currentUserId = null;
        console.log('Onboarding state reset: onboardingInProgress=', this.onboardingInProgress, ', currentUserId=', this.currentUserId);
      }
    } else {
      this.onboardingInProgress = false;
      this.currentUserId = null;
      console.log('Onboarding state reset (no currentUserId): onboardingInProgress=', this.onboardingInProgress, ', currentUserId=', this.currentUserId);
    }
  }

  /**
   * Check if a user already exists (basic check)
   */
  private async checkExistingUser(): Promise<User | null> {
    try {
      const user = await dbUtils.getCurrentUser();
      return user || null;
    } catch {
      return null;
    }
  }

  /**
   * Update existing user with new profile data
   */
  private async updateExistingUser(existingUser: User, profile: OnboardingProfile): Promise<User> {
    if (typeof existingUser.id !== 'number') {
      throw new Error('Cannot update existing user without an id')
    }

    const updateData: Partial<User> = {
      ...this.buildUserPatch(profile),
      updatedAt: new Date(),
      onboardingComplete: true
    };

    await dbUtils.updateUser(existingUser.id, updateData);
    
    // Get the updated user
    const updatedUser = await dbUtils.getCurrentUser();
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    console.log('✅ User updated successfully:', updatedUser.id);
    return updatedUser;
  }

  

  /**
   * Generate training plan with unified logic
   */
  private async generateTrainingPlanForUser(user: User): Promise<number> {
    try {
      console.log('🎯 Generating training plan for user:', user.id);
      
      // Try AI-powered plan generation first
      const planData = await generatePlan({ user: user });
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
   * Public entrypoint for generating a plan from onboarding form data.
   */
  public async generateTrainingPlan(
    profileInput: Omit<OnboardingProfile, 'onboardingComplete'> & { onboardingComplete?: boolean }
  ): Promise<OnboardingResult> {
    const profile: OnboardingProfile = {
      ...profileInput,
      onboardingComplete: profileInput.onboardingComplete ?? true,
    };

    return await this.createUserWithProfile(profile);
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
    privacySettings?: any;
    aiPlanData?: any;
  }): Promise<OnboardingResult> {
    const profile: OnboardingProfile = {
      goal: formData.goal as 'habit' | 'distance' | 'speed',
      experience: formData.experience as 'beginner' | 'intermediate' | 'advanced',
      preferredTimes: formData.selectedTimes,
      daysPerWeek: formData.daysPerWeek,
      consents: formData.consents,
      goalInferred: false,
      onboardingComplete: true,
      ...(typeof formData.rpe === 'number' ? { rpe: formData.rpe } : {}),
      ...(typeof formData.age === 'number' ? { age: formData.age } : {}),
      ...(formData.privacySettings ? { privacySettings: formData.privacySettings } : {}),
    };

    return await this.createUserWithProfile(profile);
  }
}

// Export singleton instance
export const onboardingManager = OnboardingManager.getInstance();
