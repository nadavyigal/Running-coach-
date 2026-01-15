# Garmin Activity Import - Data Flow & Security (RunSmart)

CRITICAL: Do not invent facts. Replace any `[[FILL: ...]]` placeholders before sharing externally.

This document summarizes how Garmin activity data is requested, transmitted, stored, and controlled in RunSmart, with least-privilege and user control as the default.

---

## Overview

Goal: Import completed running activities from Garmin into RunSmart so users don't need to manually log runs and can see coaching insights based on their real activity history.

## Data Flow (high level)

1. User initiates connection
   - RunSmart UI: “Connect Garmin”
   - Server returns Garmin OAuth authorization URL

2. OAuth authorization + consent
   - User authenticates with Garmin and consents to share activity data with RunSmart
   - Garmin redirects back to RunSmart (OAuth callback)

3. Token exchange (server-side)
   - RunSmart exchanges authorization code for OAuth tokens
   - Tokens are stored for subsequent activity sync

4. Activity import
   - RunSmart requests the user's activities via the Activity API
   - RunSmart filters for running activities and writes new activities into the user's run history

Repo references:
- OAuth initiation: `V0/app/api/devices/garmin/connect/route.ts`
- OAuth callback/token exchange: `V0/app/api/devices/garmin/callback/route.ts`
- Activity fetch: `V0/app/api/devices/garmin/activities/route.ts`
- Local-first DB (Dexie): `V0/lib/db.ts`

## Data Collected (minimal)

Required (MVP):
- Activity identifier, timestamps, activity type (running)
- Distance, duration, pace/speed
- Calories (if available)
- Elevation gain (if available)
- Heart rate summary (avg/max) (if available)

Optional (only if needed and supported by the API + user consent):
- GPS track/route data for the activity
- Cadence, power, running dynamics fields

## Storage & Security Controls

Transport security:
- HTTPS/TLS in transit for all requests (Garmin ↔ RunSmart, user ↔ RunSmart)

Token handling (repo evidence):
- OAuth tokens are encrypted at rest using AES-256-GCM (`V0/app/api/devices/garmin/token-crypto.ts`)
- Encryption secret comes from `ENCRYPTION_KEY` env var (MUST be set in production)

Hosting/runtime:
- Next.js on Vercel (per `DEPLOYMENT-STATUS.md`, `V0/PRODUCTION_DEPLOYMENT.md`)

Database/storage:
- Local-first: IndexedDB via Dexie (`V0/lib/db.ts`)
- Supabase is present for server-side auth and beta signup storage (`V0/lib/supabase/*`)

[[FILL: confirm and document final production storage for Garmin tokens and imported activities. If server-side, document DB (e.g., Supabase Postgres) + encryption approach.]]

## Least-Privilege / Minimal Scope

- Only request the Garmin APIs and data fields required to import completed running activities for coaching and training analytics.
- Avoid requesting unrelated scopes (e.g., contacts, social graph, etc.).

## User Controls

Disconnect:
- User can disconnect Garmin in-app, which should remove/revoke stored Garmin tokens for that user.
  - [[FILL: confirm whether you call Garmin token revocation endpoint on disconnect]]

Deletion:
- User can request deletion of imported Garmin data.
  - [[FILL: document the in-app flow and/or support email process]]
  - [[FILL: deletion SLA, e.g., within 30 days]]

Export:
- [[FILL: whether the app supports exporting the user's run data]]

## Access Controls

- Imported Garmin activities are visible only to the authenticated user by default.
- Internal/admin access: [[FILL: describe if any exists, and when it is used (support, debugging), and how it is audited.]]

## Operational Security / Monitoring

Security headers and middleware exist in the app (examples):
- Security headers in `V0/next.config.mjs`
- Request security/rate limiting middleware in `V0/lib/security.middleware.ts`

Incident response:
- Support contact: [[FILL: security/support email]]
- Process: [[FILL: incident handling steps (acknowledge -> investigate -> remediate -> notify if needed)]]
