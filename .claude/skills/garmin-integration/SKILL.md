---
name: garmin-integration
description: "Garmin Connect OAuth integration for the RunSmart PWA. Covers the complete OAuth 2.0 flow, token storage in Dexie.js (IndexedDB), activity fetching, device lifecycle (connect/sync/disconnect), and the thin-backend architecture pattern. Use when working on Garmin connection features, debugging OAuth issues, adding Garmin data, or extending the wearable device system."
user-invokable: true
---

# Garmin Integration Skill

## Project Context

RunSmart uses **Garmin Connect OAuth 2.0** to let users connect their Garmin
devices. All user data lives in **Dexie.js (IndexedDB)** — a browser-only
database. Server routes handle only what requires server secrets (signing OAuth
state, exchanging tokens with Garmin). This is the **thin-backend pattern**.

---

## Architecture: Thin-Backend Pattern

```
Browser (Dexie.js / IndexedDB)          Server (Next.js API Routes)
─────────────────────────────           ──────────────────────────
wearableDevices table                   Garmin OAuth secrets
  - accessToken (plain text)            GARMIN_CLIENT_ID
  - refreshToken                        GARMIN_CLIENT_SECRET
  - connectionStatus                    ENCRYPTION_KEY (for state signing)
  - lastSync
  - capabilities
  - settings.userProfile
```

**Rule:** Server routes NEVER read or write Dexie.js. All IndexedDB operations
happen in client components (`"use client"`).

---

## Environment Variables

```env
# Required — set in .env.local AND Vercel dashboard
GARMIN_CLIENT_ID=6149b041-557f-4ad0-82ea-ef5c3d6e867d
GARMIN_CLIENT_SECRET=Dn3GBEBxgtD++yOC2vByh4IiDDm2kADFOzpiochWE84
GARMIN_OAUTH_REDIRECT_URI=https://runsmart-ai.com/garmin/callback
ENCRYPTION_KEY=<32+ char secret used for HMAC signing OAuth state>
```

