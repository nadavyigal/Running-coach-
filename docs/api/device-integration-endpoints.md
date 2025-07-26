# Device Integration API Reference

## Overview
The Device Integration API provides endpoints for connecting, managing, and synchronizing data from fitness devices such as Apple Watch, Garmin devices, and other wearables. This API enables real-time health data collection, background sync, and advanced metrics integration.

## Base URL
All device integration API endpoints are prefixed with `/api/devices/`

## Authentication
Device endpoints require valid authentication tokens. Some device-specific endpoints may require additional OAuth tokens for device manufacturers.

## Supported Devices
- Apple Watch (HealthKit integration)
- Garmin devices (Connect IQ platform)
- Heart rate monitors
- GPS watches
- Fitness trackers

## Core Endpoints

### Device Management

#### GET `/api/devices`
Retrieves all connected devices for the current user.

**Response:**
```json
{
  "devices": [
    {
      "id": "device-123",
      "name": "Apple Watch Series 9",
      "type": "applewatch",
      "status": "connected",
      "lastSync": "2025-07-23T10:30:00Z",
      "capabilities": [
        "heart_rate",
        "gps",
        "accelerometer",
        "gyroscope"
      ],
      "batteryLevel": 85,
      "firmwareVersion": "10.5.1"
    },
    {
      "id": "device-456",
      "name": "Garmin Forerunner 965",
      "type": "garmin",
      "status": "connected",
      "lastSync": "2025-07-23T09:45:00Z",
      "capabilities": [
        "heart_rate",
        "gps",
        "running_dynamics",
        "vo2_max"
      ],
      "batteryLevel": 67,
      "firmwareVersion": "20.26"
    }
  ],
  "totalDevices": 2,
  "lastUpdated": "2025-07-23T10:30:00Z"
}
```

#### POST `/api/devices/connect`
Initiates connection process for a new device.

**Request Body:**
```json
{
  "deviceType": "applewatch",
  "deviceId": "ABC123DEF456",
  "name": "Apple Watch Series 9",
  "capabilities": [
    "heart_rate",
    "gps",
    "accelerometer"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "device-123",
  "connectionUrl": "https://oauth.device.com/auth?token=xyz",
  "status": "pending_authorization",
  "expiresAt": "2025-07-23T11:00:00Z",
  "instructions": "Please authorize the device connection using the provided URL"
}
```

#### GET `/api/devices/{deviceId}`
Retrieves detailed information about a specific device.

**Path Parameters:**
- `deviceId` - Unique device identifier

**Response:**
```json
{
  "id": "device-123",
  "name": "Apple Watch Series 9",
  "type": "applewatch",
  "status": "connected",
  "connectionDate": "2025-07-20T14:30:00Z",
  "lastSync": "2025-07-23T10:30:00Z",
  "syncStatus": "up_to_date",
  "capabilities": {
    "heart_rate": {
      "supported": true,
      "accuracy": "high",
      "sampling_rate": "1Hz"
    },
    "gps": {
      "supported": true,
      "accuracy": "3m",
      "sampling_rate": "1Hz"
    },
    "running_dynamics": {
      "supported": false
    }
  },
  "settings": {
    "auto_sync": true,
    "sync_frequency": "realtime",
    "data_retention": 90
  },
  "statistics": {
    "total_syncs": 245,
    "data_points_synced": 15678,
    "last_error": null
  }
}
```

#### DELETE `/api/devices/{deviceId}`
Disconnects and removes a device.

**Response:**
```json
{
  "success": true,
  "message": "Device disconnected successfully",
  "deviceId": "device-123",
  "disconnectedAt": "2025-07-23T10:45:00Z"
}
```

### Device Synchronization

#### POST `/api/devices/{deviceId}/sync`
Manually triggers data synchronization for a specific device.

**Request Body:**
```json
{
  "dataTypes": ["heart_rate", "gps", "steps"],
  "startDate": "2025-07-22T00:00:00Z",
  "endDate": "2025-07-23T23:59:59Z",
  "force": false
}
```

**Response:**
```json
{
  "syncId": "sync-789",
  "status": "in_progress",
  "startedAt": "2025-07-23T10:45:00Z",
  "estimatedDuration": 120,
  "dataTypes": ["heart_rate", "gps", "steps"],
  "progress": {
    "heart_rate": "completed",
    "gps": "in_progress",
    "steps": "pending"
  }
}
```

#### GET `/api/devices/{deviceId}/sync/status`
Retrieves current synchronization status.

