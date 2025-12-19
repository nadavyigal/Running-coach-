import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { chatHandler } from '@/app/api/chat/route';

describe('Chat API Fallback', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    // Restore original key after each test
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns fallback JSON when OpenAI key is not configured', async () => {
    process.env.OPENAI_API_KEY = '';

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello from test' }],
      }),
    });

    const response = await chatHandler(request as any);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toHaveProperty('fallback', true);
    expect(typeof data.error).toBe('string');
  });

  it('returns fallback JSON when userId is provided but OpenAI key is missing', async () => {
    process.env.OPENAI_API_KEY = '';

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: '1',
        messages: [{ role: 'user', content: 'Hello from test' }],
      }),
    });

    const response = await chatHandler(request as any);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toHaveProperty('fallback', true);
    expect(typeof data.error).toBe('string');
  });
});

