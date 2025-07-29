import { describe, it, expect, beforeEach } from 'vitest';
import { goalDiscoveryEngine, type UserProfile, type GoalAnalysisContext } from './goalDiscoveryEngine';

describe('Goal Discovery Engine', () => {
  let mockUserProfile: UserProfile;

  beforeEach(() => {
    mockUserProfile = {
      experience: 'beginner',
      currentFitnessLevel: 5,
      availableTime: {
        daysPerWeek: 3,
        minutesPerSession: 30,
        preferredTimes: ['morning']
      },
      physicalLimitations: [],
      pastInjuries: [],
      motivations: ['improve health', 'build habit'],
      barriers: ['time constraints'],
      preferences: {
        coachingStyle: 'supportive',
        workoutTypes: [],
        environment: 'outdoor'
      },
      age: 25
    };
  });

  describe('discoverGoals', () => {
    it('should discover goals for a beginner user', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      expect(result).toBeDefined();
      expect(result.discoveredGoals).toBeInstanceOf(Array);
      expect(result.discoveredGoals.length).toBeGreaterThan(0);
      expect(result.primaryGoal).toBeDefined();
      expect(result.primaryGoal.title).toBeTruthy();
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      expect(result.estimatedSuccessProbability).toBeGreaterThan(0);
      expect(result.estimatedSuccessProbability).toBeLessThanOrEqual(1);
    });

    it('should prioritize consistency goals for beginners', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      expect(result.primaryGoal.category).toBe('consistency');
      expect(result.primaryGoal.goalType).toBe('frequency');
    });

    it('should adjust goals based on available time', async () => {
      const limitedTimeProfile = {
        ...mockUserProfile,
        availableTime: {
          daysPerWeek: 2,
          minutesPerSession: 20,
          preferredTimes: ['evening']
        }
      };

      const result = await goalDiscoveryEngine.discoverGoals(limitedTimeProfile);

      expect(result.primaryGoal.specificTarget.value).toBeLessThanOrEqual(2);
    });

    it('should generate appropriate goals for intermediate users', async () => {
      const intermediateProfile = {
        ...mockUserProfile,
        experience: 'intermediate' as const,
        currentFitnessLevel: 7,
        availableTime: {
          daysPerWeek: 4,
          minutesPerSession: 45,
          preferredTimes: ['morning', 'evening']
        },
        motivations: ['improve speed', 'race preparation']
      };

      const result = await goalDiscoveryEngine.discoverGoals(intermediateProfile);

      expect(result.discoveredGoals).toHaveLength(3);
      expect(['speed', 'endurance']).toContain(result.primaryGoal.category);
    });

    it('should generate challenging goals for advanced users', async () => {
      const advancedProfile = {
        ...mockUserProfile,
        experience: 'advanced' as const,
        currentFitnessLevel: 9,
        availableTime: {
          daysPerWeek: 6,
          minutesPerSession: 60,
          preferredTimes: ['morning', 'afternoon', 'evening']
        },
        motivations: ['competitive racing', 'personal records']
      };

      const result = await goalDiscoveryEngine.discoverGoals(advancedProfile);

      expect(result.primaryGoal.category).toBe('speed');
      expect(result.primaryGoal.confidence).toBeGreaterThan(0.7);
    });

    it('should incorporate conversation context when provided', async () => {
      const context: GoalAnalysisContext = {
        conversationHistory: [
          { role: 'user', content: 'I want to run a 5K race in 3 months' },
          { role: 'assistant', content: 'That\'s a great goal! Let\'s work on building up to that distance.' },
          { role: 'user', content: 'I can run about 2K now but get tired easily' }
        ]
      };

      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile, context);

      expect(result.discoveredGoals.some(goal => 
        goal.title.toLowerCase().includes('5k') || 
        goal.description.toLowerCase().includes('race')
      )).toBe(true);
    });

    it('should handle users with physical limitations', async () => {
      const limitedProfile = {
        ...mockUserProfile,
        physicalLimitations: ['knee issues', 'back pain'],
        pastInjuries: ['ankle sprain']
      };

      const result = await goalDiscoveryEngine.discoverGoals(limitedProfile);

      expect(result.primaryGoal.category).toBe('health');
      expect(result.recommendations.some(rec => 
        rec.toLowerCase().includes('gentle') || 
        rec.toLowerCase().includes('careful')
      )).toBe(true);
    });

    it('should provide relevant recommendations', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toMatch(/focus|prioritize|start/i);
    });

    it('should generate actionable next steps', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      expect(result.nextSteps).toBeInstanceOf(Array);
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toMatch(/complete|begin|schedule|track/i);
    });

    it('should handle edge case of no motivations gracefully', async () => {
      const noMotivationProfile = {
        ...mockUserProfile,
        motivations: []
      };

      // Should use fallback instead of throwing
      const result = await goalDiscoveryEngine.discoverGoals(noMotivationProfile);

      expect(result).toBeDefined();
      expect(result.primaryGoal).toBeDefined();
      expect(result.primaryGoal.title).toBe('Build Running Habit');
    });

    it('should return fallback goals when discovery fails', async () => {
      // Create an invalid profile that might cause errors
      const invalidProfile = {
        ...mockUserProfile,
        experience: 'invalid' as any,
        currentFitnessLevel: -1,
        availableTime: {
          daysPerWeek: 0,
          minutesPerSession: 0,
          preferredTimes: []
        }
      };

      const result = await goalDiscoveryEngine.discoverGoals(invalidProfile);

      expect(result).toBeDefined();
      expect(result.primaryGoal.title).toBe('Build Running Habit');
      expect(result.overallConfidence).toBe(0.7);
    });
  });

  describe('goal scoring and ranking', () => {
    it('should assign higher confidence to goals matching user motivations', async () => {
      const healthMotivatedProfile = {
        ...mockUserProfile,
        motivations: ['improve cardiovascular health', 'reduce stress', 'feel better']
      };

      const result = await goalDiscoveryEngine.discoverGoals(healthMotivatedProfile);

      const healthGoals = result.discoveredGoals.filter(goal => goal.category === 'health');
      const otherGoals = result.discoveredGoals.filter(goal => goal.category !== 'health');

      if (healthGoals.length > 0 && otherGoals.length > 0) {
        expect(healthGoals[0].confidence).toBeGreaterThan(otherGoals[0].confidence);
      }
    });

    it('should adjust goal difficulty based on fitness level', async () => {
      const lowFitnessProfile = {
        ...mockUserProfile,
        currentFitnessLevel: 2
      };

      const highFitnessProfile = {
        ...mockUserProfile,
        currentFitnessLevel: 9
      };

      const lowFitnessResult = await goalDiscoveryEngine.discoverGoals(lowFitnessProfile);
      const highFitnessResult = await goalDiscoveryEngine.discoverGoals(highFitnessProfile);

      // Lower fitness should get easier targets
      expect(lowFitnessResult.primaryGoal.targetValue).toBeLessThan(
        highFitnessResult.primaryGoal.targetValue
      );
    });

    it('should consider time availability in goal feasibility', async () => {
      const busyProfile = {
        ...mockUserProfile,
        availableTime: {
          daysPerWeek: 2,
          minutesPerSession: 20,
          preferredTimes: ['morning']
        }
      };

      const result = await goalDiscoveryEngine.discoverGoals(busyProfile);

      // Should have realistic targets for limited time
      expect(result.primaryGoal.achievableAssessment.feasibilityScore).toBeGreaterThan(60);
      expect(result.primaryGoal.specificTarget.value).toBeLessThanOrEqual(2);
    });
  });

  describe('goal personalization', () => {
    it('should create age-appropriate goals', async () => {
      const olderProfile = {
        ...mockUserProfile,
        age: 65,
        motivations: ['maintain health', 'stay active']
      };

      const result = await goalDiscoveryEngine.discoverGoals(olderProfile);

      expect(result.primaryGoal.category).toBe('health');
      expect(result.primaryGoal.reasoning).toMatch(/health|gentle|safe/i);
    });

    it('should align goals with coaching style preferences', async () => {
      const challengingProfile = {
        ...mockUserProfile,
        preferences: {
          ...mockUserProfile.preferences,
          coachingStyle: 'challenging'
        },
        motivations: ['push limits', 'competitive goals']
      };

      const result = await goalDiscoveryEngine.discoverGoals(challengingProfile);

      // Should include more ambitious targets or messaging
      expect(result.primaryGoal.confidence).toBeGreaterThan(0.6);
    });

    it('should generate complementary supporting goals', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      if (result.supportingGoals.length > 0) {
        // Supporting goals should have different categories from primary
        expect(result.supportingGoals[0].category).not.toBe(result.primaryGoal.category);
      }
    });
  });

  describe('success probability calculation', () => {
    it('should provide higher success probability for realistic goals', async () => {
      const realisticProfile = {
        ...mockUserProfile,
        currentFitnessLevel: 6,
        availableTime: {
          daysPerWeek: 3,
          minutesPerSession: 30,
          preferredTimes: ['morning']
        },
        motivations: ['build habit', 'improve health'],
        barriers: []
      };

      const result = await goalDiscoveryEngine.discoverGoals(realisticProfile);

      expect(result.estimatedSuccessProbability).toBeGreaterThan(0.7);
    });

    it('should provide lower success probability for challenging scenarios', async () => {
      const challengingProfile = {
        ...mockUserProfile,
        currentFitnessLevel: 2,
        availableTime: {
          daysPerWeek: 1,
          minutesPerSession: 15,
          preferredTimes: []
        },
        barriers: ['lack of time', 'low motivation', 'no safe running areas']
      };

      const result = await goalDiscoveryEngine.discoverGoals(challengingProfile);

      expect(result.estimatedSuccessProbability).toBeLessThan(0.8);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalProfile: UserProfile = {
        experience: 'beginner',
        currentFitnessLevel: 5,
        availableTime: {
          daysPerWeek: 3,
          minutesPerSession: 30,
          preferredTimes: []
        },
        physicalLimitations: [],
        pastInjuries: [],
        motivations: ['get fit'],
        barriers: [],
        preferences: {
          coachingStyle: 'supportive',
          workoutTypes: [],
          environment: 'both'
        }
        // age is optional and missing
      };

      const result = await goalDiscoveryEngine.discoverGoals(minimalProfile);

      expect(result).toBeDefined();
      expect(result.primaryGoal).toBeDefined();
    });

    it('should validate goal structure', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      // Check that all required goal fields are present
      expect(result.primaryGoal.id).toBeTruthy();
      expect(result.primaryGoal.title).toBeTruthy();
      expect(result.primaryGoal.description).toBeTruthy();
      expect(result.primaryGoal.goalType).toBeTruthy();
      expect(result.primaryGoal.category).toBeTruthy();
      expect(result.primaryGoal.priority).toBeGreaterThan(0);
      expect(result.primaryGoal.priority).toBeLessThanOrEqual(3);
      expect(result.primaryGoal.specificTarget).toBeDefined();
      expect(result.primaryGoal.timeBound).toBeDefined();
      expect(result.primaryGoal.timeBound.startDate).toBeInstanceOf(Date);
      expect(result.primaryGoal.timeBound.deadline).toBeInstanceOf(Date);
    });

    it('should ensure goal deadlines are in the future', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);
      const now = new Date();

      expect(result.primaryGoal.timeBound.deadline.getTime()).toBeGreaterThan(now.getTime());
      expect(result.primaryGoal.timeBound.startDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });

    it('should limit the number of goals returned', async () => {
      const result = await goalDiscoveryEngine.discoverGoals(mockUserProfile);

      expect(result.discoveredGoals.length).toBeLessThanOrEqual(5);
      expect(result.supportingGoals.length).toBeLessThanOrEqual(2);
    });
  });
});