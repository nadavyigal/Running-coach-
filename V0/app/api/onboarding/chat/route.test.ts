import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { OnboardingSessionManager } from '@/lib/onboardingSessionManager';

// Mock dependencies
vi.mock('@/lib/onboardingSessionManager');
vi.mock('@/lib/db');
vi.mock('ai');
vi.mock('@ai-sdk/openai');

const mockOnboardingSessionManager = {
  loadSession: vi.fn(),
  createNewSession: vi.fn(),
  addMessageToHistory: vi.fn(),
  getConversationHistory: vi.fn(),
  updatePhase: vi.fn(),
};

describe('Onboarding Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (OnboardingSessionManager as any).mockImplementation(() => mockOnboardingSessionManager);
  });

  describe('POST /api/onboarding/chat', () => {
    it('should return 400 when userId is missing', async () => {
      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 503 when OpenAI API key is missing', async () => {
      // Mock missing API key
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(503);

      // Restore environment
      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    });

    it('should handle rate limiting correctly', async () => {
      // Mock OpenAI API key
      process.env.OPENAI_API_KEY = 'test-key';

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      // First request should work
      const response1 = await POST(request);
      expect(response1.status).toBe(200);

      // Second request should work (rate limit is 20 per hour)
      const response2 = await POST(request);
      expect(response2.status).toBe(200);
    });

    it('should handle token budget exceeded', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'A'.repeat(100000) }], // Very long message
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(429);
    });

    it('should create new session when none exists', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue(null);
      mockOnboardingSessionManager.createNewSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockOnboardingSessionManager.createNewSession).toHaveBeenCalled();
    });

    it('should add user message to history', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'I want to run a 5k' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mockOnboardingSessionManager.addMessageToHistory).toHaveBeenCalledWith('user', 'I want to run a 5k');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      // Mock OpenAI to throw an error
      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('OpenAI API error'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
      
      const responseData = await response.json();
      expect(responseData.fallback).toBe(true);
      expect(responseData.error).toBe('AI service temporarily unavailable');
    });

    it('should handle network errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      // Mock OpenAI to throw a network error
      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('network error'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
      
      const responseData = await response.json();
      expect(responseData.fallback).toBe(true);
      expect(responseData.error).toBe('Network connection failed. Please check your internet and try again.');
    });

    it('should handle timeout errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      // Mock OpenAI to throw a timeout error
      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('timeout'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(408);
      
      const responseData = await response.json();
      expect(responseData.fallback).toBe(true);
      expect(responseData.error).toBe('Request timeout. Please try again.');
    });

    it('should include proper headers in successful response', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      // Mock successful OpenAI response
      const { streamText } = await import('ai');
      const mockStream = {
        toDataStreamResponse: () => new Response('AI response', {
          headers: { 'Content-Type': 'text/plain' }
        })
      };
      vi.mocked(streamText).mockResolvedValue(mockStream as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Coaching-Interaction-Id')).toMatch(/^onboarding-/);
      expect(response.headers.get('X-Coaching-Confidence')).toBe('0.8');
      expect(response.headers.get('X-Onboarding-Next-Phase')).toBe('motivation');
    });

    it('should handle different phases correctly', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'assessment',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: []
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      // Mock successful OpenAI response
      const { streamText } = await import('ai');
      const mockStream = {
        toDataStreamResponse: () => new Response('AI response', {
          headers: { 'Content-Type': 'text/plain' }
        })
      };
      vi.mocked(streamText).mockResolvedValue(mockStream as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'I have some experience' }],
          userId: '123',
          currentPhase: 'assessment'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Onboarding-Next-Phase')).toBe('assessment');
    });
  });
}); 