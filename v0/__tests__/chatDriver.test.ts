import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatDriver, chatDriver } from '../lib/chatDriver';

// Mock the AI SDK
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(),
    generateText: vi.fn(),
  };
});

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model) => ({ model })),
}));

// Mock the database utilities
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
  },
}));

describe('ChatDriver', () => {
  let originalEnv: any;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Reset all mocks
    vi.clearAllMocks();
    vi.useRealTimers();
    
    chatDriver.__resetForTests();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ChatDriver.getInstance();
      const instance2 = ChatDriver.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('health check', () => {
    it('should return unhealthy when API key is missing', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const health = await chatDriver.health();
      
      expect(health.available).toBe(false);
      expect(health.model).toBe('unavailable');
      expect(health.lastError).toBe('OpenAI API key not configured');
    });

    it('should return unhealthy when API key is placeholder', async () => {
      process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
      
      const health = await chatDriver.health();
      
      expect(health.available).toBe(false);
      expect(health.lastError).toBe('OpenAI API key not configured');
    });

    it('should perform health check with valid API key', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({
        text: 'pong',
        usage: { promptTokens: 1, completionTokens: 1 },
      });
      
      const health = await chatDriver.health();
      
      expect(health.available).toBe(true);
      expect(health.model).toBe('gpt-4o-mini');
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should cache health check results', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({
        text: 'pong',
        usage: { promptTokens: 1, completionTokens: 1 },
      });
      
      // First call
      await chatDriver.health();
      
      // Second call should use cache
      await chatDriver.health();
      
      // Should only call generateText once
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValue(new Error('API Error'));
      
      const health = await chatDriver.health();
      
      expect(health.available).toBe(false);
      expect(health.lastError).toBe('API Error');
    });
  });

  describe('ask method', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
    });

    it('should handle missing API key', async () => {
      process.env.OPENAI_API_KEY = '';
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      
      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('auth');
      expect(response.error?.message).toContain('temporarily unavailable');
    });

    it('should handle non-streaming request', async () => {
      const { generateText } = await import('ai');
      const { dbUtils } = await import('@/lib/dbUtils');
      
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello! How can I help you?',
        usage: { promptTokens: 10, completionTokens: 15 },
      });
      
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue({
        id: 1,
        goal: 'habit',
        experience: 'beginner',
        daysPerWeek: 3,
      } as any);
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        userId: 1,
        streaming: false,
      });
      
      expect(response.success).toBe(true);
      expect(response.data?.response).toBe('Hello! How can I help you?');
      expect(response.data?.tokensIn).toBeGreaterThan(0);
      expect(response.data?.tokensOut).toBeGreaterThan(0);
      expect(response.data?.requestId).toBeDefined();
    });

    it('should handle streaming request', async () => {
      const { streamText } = await import('ai');
      
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello '));
          controller.enqueue(new TextEncoder().encode('world!'));
          controller.close();
        },
      });
      
      vi.mocked(streamText).mockResolvedValue({
        toDataStreamResponse: () => ({ body: mockStream }),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 15 }),
      } as any);
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: true,
      });
      
      expect(response.success).toBe(true);
      expect(response.stream).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      // Simulate multiple rapid requests from the same user
      const requests = Array.from({ length: 52 }, () => 
        chatDriver.ask({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: 1,
          streaming: false,
        })
      );
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => !r.success && r.error?.type === 'rate_limit');
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should truncate long message history', async () => {
      const { generateText } = await import('ai');
      
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      }));
      
      vi.mocked(generateText).mockImplementation(async (params: any) => {
        // Check that messages were truncated
        expect(params.messages.length).toBeLessThanOrEqual(11); // 10 + 1 system message
        return {
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 15 },
        };
      });
      
      const response = await chatDriver.ask({
        messages: longHistory,
        streaming: false,
      });
      
      expect(response.success).toBe(true);
    });

    it('should handle timeout errors', async () => {
      const { generateText } = await import('ai');
      
      vi.mocked(generateText).mockImplementation(async () => {
        // Simulate a timeout
        await new Promise(resolve => setTimeout(resolve, 20000));
        return { text: 'Response', usage: { promptTokens: 10, completionTokens: 15 } };
      });
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('timeout');
    });

    it('should handle OpenAI API errors', async () => {
      const { generateText } = await import('ai');
      
      const apiError = new Error('API Error');
      (apiError as any).status = 429;
      (apiError as any).retryAfter = 60;
      
      vi.mocked(generateText).mockRejectedValue(apiError);
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('rate_limit');
      expect(response.error?.retryAfter).toBe(60);
    });

    it('should include user profile in system message', async () => {
      const { generateText } = await import('ai');
      const { dbUtils } = await import('@/lib/dbUtils');
      
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue({
        id: 1,
        goal: 'distance',
        experience: 'intermediate',
        daysPerWeek: 5,
      } as any);
      
      vi.mocked(generateText).mockImplementation(async (params: any) => {
        // Check that system message includes user profile
        const systemMessage = params.messages.find((m: any) => m.role === 'system');
        expect(systemMessage?.content).toContain('intermediate runner');
        expect(systemMessage?.content).toContain('goal: distance');
        expect(systemMessage?.content).toContain('5 days/week');
        
        return {
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 15 },
        };
      });
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        userId: 1,
        streaming: false,
      });
      
      expect(response.success).toBe(true);
    });
  });

  describe('token tracking', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
    });

    it('should track token usage and enforce limits', async () => {
      const { generateText } = await import('ai');
      
      // Mock a response that would exceed the monthly limit
      vi.mocked(generateText).mockResolvedValue({
        text: 'x'.repeat(800000), // Very long response to simulate high token usage
        usage: { promptTokens: 100000, completionTokens: 200000 },
      });
      
      // Make requests until quota is exceeded
      let quotaExceeded = false;
      for (let i = 0; i < 5; i++) {
        const response = await chatDriver.ask({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: 1,
          streaming: false,
        });
        
        if (!response.success && response.error?.type === 'quota') {
          quotaExceeded = true;
          break;
        }
      }
      
      expect(quotaExceeded).toBe(true);
    });
  });

  describe('error mapping', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
    });

    it('should map 401 errors to auth type', async () => {
      const { generateText } = await import('ai');
      
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;
      
      vi.mocked(generateText).mockRejectedValue(authError);
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('auth');
      expect(response.error?.code).toBe(401);
    });

    it('should map 500+ errors to server_error type', async () => {
      const { generateText } = await import('ai');
      
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      
      vi.mocked(generateText).mockRejectedValue(serverError);
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('server_error');
      expect(response.error?.code).toBe(500);
    });
  });

  describe('observability', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
    });

    it('should generate unique request IDs', async () => {
      const { generateText } = await import('ai');
      
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 15 },
      });
      
      const response1 = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello 1' }],
        streaming: false,
      });
      
      const response2 = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello 2' }],
        streaming: false,
      });
      
      expect(response1.data?.requestId).toBeDefined();
      expect(response2.data?.requestId).toBeDefined();
      expect(response1.data?.requestId).not.toBe(response2.data?.requestId);
    });

    it('should measure response duration', async () => {
      const { generateText } = await import('ai');
      
      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 15 },
        };
      });
      
      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });
      
      expect(response.success).toBe(true);
      expect(response.data?.duration).toBeGreaterThanOrEqual(100);
    });

    it('should provide metrics', () => {
      const metrics = chatDriver.getMetrics();
      
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('totalTokens');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('errorRate');
    });
  });
});
