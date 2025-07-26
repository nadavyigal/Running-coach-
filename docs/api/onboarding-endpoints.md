# Onboarding API Documentation

## Overview
This document provides comprehensive documentation for the onboarding API endpoints in the Run-Smart application. It includes authentication, request/response formats, error handling, and usage examples.

## Base URL
```
Production: https://api.run-smart.com
Development: http://localhost:3000
```

## Authentication
All onboarding endpoints require authentication via session tokens or API keys.

### Session Authentication
```javascript
// Include session token in headers
headers: {
  'Authorization': 'Bearer <session-token>',
  'Content-Type': 'application/json'
}
```

### API Key Authentication
```javascript
// Include API key in headers
headers: {
  'X-API-Key': '<api-key>',
  'Content-Type': 'application/json'
}
```

## Endpoints

### 1. Onboarding Chat API

#### POST `/api/onboarding/chat`
Handles AI-guided onboarding conversations with real-time streaming responses.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I want to start running to improve my fitness"
    }
  ],
  "userId": "user-123",
  "userContext": {
    "age": 25,
    "experience": "beginner",
    "motivations": ["fitness", "weight-loss"],
    "barriers": ["time", "motivation"]
  },
  "currentPhase": "motivation"
}
```

**Response (Streaming):**
```json
{
  "content": "That's a great goal! Let me help you create a personalized running plan...",
  "role": "assistant",
  "timestamp": "2025-01-13T10:30:00Z",
  "coachingInteractionId": "onboarding-1705140600000",
  "confidence": 0.85,
  "adaptations": ["fitness-focus", "beginner-friendly"]
}
```

**Error Response:**
```json
{
  "error": "OpenAI API service unavailable",
  "fallback": true,
  "message": "Please try again in a few minutes or use the guided form",
  "retryAfter": 30000
}
```

**Enhanced Error Responses (New):**
```json
{
  "error": "Content-Type must be application/json",
  "fallback": true
}
```
```json
{
  "error": "Request body cannot be empty",
  "fallback": true
}
```
```json
{
  "error": "Invalid JSON in request body",
  "fallback": true
}
```
```json
{
  "error": "Messages array is required and cannot be empty",
  "fallback": true
}
```
```json
{
  "error": "AI service is not configured",
  "fallback": true,
  "message": "Please configure your OpenAI API key to use the AI coach."
}
```

**Status Codes:**
- `200` - Success (streaming response)
- `400` - Bad Request (invalid input, missing fields, invalid JSON)
- `401` - Unauthorized (missing/invalid token)
- `503` - Service Unavailable (AI service down, missing API key)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error (unexpected errors)

### 2. Goal Wizard API

#### POST `/api/onboarding/goalWizard`
Assists in creating SMART goals based on user motivations and context.

**Request Body:**
```json
{
  "motivations": ["fitness", "weight-loss"],
  "barriers": ["time", "motivation"],
  "experience": "beginner",
  "age": 25,
  "availability": {
    "daysPerWeek": 3,
    "preferredTimes": ["morning", "evening"]
  }
}
```

**Response:**
```json
{
  "goals": [
    {
      "id": "goal-123",
      "title": "Build Running Habit",
      "description": "Establish a consistent running routine",
      "type": "primary",
      "specific": "Run 3 times per week",
      "measurable": "Track runs in app",
      "achievable": "Start with 10-minute runs",
      "relevant": "Supports fitness goals",
      "timeBound": "Complete in 21 days",
      "targetDate": "2025-02-03T00:00:00Z"
    }
  ],
  "coachingStyle": "supportive",
  "confidence": 0.9
}
```

**Error Response:**
```json
{
  "error": "Invalid goal parameters",
  "fallback": true,
  "message": "Please provide valid motivation and experience information"
}
```

### 3. Assessment API

#### POST `/api/onboarding/assessment`
Provides dynamic questioning based on user responses and context.

**Request Body:**
```json
{
  "currentPhase": "assessment",
  "userResponses": [
    {
      "question": "What's your primary motivation for running?",
      "answer": "I want to improve my fitness"
    }
  ],
  "context": {
    "age": 25,
    "experience": "beginner"
  }
}
```

**Response:**
```json
{
  "nextQuestion": "How much time can you dedicate to running each week?",
  "phase": "assessment",
  "progress": 0.4,
  "suggestedQuestions": [
    "What's your current fitness level?",
    "Do you have any injuries or health concerns?"
  ]
}
```

### 4. Plan Generation API

#### POST `/api/generate-plan`
Generates personalized training plans based on onboarding data.

**Request Body:**
```json
{
  "goal": "habit",
  "age": 25,
  "experience": "beginner",
  "availability": {
    "daysPerWeek": 3,
    "preferredTimes": ["morning", "evening"]
  },
  "rookie_challenge": true,
  "userContext": {
    "motivations": ["fitness"],
    "barriers": ["time"]
  }
}
```

**Response:**
```json
{
  "plan": {
    "id": "plan-123",
    "userId": "user-123",
    "goal": "habit",
    "duration": 21,
    "rookie_challenge": true,
    "workouts": [
      {
        "id": "workout-1",
        "week": 1,
        "day": 1,
        "type": "easy",
        "duration": 10,
        "description": "Gentle walk/run intervals"
      }
    ]
  },
  "analytics": {
    "planGenerated": true,
    "userProfile": "beginner-fitness-focus"
  }
}
```

**Error Response:**
```json
{
  "error": "Plan generation failed",
  "fallback": true,
  "message": "Using fallback plan generation",
  "plan": {
    "id": "fallback-plan-123",
    "goal": "habit",
    "duration": 14,
    "rookie_challenge": true
  }
}
```

### 5. Session Management API

#### GET `/api/onboarding/session/{sessionId}`
Retrieves onboarding session data for resuming incomplete sessions.

**Response:**
```json
{
  "sessionId": "session-123",
  "userId": "user-123",
  "phase": "motivation",
  "progress": 0.3,
  "conversationHistory": [
    {
      "role": "user",
      "content": "I want to start running",
      "timestamp": "2025-01-13T10:30:00Z"
    }
  ],
  "goals": [],
  "userContext": {
    "age": 25,
    "experience": "beginner"
  }
}
```

#### POST `/api/onboarding/session`
Creates a new onboarding session.

**Request Body:**
```json
{
  "userId": "user-123",
  "initialContext": {
    "age": 25,
    "experience": "beginner"
  }
}
```

**Response:**
```json
{
  "sessionId": "session-123",
  "phase": "motivation",
  "progress": 0.0,
  "createdAt": "2025-01-13T10:30:00Z"
}
```

#### PUT `/api/onboarding/session/{sessionId}`
Updates onboarding session data.

**Request Body:**
```json
{
  "phase": "assessment",
  "progress": 0.5,
  "goals": [
    {
      "id": "goal-123",
      "title": "Build Running Habit"
    }
  ]
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error message",
  "fallback": true,
  "message": "User-friendly error message",
  "retryAfter": 30000,
  "details": {
    "code": "RATE_LIMITED",
    "timestamp": "2025-01-13T10:30:00Z"
  }
}
```

### Common Error Codes
- `INVALID_INPUT` - Request body validation failed
- `INVALID_JSON` - JSON parsing error in request body
- `EMPTY_REQUEST` - Request body cannot be empty
- `INVALID_CONTENT_TYPE` - Content-Type must be application/json
- `MISSING_REQUIRED_FIELDS` - Required fields (messages, currentPhase) missing
- `UNAUTHORIZED` - Missing or invalid authentication
- `RATE_LIMITED` - Too many requests
- `SERVICE_UNAVAILABLE` - AI service unavailable
- `API_KEY_MISSING` - OpenAI API key not configured
- `DATABASE_ERROR` - Database operation failed
- `SESSION_EXPIRED` - Session token expired
- `VALIDATION_ERROR` - Input validation failed

### Rate Limiting
- **Onboarding Chat**: 20 requests per hour per user
- **Goal Wizard**: 50 requests per hour per user
- **Assessment**: 100 requests per hour per user
- **Plan Generation**: 10 requests per hour per user

### Retry Logic
```javascript
// Exponential backoff retry
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};
```

## Usage Examples

### Complete Onboarding Flow
```javascript
// 1. Start onboarding session
const session = await fetch('/api/onboarding/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    userId: 'user-123',
    initialContext: { age: 25, experience: 'beginner' }
  })
});

