# Recovery Metrics API Reference

## Overview
The Recovery Metrics API provides comprehensive endpoints for tracking, calculating, and retrieving recovery-related data in the Run-Smart application. This includes sleep data, heart rate variability (HRV), subjective wellness metrics, and computed recovery scores.

## Base URL
All recovery API endpoints are prefixed with `/api/recovery/`

## Authentication
Currently, all recovery endpoints use local database storage without authentication. User identification is handled through browser session data.

## Endpoints

### Recovery Score

#### GET `/api/recovery/score`
Retrieves the current recovery score for the user.

**Response:**
```json
{
  "score": 85,
  "confidence": 0.9,
  "timestamp": "2025-07-23T10:00:00Z",
  "breakdown": {
    "sleep": 0.85,
    "hrv": 0.80,
    "restingHR": 0.90,
    "wellness": 0.85,
    "trainingLoad": 0.75
  },
  "recommendation": "Good recovery - moderate training recommended"
}
```

#### POST `/api/recovery/score`
Calculates a new recovery score based on current data.

**Request Body:**
```json
{
  "forceRecalculation": true
}
```

**Response:** Same as GET response above.

### Sleep Data

#### GET `/api/recovery/sleep`
Retrieves sleep data for the user.

**Query Parameters:**
- `date` (optional): ISO date string (YYYY-MM-DD)
- `days` (optional): Number of days to retrieve (default: 7)

**Response:**
```json
{
  "sleepData": [
    {
      "id": 1,
      "date": "2025-07-23",
      "duration": 8.5,
      "efficiency": 85,
      "deepSleep": 25,
      "remSleep": 20,
      "quality": "good",
      "bedTime": "22:30",
      "wakeTime": "07:00",
      "createdAt": "2025-07-23T07:30:00Z"
    }
  ]
}
```

#### POST `/api/recovery/sleep`
Saves new sleep data for the user.

**Request Body:**
```json
{
  "date": "2025-07-23",
  "duration": 8.5,
  "efficiency": 85,
  "deepSleep": 25,
  "remSleep": 20,
  "quality": "good",
  "bedTime": "22:30",
  "wakeTime": "07:00"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "message": "Sleep data saved successfully"
}
```

### Heart Rate Variability (HRV)

#### GET `/api/recovery/hrv`
Retrieves HRV measurements for the user.

**Query Parameters:**
- `date` (optional): ISO date string (YYYY-MM-DD)
- `days` (optional): Number of days to retrieve (default: 7)

**Response:**
```json
{
  "hrvData": [
    {
      "id": 1,
      "date": "2025-07-23",
      "rmssd": 45.2,
      "sdnn": 52.8,
      "pnn50": 18.5,
      "restingHR": 58,
      "timestamp": "2025-07-23T07:00:00Z",
      "deviceType": "applewatch",
      "createdAt": "2025-07-23T07:30:00Z"
    }
  ]
}
```

#### POST `/api/recovery/hrv`
Saves new HRV measurement data.

**Request Body:**
```json
{
  "date": "2025-07-23",
  "rmssd": 45.2,
  "sdnn": 52.8,
  "pnn50": 18.5,
  "restingHR": 58,
  "deviceType": "applewatch"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "message": "HRV data saved successfully"
}
```

### Subjective Wellness

#### GET `/api/recovery/wellness`
Retrieves subjective wellness data for the user.

**Query Parameters:**
- `date` (optional): ISO date string (YYYY-MM-DD)
- `days` (optional): Number of days to retrieve (default: 7)

**Response:**
```json
{
  "wellnessData": [
    {
      "id": 1,
      "date": "2025-07-23",
      "energy": 8,
      "mood": 7,
      "motivation": 8,
      "soreness": 3,
      "stress": 4,
      "sleep": 8,
      "notes": "Feeling great today!",
      "createdAt": "2025-07-23T08:00:00Z"
    }
  ]
}
```

#### POST `/api/recovery/wellness`
Saves new subjective wellness data.

**Request Body:**
```json
{
  "date": "2025-07-23",
  "energy": 8,
  "mood": 7,
  "motivation": 8,
  "soreness": 3,
  "stress": 4,
  "sleep": 8,
  "notes": "Feeling great today!"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "message": "Wellness data saved successfully"
}
```

### Recovery Recommendations

#### GET `/api/recovery/recommendations`
Retrieves personalized recovery recommendations based on current data.

**Response:**
```json
{
  "recommendations": [
    {
      "type": "training",
      "priority": "high",
      "title": "Moderate Training Recommended",
      "description": "Your recovery score is good. Consider moderate intensity training today.",
      "confidence": 0.9
    },
    {
      "type": "sleep",
      "priority": "medium",
      "title": "Maintain Sleep Schedule",
      "description": "Continue your current sleep pattern for optimal recovery.",
      "confidence": 0.8
    }
  ],
  "overallScore": 85,
  "lastUpdated": "2025-07-23T10:00:00Z"
}
```