**Response:**
```json
{
  "syncId": "sync-789",
  "status": "completed",
  "startedAt": "2025-07-23T10:45:00Z",
  "completedAt": "2025-07-23T10:47:30Z",
  "duration": 150,
  "dataPointsSynced": 1245,
  "errors": [],
  "summary": {
    "heart_rate": {
      "status": "completed",
      "points": 850,
      "timeRange": "2025-07-22T00:00:00Z to 2025-07-23T23:59:59Z"
    },
    "gps": {
      "status": "completed", 
      "points": 345,
      "timeRange": "2025-07-22T00:00:00Z to 2025-07-23T23:59:59Z"
    },
    "steps": {
      "status": "completed",
      "points": 50,
      "timeRange": "2025-07-22T00:00:00Z to 2025-07-23T23:59:59Z"
    }
  }
}
```

## Apple Watch Integration

### HealthKit Connection

#### POST `/api/devices/apple/connect`
Connects to Apple HealthKit for data access.

**Request Body:**
```json
{
  "requestedPermissions": [
    "heart_rate",
    "active_calories",
    "distance_walking_running",
    "steps"
  ],
  "deviceInfo": {
    "model": "Apple Watch Series 9", 
    "osVersion": "watchOS 10.5",
    "appVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "apple-device-123",
  "authorizedPermissions": [
    "heart_rate",
    "active_calories", 
    "distance_walking_running",
    "steps"
  ],
  "deniedPermissions": [],
  "connectionStatus": "authorized"
}
```

### HealthKit Data Sync

#### GET `/api/devices/apple/{deviceId}/healthkit`
Retrieves HealthKit data for specific date range.

**Query Parameters:**
- `startDate` - ISO date string (required)
- `endDate` - ISO date string (required)
- `dataTypes` - Comma-separated list of data types

**Response:**
```json
{
  "data": {
    "heart_rate": [
      {
        "timestamp": "2025-07-23T10:30:00Z",
        "value": 142,
        "unit": "bpm",
        "source": "Apple Watch"
      }
    ],
    "steps": [
      {
        "timestamp": "2025-07-23T10:00:00Z",
        "value": 1250,
        "unit": "steps",
        "source": "Apple Watch"
      }
    ]
  },
  "timeRange": {
    "start": "2025-07-23T00:00:00Z",
    "end": "2025-07-23T23:59:59Z"
  },
  "totalDataPoints": 1425
}
```

## Garmin Integration

### Garmin Connect Authentication

#### GET `/api/devices/garmin/connect`
Initiates Garmin Connect OAuth flow.

**Response:**
```json
{
  "authUrl": "https://connect.garmin.com/oauthConfirm?oauth_token=xyz",
  "requestToken": "oauth_token_123",
  "expiresAt": "2025-07-23T11:30:00Z",
  "instructions": "Please visit the auth URL to authorize access"
}
```

#### POST `/api/devices/garmin/callback`
Handles OAuth callback from Garmin Connect.

**Request Body:**
```json
{
  "oauth_token": "oauth_token_123",
  "oauth_verifier": "verifier_456"
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "garmin-device-456",
  "accessToken": "access_token_789",
  "userProfile": {
    "displayName": "John Runner",
    "garminUserId": "12345",
    "profileImageUrl": "https://connect.garmin.com/avatar/12345"
  }
}
```

### Garmin Activity Data

#### GET `/api/devices/garmin/activities`
Retrieves activities from Garmin Connect.

**Query Parameters:**
- `startDate` - ISO date string
- `endDate` - ISO date string  
- `activityType` - Activity type filter (running, cycling, etc.)
- `limit` - Maximum number of activities (default: 50)

**Response:**
```json
{
  "activities": [
    {
      "activityId": "activity-123",
      "activityName": "Morning Run",
      "activityType": "running",
      "startTime": "2025-07-23T07:00:00Z",
      "duration": 1800,
      "distance": 5000,
      "averageHeartRate": 155,
      "maxHeartRate": 175,
      "calories": 320,
      "averagePace": "6:00",
      "elevationGain": 45,
      "runningDynamics": {
        "cadence": 180,
        "strideLength": 1.25,
        "verticalOscillation": 8.2,
        "groundContactTime": 242
      }
    }
  ],
  "totalActivities": 1,
  "hasMore": false
}
```

## Heart Rate Zones

### Zone Configuration

#### GET `/api/heart-rate/zones`
Retrieves user's heart rate zones configuration.

