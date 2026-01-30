# Phase 0 Repo Audit (Monetization)

## Scope and method
- Scanned repository files under `v0/` plus Supabase migrations and analytics docs.
- No live app inspection performed in this phase.

## Architecture map (repo-grounded)
- App: Next.js 14 App Router under `v0/`.
- UI: `v0/app/` routes and `v0/components/` screens and widgets.
- Local data: Dexie IndexedDB in `v0/lib/db.ts` with a local-first model.
- Cloud data: Supabase Postgres schema in `v0/supabase/migrations/`.
- Sync: local -> cloud sync in `v0/lib/sync/sync-service.ts` (see `v0/docs/ARCHITECTURE.md`).
- Auth: Supabase Auth via `v0/lib/auth-context.tsx`, `v0/lib/supabase/client.ts`, `v0/lib/supabase/server.ts`, and `v0/middleware.ts`.
- AI: OpenAI in `v0/app/api/chat/route.ts` and `v0/app/api/onboarding/chat/route.ts`.
- Analytics: PostHog in `v0/lib/posthog-provider.tsx` and `v0/lib/analytics.ts`, GA via `v0/app/layout.tsx`.

## Data model summary (source of truth)
### Local (Dexie)
Defined in `v0/lib/db.ts`.
- `users`: includes subscription fields (`subscriptionTier`, `subscriptionStatus`, `trialStartDate`, `trialEndDate`, `subscriptionStartDate`, `subscriptionEndDate`).
- `plans`, `workouts`: training plans and scheduled workouts.
- `runs`: completed runs; contains GPS fields (`gpsPath`, `route`, accuracy metrics) and AI report fields (`runReport`).
- `chatMessages`, `conversationMessages`: AI chat and onboarding conversation storage.
- `routes`, `routeRecommendations`, `userRoutePreferences`: route selection and preferences.
- `wearableDevices`, `heartRateData`, `runningDynamicsData`, `advancedMetrics`: wearables and advanced telemetry.

### Cloud (Supabase)
Defined in `v0/supabase/migrations/001_initial_schema.sql` and `v0/supabase/migrations/006_authenticated_user_schema.sql`.
- `profiles`: user profile data linked to Supabase Auth (`auth_user_id`).
- `plans`, `workouts`: training plans and workouts.
- `runs`: includes GPS, route, and run report fields.
- `goals`, `goal_progress_history`, `shoes`, `sleep_data`, `hrv_measurements`, `recovery_scores`.
- `conversations`, `conversation_messages`: chat storage.

## Where key product data lives
- User profile: `users` in Dexie (`v0/lib/db.ts`) and `profiles` in Supabase (`v0/supabase/migrations/001_initial_schema.sql`).
- Runs and GPS: `runs` in Dexie and Supabase; GPS fields in `v0/lib/db.ts` Run interface; run recording logic in `v0/lib/run-recording.ts`.
- Plans and workouts: `plans` and `workouts` in Dexie and Supabase; plan generation in `v0/app/api/generate-plan/route.ts` and `v0/lib/planGenerator.ts`.
- AI chat: client-side storage in `v0/lib/conversationStorage.ts`; server chat endpoint in `v0/app/api/chat/route.ts`.
- Wearables: Garmin endpoints under `v0/app/api/devices/garmin/*`; UI in `v0/components/device-connection-screen.tsx`.

## Analytics and tracking
- PostHog: `v0/lib/posthog-provider.tsx`, events in `v0/lib/analytics.ts`, documentation in `v0/docs/analytics-events.md`.
- Google Analytics: gtag in `v0/app/layout.tsx`.

## Feature flags and gating
- Feature flag: `NEXT_PUBLIC_ENABLE_PLAN_TEMPLATE_FLOW` in `v0/lib/featureFlags.ts`.
- Subscription gating: `v0/lib/subscriptionGates.ts` defines Pro features but currently returns access for all users (testing mode). Used in:
  - `v0/app/api/goals/recommendations/route.ts`
  - `v0/app/api/recovery/recommendations/route.ts`
- Pricing page is placeholder: `v0/app/landing/pricing/page.tsx`.

## Hosting and deployment
- Vercel config at `vercel.json` (root) and `v0/vercel.json.backup`.

## Unknowns and how to verify
- Are Supabase tables actively used in production sync, or is Dexie the only source of truth? Verify by tracing sync calls in `v0/lib/sync/sync-service.ts` and checking production Supabase logs.
- Are `conversations` and `conversation_messages` in Supabase used for chat persistence? Verify usage in API routes and `v0/lib/server/chatRepository.ts` (currently in-memory).
- Exact GA configuration: `v0/app/layout.tsx` hard-codes a GA ID. Verify whether this is intended for production.
- Any existing billing provider integration? None found in repo; confirm by searching for payment SDKs in `v0/package.json`.