// 2. Start AI conversation
const chatResponse = await fetch('/api/onboarding/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'I want to start running' }],
    userId: 'user-123',
    currentPhase: 'motivation'
  })
});

// 3. Generate goals
const goals = await fetch('/api/onboarding/goalWizard', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    motivations: ['fitness'],
    experience: 'beginner',
    age: 25
  })
});

// 4. Generate training plan
const plan = await fetch('/api/generate-plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    goal: 'habit',
    age: 25,
    experience: 'beginner',
    rookie_challenge: true
  })
});
```

### Error Handling Example
```javascript
const handleOnboardingError = async (endpoint, data) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (error.fallback) {
        // Use fallback mechanism
        return await useFallbackOnboarding(data);
      }
      
      if (error.retryAfter) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, error.retryAfter));
        return await handleOnboardingError(endpoint, data);
      }
      
      throw new Error(error.message);
    }

    return await response.json();
  } catch (error) {
    console.error('Onboarding error:', error);
    // Show user-friendly error message
    showErrorToast(error.message);
  }
};
```

## Testing

### Test Endpoints
```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "currentPhase": "motivation"
  }'

# Test goal wizard
curl -X POST http://localhost:3000/api/onboarding/goalWizard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "motivations": ["fitness"],
    "experience": "beginner"
  }'

# Test plan generation
curl -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "goal": "habit",
    "age": 25,
    "experience": "beginner"
  }'
```

### Mock Responses
```javascript
// Mock successful response
const mockChatResponse = {
  content: "I understand you want to start running. Let's create a personalized plan for you.",
  role: "assistant",
  timestamp: new Date().toISOString(),
  coachingInteractionId: "mock-interaction-123"
};

// Mock error response
const mockErrorResponse = {
  error: "Service unavailable",
  fallback: true,
  message: "Please try again later",
  retryAfter: 30000
};
```

## Security Considerations

### Input Validation
- All user inputs are sanitized and validated
- Age must be between 13-100
- Experience must be one of: "beginner", "occasional", "regular"
- Goals must pass safety validation

### Rate Limiting
- Implemented per-user rate limiting
- Exponential backoff for retries
- Circuit breaker pattern for service failures

### Data Privacy
- Session data encrypted in transit
- User data anonymized for analytics
- GDPR compliance for all data handling

## Performance Guidelines

### Response Times
- **Chat API**: < 5 seconds for initial response
- **Goal Wizard**: < 2 seconds
- **Plan Generation**: < 3 seconds
- **Session Management**: < 1 second

### Caching
- Session data cached locally
- Plan templates cached server-side
- User context cached for session duration

### Monitoring
- Response time monitoring
- Error rate tracking
- Usage analytics
- Service health checks

---

*Last Updated: 2025-07-23*
*Version: 1.1*
*Maintained by: Development Team*

## Recent Updates
- Enhanced chat API error handling and validation
- Improved JSON parsing with better error messages
- Added comprehensive request validation
- Updated error codes and responses for better debugging 