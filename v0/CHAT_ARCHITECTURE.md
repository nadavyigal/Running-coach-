# Chat Architecture: Predictable & Debuggable AI Chat

This document outlines the centralized chat architecture that provides predictable error handling, payload management, and observability.

## Architecture Overview

### Core Components

1. **ChatDriver (`lib/chatDriver.ts`)**: centralized AI wrapper (payload caps, timeouts, typed errors)
2. **Server-only endpoints**: clients never call vendor APIs directly
3. **Payload management**: message truncation + token limits
4. **Typed errors**: consistent error types with retry guidance
5. **Observability**: request IDs, logs, health checks

### Key Features

- Single server endpoint path (no client-to-vendor calls)
- Strict payload caps with token metrics
- Streaming toggle with non-streaming fallback
- Typed error responses (401/429/5xx mapped to app errors)
- RequestId tracing and comprehensive logging
- Environment guards with graceful fallbacks

### SDK Versions

- AI SDK: `ai` v5
- OpenAI provider: `@ai-sdk/openai` v2
- Streaming contract: server returns `toDataStreamResponse()` output (the `0:{...}` chunked format expected by `useChat`)

## API Endpoints

### 1. Health Check: `/api/chat/ping`

Purpose: quick health check for chat availability and latency.

```bash
curl http://localhost:3000/api/chat/ping
```

### 2. General Chat: `/api/chat`

- `GET`: chat history (secured)
- `POST`: send chat messages (streaming)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What should I eat before a long run?"}
    ],
    "streaming": true
  }'
```

### 3. Onboarding Chat: `/api/onboarding/chat`

Purpose: AI-guided onboarding with phase-specific prompts.

```bash
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I want to start running but I am a complete beginner"}
    ],
    "userId": 123,
    "currentPhase": "motivation",
    "streaming": true
  }'
```

## Error Handling

### Error Types and Responses

| Error Type | HTTP Code | Retry Strategy | Notes |
|-----------|----------:|----------------|-------|
| `auth` | 401/503 | manual intervention | key missing/invalid |
| `rate_limit` | 429 | wait `retryAfter` | per-user rate limit |
| `timeout` | 408 | retry shorter request | hard timeout via abort |
| `quota` | 429 | wait until reset | monthly token budget |
| `server_error` | 500+ | exponential backoff | upstream failures |
| `validation` | 400 | fix request payload | invalid JSON/messages |

### Example Error Response

```json
{
  "success": false,
  "error": "Too many requests. Please wait before trying again.",
  "type": "rate_limit",
  "requestId": "chat_1755011234567_abc123",
  "retryAfter": 60
}
```

## Performance Targets

### Latency Targets

- P95 <= 1.5s for local requests
- P99 <= 3.0s for all requests
- Health check <= 100ms (cached when possible)

### Payload Limits

- Max messages: 10 per request (auto-truncated)
- Max output tokens: 1000 per response (configurable)
- Profile summary: <= 500 characters
- Context window: last N messages + system prompt

### Rate Limits

- Per user: 50 requests/hour
- Monthly tokens: 200,000 per user
- Concurrent requests: 10 per user

## Observability & Analytics

### Request Tracing

Every request generates a unique `requestId` for traceability:

```
[chat:ask] requestId=chat_1755011234567_abc123 Starting chat request
[chat:ask] requestId=chat_1755011234567_abc123 Messages count: 2, streaming: true
[chat:payload] requestId=chat_1755011234567_abc123 Prepared payload: {...}
[chat:ask] requestId=chat_1755011234567_abc123 OK - duration: 850ms, tokensIn: 45, tokensOut: 120
```

### Log Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `[chat:health]` | service health | `[chat:health] OK - latency: 120ms` |
| `[chat:ask]` | request lifecycle | `[chat:ask] requestId=... Starting chat request` |
| `[chat:payload]` | payload processing | `[chat:payload] requestId=... Truncated to 8 messages` |
| `[chat:error]` | error handling | `[chat:error] requestId=... OpenAI error: Rate limit exceeded` |

## Environment Configuration

### Required

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

### Optional: Chat Runtime Tuning

These defaults are reflected in `V0/.env.example`.

```bash
CHAT_DEFAULT_MODEL=gpt-4o-mini
CHAT_MAX_TOKENS=1000
CHAT_TIMEOUT_MS=15000
CHAT_COACHING_MODEL=gpt-4o
CHAT_MAX_MESSAGES=10
CHAT_MAX_PROFILE_SUMMARY_CHARS=500
CHAT_MONTHLY_TOKEN_BUDGET=200000
CHAT_HOURLY_REQUEST_LIMIT=50
CHAT_HEALTH_CACHE_TTL_MS=60000
```

### Graceful Fallbacks

When `OPENAI_API_KEY` is missing or invalid:

1. `/api/chat/ping` returns `available: false`
2. Chat endpoints return a friendly fallback error payload
3. Onboarding returns `{ fallback: true, redirectToForm: true }`
4. No silent failures or cryptic vendor errors

## Testing & Validation

### Unit Tests

```bash
cd V0
npm run test -- --run __tests__/chatDriver.test.ts
```

### Integration Tests

```bash
cd V0
npm run test -- --run __tests__/chat-integration.test.ts __tests__/api-chat-ping.test.ts
```

### Smoke Tests

```bash
# Health
curl http://localhost:3000/api/chat/ping

# Chat (non-streaming)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"streaming":false}'
```

## Migration Guide

### From direct AI SDK calls to `ChatDriver`

Before:

```ts
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const result = await streamText({ model: openai('gpt-4o-mini'), messages })
return result.toDataStreamResponse()
```

After:

```ts
import { chatDriver } from '@/lib/chatDriver'

const result = await chatDriver.ask({ messages, streaming: true })
if (!result.success) return Response.json({ error: result.error.message }, { status: result.error.code })
return new Response(result.stream)
```

## Risk Notes

- Streaming format: keep the `toDataStreamResponse()` / `0:{...}` contract stable for `useChat`.
- Timeouts: hard timeouts can surface previously hidden hangs; tune via `CHAT_TIMEOUT_MS` if needed.
- Token budgets: ensure limits align with expected conversation length and costs; tune via `CHAT_*`.