**Response:**
```json
{
  "zones": [
    {
      "zone": 1,
      "name": "Recovery",
      "minBpm": 60,
      "maxBpm": 120,
      "percentage": "50-60%",
      "color": "#0066cc"
    },
    {
      "zone": 2,
      "name": "Aerobic Base",
      "minBpm": 121,
      "maxBpm": 140,
      "percentage": "60-70%", 
      "color": "#00cc66"
    },
    {
      "zone": 3,
      "name": "Aerobic",
      "minBpm": 141,
      "maxBpm": 160,
      "percentage": "70-80%",
      "color": "#ffcc00"
    },
    {
      "zone": 4,
      "name": "Lactate Threshold",
      "minBpm": 161,
      "maxBpm": 175,
      "percentage": "80-90%",
      "color": "#ff6600"
    },
    {
      "zone": 5,
      "name": "VO2 Max",
      "minBpm": 176,
      "maxBpm": 200,
      "percentage": "90-100%",
      "color": "#cc0000"
    }
  ],
  "maxHeartRate": 200,
  "restingHeartRate": 60,
  "lactateThreshold": 175,
  "lastUpdated": "2025-07-23T08:00:00Z"
}
```

#### POST `/api/heart-rate/zones`
Updates heart rate zones configuration.

**Request Body:**
```json
{
  "maxHeartRate": 195,
  "restingHeartRate": 58,
  "lactateThreshold": 172,
  "method": "field_test",
  "testDate": "2025-07-20T18:00:00Z"
}
```

### Heart Rate Data

#### GET `/api/heart-rate/{runId}`
Retrieves heart rate data for a specific run.

**Response:**
```json
{
  "runId": "run-123",
  "heartRateData": [
    {
      "timestamp": "2025-07-23T07:00:00Z",
      "heartRate": 145,
      "zone": 3,
      "efficiency": 0.85
    }
  ],
  "summary": {
    "averageHeartRate": 155,
    "maxHeartRate": 175,
    "minHeartRate": 135,
    "timeInZones": {
      "zone1": 0,
      "zone2": 300,
      "zone3": 900,
      "zone4": 600,
      "zone5": 0
    }
  },
  "totalDataPoints": 1800
}
```

#### GET `/api/heart-rate/zones/distribution`
Retrieves heart rate zone distribution over time.

**Query Parameters:**
- `period` - Time period ("week", "month", "quarter")
- `startDate` - ISO date string
- `endDate` - ISO date string

**Response:**
```json
{
  "distribution": {
    "zone1": {
      "time": 3600,
      "percentage": 20.0,
      "runs": 8
    },
    "zone2": {
      "time": 7200,
      "percentage": 40.0,
      "runs": 12
    },
    "zone3": {
      "time": 5400,
      "percentage": 30.0,
      "runs": 10
    },
    "zone4": {
      "time": 1800,
      "percentage": 10.0,
      "runs": 4
    },
    "zone5": {
      "time": 0,
      "percentage": 0.0,
      "runs": 0
    }
  },
  "totalTime": 18000,
  "totalRuns": 25,
  "period": "month"
}
```

## Advanced Metrics

### Running Dynamics

#### GET `/api/metrics/running-dynamics/{runId}`
Retrieves running dynamics data for a specific run.

**Response:**
```json
{
  "runId": "run-123",
  "runningDynamics": {
    "cadence": [
      {
        "timestamp": "2025-07-23T07:00:00Z",
        "value": 180,
        "unit": "spm"
      }
    ],
    "strideLength": [
      {
        "timestamp": "2025-07-23T07:00:00Z", 
        "value": 125,
        "unit": "cm"
      }
    ],
    "verticalOscillation": [
      {
        "timestamp": "2025-07-23T07:00:00Z",
        "value": 8.2,
        "unit": "cm"
      }
    ],
    "groundContactTime": [
      {
        "timestamp": "2025-07-23T07:00:00Z",
        "value": 242,
        "unit": "ms"
      }
    ]
  },
  "averages": {
    "cadence": 180,
    "strideLength": 125,
    "verticalOscillation": 8.2,
    "groundContactTime": 242
  }
}
```

### Advanced Performance Metrics

#### GET `/api/metrics/advanced/{runId}`
Retrieves advanced performance metrics for a specific run.

