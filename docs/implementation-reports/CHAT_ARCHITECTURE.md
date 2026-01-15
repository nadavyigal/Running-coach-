# Chat Architecture: Predictable & Debuggable AI Chat

This document outlines the new centralized chat architecture that provides predictable error handling, payload management, and comprehensive observability.

## Architecture Overview

### Core Components

1. **ChatDriver (`lib/chatDriver.ts`)**: Centralized AI service wrapper
2. **Server-Only Endpoints**: Client never talks directly to AI vendor APIs
3. **Payload Management**: Automatic truncation and token limits
4. **Typed Error Handling**: Comprehensive error mapping with retry guidance
5. **Observability**: Request tracing, metrics, and performance monitoring

### Key Features

- ✅ Single server endpoint path (no client-to-vendor calls)
- ✅ Strict payload caps with token metrics
- ✅ Streaming toggle with non-streaming fallback
- ✅ Typed error responses (401/429/5xx mapped to app errors)
- ✅ RequestId tracing and comprehensive logging
- ✅ Environment guards with graceful fallbacks

## API Endpoints

### 1. Health Check: `/api/chat/ping`

**Purpose**: Quick health check for chat service availability

```bash
curl http://localhost:3000/api/chat/ping
```

**Response (Healthy)**:
```json
{
  "success": true,
  "available": true,
  "model": "gpt-4o-mini",
  "latency": 150,
  "serviceLatency": 120,
  "quota": {
    "remaining": 180000,
    "resetAt": "2025-01-15T10:30:00.000Z"
  },
  "timestamp": "2025-01-15T09:30:00.000Z"
}
```

**Response (Unhealthy)**:
```json
{
  "success": false,
  "available": false,
  "error": "OpenAI API key not configured",
  "latency": 5,
  "timestamp": "2025-01-15T09:30:00.000Z"
}
```

### 2. General Chat: `/api/chat`

**GET**: Health check with detailed metrics
**POST**: Send chat messages

```bash
# Health check
curl http://localhost:3000/api/chat

# Chat request (non-streaming)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What should I eat before a long run?"}
    ],
    "streaming": false
  }'

# Chat request (streaming)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a 10K training plan"}
    ],
    "streaming": true
  }'
```

### 3. Onboarding Chat: `/api/onboarding/chat`

**Purpose**: AI-guided onboarding with phase-specific prompts

```bash
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I want to start running but I'"'"'m a complete beginner"}
    ],
    "currentPhase": "motivation",
    "streaming": true
  }'
```

## Error Handling

### Error Types and Responses

| Error Type | HTTP Code | Retry Strategy | Example Response |
|------------|-----------|----------------|------------------|
| `auth` | 401/503 | Manual intervention | API key not configured |
| `rate_limit` | 429 | Wait `retryAfter` seconds | Too many requests |
| `timeout` | 408 | Retry with shorter message | Request timed out |
| `quota` | 429 | Wait until quota reset | Monthly limit reached |
| `server_error` | 500+ | Exponential backoff | AI service unavailable |
| `validation` | 400 | Fix request format | Invalid message format |

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
- **P95 ≤ 1.5s** for local requests
- **P99 ≤ 3.0s** for all requests
- **Health check ≤ 100ms** (cached)

### Payload Limits
- **Max messages**: 10 per request (auto-truncated)
- **Max tokens**: 1000 per response
- **Profile summary**: ≤ 500 characters
- **Context window**: Last 10 messages + system prompt

### Rate Limits
- **Per user**: 50 requests/hour
- **Monthly tokens**: 200,000 per user
- **Concurrent requests**: 10 per user

## Observability & Analytics

### Request Tracing

Every request generates a unique `requestId` for full traceability:

```
[chat:ask] requestId=chat_1755011234567_abc123 Starting chat request
[chat:ask] requestId=chat_1755011234567_abc123 Messages count: 2, streaming: true
[chat:payload] requestId=chat_1755011234567_abc123 Prepared payload: {...}
[chat:ask] requestId=chat_1755011234567_abc123 ✅ Success - duration: 850ms, tokensIn: 45, tokensOut: 120
```

### Metrics Captured

- **Request duration** (end-to-end timing)
- **Tokens in/out** (for cost tracking)
- **Model used** (for performance analysis)
- **Error codes** (for reliability monitoring)
- **Context truncation** (for optimization)

