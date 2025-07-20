import { describe, it, expect, beforeEach } from 'vitest';
import { dbUtils } from '@/lib/db';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

// Setup fake IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Goal System Basic Functionality', () => {
  let userId: number;

  beforeEach(async () => {
    // Clear database
    await dbUtils.clearDatabase();
    
    // Create test user
    userId = await dbUtils.createUser({
      name: 'Test User',
      goal: 'fitness',
      experience: 'intermediate',
      preferredTimes: ['morning'],
      daysPerWeek: 4,
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      onboardingComplete: true
    });
  });

  it('should create a goal successfully', async () => {
    const goalData = {
      userId,
      title: 'Run 5K in under 25 minutes',
      description: 'Improve my 5K personal record',
      goalType: 'time_improvement' as const,
      category: 'speed' as const,
      priority: 1,
      specificTarget: {
        metric: '5k_time',
        value: 1500, // 25 minutes in seconds
        unit: 'seconds',
        description: 'Complete 5K in under 25 minutes'
      },
      measurableMetrics: ['5k_time', 'pace'],
      achievableAssessment: {
        currentLevel: 1680, // 28 minutes
        targetLevel: 1500, // 25 minutes
        feasibilityScore: 85,
        recommendedAdjustments: []
      },
      relevantContext: 'Training for local 5K race',
      timeBound: {
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        startDate: new Date(),
        totalDuration: 90,
        milestoneSchedule: [25, 50, 75]
      },
      baselineValue: 1680,
      targetValue: 1500,
      currentValue: 1680,
      progressPercentage: 0,
      status: 'active' as const
    };

    const goalId = await dbUtils.createGoal(goalData);
    expect(goalId).toBeGreaterThan(0);

    const createdGoal = await dbUtils.getGoal(goalId);
    expect(createdGoal).toBeTruthy();
    expect(createdGoal?.title).toBe(goalData.title);
    expect(createdGoal?.status).toBe('active');
  });

  it('should validate SMART goal criteria', async () => {
    const validGoal = {
      userId,
      title: 'Run 10K distance',
      description: 'Build endurance for 10K runs',
      goalType: 'distance_achievement' as const,
      category: 'endurance' as const,
      priority: 1,
      specificTarget: {
        metric: 'distance',
        value: 10,
        unit: 'km',
        description: 'Complete a 10K run'
      },
      measurableMetrics: ['distance'],
      achievableAssessment: {
        currentLevel: 5,
        targetLevel: 10,
        feasibilityScore: 80
      },
      relevantContext: 'Building running endurance',
      timeBound: {
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        startDate: new Date(),
        totalDuration: 60,
        milestoneSchedule: [25, 50, 75]
      },
      baselineValue: 5,
      targetValue: 10
    };

    const validation = dbUtils.validateSMARTGoal(validGoal);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Test invalid goal
    const invalidGoal = {
      ...validGoal,
      title: 'Run', // Too short
      timeBound: {
        ...validGoal.timeBound,
        deadline: new Date(Date.now() - 1000) // Past deadline
      }
    };

    const invalidValidation = dbUtils.validateSMARTGoal(invalidGoal);
    expect(invalidValidation.isValid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);
  });

  it('should record and calculate progress correctly', async () => {
    // Create goal
    const goalId = await dbUtils.createGoal({
      userId,
      title: 'Distance Goal',
      description: 'Build endurance',
      goalType: 'distance_achievement',
      category: 'endurance',
      priority: 1,
      specificTarget: {
        metric: 'distance',
        value: 10,
        unit: 'km',
        description: 'Run 10K'
      },
      measurableMetrics: ['distance'],
      achievableAssessment: {
        currentLevel: 0,
        targetLevel: 10,
        feasibilityScore: 80
      },
      relevantContext: 'Test goal',
      timeBound: {
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        startDate: new Date(),
        totalDuration: 60,
        milestoneSchedule: [25, 50, 75]
      },
      baselineValue: 0,
      targetValue: 10,
      currentValue: 0,
      progressPercentage: 0,
      status: 'active'
    });

    // Record progress
    await dbUtils.recordGoalProgress({
      goalId,
      measurementDate: new Date(),
      measuredValue: 4,
      progressPercentage: 40,
      contributingActivityId: null,
      contributingActivityType: 'manual',
      autoRecorded: false
    });

    // Verify progress was recorded
    const updatedGoal = await dbUtils.getGoal(goalId);
    expect(updatedGoal?.currentValue).toBe(4);
    expect(updatedGoal?.progressPercentage).toBe(40);

    const progressHistory = await dbUtils.getGoalProgressHistory(goalId);
    expect(progressHistory.length).toBe(1);
    expect(progressHistory[0].measuredValue).toBe(4);
  });

  it('should generate milestones automatically', async () => {
    const goalId = await dbUtils.createGoal({
      userId,
      title: 'Milestone Test Goal',
      description: 'Test milestone generation',
      goalType: 'distance_achievement',
      category: 'endurance',
      priority: 1,
      specificTarget: {
        metric: 'distance',
        value: 100,
        unit: 'km',
        description: 'Run 100K total'
      },
      measurableMetrics: ['distance'],
      achievableAssessment: {
        currentLevel: 0,
        targetLevel: 100,
        feasibilityScore: 75
      },
      relevantContext: 'Monthly challenge',
      timeBound: {
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate: new Date(),
        totalDuration: 30,
        milestoneSchedule: [25, 50, 75]
      },
      baselineValue: 0,
      targetValue: 100,
      currentValue: 0,
      progressPercentage: 0,
      status: 'active'
    });

    // Generate milestones
    const milestones = await dbUtils.generateGoalMilestones(goalId);
    expect(milestones.length).toBe(3); // 25%, 50%, 75%

    // Check milestone values
    const sortedMilestones = milestones.sort((a, b) => a.milestoneOrder - b.milestoneOrder);
    expect(sortedMilestones[0].targetValue).toBe(25); // 25% of 100
    expect(sortedMilestones[1].targetValue).toBe(50); // 50% of 100
    expect(sortedMilestones[2].targetValue).toBe(75); // 75% of 100
  });

  it('should calculate progress percentage correctly for different goal types', async () => {
    // Test time improvement goal (lower is better)
    const timeProgress = dbUtils.calculateGoalProgressPercentage(
      1800, // 30 minutes baseline
      1500, // 25 minutes current
      1200, // 20 minutes target
      'time_improvement'
    );
    expect(timeProgress).toBe(50); // (1800-1500)/(1800-1200) = 300/600 = 50%

    // Test distance goal (higher is better)
    const distanceProgress = dbUtils.calculateGoalProgressPercentage(
      0,    // 0km baseline
      5,    // 5km current  
      10,   // 10km target
      'distance_achievement'
    );
    expect(distanceProgress).toBe(50); // (5-0)/(10-0) = 5/10 = 50%
  });
});