**Response:**
```json
{
  "runId": "run-123",
  "metrics": {
    "vo2Max": 52.4,
    "lactateThreshold": {
      "heartRate": 172,
      "pace": "5:30"
    },
    "runningEfficiency": 0.89,
    "powerOutput": [
      {
        "timestamp": "2025-07-23T07:00:00Z",
        "value": 285,
        "unit": "watts"
      }
    ],
    "metabolicCost": 4.2,
    "biomechanicalEfficiency": {
      "cadenceOptimality": 0.92,
      "strideEfficiency": 0.88,
      "groundContactBalance": 0.95
    }
  },
  "recommendations": [
    {
      "metric": "cadence",
      "current": 180,
      "optimal": 185,
      "suggestion": "Increase cadence by 5 steps per minute"
    }
  ]
}
```

## Background Sync

### Sync Jobs

#### GET `/api/sync/jobs`
Retrieves status of background sync jobs.

**Response:**
```json
{
  "activeJobs": [
    {
      "jobId": "job-123",
      "deviceId": "device-456",
      "type": "incremental_sync",
      "status": "running",
      "startedAt": "2025-07-23T10:30:00Z",
      "progress": 75,
      "estimatedCompletion": "2025-07-23T10:45:00Z"
    }
  ],
  "recentJobs": [
    {
      "jobId": "job-122",
      "deviceId": "device-123",
      "type": "full_sync",
      "status": "completed",
      "startedAt": "2025-07-23T09:00:00Z",
      "completedAt": "2025-07-23T09:15:00Z",
      "dataPointsSynced": 2450
    }
  ],
  "scheduledJobs": [
    {
      "jobId": "job-124",
      "deviceId": "device-456", 
      "type": "hourly_sync",
      "scheduledAt": "2025-07-23T11:00:00Z",
      "status": "scheduled"
    }
  ]
}
```

#### POST `/api/sync/jobs`
Creates a new background sync job.

**Request Body:**
```json
{
  "deviceId": "device-123",
  "type": "full_sync",
  "priority": "high",
  "dataTypes": ["heart_rate", "gps", "steps"],
  "schedule": {
    "type": "immediate"
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-125",
  "status": "queued",
  "estimatedStartTime": "2025-07-23T10:50:00Z",
  "priority": "high"
}
```

## Error Handling

### Common Error Responses

```json
{
  "error": "Device not found",
  "code": "DEVICE_NOT_FOUND",
  "deviceId": "device-123",
  "timestamp": "2025-07-23T10:45:00Z"
}
```

```json
{
  "error": "Device authorization expired",
  "code": "AUTH_EXPIRED",
  "deviceId": "device-456",
  "reauthorizeUrl": "https://oauth.device.com/reauth",
  "timestamp": "2025-07-23T10:45:00Z"
}
```

```json
{
  "error": "Sync failed",
  "code": "SYNC_FAILED",
  "deviceId": "device-789",
  "details": {
    "failedDataTypes": ["heart_rate"],
    "reason": "Rate limit exceeded",
    "retryAfter": 3600
  },
  "timestamp": "2025-07-23T10:45:00Z"
}
```

### Error Codes
- `DEVICE_NOT_FOUND` - Device ID does not exist
- `DEVICE_DISCONNECTED` - Device is not connected
- `AUTH_EXPIRED` - Device authorization expired
- `AUTH_FAILED` - Device authorization failed
- `SYNC_FAILED` - Data synchronization failed
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `DEVICE_OFFLINE` - Device is not available
- `DATA_INVALID` - Received data is invalid
- `STORAGE_FULL` - Device storage is full

## Rate Limiting

- **Device Management**: 100 requests per hour
- **Data Sync**: 20 sync jobs per hour per device
- **Data Retrieval**: 200 requests per hour
- **OAuth Operations**: 10 requests per hour

## Security Considerations

### Data Privacy
- All device data encrypted in transit and at rest
- OAuth tokens stored securely with encryption
- Data retention policies enforced
- User consent required for all data access

### Authentication
- Device-specific OAuth tokens
- Token rotation and expiration
- Secure token storage
- Permission-based access control

## Testing

### Test Device Setup
```javascript
// Mock device for testing
const mockDevice = {
  id: "test-device-123",
  name: "Test Apple Watch",
  type: "applewatch",
  status: "connected"
};

// Test device connection
const connectTestDevice = async () => {
  const response = await fetch('/api/devices/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify(mockDevice)
  });
  return response.json();
};
```

---

*Last Updated: 2025-07-23*
*Version: 1.0*
*Maintained by: Development Team*