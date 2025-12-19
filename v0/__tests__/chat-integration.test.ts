import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model) => ({ model })),
}));

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
  },
}));

import { chatDriver } from '../lib/chatDriver';

// Mock environment for testing
const originalEnv = { ...process.env };

describe('Chat Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env = { ...originalEnv };
    chatDriver.__resetForTests();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('Performance Targets', () => {
    it('should meet P95 latency target for local requests', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      // Mock AI responses to simulate realistic timing
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockImplementation(async () => {
        // Simulate realistic API response time
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
          text: 'This is a test response from the AI coach.',
          usage: { promptTokens: 20, completionTokens: 25 },
        };
      });

      const requests = [];
      const startTime = Date.now();

      // Perform multiple requests to test P95
      for (let i = 0; i < 20; i++) {
        requests.push(
          chatDriver.ask({
            messages: [{ role: 'user', content: `Test message ${i}` }],
            streaming: false,
          })
        );
      }

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All responses should be successful
      expect(responses.every(r => r.success)).toBe(true);

      // Calculate latencies
      const latencies = responses
        .filter(r => r.data)
        .map(r => r.data!.duration);

      // Sort latencies to find P95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      console.log(`P95 Latency: ${p95Latency}ms, Average: ${latencies.reduce((a, b) => a + b, 0) / latencies.length}ms`);

      // P95 should be under 1500ms for local testing
      expect(p95Latency).toBeLessThan(1500);
    }, 30000); // 30 second timeout for this test

    it('should handle concurrent requests efficiently', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({
        text: 'Concurrent response',
        usage: { promptTokens: 10, completionTokens: 15 },
      });

      // Send 10 concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        chatDriver.ask({
          messages: [{ role: 'user', content: `Concurrent message ${i}` }],
          userId: i + 1, // Different users to avoid rate limiting
          streaming: false,
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      // All should succeed
      expect(responses.every(r => r.success)).toBe(true);
      
      // Should complete faster than sequential execution
      expect(duration).toBeLessThan(10000); // 10 seconds max for 10 concurrent requests
    });
  });

  describe('Error Handling', () => {
    it('should show actionable error messages', async () => {
      // Test with missing API key
      process.env.OPENAI_API_KEY = '';

      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('temporarily unavailable');
      expect(response.error?.message).toContain('guided form');
    });

    it('should not fail silently', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValue(new Error('Network timeout'));

      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });

      // Should not fail silently - must return an error
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.requestId).toBeDefined();
    });

    it('should provide detailed error context', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      const apiError = new Error('Rate limit exceeded');
      (apiError as any).status = 429;
      (apiError as any).retryAfter = 120;
      
      vi.mocked(generateText).mockRejectedValue(apiError);

      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });

      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('rate_limit');
      expect(response.error?.code).toBe(429);
      expect(response.error?.retryAfter).toBe(120);
      expect(response.error?.requestId).toBeDefined();
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should trigger graceful fallback when API key is missing', async () => {
      process.env.OPENAI_API_KEY = '';

      const health = await chatDriver.health();
      
      expect(health.available).toBe(false);
      expect(health.lastError).toBe('OpenAI API key not configured');

      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: false,
      });

      expect(response.success).toBe(false);
      expect(response.error?.type).toBe('auth');
    });

    it('should handle streaming fallback to non-streaming', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      // Mock streaming to fail, but generateText to succeed
      const { streamText, generateText } = await import('ai');
      vi.mocked(streamText).mockRejectedValue(new Error('Streaming failed'));
      vi.mocked(generateText).mockResolvedValue({
        text: 'Fallback response',
        usage: { promptTokens: 10, completionTokens: 15 },
      });

      // This would typically be handled at the application level
      let streamingResponse = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Hello' }],
        streaming: true,
      });

      if (!streamingResponse.success) {
        // Fallback to non-streaming
        streamingResponse = await chatDriver.ask({
          messages: [{ role: 'user', content: 'Hello' }],
          streaming: false,
        });
      }

      expect(streamingResponse.success).toBe(true);
    });
  });

  describe('Analytics and Observability', () => {
    it('should capture tokens in/out for each request', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({
        text: 'This is a longer response that should generate more tokens than the input.',
        usage: { promptTokens: 25, completionTokens: 40 },
      });

      const response = await chatDriver.ask({
        messages: [{ role: 'user', content: 'Short question?' }],
        streaming: false,
      });

      expect(response.success).toBe(true);
      expect(response.data?.tokensIn).toBeGreaterThan(0);
      expect(response.data?.tokensOut).toBeGreaterThan(0);
      expect(response.data?.tokensOut).toBeGreaterThan(response.data?.tokensIn);
    });

    it('should include request duration', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
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
      expect(response.data?.duration).toBeGreaterThanOrEqual(200);
    });

    it('should provide unique request IDs for tracing', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 15 },
      });

      const responses = await Promise.all([
        chatDriver.ask({
          messages: [{ role: 'user', content: 'First' }],
          streaming: false,
        }),
        chatDriver.ask({
          messages: [{ role: 'user', content: 'Second' }],
          streaming: false,
        }),
      ]);

      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(true);
      
      const requestId1 = responses[0].data?.requestId;
      const requestId2 = responses[1].data?.requestId;
      
      expect(requestId1).toBeDefined();
      expect(requestId2).toBeDefined();
      expect(requestId1).not.toBe(requestId2);
    });
  });

  describe('Context Management', () => {
    it('should truncate long conversation history', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      let capturedMessages: any[] = [];
      
      vi.mocked(generateText).mockImplementation(async (params: any) => {
        capturedMessages = params.messages;
        return {
          text: 'Response',
          usage: { promptTokens: 10, completionTokens: 15 },
        };
      });

      // Create a long conversation history (15 messages)
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i + 1}`,
      }));

      const response = await chatDriver.ask({
        messages: longHistory,
        streaming: false,
      });

      expect(response.success).toBe(true);
      
      // Should have truncated to max messages + system message
      expect(capturedMessages.length).toBeLessThanOrEqual(11); // 10 max + 1 system
      
      // Should include system message and most recent messages
      expect(capturedMessages[0].role).toBe('system');
      expect(capturedMessages[capturedMessages.length - 1].content).toContain('Message 15');
    });

    it('should include user profile in system context', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const { generateText } = await import('ai');
      const { dbUtils } = await import('@/lib/dbUtils');
      
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue({
        id: 1,
        goal: 'marathon',
        experience: 'advanced',
        daysPerWeek: 6,
      } as any);

      let capturedMessages: any[] = [];
      vi.mocked(generateText).mockImplementation(async (params: any) => {
        capturedMessages = params.messages;
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
      
      const systemMessage = capturedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('advanced runner');
      expect(systemMessage.content).toContain('goal: marathon');
      expect(systemMessage.content).toContain('6 days/week');
    });
  });
});
