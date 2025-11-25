import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/onboarding/chat/route';

describe('Onboarding Chat API Fallback', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    // Restore original key after each test
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns fallback JSON with redirectToForm when OpenAI key is missing', async () => {
    process.env.OPENAI_API_KEY = '';

    const request = new NextRequest('http://localhost:3000/api/onboarding/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello from test' }],
        currentPhase: 'motivation',
      }),
    });

    const response = await POST(request as unknown as Request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toHaveProperty('fallback', true);
    expect(data).toHaveProperty('redirectToForm', true);
    expect(typeof data.message).toBe('string');
  });
});