#### POST `/api/recovery/recommendations`
Generates new recovery recommendations based on current data.

**Request Body:**
```json
{
  "includeTraining": true,
  "includeSleep": true,
  "includeWellness": true
}
```

**Response:** Same as GET response above.

### Recovery Trends

#### GET `/api/recovery/trends`
Retrieves recovery trend analysis over time.

**Query Parameters:**
- `period` (optional): "week" | "month" | "quarter" (default: "week")

**Response:**
```json
{
  "trends": {
    "recoveryScore": {
      "current": 85,
      "average": 82,
      "trend": "improving",
      "change": "+3.7%"
    },
    "sleep": {
      "averageDuration": 8.2,
      "averageEfficiency": 86,
      "trend": "stable"
    },
    "hrv": {
      "averageRmssd": 44.8,
      "trend": "improving",
      "change": "+2.1%"
    },
    "wellness": {
      "averageEnergy": 7.8,
      "averageMood": 7.5,
      "trend": "stable"
    }
  },
  "period": "week",
  "dataPoints": 7
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": "2025-07-23T10:00:00Z"
}
```

### Common Error Codes
- `INVALID_DATE_FORMAT`: Date parameter is not in valid ISO format
- `DATA_NOT_FOUND`: Requested data not found
- `VALIDATION_ERROR`: Request data failed validation
- `DATABASE_ERROR`: Internal database error
- `CALCULATION_ERROR`: Error in recovery score calculation

## Data Models

### Sleep Data Interface
```typescript
interface SleepData {
  id?: number;
  userId?: number;
  date: string; // ISO date string
  duration: number; // hours
  efficiency: number; // percentage (0-100)
  deepSleep: number; // percentage of total sleep
  remSleep: number; // percentage of total sleep
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  bedTime?: string; // HH:MM format
  wakeTime?: string; // HH:MM format
  createdAt: Date;
  updatedAt: Date;
}
```

### HRV Measurement Interface
```typescript
interface HRVMeasurement {
  id?: number;
  userId?: number;
  date: string; // ISO date string
  rmssd: number; // milliseconds
  sdnn?: number; // milliseconds
  pnn50?: number; // percentage
  restingHR?: number; // beats per minute
  timestamp: Date;
  deviceType?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Subjective Wellness Interface
```typescript
interface SubjectiveWellness {
  id?: number;
  userId?: number;
  date: string; // ISO date string
  energy: number; // 1-10 scale
  mood: number; // 1-10 scale
  motivation: number; // 1-10 scale
  soreness: number; // 1-10 scale (10 = very sore)
  stress: number; // 1-10 scale (10 = very stressed)
  sleep: number; // 1-10 scale (subjective sleep quality)
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Recovery Score Interface
```typescript
interface RecoveryScore {
  id?: number;
  userId?: number;
  date: string; // ISO date string
  score: number; // 0-100
  confidence: number; // 0-1
  sleepScore?: number;
  hrvScore?: number;
  restingHRScore?: number;
  wellnessScore?: number;
  trainingLoadScore?: number;
  recommendation?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Usage Examples

### JavaScript/TypeScript
```javascript
// Fetch current recovery score
const response = await fetch('/api/recovery/score');
const data = await response.json();
console.log('Recovery Score:', data.score);

// Save sleep data
const sleepData = {
  date: '2025-07-23',
  duration: 8.5,
  efficiency: 85,
  quality: 'good'
};

const response = await fetch('/api/recovery/sleep', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(sleepData)
});

// Save wellness data
const wellnessData = {
  date: '2025-07-23',
  energy: 8,
  mood: 7,
  motivation: 8,
  soreness: 3,
  stress: 4,
  sleep: 8
};

await fetch('/api/recovery/wellness', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(wellnessData)
});
```

### cURL Examples
```bash
# Get recovery score
curl -X GET http://localhost:3000/api/recovery/score

# Save sleep data
curl -X POST http://localhost:3000/api/recovery/sleep \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-07-23",
    "duration": 8.5,
    "efficiency": 85,
    "quality": "good"
  }'

# Get recovery recommendations
curl -X GET http://localhost:3000/api/recovery/recommendations

# Get recovery trends
curl -X GET "http://localhost:3000/api/recovery/trends?period=week"
```

## Rate Limiting
Currently, no rate limiting is implemented on recovery endpoints. Consider implementing rate limiting for production deployment.

## Future Enhancements
- User authentication and authorization
- Real-time data sync with fitness devices
- Advanced machine learning recommendations
- Social sharing of recovery metrics
- Export functionality for recovery data

---

*Last Updated: 2025-07-23*
*Version: 1.0*
*Maintained by: Development Team*