import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/onboardingSessionManager', () => ({
  OnboardingSessionManager: vi.fn(),
}));

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
  };
});

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model) => ({ model })),
}));

vi.mock('@/lib/onboardingPromptBuilder', () => ({
  OnboardingPromptBuilder: {
    buildPrompt: vi.fn(() => 'test onboarding prompt'),
  },
}));

const mockOnboardingSessionManager = {
  loadSession: vi.fn(),
  createNewSession: vi.fn(),
  addMessageToHistory: vi.fn(),
  getConversationHistory: vi.fn(),
  updatePhase: vi.fn(),
};

describe('Onboarding Chat API', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  let POST: typeof import('./route').POST;
  let OnboardingSessionManager: typeof import('@/lib/onboardingSessionManager').OnboardingSessionManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();

    ({ POST } = await import('./route'));
    ({ OnboardingSessionManager } = await import('@/lib/onboardingSessionManager'));
    (OnboardingSessionManager as any).mockImplementation(() => mockOnboardingSessionManager);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    vi.useRealTimers();
  });

  describe('POST /api/onboarding/chat', () => {
    it('should return 400 when userId is missing', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 503 when OpenAI API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
    });

    it('should handle rate limiting correctly', async () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
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
          messages: [{ role: 'user', content: 'x'.repeat(6000) }],
          userId: '123',
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(429);
    });

    it('should create new session when none exists', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue(null);
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockResolvedValue({
        toDataStreamResponse: () => new Response('0:{"textDelta":"ok"}\n'),
      } as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
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
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockResolvedValue({
        toDataStreamResponse: () => new Response('0:{"textDelta":"ok"}\n'),
      } as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'I want to run a 5k' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
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
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('OpenAI API error'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
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
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('network error'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
    });

    it('should handle timeout errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('timeout'));

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(408);
    });

    it('should include proper headers in successful response', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'motivation',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockResolvedValue({
        toDataStreamResponse: () => new Response('0:{"textDelta":"ok"}\n'),
      } as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'motivation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Coaching-Interaction-Id')).toBeTruthy();
      expect(response.headers.get('X-Coaching-Confidence')).toBeTruthy();
      expect(response.headers.get('X-Onboarding-Next-Phase')).toBe('motivation');
    });

    it('should handle different phases correctly', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockOnboardingSessionManager.loadSession.mockResolvedValue({
        conversationId: 'test-session',
        goalDiscoveryPhase: 'assessment',
        discoveredGoals: [],
        coachingStyle: 'analytical',
        conversationHistory: [],
      });
      mockOnboardingSessionManager.getConversationHistory.mockResolvedValue([]);

      const { streamText } = await import('ai');
      vi.mocked(streamText).mockResolvedValue({
        toDataStreamResponse: () => new Response('0:{"textDelta":"ok"}\n'),
      } as any);

      const request = new Request('http://localhost/api/onboarding/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: '123',
          currentPhase: 'assessment',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Onboarding-Next-Phase')).toBe('assessment');
    });
  });
});

