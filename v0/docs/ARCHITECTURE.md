# RunSmart AI - Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture Patterns](#architecture-patterns)
- [Data Flow](#data-flow)
- [Authentication System](#authentication-system)
- [Sync System](#sync-system)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)
- [Scalability](#scalability)

---

## Overview

RunSmart AI is a Progressive Web App (PWA) built with Next.js 14, featuring a **hybrid local-first + cloud-sync architecture**. The application prioritizes instant performance through local data storage while providing cloud backup and multi-device sync capabilities.

### Key Architectural Principles

1. **Local-First**: All data operations happen locally first for instant UX
2. **Background Sync**: Cloud sync happens asynchronously without blocking UI
3. **Offline Capable**: Full functionality without internet connection
4. **Progressive Enhancement**: Works on all devices, enhanced on capable ones
5. **Security by Default**: Row-Level Security (RLS) and proper authentication

---

## Technology Stack

### Frontend Framework
- **Next.js 14**: React framework with App Router
- **React 18**: UI library with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives

### Local Data Layer
- **Dexie.js**: IndexedDB wrapper with reactive queries
- **IndexedDB**: Browser-native database (80+ tables)
- **localStorage**: Settings and session data

### Cloud Data Layer
- **Supabase PostgreSQL**: Cloud database (9 synced tables)
- **Supabase Auth**: Email/password authentication with JWT
- **Row-Level Security (RLS)**: User data isolation

### AI & Analytics
- **OpenAI GPT-4o**: Chat and plan generation via Vercel AI SDK
- **PostHog**: Behavioral analytics and feature flags
- **Google Analytics 4**: Traffic and conversion tracking

### Development Tools
- **Vitest**: Unit testing framework
- **Playwright**: E2E testing
- **ESLint**: Code linting
- **Prettier**: Code formatting

---

## Architecture Patterns

### 1. Single-Page Application (SPA) Pattern

The app uses screen-based navigation with state management in the root component:

```typescript
// Main app structure
<RootLayout>
  {currentScreen === 'today' && <TodayScreen />}
  {currentScreen === 'plan' && <PlanScreen />}
  {currentScreen === 'record' && <RecordScreen />}
  {currentScreen === 'chat' && <ChatScreen />}
  {currentScreen === 'profile' && <ProfileScreen />}
</RootLayout>
```

**Benefits:**
- No page reloads (instant navigation)
- Shared state between screens
- Optimized for mobile UX

### 2. Local-First Architecture

```
User Action → IndexedDB (Instant) → UI Update (Instant)
                    ↓
            Background Sync Queue
                    ↓
              Supabase (Async)
```

**Flow:**
1. User records a run
2. Data saves to IndexedDB immediately (~10ms)
3. UI updates instantly
4. Sync service queues upload
5. Data syncs to Supabase in background (5-30s)

**Benefits:**
- Instant user feedback
- Offline capability
- Resilient to network issues

### 3. Singleton Pattern for Services

Critical services use singleton pattern to ensure single instance:

```typescript
export class SyncService {
  private static instance: SyncService | null = null

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }
}
```

**Used for:**
- SyncService (manages all cloud sync)
- Database instance (Dexie)
- Analytics trackers

### 4. Context Providers Pattern

Authentication and shared state use React Context:

```typescript
<AuthProvider>
  <App />
</AuthProvider>
```

**Contexts:**
- `AuthContext`: User authentication state, profile ID, session management
- Future: `ThemeContext`, `SettingsContext`

---

## Data Flow

### Write Path (User Creates Data)

```mermaid
User Action → Component → Local DB → UI Update
                           ↓
                    Sync Service
                           ↓
                   Supabase (Cloud)
```

**Example: Recording a Run**
1. User clicks "Complete Run"
2. `RecordScreen` component saves to `db.runs.add()`
3. IndexedDB write completes in ~10ms
4. UI navigates to success screen
5. `SyncService` detects new data
6. Run uploads to Supabase within 5 seconds
7. Sync status indicator shows completion

### Read Path (User Views Data)

```mermaid
User Navigation → Component → Local DB Query → UI Render
```

**Example: Viewing Today's Workouts**
1. User navigates to "Today" screen
2. `TodayScreen` queries `db.workouts.toArray()`
3. IndexedDB returns results in ~5ms
4. React renders workout list
5. No network request needed

### Sync Path (Background Sync)

```mermaid
Timer (5 min) → SyncService → Check Auth → Query Local Changes
                                                ↓
                                        Batch Upload (100/batch)
                                                ↓
                                          Supabase Upsert
                                                ↓
                                        Update Last Sync Time
```

---

## Authentication System

### Architecture

```
User Signup → Supabase Auth → Profile Creation → Device Migration → Initial Sync
```

### Components

**1. Supabase Auth**
- Email/password authentication
- JWT token-based sessions
- Email verification
- Password reset flows

**2. AuthContext Provider**
```typescript
type AuthContext = {
  user: User | null
  profileId: string | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}
```

**3. Profile Management**
- Each authenticated user has a `profile` in Supabase
- `auth_user_id` links to Supabase Auth user
- `profile_id` used for all data relationships

### Authentication Flow

#### New User Signup
```
1. User enters email/password
2. Supabase Auth creates user account
3. Trigger creates profile in `profiles` table
4. Profile ID fetched and stored in context
5. Device migration checks for local data
6. Welcome modal shows if data exists
7. Initial sync uploads all local data
8. User proceeds to app
```

#### Existing User Login
```
1. User enters credentials
2. Supabase Auth validates and returns session
3. Session stored in cookies (httpOnly)
4. Profile ID fetched from `profiles` table
5. User context updated
6. Auto-sync starts
7. User sees main app
```

### Session Management

- **Storage**: HTTP-only cookies via Supabase SSR
- **Duration**: 1 hour (refresh token: 30 days)
- **Refresh**: Automatic via Supabase client
- **Validation**: Server-side on protected routes

---

## Sync System

### Architecture Overview

The sync system uses a **incremental sync** strategy with **last-write-wins** conflict resolution.

### Key Components

**1. SyncService (Singleton)**
- Manages all sync operations
- Runs every 5 minutes (configurable)
- Prevents concurrent syncs
- Tracks sync status and errors

**2. Sync Strategy**

**Initial Sync** (First time after signup):
```typescript
- Upload ALL local data to cloud
- No timestamp filtering
- Full data migration
- One-time operation
```

**Incremental Sync** (Ongoing):
```typescript
- Query local DB for changes since last sync
- Filter by updatedAt > lastSyncTimestamp
- Batch upload in chunks of 100
- Update lastSyncTimestamp
```

**3. Synced Tables**

| Local Table | Cloud Table | Sync Direction |
|-------------|-------------|----------------|
| runs | runs | Local → Cloud |
| goals | goals | Local → Cloud |
| shoes | shoes | Local → Cloud |
| sleep_data | sleep_data | Local → Cloud |
| hrv_measurements | hrv_measurements | Local → Cloud |
| recovery_scores | recovery_scores | Local → Cloud |
| personal_records | personal_records | Local → Cloud |
| heart_rate_zones | heart_rate_zones | Local → Cloud |

**Note**: Currently one-way sync (local → cloud). Future: bidirectional sync.

### Data Transformation

Each entity maps from local schema to cloud schema:

```typescript
// Local Run
{
  id: number,              // Auto-increment
  type: string,
  distance: number,
  duration: number,
  completedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

// Cloud Run
{
  profile_id: uuid,        // User identifier
  local_id: number,        // Original local ID
  type: text,
  distance: number,
  duration: number,
  completed_at: timestamptz,
  created_at: timestamptz,
  updated_at: timestamptz,
  last_synced_at: timestamptz
}
```

### Conflict Resolution

**Strategy**: Last-Write-Wins (LWW)

```typescript
if (localRecord.updatedAt > cloudRecord.updatedAt) {
  // Local version is newer, overwrite cloud
  upsert(localRecord)
} else {
  // Cloud version is newer, keep cloud version
  // (In current implementation, local always overwrites)
}
```

**Unique Constraint**: `(profile_id, local_id)`
- Prevents duplicate records
- Allows same local_id across different users

### Batching

Large datasets batch to prevent timeouts:

```typescript
const BATCH_SIZE = 100

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE)
  await supabase.from(table).upsert(batch)
}
```

**Benefits:**
- Prevents timeout errors
- Allows progress tracking
- Better error recovery

### Error Handling

```typescript
try {
  await syncOperation()
  status = 'idle'
  error = null
} catch (error) {
  status = 'error'
  errorMessage = error.message
  // Retry on next interval
}
```

**Retry Strategy:**
- Failed syncs retry on next interval (5 min)
- No exponential backoff (simple retry)
- User notified via sync status indicator

---

## Database Schema

### Local Database (IndexedDB via Dexie)

**80+ Tables** including:

#### Core Tables
- `users` - User profile and preferences
- `plans` - Training plans
- `workouts` - Scheduled workouts
- `runs` - Completed run history
- `goals` - User objectives
- `shoes` - Equipment tracking

#### Recovery & Health
- `sleep_data` - Sleep metrics
- `hrv_measurements` - Heart rate variability
- `recovery_scores` - Calculated recovery
- `subjective_wellness` - User-reported wellness

#### Social & Gamification
- `badges` - Achievement badges
- `cohorts` - Group participation
- `chat_messages` - AI chat history

#### Performance
- `personal_records` - Best performances
- `heart_rate_zones` - Training zones
- `running_dynamics` - Advanced metrics

**Schema Pattern:**
```typescript
interface Entity {
  id?: number           // Auto-increment primary key
  createdAt: Date       // Creation timestamp
  updatedAt: Date       // Last update timestamp
  // ... entity-specific fields
}
```

### Cloud Database (Supabase PostgreSQL)

**9 Synced Tables**:

#### Core Schema
```sql
-- User profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id uuid REFERENCES auth.users(id),
  name text,
  email text,
  onboarding_complete boolean DEFAULT false,
  device_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Runs (synced from local)
CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid REFERENCES profiles(id),
  local_id integer NOT NULL,
  type text NOT NULL,
  distance numeric NOT NULL,
  duration integer NOT NULL,
  pace numeric,
  heart_rate integer,
  calories integer,
  notes text,
  route jsonb,
  completed_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, local_id)
);
```

**Other Tables**: goals, shoes, sleep_data, hrv_measurements, recovery_scores, personal_records, heart_rate_zones

---

## Security Model

### Row-Level Security (RLS)

Every table has RLS policies to enforce data isolation:

```sql
-- Users can only read their own data
CREATE POLICY "Users can view own runs"
  ON runs FOR SELECT
  USING (auth.uid() = (SELECT auth_user_id FROM profiles WHERE id = profile_id));

-- Users can only insert their own data
CREATE POLICY "Users can insert own runs"
  ON runs FOR INSERT
  WITH CHECK (auth.uid() = (SELECT auth_user_id FROM profiles WHERE id = profile_id));

-- Users can only update their own data
CREATE POLICY "Users can update own runs"
  ON runs FOR UPDATE
  USING (auth.uid() = (SELECT auth_user_id FROM profiles WHERE id = profile_id));
```

**Benefits:**
- Database-level security
- Cannot be bypassed from client
- Automatic enforcement on all queries

### Authentication Security

**JWT Tokens:**
- Stored in httpOnly cookies
- Not accessible from JavaScript
- Automatic refresh
- Secure transmission (HTTPS only)

**Password Requirements:**
- Minimum 6 characters (Supabase default)
- Can be enhanced with custom validation

**API Protection:**
- Rate limiting on AI endpoints
- Request size limits
- Timeout protection

### Admin Dashboard Security

**Multi-layer Protection:**

1. **Middleware Layer** (Edge)
   - Checks authentication before page load
   - Validates admin email whitelist
   - Fast redirect for unauthorized users

2. **Layout Layer** (Server)
   - Server-side authentication check
   - Secondary validation
   - Prevents direct access

3. **Environment-based Access**
   - Admin emails in environment variable
   - Easy to update without code changes
   - Separate config for each environment

---

## Performance Considerations

### Local Data Access

**IndexedDB Performance:**
- Read: ~5-10ms
- Write: ~10-20ms
- Query: ~10-30ms (depending on complexity)

**Optimization Strategies:**
- Indexes on frequently queried fields
- Batched writes where possible
- Reactive queries with Dexie observables

### Sync Performance

**Benchmarks:**
- 100 records: ~2-5 seconds
- 500 records: ~10-30 seconds
- 1000 records: ~30-60 seconds

**Optimizations:**
- Batching (100 records per request)
- Incremental sync (only changes)
- Background execution (non-blocking)

### Bundle Size

**Current Bundle:**
- First Load JS: ~200-250 KB (gzipped)
- Page-specific chunks: ~50-100 KB

**Optimization:**
- Code splitting per route
- Dynamic imports for large components
- Tree shaking for unused code

### Rendering Performance

**Strategies:**
- React Suspense for loading states
- Virtualization for long lists (future)
- Memoization for expensive calculations
- Debounced search inputs

---

## Scalability

### User Scalability

**Current Capacity:**
- IndexedDB: ~50 MB per domain (varies by browser)
- Typical user data: ~5-10 MB after 1 year
- **Estimated capacity: 5-10 users per device (shared computer)**
- **Practical: 1 user per device (personal app)**

**Cloud Capacity:**
- Supabase free tier: 500 MB database
- Estimated: 1000-5000 users (depending on activity)
- Paid tier: Unlimited scalability

### Data Scalability

**Local Storage Growth:**
- ~100 runs: ~1 MB
- ~1000 runs: ~10 MB
- GPS data: ~5-10 KB per run

**Mitigation:**
- Optional GPS data deletion (older runs)
- Cloud-only storage for old data (future)
- Data export and archive features

### Sync Scalability

**Current Implementation:**
- Single-threaded sync
- Sequential batch uploads
- ~1000 records/minute

**Future Improvements:**
- Parallel table syncing
- Web Workers for background sync
- Delta sync (only changed fields)
- Compression for large payloads

### API Scalability

**Rate Limiting:**
- OpenAI API: Tier-based limits
- Supabase API: Connection pooling
- Custom rate limiting on endpoints

**Caching:**
- AI responses cached in IndexedDB
- Static data (badges, etc.) cached
- CDN for static assets

---

## Deployment Architecture

### Production Environment

```
Users → Vercel Edge Network → Next.js App
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              Supabase                         OpenAI API
         (Auth + Database)              (Chat + Plan Generation)
                    ↓
              PostHog + Google Analytics
```

### Edge Computing

**Vercel Edge Functions:**
- Middleware runs at edge for fast auth checks
- Server Components render close to users
- Static assets served from CDN

**Benefits:**
- Low latency worldwide
- Automatic scaling
- DDoS protection

---

## Future Architecture Enhancements

### Planned Improvements

1. **Bidirectional Sync**
   - Cloud → Local sync
   - Multi-device data consistency
   - Conflict resolution UI

2. **Offline Queue**
   - Persistent queue for failed syncs
   - Manual retry mechanism
   - Better error reporting

3. **Real-time Updates**
   - Supabase Realtime subscriptions
   - Live sync status across devices
   - Instant data updates

4. **Data Compression**
   - GPS path compression (pako.js)
   - Reduces storage by ~70%
   - Faster sync transfers

5. **Service Worker**
   - Background sync API
   - Push notifications
   - True offline mode

6. **Web Workers**
   - Heavy sync operations in worker
   - Non-blocking UI during sync
   - Better performance

---

## Monitoring & Observability

### Current Monitoring

**PostHog:**
- User events (signup, login, sync)
- Feature usage analytics
- Session recordings (if enabled)

**Google Analytics:**
- Page views
- User demographics
- Traffic sources

**Browser Console:**
- Client-side errors
- Sync status logs
- Performance metrics

### Future Monitoring

**Planned:**
- Sentry for error tracking
- Supabase logs integration
- Custom performance monitoring
- Sync success/failure metrics
- Database size tracking

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [Dexie.js Documentation](https://dexie.org/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
**Maintained By**: Development Team
