import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PUT, GET } from './route';

// Mock the goal discovery engine
vi.mock('@/lib/goalDiscoveryEngine', () => ({
  goalDiscoveryEngine: {
    discoverGoals: vi.fn()
  }
}));

// Mock the AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn()
}));

// Mock the OpenAI SDK
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn()
}));

describe('Goal Discovery API', () => {
  let mockRequest: NextRequest;
  let mockUserProfile: any;

  beforeEach(async () => {
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
      age: 25,
      goals: []
    };

    // Mock the goal discovery engine response
    const { goalDiscoveryEngine } = await import('@/lib/goalDiscoveryEngine');
    goalDiscoveryEngine.discoverGoals.mockResolvedValue({
      discoveredGoals: [
        {
          id: 'goal-1',
          title: 'Build Running Habit',
          description: 'Establish consistent running routine',
          goalType: 'frequency',
          category: 'consistency',
          priority: 1,
          confidence: 0.8,
          reasoning: 'Perfect for beginners',
          specificTarget: {
            metric: 'weekly_runs',
            value: 3,
            unit: 'runs/week',
            description: 'Run 3 times per week'
          },
          measurableMetrics: ['weekly_runs'],
          achievableAssessment: {
            currentLevel: 0,
            targetLevel: 3,
            feasibilityScore: 85
          },
          relevantContext: 'Beginner-friendly goal',
          timeBound: {
            startDate: new Date(),
            deadline: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
            totalDuration: 56,
            milestoneSchedule: [25, 50, 75]
          },
          baselineValue: 0,
          targetValue: 3,
          motivationalFactors: ['health', 'habit'],
          potentialBarriers: ['time'],
          suggestedActions: ['Schedule runs', 'Start slowly']
        }
      ],
      primaryGoal: {
        id: 'goal-1',
        title: 'Build Running Habit',
        category: 'consistency',
        confidence: 0.8
      },
      supportingGoals: [],
      overallConfidence: 0.8,
      recommendations: ['Start with consistency'],
      nextSteps: ['Complete onboarding'],
      estimatedSuccessProbability: 0.85
    });

    vi.clearAllMocks();
  });

  describe('POST /api/goals/discovery', () => {
    it('should discover goals successfully with valid request', async () => {
      const requestBody = {
        userProfile: mockUserProfile,
        context: {},
        includeAIEnhancement: false,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.discoveredGoals).toBeDefined();
      expect(responseData.primaryGoal).toBeDefined();
      expect(responseData.overallConfidence).toBe(0.8);
      expect(responseData.estimatedSuccessProbability).toBe(0.85);
      expect(responseData.metadata).toBeDefined();
      expect(responseData.metadata.discoveryTimestamp).toBeTruthy();
      expect(responseData.metadata.engineVersion).toBe('1.0.0');
    });

    it('should include AI enhancement when requested', async () => {
      // Mock AI enhancement
      const { generateObject } = require('ai');
      generateObject.mockResolvedValue({
        object: {
          suitabilityAnalysis: {
            recommendedGoalTypes: ['consistency', 'health'],
            priorityRanking: ['primary', 'secondary'],
            avoidGoalTypes: [],
            reasonings: ['Good for beginners']
          },
          personalizationInsights: {
            experienceAdjustments: 'Start slow',
            timelineConsiderations: '8 weeks is realistic',
            motivationalFactors: ['health', 'habit'],
            coachingStyleAlignment: 'Supportive approach works well'
          },
          riskAssessment: {
            primaryBarriers: ['time constraints'],
            successFactors: ['motivation', 'realistic goals'],
            safetyConsiderations: ['avoid overexertion'],
            mitigationStrategies: ['flexible scheduling']
          },
          specificRecommendations: [
            {
              goalType: 'consistency',
              title: 'Running Consistency',
              description: 'Build regular habit',
              targetValue: 3,
              targetUnit: 'runs/week',
              timeline: 56,
              reasoning: 'Perfect for beginners',
              confidence: 0.9
            }
          ],
          overallConfidence: 0.85,
          additionalNotes: 'Strong foundation for success'
        }
      });

      const requestBody = {
        userProfile: mockUserProfile,
        context: {},
        includeAIEnhancement: true,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.metadata.aiEnhanced).toBe(true);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should handle invalid request data', async () => {
      const invalidRequestBody = {
        userProfile: {
          // Missing required fields
          experience: 'invalid_experience',
          motivations: [] // Empty array should fail validation
        }
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid request data');
      expect(responseData.details).toBeDefined();
    });

    it('should limit goals to maxGoals parameter', async () => {
      // Mock multiple goals
    const { goalDiscoveryEngine } = require('../../../../lib/goalDiscoveryEngine');
      goalDiscoveryEngine.discoverGoals.mockResolvedValue({
        discoveredGoals: [
          { id: 'goal-1', title: 'Goal 1', category: 'consistency' },
          { id: 'goal-2', title: 'Goal 2', category: 'health' },
          { id: 'goal-3', title: 'Goal 3', category: 'speed' },
          { id: 'goal-4', title: 'Goal 4', category: 'endurance' },
          { id: 'goal-5', title: 'Goal 5', category: 'strength' }
        ],
        primaryGoal: { id: 'goal-1', title: 'Goal 1' },
        supportingGoals: [
          { id: 'goal-2', title: 'Goal 2' },
          { id: 'goal-3', title: 'Goal 3' },
          { id: 'goal-4', title: 'Goal 4' },
          { id: 'goal-5', title: 'Goal 5' }
        ],
        overallConfidence: 0.8,
        recommendations: [],
        nextSteps: [],
        estimatedSuccessProbability: 0.8
      });

      const requestBody = {
        userProfile: mockUserProfile,
        context: {},
        includeAIEnhancement: false,
        maxGoals: 2
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.discoveredGoals).toHaveLength(2);
      expect(responseData.supportingGoals).toHaveLength(1); // Primary goal + 1 supporting
    });

    it('should handle goal discovery engine errors gracefully', async () => {
      const { goalDiscoveryEngine } = await import('@/lib/goalDiscoveryEngine');
      goalDiscoveryEngine.discoverGoals.mockRejectedValue(new Error('Discovery failed'));

      const requestBody = {
        userProfile: mockUserProfile,
        context: {},
        includeAIEnhancement: false,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Goal discovery failed');
      expect(responseData.fallback).toBe(true);
    });

    it('should continue with core results when AI enhancement fails', async () => {
      const { generateObject } = require('ai');
      generateObject.mockRejectedValue(new Error('AI service unavailable'));

      const requestBody = {
        userProfile: mockUserProfile,
        context: {},
        includeAIEnhancement: true,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.discoveredGoals).toBeDefined();
      expect(responseData.metadata.aiEnhanced).toBe(true); // Still requested
    });

    it('should include conversation context in analysis', async () => {
      const requestBody = {
        userProfile: mockUserProfile,
        context: {
          conversationHistory: [
            { role: 'user', content: 'I want to run a 5K' },
            { role: 'assistant', content: 'Great goal!' }
          ]
        },
        includeAIEnhancement: false,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      
      expect(response.status).toBe(200);
      
      const { goalDiscoveryEngine } = await import('@/lib/goalDiscoveryEngine');
      expect(goalDiscoveryEngine.discoverGoals).toHaveBeenCalledWith(
        mockUserProfile,
        expect.objectContaining({
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'I want to run a 5K' })
          ])
        })
      );
    });
  });

  describe('PUT /api/goals/discovery', () => {
    it('should refine goals based on user feedback', async () => {
      const requestBody = {
        goals: [
          { id: 'goal-1', title: 'Original Goal', targetValue: 3 }
        ],
        userFeedback: 'This seems too easy, can we make it more challenging?',
        adjustmentType: 'difficulty'
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PUT(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.refinedGoals).toBeDefined();
      expect(responseData.adjustmentsMade).toBeDefined();
      expect(responseData.message).toBe('Goals refined successfully');
    });

    it('should handle invalid refinement data', async () => {
      const invalidRequestBody = {
        goals: 'invalid', // Should be array
        userFeedback: '',
        adjustmentType: 'invalid_type'
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'PUT',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await PUT(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid refinement data');
    });
  });

  describe('GET /api/goals/discovery', () => {
    it('should return discovery capabilities', async () => {
      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.supportedExperienceLevels).toEqual(['beginner', 'intermediate', 'advanced']);
      expect(responseData.availableGoalTypes).toContain('consistency');
      expect(responseData.maxGoalsPerUser).toBe(5);
      expect(responseData.aiEnhancementAvailable).toBe(true);
      expect(responseData.features).toBeDefined();
      expect(responseData.features.personalizedGoalGeneration).toBe(true);
    });

    it('should return experience-specific capabilities when requested', async () => {
      mockRequest = new NextRequest('http://localhost/api/goals/discovery?experience=beginner', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.templates).toBeDefined();
      expect(responseData.templates.beginner).toBeDefined();
    });

    it('should handle capability retrieval errors', async () => {
      // Mock an error in capability retrieval
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Force an error by mocking URL constructor to throw
      const OriginalURL = global.URL;
      global.URL = class extends OriginalURL {
        constructor(...args: any[]) {
          super(...args);
          throw new Error('URL parsing failed');
        }
      } as any;

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to get discovery capabilities');

      // Restore
      global.URL = OriginalURL;
      console.error = originalConsoleError;
    });
  });

  describe('Metadata calculation', () => {
    it('should calculate profile completeness correctly', async () => {
      const incompleteProfile = {
        ...mockUserProfile,
        age: undefined,
        motivations: ['health'], // Fewer motivations
        availableTime: {
          daysPerWeek: 3,
          minutesPerSession: 30,
          preferredTimes: [] // No preferred times
        }
      };

      const requestBody = {
        userProfile: incompleteProfile,
        context: {},
        includeAIEnhancement: false,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.metadata.confidenceFactors.profileCompleteness).toBeLessThan(1);
      expect(responseData.metadata.confidenceFactors.motivationClarity).toBe(0.2); // 1/5
    });

    it('should assess time realism appropriately', async () => {
      const unrealisticProfile = {
        ...mockUserProfile,
        availableTime: {
          daysPerWeek: 7,
          minutesPerSession: 120, // Too much time
          preferredTimes: ['morning']
        }
      };

      const requestBody = {
        userProfile: unrealisticProfile,
        context: {},
        includeAIEnhancement: false,
        maxGoals: 3
      };

      mockRequest = new NextRequest('http://localhost/api/goals/discovery', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.metadata.confidenceFactors.timeRealism).toBeLessThan(1);
    });
  });
});