import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbUtils } from '@/lib/dbUtils';
import { goalProgressEngine } from '@/lib/goalProgressEngine';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

// Setup fake IndexedDB
global.indexedDB = new FDBFactory();
global.IDBKeyRange = FDBKeyRange;

describe('Goal Progress Tracking System', () => {
  let userId: number;
  let goalId: number;

  beforeEach(async () => {
    // Reset database
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

  afterEach(async () => {
    await dbUtils.clearDatabase();
  });

  describe('Goal Creation and SMART Validation', () => {
    it('should create a valid SMART goal', async () => {
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
        targetValue: 1500
      };

      // Validate SMART criteria
      const validation = dbUtils.validateSMARTGoal(goalData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);

      // Create goal
      goalId = await dbUtils.createGoal({
        ...goalData,
        currentValue: goalData.baselineValue,
        progressPercentage: 0,
        status: 'active'
      });

      expect(goalId).toBeGreaterThan(0);

      // Verify goal was created
      const createdGoal = await dbUtils.getGoal(goalId);
      expect(createdGoal).toBeTruthy();
      expect(createdGoal?.title).toBe(goalData.title);
      expect(createdGoal?.status).toBe('active');
    });

    it('should reject invalid SMART goals', async () => {
      const invalidGoalData = {
        userId,
        title: 'Run', // Too vague
        description: '',
        goalType: 'time_improvement' as const,
        category: 'speed' as const,
        priority: 1,
        specificTarget: {
          metric: '5k_time',
          value: 0, // Invalid target
          unit: 'seconds',
          description: ''
        },
        measurableMetrics: [],
        achievableAssessment: {
          currentLevel: 1680,
          targetLevel: 0,
          feasibilityScore: 0,
          recommendedAdjustments: []
        },
        relevantContext: '',
        timeBound: {
          deadline: new Date(Date.now() - 1000), // Past deadline
          startDate: new Date(),
          totalDuration: -1,
          milestoneSchedule: []
        },
        baselineValue: 1680,
        targetValue: 0
      };

      const validation = dbUtils.validateSMARTGoal(invalidGoalData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Progress Tracking and Calculation', () => {
    beforeEach(async () => {
      // Create a test goal
      goalId = await dbUtils.createGoal({
        userId,
        title: 'Run 10K distance',
        description: 'Build endurance for 10K runs',
        goalType: 'distance_achievement',
        category: 'endurance',
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
        targetValue: 10,
        currentValue: 5,
        progressPercentage: 0,
        status: 'active'
      });
    });

    it('should calculate progress correctly', async () => {
      // Record progress
      await dbUtils.recordGoalProgress({
        goalId,
        measurementDate: new Date(),
        measuredValue: 7,
        progressPercentage: 40, // (7-5)/(10-5) * 100 = 40%
        contributingActivityId: null,
        contributingActivityType: 'manual',
        notes: 'Great 7K run today',
        autoRecorded: false
      });

      // Calculate progress
      const progress = await goalProgressEngine.calculateGoalProgress(goalId);
      
      expect(progress).toBeTruthy();
      expect(progress?.progressPercentage).toBeCloseTo(40, 1);
      expect(progress?.currentValue).toBe(7);
      expect(progress?.targetValue).toBe(10);
    });

    it('should detect trajectory correctly', async () => {
      // Record multiple progress points
      const dates = [
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // 7 days ago
        new Date() // today
      ];
      
      const values = [5.5, 6.5, 7.5]; // Steady improvement
      
      for (let i = 0; i < dates.length; i++) {
        await dbUtils.recordGoalProgress({
          goalId,
          measurementDate: dates[i],
          measuredValue: values[i],
          progressPercentage: ((values[i] - 5) / (10 - 5)) * 100,
          contributingActivityId: null,
          contributingActivityType: 'manual',
          autoRecorded: false
        });
      }

      const progress = await goalProgressEngine.calculateGoalProgress(goalId);
      expect(progress?.trajectory).toBe('on_track');
      expect(progress?.recentTrend).toBe('improving');
    });
  });

  describe('Milestone Management', () => {
    beforeEach(async () => {
      goalId = await dbUtils.createGoal({
        userId,
        title: 'Monthly Running Goal',
        description: 'Run 100km this month',
        goalType: 'distance_achievement',
        category: 'endurance',
        priority: 1,
        specificTarget: {
          metric: 'distance',
          value: 100,
          unit: 'km',
          description: 'Complete 100km in a month'
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
      await dbUtils.generateGoalMilestones(goalId);
    });

    it('should create milestones automatically', async () => {
      const milestones = await dbUtils.getGoalMilestones(goalId);
      expect(milestones.length).toBeGreaterThan(0);
      
      // Should have milestones at 25%, 50%, 75% progress
      const targetValues = milestones.map(m => m.targetValue).sort((a, b) => a - b);
      expect(targetValues).toContain(25); // 25% of 100km
      expect(targetValues).toContain(50); // 50% of 100km
      expect(targetValues).toContain(75); // 75% of 100km
    });

    it('should detect milestone achievements', async () => {
      // Record progress that hits first milestone (25km)
      await dbUtils.recordGoalProgress({
        goalId,
        measurementDate: new Date(),
        measuredValue: 25,
        progressPercentage: 25,
        contributingActivityId: null,
        contributingActivityType: 'manual',
        autoRecorded: false
      });

      const achievements = await goalProgressEngine.checkMilestoneAchievements(goalId);
      expect(achievements.length).toBeGreaterThan(0);
      
      // Check that milestone status was updated
      const milestones = await dbUtils.getGoalMilestones(goalId);
      const achievedMilestones = milestones.filter(m => m.status === 'achieved');
      expect(achievedMilestones.length).toBeGreaterThan(0);
    });
  });

  describe('Goal Recommendations', () => {
    it('should generate recommendations for struggling goals', async () => {
      // Create a goal that's behind schedule
      const goalId = await dbUtils.createGoal({
        userId,
        title: 'Struggling Goal',
        description: 'A goal that needs help',
        goalType: 'distance_achievement',
        category: 'endurance',
        priority: 1,
        specificTarget: {
          metric: 'distance',
          value: 50,
          unit: 'km',
          description: 'Run 50km'
        },
        measurableMetrics: ['distance'],
        achievableAssessment: {
          currentLevel: 0,
          targetLevel: 50,
          feasibilityScore: 60
        },
        relevantContext: 'Challenge goal',
        timeBound: {
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Only 7 days left
          startDate: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), // Started 23 days ago
          totalDuration: 30,
          milestoneSchedule: [25, 50, 75]
        },
        baselineValue: 0,
        targetValue: 50,
        currentValue: 5, // Only 10% progress with 7 days left
        progressPercentage: 10,
        status: 'active'
      });

      // This should trigger "at risk" trajectory
      const progress = await goalProgressEngine.calculateGoalProgress(goalId);
      expect(progress?.trajectory).toBe('at_risk');
    });

    it('should suggest new goals based on performance', async () => {
      // Create a completed goal to base recommendations on
      await dbUtils.createGoal({
        userId,
        title: 'Completed Distance Goal',
        description: 'Successfully completed',
        goalType: 'distance_achievement',
        category: 'endurance',
        priority: 1,
        specificTarget: {
          metric: 'distance',
          value: 20,
          unit: 'km',
          description: 'Run 20km'
        },
        measurableMetrics: ['distance'],
        achievableAssessment: {
          currentLevel: 15,
          targetLevel: 20,
          feasibilityScore: 90
        },
        relevantContext: 'Endurance building',
        timeBound: {
          deadline: new Date(Date.now() - 1000), // Past deadline
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          totalDuration: 30,
          milestoneSchedule: [25, 50, 75]
        },
        baselineValue: 15,
        targetValue: 20,
        currentValue: 20,
        progressPercentage: 100,
        status: 'completed',
        completedAt: new Date()
      });

      // User should have pattern of success in endurance goals
      const userGoals = await dbUtils.getGoalsByUser(userId);
      const completedGoals = userGoals.filter(g => g.status === 'completed');
      expect(completedGoals.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics and Insights', () => {
    beforeEach(async () => {
      // Create multiple goals for analytics
      const goals = [
        {
          title: 'Speed Goal',
          category: 'speed',
          goalType: 'time_improvement',
          targetValue: 1500,
          currentValue: 1600,
          progressPercentage: 55,
          status: 'active'
        },
        {
          title: 'Distance Goal',
          category: 'endurance',
          goalType: 'distance_achievement',
          targetValue: 42.2,
          currentValue: 30,
          progressPercentage: 71,
          status: 'active'
        },
        {
          title: 'Completed Goal',
          category: 'consistency',
          goalType: 'frequency',
          targetValue: 12,
          currentValue: 12,
          progressPercentage: 100,
          status: 'completed'
        }
      ];

      for (const goal of goals) {
        await dbUtils.createGoal({
          userId,
          ...goal,
          description: `Test ${goal.title}`,
          priority: 1,
          specificTarget: {
            metric: 'test_metric',
            value: goal.targetValue,
            unit: 'units',
            description: goal.title
          },
          measurableMetrics: ['test_metric'],
          achievableAssessment: {
            currentLevel: goal.currentValue,
            targetLevel: goal.targetValue,
            feasibilityScore: 80
          },
          relevantContext: 'Test goal',
          timeBound: {
            deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            startDate: new Date(),
            totalDuration: 60,
            milestoneSchedule: [25, 50, 75]
          },
          baselineValue: 0
        });
      }
    });

    it('should calculate goal statistics correctly', async () => {
      const goals = await dbUtils.getGoalsByUser(userId);
      
      expect(goals.length).toBe(3);
      
      const activeGoals = goals.filter(g => g.status === 'active');
      const completedGoals = goals.filter(g => g.status === 'completed');
      
      expect(activeGoals.length).toBe(2);
      expect(completedGoals.length).toBe(1);
      
      // Calculate average progress
      const avgProgress = activeGoals.reduce((sum, g) => sum + g.progressPercentage, 0) / activeGoals.length;
      expect(avgProgress).toBeCloseTo(63, 0); // (55 + 71) / 2
    });

    it('should identify performance patterns', async () => {
      const goals = await dbUtils.getGoalsByUser(userId);
      
      // Group by category
      const categoryStats = goals.reduce((acc, goal) => {
        if (!acc[goal.category]) {
          acc[goal.category] = { total: 0, completed: 0 };
        }
        acc[goal.category].total++;
        if (goal.status === 'completed') {
          acc[goal.category].completed++;
        }
        return acc;
      }, {} as Record<string, { total: number; completed: number }>);

      // Consistency category should have 100% success rate
      expect(categoryStats.consistency.completed / categoryStats.consistency.total).toBe(1);
    });
  });

  describe('Integration with Running Activities', () => {
    it('should update goal progress from runs', async () => {
      // Create a distance goal
      const goalId = await dbUtils.createGoal({
        userId,
        title: 'Weekly Distance Target',
        description: 'Run 25km this week',
        goalType: 'distance_achievement',
        category: 'endurance',
        priority: 1,
        specificTarget: {
          metric: 'weekly_distance',
          value: 25,
          unit: 'km',
          description: 'Complete 25km in a week'
        },
        measurableMetrics: ['distance'],
        achievableAssessment: {
          currentLevel: 0,
          targetLevel: 25,
          feasibilityScore: 85
        },
        relevantContext: 'Weekly training target',
        timeBound: {
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          startDate: new Date(),
          totalDuration: 7,
          milestoneSchedule: [25, 50, 75]
        },
        baselineValue: 0,
        targetValue: 25,
        currentValue: 0,
        progressPercentage: 0,
        status: 'active'
      });

      // Record a run
      const runId = await dbUtils.recordRun({
        userId,
        distance: 8.5,
        duration: 45 * 60, // 45 minutes
        pace: (45 * 60) / 8.5, // seconds per km
        calories: 400,
        heartRate: 150,
        route: 'Local park loop',
        startedAt: new Date(),
        completedAt: new Date(),
        weather: 'Sunny, 18°C',
        notes: 'Good pace, felt strong'
      });

      // Update goal progress based on the run
      await dbUtils.recordGoalProgress({
        goalId,
        measurementDate: new Date(),
        measuredValue: 8.5,
        progressPercentage: (8.5 / 25) * 100,
        contributingActivityId: runId,
        contributingActivityType: 'run',
        autoRecorded: true
      });

      // Verify progress was recorded
      const progress = await goalProgressEngine.calculateGoalProgress(goalId);
      expect(progress?.currentValue).toBe(8.5);
      expect(progress?.progressPercentage).toBeCloseTo(34, 1); // 8.5/25 * 100
    });
  });
});