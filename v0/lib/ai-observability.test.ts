import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aiObservabilityTestUtils, captureAIGeneration } from './ai-observability'

describe('ai-observability', () => {
  const originalEnv = { ...process.env }
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it('redacts contact details and data URLs before capture', () => {
    const redacted = aiObservabilityTestUtils.redactTelemetryValue({
      name: 'Nadav',
      email: 'nadav@example.com',
      phone: '+1 (555) 123-4567',
      prompt: 'Email nadav@example.com with data:image/png;base64,abc123',
    })

    expect(redacted).toEqual({
      name: '[redacted-name]',
      email: '[redacted-email]',
      phone: '[redacted-phone]',
      prompt: 'Email [redacted-email] with [redacted-data-url]',
    })
  })

  it('captures a PostHog $ai_generation event with trace metadata', async () => {
    process.env.POSTHOG_API_KEY = 'phc_test'
    process.env.POSTHOG_HOST = 'https://us.i.posthog.com'
    vi.stubGlobal('window', undefined)
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    global.fetch = fetchMock as typeof fetch

    await captureAIGeneration({
      traceName: 'generate-plan',
      distinctId: 42,
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Build a plan' }],
      output: { title: 'Plan' },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      latencyMs: 1234,
      properties: { request_id: 'req_1' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.i.posthog.com/capture/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.event).toBe('$ai_generation')
    expect(body.api_key).toBe('phc_test')
    expect(body.properties).toEqual(
      expect.objectContaining({
        distinct_id: '42',
        $ai_provider: 'openai',
        $ai_model: 'gpt-4o',
        $ai_trace_name: 'generate-plan',
        $ai_input_tokens: 10,
        $ai_output_tokens: 20,
        $ai_total_tokens: 30,
        $ai_latency: 1234,
        request_id: 'req_1',
      })
    )
  })
})