### Log Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `[chat:health]` | Service health | `[chat:health] ✅ Healthy - latency: 120ms` |
| `[chat:ask]` | Request lifecycle | `[chat:ask] requestId=... Starting chat request` |
| `[chat:payload]` | Payload processing | `[chat:payload] requestId=... Truncated to 8 messages` |
| `[chat:error]` | Error handling | `[chat:error] requestId=... OpenAI error: Rate limit exceeded` |

## Environment Configuration

### Required Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

# Optional: Model Configuration
CHAT_DEFAULT_MODEL=gpt-4o-mini
CHAT_MAX_TOKENS=1000
CHAT_TIMEOUT_MS=15000
```

### Graceful Fallbacks

When `OPENAI_API_KEY` is missing:
1. Health check returns `available: false`
2. Chat requests return friendly fallback message
3. Onboarding redirects to guided form
4. No silent failures or cryptic errors

## Testing & Validation

### Unit Tests

```bash
# Run ChatDriver tests
npm run test -- --run chatDriver

# Run API integration tests
npm run test -- --run chat-integration

# Run API endpoint tests
npm run test -- --run api-chat-ping
```

### Smoke Tests

```bash
# Health checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/chat/ping

# Chat functionality (with API key)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"streaming":false}'

# Onboarding chat
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"currentPhase":"motivation"}'

# Error scenarios
export OPENAI_API_KEY=""
curl http://localhost:3000/api/chat/ping  # Should return error
```

### Performance Testing

```bash
# Load test with multiple concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Test '"$i"'"}],"streaming":false}' &
done
wait
```

## Debugging Guide

### Common Issues

**1. "AI coaching temporarily unavailable"**
- Check: `OPENAI_API_KEY` environment variable
- Verify: API key format (starts with `sk-`)
- Test: `curl http://localhost:3000/api/chat/ping`

**2. Request timeouts**
- Check: Message length and complexity
- Try: Shorter messages or non-streaming mode
- Monitor: Request duration in logs

**3. Rate limit errors**
- Check: Request frequency per user
- Wait: For `retryAfter` period
- Monitor: Token usage in logs

### Log Analysis

Search logs by patterns:
```bash
# Find all errors for a request
grep "requestId=chat_1755011234567_abc123" logs/app.log

# Find all rate limit issues
grep "rate_limit" logs/app.log

# Monitor performance
grep "✅ Success" logs/app.log | grep -o "duration: [0-9]*ms"
```

## Migration Guide

### From Existing Chat Routes

1. **Update imports**: Change from direct AI SDK to ChatDriver
2. **Replace error handling**: Use typed ChatError responses
3. **Add request IDs**: Include in all log messages
4. **Update tests**: Mock ChatDriver instead of AI SDK

### Example Migration

**Before**:
```typescript
import { streamText } from 'ai';
const result = await streamText({
  model: openai("gpt-4"),
  messages,
});
```

**After**:
```typescript
import { chatDriver } from '@/lib/chatDriver';
const response = await chatDriver.ask({
  messages,
  streaming: true,
});
if (!response.success) {
  return handleError(response.error);
}
```

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Availability**: Health check success rate
2. **Latency**: P95/P99 response times
3. **Error Rate**: 4xx/5xx response percentage
4. **Token Usage**: Daily/monthly consumption
5. **Rate Limits**: Users hitting limits

### Recommended Alerts

- Health check failure > 1 minute
- P95 latency > 2 seconds
- Error rate > 5%
- Token usage > 80% of quota
- High rate limit rejections

## Security Considerations

1. **API Key Protection**: Never expose in client code
2. **Rate Limiting**: Prevent abuse and cost overruns
3. **Input Validation**: Sanitize all user inputs
4. **Request Logging**: Exclude sensitive data from logs
5. **Error Messages**: Don't expose internal details

---

## Quick Reference

### Start Development
```bash
cd V0
npm run dev
```

### Health Check
```bash
curl http://localhost:3000/api/chat/ping
```

### Test Chat
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

### View Logs
```bash
# Follow real-time logs
tail -f logs/app.log | grep chat

# Search specific request
grep "requestId=YOUR_REQUEST_ID" logs/app.log
```