> **Note:** `GARMIN_OAUTH_REDIRECT_URI` must exactly match the redirect URI
> registered in the [Garmin Developer Portal](https://developer.garmin.com).
> For local dev the redirect will still point to production unless you register
> a localhost URI separately.

---

## Key Files

| File | Purpose |
|------|---------|
| `V0/app/api/devices/garmin/connect/route.ts` | POST — generates Garmin OAuth URL with signed state |
| `V0/app/api/devices/garmin/callback/route.ts` | POST — validates state, exchanges code for tokens, returns device data |
| `V0/app/api/devices/garmin/oauth-state.ts` | HMAC-SHA256 signed state generation & verification |
| `V0/app/api/devices/garmin/token-crypto.ts` | AES-256-GCM encryption (legacy, not used for storage in current impl) |
| `V0/app/api/devices/garmin/activities/route.ts` | GET — proxies to Garmin API using Bearer token from client |
| `V0/app/garmin/callback/page.tsx` | Client page — reads OAuth params, calls callback API, stores in Dexie.js |
| `V0/components/device-connection-screen.tsx` | UI for connecting/syncing/disconnecting devices |
| `V0/components/device-settings-screen.tsx` | UI for managing a connected device (reads/writes Dexie.js directly) |
| `V0/lib/garminManualExport.ts` | Formats workouts as Garmin-compatible text for manual export |
| `V0/lib/queue/syncQueue.ts` | BullMQ + Redis queue (optional background sync infrastructure) |

---

## Garmin API Endpoints (OAuth 2.0 PKCE — Verified from Official PDF Spec)

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Authorization | `https://connect.garmin.com/oauth2Confirm` | Redirect user to grant access |
| Token Exchange | `https://diauth.garmin.com/di-oauth2-service/oauth/token` | Exchange code → access_token |
| User Profile | `https://connect.garmin.com/userprofile-service/userprofile` | Get Garmin user info after auth |
| Activities | `https://connect.garmin.com/activitylist-service/activities/search/activities` | List activities |
| User Permissions | `https://apis.garmin.com/wellness-api/rest/user/permissions` | Check granted scopes |

> **Old (broken) endpoints — DO NOT USE:**
> - ~~`https://connect.garmin.com/oauth-service/oauth/preauthorized`~~ (OAuth 1.0, returns 404)
> - ~~`https://connect.garmin.com/oauth-service/oauth/access_token`~~ (OAuth 1.0, broken)

---

## OAuth 2.0 PKCE Flow (Required by Garmin Developer Program)

Garmin requires **Authorization Code + PKCE** (RFC 7636). OAuth 1.0 is deprecated (retires 12/31/2026).

### Step 1 — User clicks "Connect Garmin"

`DeviceConnectionScreen.connectGarmin()` calls:
```
POST /api/devices/garmin/connect
{ userId: number, redirectUri: string }
```

Server response:
```json
{ "success": true, "authUrl": "https://connect.garmin.com/oauth-service/oauth/preauthorized?..." }
```

Client redirects: `window.location.href = data.authUrl`

### Step 2 — User authorizes on Garmin

Garmin redirects to:
```
https://runsmart-ai.com/garmin/callback?code=XXX&state=YYY
```

### Step 3 — Callback page processes response

`/app/garmin/callback/page.tsx` (client component wrapped in Suspense):
```typescript
const code = searchParams.get("code");
const state = searchParams.get("state") ?? searchParams.get("oauth_state");
```

Calls `POST /api/devices/garmin/callback` with `{ code, state }`.

### Step 4 — Server exchanges code for tokens

`callback/route.ts`:
1. Verifies HMAC-signed state (extracts `userId`, `redirectUri`, checks expiry)
2. Exchanges code → access token via Garmin's token endpoint
3. Fetches Garmin user profile
4. Returns `{ success, userId, device: { authTokens, capabilities, ... } }`

### Step 5 — Client stores device in Dexie.js

Back in `callback/page.tsx`:
```typescript
const existing = await db.wearableDevices.where({ userId, type: 'garmin' }).first();
if (existing?.id) {
  await db.wearableDevices.update(existing.id, { ...device, updatedAt: new Date() });
} else {
  await db.wearableDevices.add(device);
}
```

Redirects to `/?screen=profile`.

---

## Garmin OAuth 2.0 PKCE Authorization Request

`GET https://connect.garmin.com/oauth2Confirm` with these query parameters:

| Parameter | Value | Notes |
|-----------|-------|-------|
| `client_id` | your registered client ID | Standard OAuth 2.0 (NOT `oauth_client_id`) |
| `response_type` | `code` | Standard OAuth 2.0 |
| `redirect_uri` | registered callback URL | Must exactly match Garmin portal |
| `scope` | `activity workout heart_rate` | Space-separated |
| `state` | HMAC-signed payload | Contains userId + codeVerifier + nonce |
| `code_challenge` | base64url(SHA256(codeVerifier)) | PKCE S256 challenge |
| `code_challenge_method` | `S256` | Required by Garmin |

## Garmin Token Exchange Request

`POST https://diauth.garmin.com/di-oauth2-service/oauth/token` with:

| Parameter | Value |
|-----------|-------|
| `grant_type` | `authorization_code` |
| `code` | code from Garmin callback |
| `redirect_uri` | same URI used in auth request |
| `client_id` | your client ID |
| `code_verifier` | original random string (PKCE proof) |
| `Authorization` | `Basic base64(clientId:clientSecret)` |

### Scopes Available

```
activity    # Activity data (runs, workouts)
workout     # Planned workouts
heart_rate  # Heart rate measurements
```

### Scopes Requested

```
activities workouts heart_rate training_data
```

---

## WearableDevice Schema (Dexie.js)

```typescript
interface WearableDevice {
  id?: number;               // Auto-increment primary key
  userId: number;            // Dexie user ID (not Supabase)
  type: 'apple_watch' | 'garmin' | 'fitbit';
  name: string;              // e.g. "Garmin Device" or user's displayName
  deviceId: string;          // e.g. "garmin-12345678"
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date | null;
  capabilities: string[];    // ['heart_rate', 'activities', 'advanced_metrics', 'running_dynamics']
  settings: {
    userProfile: any;        // Garmin user profile JSON
  };
  authTokens: {
    accessToken: string;     // Plain text (stored in IndexedDB)
    refreshToken?: string;
    expiresAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Fetching Activities

The client reads the token from Dexie.js and passes it in the Authorization header:

```typescript
// In a client component
const device = await db.wearableDevices
  .where({ userId, type: 'garmin' })
  .and(d => d.connectionStatus === 'connected')
  .first();

if (!device?.authTokens?.accessToken) {
  // Show reconnect prompt
  return;
}

const response = await fetch(`/api/devices/garmin/activities?userId=${userId}&limit=20`, {
  headers: {
    'Authorization': `Bearer ${device.authTokens.accessToken}`
  }
});
const { activities, runningCount } = await response.json();
```

If the server returns `{ needsReauth: true }`, mark the device as error in Dexie.js
and prompt the user to reconnect.

---

## Security Model

| Concern | Implementation |
|---------|---------------|
| OAuth state forgery | HMAC-SHA256 signed state with 10-min TTL, nonce, userId embedded |
| State timing attack | `timingSafeEqual` comparison in `oauth-state.ts` |
| Server secret exposure | Client ID/secret never sent to browser |
| Token storage | Plain text in IndexedDB (origin-isolated by browser sandbox) |
| Auth gate on OAuth routes | `withApiSecurity` (rate limited, no session required — security via signed state) |

---

## Common Issues & Fixes

### "Missing OAuth parameters" on callback
**Cause:** Garmin returned `oauth_state` but page reads `state`.
**Fix:** Already fixed — callback page reads `searchParams.get("state") ?? searchParams.get("oauth_state")`.

### 401 on connect/callback endpoints
**Cause:** `withAuthSecurity` requires a session — this app doesn't always have one.
**Fix:** Already fixed — Garmin endpoints use `withApiSecurity`.

### "Device not found" after OAuth
**Cause:** Server route tried to write to Dexie.js (IndexedDB not available in Node.js).
**Fix:** Already fixed — callback route returns device data, client stores in Dexie.js.

### Token expired (Garmin returns 401 on activities)
**Symptom:** Activities endpoint returns `{ needsReauth: true }`.
**Fix in client:**
```typescript
if (data.needsReauth) {
  await db.wearableDevices.update(deviceId, {
    connectionStatus: 'error',
    updatedAt: new Date()
  });
  // Show "Reconnect Garmin" button
}
```

### `GARMIN_OAUTH_REDIRECT_URI` mismatch
**Cause:** Redirect URI in env doesn't match what's registered in Garmin Developer Portal.
**Fix:** Log into [developer.garmin.com](https://developer.garmin.com), verify the registered
redirect URI exactly matches `GARMIN_OAUTH_REDIRECT_URI`.

---

## Adding New Garmin Data Points

To pull additional data from Garmin (e.g. sleep, HRV, VO2 max):

1. Add the relevant scope to `connect/route.ts`:
   ```typescript
   scope: 'activities workouts heart_rate training_data sleep hrv'
   ```
2. Add a new API route (e.g. `app/api/devices/garmin/sleep/route.ts`)
   following the same pattern as `activities/route.ts`:
   - Accept `Authorization: Bearer <token>` from client
   - Call Garmin API endpoint
   - Return data to client
3. In the client component, read the token from Dexie.js and pass it.
4. Store results in the appropriate Dexie.js table (e.g. `db.sleepData`).

---

## Garmin Developer Portal Setup

1. Go to [developer.garmin.com](https://developer.garmin.com/connect-iq/sdk/)
2. Create an app → OAuth 2.0 type
3. Set **Redirect URI** to `https://runsmart-ai.com/garmin/callback`
4. Copy **Client ID** → `GARMIN_CLIENT_ID`
5. Copy **Client Secret** → `GARMIN_CLIENT_SECRET`
6. Add both to `.env.local` and Vercel environment variables
7. Set `ENCRYPTION_KEY` to a random 32+ char string (used for HMAC state signing)

---

## Testing the Flow

```bash
# 1. Verify env vars are set
grep GARMIN V0/.env.local

# 2. Build passes
cd V0 && npm run build

# 3. Manual test (production)
# - Navigate to device connection screen
# - Click "Connect Garmin"
# - Should redirect to connect.garmin.com
# - Authorize → redirected to /garmin/callback
# - Should show "Garmin connected. Redirecting..."
# - Profile screen should show device as connected
```
