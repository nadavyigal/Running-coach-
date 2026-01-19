# API Reference - RunSmart AI

This document provides reference documentation for all internal APIs, context providers, services, and utilities in the RunSmart AI application.

## Table of Contents
- [Authentication](#authentication)
- [Sync Service](#sync-service)
- [Database](#database)
- [Analytics](#analytics)
- [Supabase Client](#supabase-client)
- [Utility Functions](#utility-functions)

---

## Authentication

### AuthContext

React context providing authentication state and functions.

**Location**: `v0/lib/auth/auth-context.tsx`

#### Types

```typescript
type AuthContextType = {
  user: User | null
  profileId: string | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}
```

#### Usage

```typescript
import { useAuth } from '@/lib/auth/auth-context'

function MyComponent() {
  const { user, profileId, loading, signOut } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please log in</div>

  return (
    <div>
      <p>Logged in as: {user.email}</p>
      <p>Profile ID: {profileId}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | Current authenticated user from Supabase Auth |
| `profileId` | `string \| null` | User's profile ID from `profiles` table |
| `loading` | `boolean` | `true` while checking authentication status |
| `signOut` | `() => Promise<void>` | Signs out the user and clears session |
| `refreshSession` | `() => Promise<void>` | Refreshes the current auth session |

#### Example: Protected Component

```typescript
import { useAuth } from '@/lib/auth/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

function ProtectedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) return <div>Loading...</div>
  if (!user) return null

  return <div>Protected content</div>
}
```

---

## Sync Service

### SyncService

Singleton service managing all data synchronization between local IndexedDB and Supabase.

**Location**: `v0/lib/sync/sync-service.ts`

#### Methods

##### `getInstance()`

Returns the singleton instance of SyncService.

```typescript
const syncService = SyncService.getInstance()
```

##### `startAutoSync(intervalMs?: number)`

Starts automatic sync at specified interval (default: 300000ms = 5 minutes).

```typescript
// Start with default interval (5 minutes)
syncService.startAutoSync()

// Start with custom interval (1 minute)
syncService.startAutoSync(60000)
```

**Parameters:**
- `intervalMs` (optional): Sync interval in milliseconds

**Notes:**
- Performs initial sync immediately
- Sets up recurring interval
- Does nothing if auto-sync already running

##### `stopAutoSync()`

Stops the automatic sync interval.

```typescript
syncService.stopAutoSync()
```

##### `syncIncrementalChanges()`

Manually triggers an incremental sync.

```typescript
await syncService.syncIncrementalChanges()
```

**Returns:** `Promise<void>`

**Behavior:**
- Checks authentication
- Fetches profile ID
- Syncs only changes since last sync
- Updates status throughout process
- Prevents concurrent syncs

**Example:**

```typescript
import { SyncService } from '@/lib/sync/sync-service'

async function handleManualSync() {
  const syncService = SyncService.getInstance()

  try {
    await syncService.syncIncrementalChanges()
    console.log('Sync completed successfully')
  } catch (error) {
    console.error('Sync failed:', error)
  }
}
```

##### `getStatus()`

Returns current sync status.

```typescript
const status = syncService.getStatus()
```

**Returns:** `'idle' | 'syncing' | 'error'`

##### `getLastSyncTime()`

Returns timestamp of last successful sync.

```typescript
const lastSync = syncService.getLastSyncTime()
```

**Returns:** `Date | null`

##### `getErrorMessage()`

Returns error message if sync failed.

```typescript
const error = syncService.getErrorMessage()
```

**Returns:** `string | null`

#### Complete Example

```typescript
import { SyncService } from '@/lib/sync/sync-service'
import { useEffect, useState } from 'react'

function SyncStatusIndicator() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    const syncService = SyncService.getInstance()

    // Start auto-sync
    syncService.startAutoSync()

    // Poll status every second
    const interval = setInterval(() => {
      setStatus(syncService.getStatus())
      setLastSync(syncService.getLastSyncTime())
    }, 1000)

    return () => {
      clearInterval(interval)
      syncService.stopAutoSync()
    }
  }, [])

  return (
    <div>
      <span>Status: {status}</span>
      {lastSync && <span>Last sync: {lastSync.toLocaleString()}</span>}
    </div>
  )
}
```

---

## Database

### Dexie Database Instance

**Location**: `v0/lib/db.ts`

#### Importing

```typescript
import { db } from '@/lib/db'
```

#### Tables

Access tables via `db.<tableName>`:

```typescript
// Runs
await db.runs.toArray()
await db.runs.where('type').equals('easy').toArray()
await db.runs.add(newRun)
await db.runs.update(runId, { distance: 5000 })

// Goals
await db.goals.toArray()
await db.goals.get(goalId)
await db.goals.add(newGoal)

// Shoes
await db.shoes.toArray()
await db.shoes.where('isActive').equals(true).toArray()
```

#### Common Operations

##### Add Record

```typescript
const runId = await db.runs.add({
  type: 'easy',
  distance: 5000,
  duration: 1800,
  completedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

##### Query Records

```typescript
// Get all runs
const allRuns = await db.runs.toArray()

// Filter by field
const easyRuns = await db.runs
  .where('type')
  .equals('easy')
  .toArray()

// Complex query
const recentRuns = await db.runs
  .where('completedAt')
  .above(new Date('2026-01-01'))
  .and(run => run.distance > 5000)
  .sortBy('completedAt')
```

##### Update Record

```typescript
await db.runs.update(runId, {
  distance: 5500,
  updatedAt: new Date(),
})
```

##### Delete Record

```typescript
await db.runs.delete(runId)
```

##### Bulk Operations

```typescript
// Bulk add
await db.runs.bulkAdd([run1, run2, run3])

// Bulk update
await db.runs.bulkUpdate([
  { key: 1, changes: { distance: 5000 } },
  { key: 2, changes: { distance: 10000 } },
])

// Bulk delete
await db.runs.bulkDelete([1, 2, 3])
```

### Database Utilities

**Location**: `v0/lib/dbUtils.ts`

Common database operations wrapped in utility functions.

#### `getUser()`

Gets the current user profile.

```typescript
import { getUser } from '@/lib/dbUtils'

const user = await getUser()
```

**Returns:** `User | undefined`

#### `getCurrentPlan()`

Gets the active training plan.

```typescript
import { getCurrentPlan } from '@/lib/dbUtils'

const plan = await getCurrentPlan()
```

**Returns:** `Plan | undefined`

---

## Analytics

### Track Auth Events

```typescript
import { trackAuthEvent } from '@/lib/analytics'

// Track signup
await trackAuthEvent('signup')

// Track login
await trackAuthEvent('login')

// Track logout
await trackAuthEvent('logout')

// Track device migration
await trackAuthEvent('migration')
```

**Function Signature:**

```typescript
async function trackAuthEvent(
  event: 'signup' | 'login' | 'logout' | 'migration'
): Promise<void>
```

### Track Sync Events

```typescript
import { trackSyncEvent } from '@/lib/analytics'

// Track sync start
await trackSyncEvent('sync_started')

// Track sync completion with record count
await trackSyncEvent('sync_completed', 42)

// Track sync failure
await trackSyncEvent('sync_failed')
```

**Function Signature:**

```typescript
async function trackSyncEvent(
  event: 'sync_started' | 'sync_completed' | 'sync_failed',
  recordCount?: number
): Promise<void>
```

### PostHog Integration

Direct PostHog usage:

```typescript
import posthog from 'posthog-js'

// Track custom event
posthog.capture('run_completed', {
  distance: 5000,
  duration: 1800,
  type: 'easy',
})

// Identify user
posthog.identify(userId, {
  email: user.email,
  signup_date: user.createdAt,
})
```

---

## Supabase Client

### Client-Side Client

For use in Client Components.

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// Auth operations
const { data: { user } } = await supabase.auth.getUser()
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
})

// Database operations
const { data: runs } = await supabase
  .from('runs')
  .select('*')
  .order('completed_at', { ascending: false })

const { error: insertError } = await supabase
  .from('runs')
  .insert([{ distance: 5000, duration: 1800 }])
```

### Server-Side Client

For use in Server Components and API Routes.

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data } = await supabase
    .from('runs')
    .select('*')

  return Response.json(data)
}
```

### Admin Client

For operations requiring service role key.

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

// Admin operations (bypasses RLS)
const { data: allUsers } = await supabase.auth.admin.listUsers()
```

**⚠️ Warning:** Only use admin client server-side, never in client code!

---

## Utility Functions

### Logger

Centralized logging utility.

**Location**: `v0/lib/logger.ts`

```typescript
import { logger } from '@/lib/logger'

logger.info('User signed in', { userId: '123' })
logger.warn('Sync taking longer than expected')
logger.error('Failed to save run', error)
```

**Methods:**
- `logger.info(message, data?)` - Info level logs
- `logger.warn(message, data?)` - Warning level logs
- `logger.error(message, error?)` - Error level logs

### Date Utilities

Common date operations.

**Location**: `v0/lib/utils.ts` or `v0/lib/date-utils.ts`

```typescript
import { formatDate, parseDate } from '@/lib/utils'

// Format date
const formatted = formatDate(new Date(), 'MMM dd, yyyy')

// Parse date
const date = parseDate('2026-01-18')
```

### Distance Formatting

Convert meters to readable formats.

```typescript
import { formatDistance } from '@/lib/utils'

formatDistance(5000) // "5.0 km"
formatDistance(1500) // "1.5 km"
formatDistance(500)  // "500 m"
```

### Pace Calculations

Calculate pace from distance and duration.

```typescript
import { calculatePace } from '@/lib/utils'

// distance in meters, duration in seconds
const paceSeconds = calculatePace(5000, 1800)
// Returns: 360 (seconds per km)

const paceString = formatPace(paceSeconds)
// Returns: "6:00 /km"
```

---

## Environment Variables

### Required

```typescript
// Supabase
process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY // Server-only

// OpenAI
process.env.OPENAI_API_KEY // Server-only
```

### Optional

```typescript
// Analytics
process.env.NEXT_PUBLIC_POSTHOG_API_KEY
process.env.NEXT_PUBLIC_POSTHOG_HOST
process.env.NEXT_PUBLIC_GA_ID

// Admin
process.env.ADMIN_EMAILS // Comma-separated

// Maps
process.env.NEXT_PUBLIC_MAP_TILE_TOKEN

// Feature Flags
process.env.NEXT_PUBLIC_ENABLE_PLAN_TEMPLATE_FLOW
```

### Accessing Environment Variables

**Client-side** (must be prefixed with `NEXT_PUBLIC_`):

```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
```

**Server-side** (API routes, Server Components):

```typescript
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
```

---

## Type Definitions

### Common Types

```typescript
// User
type User = {
  id?: number
  name: string
  email?: string
  age?: number
  weight?: number
  height?: number
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  weeklyMileage: number
  createdAt: Date
  updatedAt: Date
}

// Run
type Run = {
  id?: number
  type: 'easy' | 'tempo' | 'interval' | 'long' | 'recovery'
  distance: number // meters
  duration: number // seconds
  pace?: number // seconds per km
  heartRate?: number
  calories?: number
  notes?: string
  gpsPath?: string // JSON
  completedAt: Date
  createdAt: Date
  updatedAt: Date
}

// Goal
type Goal = {
  id?: number
  title: string
  description?: string
  goalType: 'distance' | 'speed' | 'race' | 'habit'
  category: string
  priority: 'high' | 'medium' | 'low'
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned'
  baselineValue: number
  targetValue: number
  currentValue: number
  progressPercentage: number
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

// Shoe
type Shoe = {
  id?: number
  name: string
  brand: string
  model: string
  initialKm: number
  currentKm: number
  maxKm: number
  startDate: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## Error Handling

### Standard Error Format

```typescript
type APIError = {
  error: string
  message: string
  statusCode: number
}
```

### Throwing Errors

```typescript
// In API routes
if (!user) {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: 'You must be logged in',
      statusCode: 401,
    }),
    { status: 401 }
  )
}
```

### Catching Errors

```typescript
try {
  await someOperation()
} catch (error) {
  if (error instanceof Error) {
    logger.error('Operation failed', error)
  }
  // Handle error
}
```

---

## Rate Limiting

API routes implement rate limiting:

```typescript
// Example: 50 requests per hour
const MAX_REQUESTS = 50
const TIME_WINDOW = 60 * 60 * 1000 // 1 hour
```

### Checking Rate Limits

```typescript
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const userId = await getUserId(request)

  const allowed = await checkRateLimit(userId, 'chat', MAX_REQUESTS, TIME_WINDOW)

  if (!allowed) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  // Process request
}
```

---

## Webhooks

### Supabase Webhooks

Configure webhooks in Supabase Dashboard for:
- User signup (trigger profile creation)
- Data changes (trigger sync)
- Authentication events

**Example Handler** (`v0/app/api/webhooks/supabase/route.ts`):

```typescript
export async function POST(request: Request) {
  const payload = await request.json()

  // Verify webhook signature
  // Process event
  // Return 200 OK
}
```

---

## Testing

### Mocking Supabase

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
    })),
  })),
}))
```

### Mocking Database

```typescript
import { db } from '@/lib/db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
```

---

## Best Practices

1. **Always check authentication**:
   ```typescript
   const { user } = useAuth()
   if (!user) return null
   ```

2. **Handle loading states**:
   ```typescript
   if (loading) return <Spinner />
   ```

3. **Use TypeScript types**:
   ```typescript
   const run: Run = { ... }
   ```

4. **Log important operations**:
   ```typescript
   logger.info('User signed up', { email: user.email })
   ```

5. **Handle errors gracefully**:
   ```typescript
   try {
     await operation()
   } catch (error) {
     showError(error.message)
   }
   ```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
