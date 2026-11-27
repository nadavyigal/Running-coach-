# API routes that use the browser-only database (2026-11-14)

Investigation only. No app code changed. Follows the addendum in `docs/audits/2026-11-11-repo-audit.md`.

## Summary

1. All 43 routes are broken in production: the database they read lives in the user's browser, so on the server it is empty. They return errors, empty data, or a fake "success".
2. Only **10 are used by a screen people can open** (Today, Profile, Chat, /recovery). The other 14 "used" routes are called only by components that no screen renders, including **share-run** and **goal analytics**: users never hit them.
3. Nothing else calls the 19 unused routes: not the iOS app, crons, webhooks, or other repo code. Delete them.
4. Fix for the 10 live ones: mostly move the call into the browser (the data is already there). Small or medium work each. Remove the community (cohort) feature: it cannot work while each user's data stays on their own device.
5. Suggested order: Profile records and export, then chat "save to profile" and feedback, then Today goal recommendations, then /recovery, then deletes.

## Decisions for the founder

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Delete the 19 uncalled routes | Yes. Nothing calls them (checked web, iOS, crons, webhooks, other repo code). |
| 2 | Delete the 14 routes whose screen is never shown, plus their unused components | Yes. Users never hit them. Rebuild share-a-run later, in the browser, if you want it. |
| 3 | Community (cohort) widget and "Join cohort" | Remove for now. A real version needs new Supabase tables (Large). |
| 4 | Fix the other 8 live features in the browser (option b) | Yes, one small PR per screen. |

## Why it breaks (root cause in plain words)

- RunSmart web stores runs, goals, plans and settings in **IndexedDB**, a database inside the user's browser, through the Dexie library (`v0/lib/db.ts`).
- An API route runs on a Vercel server, not in the browser. The server has no IndexedDB and cannot see any user's browser data.
- On the server, `getDatabase()` returns `null` (`v0/lib/db.ts:1594`). Every helper then either throws "Database not available" or returns an empty fallback (`safeDbOperation`, `v0/lib/db.ts:1657`; same pattern in `v0/lib/dbUtils.ts`, e.g. `getRunsByUser` at `v0/lib/dbUtils.ts:1002` returns `[]`).
- So the route answers as if the user has no data: "User not found", empty lists, 500 errors, or a "success" that saved nothing.
- These routes were written as if the server shared the browser's database. It never did. Two more problems make a server fix harder:
  - The routes trust a numeric `userId` sent by the browser. That id is the local Dexie id, not the signed-in Supabase user, and there is no auth check.
  - The four routes with `[id]` in the path read `params.x` directly. Next 16 passes `params` as a Promise, so the id is always missing (the probe below got "Invalid run ID" / "Missing workoutId parameter").

## How this was checked

- **Callers:** searched `v0/` for every route path, then traced each calling file through the import graph from every `app/**/page.tsx` and `layout.tsx` to see if a real screen renders it. Also searched the iOS repo (`origin/main`), `vercel.json` crons, Garmin webhook routes, and all non-`v0` code.
- **Server behavior:** ran every handler in Node (no browser, same as Vercel) with dummy input, then replayed the exact request each live screen sends. No real data, no network writes.
- **Production:** called 15 read-only GET routes on `www.runsmart-ai.com` with a fake user id (`999999`). Results matched the local run exactly. No POST/PUT/DELETE was sent to production.
- **Production logs:** `vercel logs` keeps about 2 hours of history here. No request to any of the 43 routes appeared in that window, so logs give no traffic evidence either way.

## Table A: 10 routes used by screens people can open

Fix codes: **(a)** move data to Supabase and keep a server route, **(b)** move the logic into the browser and drop the route, **(c)** remove the feature.

| Route | What it does | Storage | Screen that calls it | What happens in production today | Fix | Reason | Effort | User impact of fix |
|---|---|---|---|---|---|---|---|---|
| `GET, PUT /api/goals/recommendations` | Builds and answers goal suggestions | Dexie `users`, `goals`, `goalRecommendations`; Pro check via `lib/subscriptionGates.ts` (also Dexie) | Today, "Smart Recommendations" card (`components/goal-recommendations.tsx:104`, rendered at `components/today-screen.tsx:1594`) | **403 `pro_required` for every user** (verified on prod). The Pro check cannot find the user, so everyone sees a "Pro Feature" upsell with sample suggestions. Accept/dismiss would 500. | b | Goals are already on the device; `goalProgressEngine` runs in the browser. Pro status must come from the real subscription source, not Dexie. | M | Today shows real suggestions instead of a permanent upsell. |
| `PUT /api/goals` | Updates a goal | Dexie `goals` | Same card, only after accepting an "adjustment" suggestion (`components/goal-recommendations.tsx:208`) | Never reached, because suggestions never load. Would return 404 "Goal not found". | b | Call `dbUtils.updateGoal` in the browser; the existing sync (`lib/sync/sync-service.ts:245`) uploads goals to Supabase. | S (with the row above) | Accepting a suggestion changes the goal. |
| `GET /api/cohort/stats` | Compares the user with their running group | Dexie `cohorts`, `cohortMembers`, `runs` | Today community widget (`components/community-stats-widget.tsx:35`); Profile > performance > community comparison (`components/community-comparison.tsx:59`) | 404 "User not in a cohort" for everyone (verified on prod). Both widgets hide themselves or show "not in a cohort". Silent. | c | A group comparison needs other users' data, which is never on your device. A real version is option (a): new Supabase cohort tables plus aggregates (L). | S to remove | None visible: the widgets are already empty. |
| `POST /api/cohort/join` | Joins a group by invite code | Dexie `cohorts`, `cohortMembers`, `users` | Profile, "Join cohort" modal (`components/join-cohort-modal.tsx:31`, opened at `components/profile-screen.tsx:902`) | 500 "Internal server error" toast every time. | c | Same as above. | S | Removes a button that always fails. |
| `GET /api/performance/records` | Personal records (fastest 5K, longest run…) | Dexie `personalRecords`, `runs` | Profile > performance > records card (`components/personal-records-card.tsx:69`) | 200 with **no records** (verified on prod). Users with real PRs see "none". Silent and wrong. | b | `dbUtils.getPersonalRecordProgression` already works in the browser. | S | Users see their real PRs. |
| `GET /api/performance/export` | Downloads runs as CSV or JSON | Dexie `runs`, `performanceMetrics`, `personalRecords` | Profile > performance > Export (`components/performance-analytics-dashboard.tsx:188`) | 200, **downloads a file with no runs** (verified on prod). Silent and wrong. | b | Build the file in the browser from Dexie. | S | Export contains the user's data (also matters for data access requests). |
| `PUT /api/user-data` | Saves profile facts the AI coach found in chat | Dexie `users` | Chat, "Save to profile" (`components/chat-screen.tsx:245`) | 500 "not available on server", "Failed to save to profile" toast every time. | b | Call `dbUtils.updateUser` in the browser; the sync uploads the profile. | S | Saving from chat works. |
| `POST /api/coaching/feedback` | Stores a rating of a coach reply and adapts coaching | Dexie `coachingFeedback`, `coachingProfiles` | Chat, rate-a-reply buttons (`components/chat-screen.tsx:736`, modal `components/coaching-feedback-modal.tsx:121`) | **200 "Feedback received" but nothing is saved** (verified locally with the exact request). Fake success. | b | `adaptiveCoachingEngine.processFeedback` and the helpers work in the browser. | S | Ratings are kept and can shape coaching. |
| `GET, PUT /api/coaching/profile` | Reads and saves coaching preferences (tone, detail, difficulty) | Dexie `coachingProfiles`, `coachingFeedback`, `coachingInteractions`, `behaviorPatterns` | Chat, "Coaching preferences" dialog (`components/chat-screen.tsx:812`, `components/coaching-preferences-settings.tsx:118` and `:164`) | GET 500 "Database schema outdated. Please refresh the page" (verified on prod), so preferences never load. PUT 404 "Coaching profile not found", so save fails. | b | Same browser helpers. If the chat AI should use these preferences, send them with the chat request. | M | Preferences load and save. |
| `GET /api/recovery/wellness` | Reads the day's wellness check-in (energy, mood, soreness) | Dexie `subjectiveWellness` via `lib/recoveryEngine.ts` | `/recovery` page (`components/recovery-dashboard.tsx:110`), opened from "View Full Dashboard" / "Log Wellness Data" (`components/recovery-recommendations.tsx:423`) on the Plan and Record screens | 500 "Failed to get wellness data" (verified on prod). The wellness section stays empty. Silent. | b | `RecoveryEngine` reads Dexie in the browser. Fix the page's two sibling calls at the same time (see "Degraded paths"). | M | /recovery shows the user's own data. |

## Table B: 14 routes called only by components no screen renders

Each caller file exists, but no page or layout imports it (traced through the import graph). Users cannot reach these routes. Production behavior is from the local server run; GETs marked "prod" were also called on production.

| Route | What it does | Storage | Caller (never rendered) | Production today | Fix |
|---|---|---|---|---|---|
| `POST /api/share-run` | Builds share text and social links for a run | Dexie `runs`, `users` | `components/share-run-modal.tsx` (only its own test imports it) | 400 without `userId`, 404 "Run not found" with it. Its share link points to `/share/run/:id`, a page that does not exist. | c: delete route and modal. If you want share-a-run, build it in the browser with the native share sheet (S–M). |
| `GET /api/goals/analytics` | Goal progress charts and predictions | Dexie `goals`, `goalMilestones` | `components/goal-analytics-insights.tsx` | 400 without `goalId` (prod), 404 "Goal not found" with it | c |
| `POST /api/onboarding/chat` | AI chat during onboarding | Dexie via `lib/onboardingSessionManager.ts`; OpenAI | `components/onboarding-chat-overlay.tsx` (unrendered). `components/onboarding-screen.tsx:312` mounts the hook but never calls the chat function. | Fails before the AI call; returns 503 "use the guided form" (local run). Onboarding uses the guided form today. | c |
| `GET, POST /api/data-fusion/conflicts` | Lists and records conflicts between device data sources | Dexie `dataConflicts`, `dataSources`, `fusedDataPoints` | `components/conflict-resolution-center.tsx` | GET 500 | c |
| `POST /api/data-fusion/conflicts/[id]/resolve` | Resolves one conflict | Dexie `dataConflicts`, `fusedDataPoints` | `components/conflict-resolution-center.tsx` | 500 (and the `[id]` param bug) | c |
| `GET, POST /api/data-fusion/sources` | Lists and manages data sources | Dexie `dataSources`, `fusedDataPoints` | `components/data-sources-manager.tsx` | GET 500 (prod) | c |
| `POST /api/data-fusion/sync` | Merges data from several devices | Dexie fusion tables | `components/data-sources-manager.tsx` | 500 "Database not available" | c |
| `GET /api/devices` | Lists connected wearables | Dexie `wearableDevices` | `components/device-connection-screen.tsx` | 500 (prod) | c. Garmin uses the separate, working `/api/devices/garmin/*` routes. |
| `POST /api/devices/connect` | Registers a wearable | Dexie `wearableDevices` | `components/device-connection-screen.tsx` | 500 | c |
| `GET, POST, DELETE /api/sync/jobs` | Background device sync jobs | Dexie `syncJobs`, `wearableDevices` | `components/background-sync-status.tsx` | GET 500 (prod) | c |
| `GET /api/training-plan/workouts` | Lists a plan's workouts | Dexie `workouts` | `components/plan-customization-dashboard.tsx` | 200 empty list (prod) | c |
| `PUT, POST /api/training-plan/customize` | Edits or adds a plan workout | Dexie `plans`, `workouts` | `components/plan-customization-dashboard.tsx` | 500 or 404 with real input | c |
| `DELETE /api/training-plan/customize/[workoutId]` | Deletes a plan workout | Dexie `workouts` | `components/plan-customization-dashboard.tsx` | 400 "Missing workoutId parameter" (the `[id]` param bug) | c |
| `GET, POST, PUT, DELETE /api/training-plan/race-goal` | Race goals | Dexie `raceGoals` | `components/race-goal-modal.tsx`, only used by `components/race-goals-screen.tsx`, which nothing renders | GET 200 empty (prod). POST 500: `dbUtils.getPrimaryRaceGoal is not a function` (a separate code bug). | c |

Effort for all of Table B: S (delete routes, their unrendered components and their tests).

## Table C: 19 routes nothing calls

Callers checked: web screens and components, iOS app (`origin/main` calls only `/api/coach/voice-cue`, `/api/generate-plan`, `/api/run-report`, `/api/devices/garmin/connect` on this backend, plus Strava's own API), `vercel.json` crons (only `/api/cron/garmin-nightly` and `/api/internal/jobs/garmin`), Garmin webhooks (`/api/devices/garmin/webhook*`), and all code outside `v0/`. The only hits are their own tests, one e2e spec (`e2e/production-verification.spec.ts`, for `data-fusion/quality` and `data-fusion/rules`), old docs, and path constants in `packages/shared/src/api/endpoints.ts` that neither the web app nor the iOS app imports.

| Route | What it does | Storage | Production today (local server run) |
|---|---|---|---|
| `GET, POST /api/coaching/adaptive-recommendations` | Coaching suggestions from run history | Dexie coaching tables, `runs` | GET 200 with empty suggestions |
| `GET /api/data-fusion/quality` | Data quality score per source | Dexie fusion tables | 500 |
| `GET, PUT /api/data-fusion/rules` | Fusion rules | Dexie `dataFusionRules` | GET 500 |
| `GET, POST, PUT /api/engagement-optimization` | Engagement score and best notification time | Dexie `users` | 404 "User not found" |
| `POST /api/goals/milestones/achieve` | Marks a milestone reached | Dexie `goals`, `goalMilestones` | 400 / 404 |
| `GET, POST, PUT, DELETE /api/goals/milestones` | Goal milestones | Dexie `goalMilestones` | 400 / 404 |
| `GET, POST /api/goals/progress` | Goal progress history | Dexie `goals`, `goalProgressHistory` | 404 "Goal not found" |
| `GET, POST /api/heart-rate/[runId]` | Heart-rate samples for a run | Dexie `heartRateData` | 400 "Invalid run ID" (`[id]` param bug) |
| `GET, POST /api/heart-rate/zones/distribution` | Time in each HR zone | Dexie `heartRateData`, `heartRateZones`, `runs`, `zoneDistributions` | 500 |
| `GET, POST, PUT, DELETE /api/heart-rate/zones` | HR zone settings | Dexie `heartRateZones`, `heartRateZoneSettings`, `users` | 500 |
| `GET, POST /api/metrics/advanced/[runId]` | Advanced run metrics | Dexie `advancedMetrics` | 400 "Invalid run ID" |
| `GET, POST /api/metrics/running-dynamics/[runId]` | Cadence, ground contact, etc. | Dexie `runningDynamicsData` | 400 "Invalid run ID" |
| `GET /api/performance/analytics` | Performance summary and trends | Dexie `runs`, `performanceMetrics`, `personalRecords` | 200 with zeros |
| `GET, POST /api/plan/adapt` | Adapts the plan after changes | Dexie `users`, `plans` | 404 "User not found" |
| `GET, POST /api/recovery/hrv` | HRV readings | Dexie `hrvMeasurements` | 500 |
| `GET, POST /api/recovery/sleep` | Sleep data | Dexie `sleepData` | 500 |
| `POST, GET /api/training-plan/generate-advanced` | Periodized race plan | Dexie `raceGoals`, `plans`, `workouts` | 404 "Race goal not found" |
| `GET /api/training-plan/preview` | Preview of a race plan | Dexie `raceGoals`, `runs` | 400 / 404 |
| `GET, POST /api/workouts/zone-based` | HR-zone workouts | Dexie `heartRateZones`, `users` | 500 |

Recommendation: delete all 19, with their tests, the two e2e checks, and the matching `packages/shared` constants. Effort S.

## Degraded paths in routes outside the 43 (not in scope, noted)

- `/api/recovery/score` and `/api/recovery/trends` read Dexie through `lib/recoveryEngine.ts`. On production they return **200 with made-up data**: a default score of 50 for any user id, and invented trend values (checked with user id `999999`). The /recovery page shows these as if they were real. Fix them together with `/api/recovery/wellness`.
- The audit addendum names 11 such indirect routes (e.g. `generate-plan`, `run-report`). They still work, with less personalization.

## Corrections to the 2026-11-14 addendum

- "Called by the website (24)" is really **10 live + 14 dead**: the 14 are called only from components no screen renders. **share-run is not live**: only its own test imports `share-run-modal`.
- `/api/devices` is called only by `components/device-connection-screen.tsx`, which is not rendered. The `app/garmin/*` files call `/api/devices/garmin/*`, a different, working route group.
- `/api/onboarding/chat`: the onboarding screen mounts the hook but never sends a chat; the overlay that would is not rendered.

## Other bugs found on the way (not fixed)

1. `POST /api/training-plan/race-goal` crashes: `dbUtils.getPrimaryRaceGoal is not a function`.
2. All four `[id]` routes read `params` synchronously; on Next 16 the id is always missing.
3. `POST /api/coaching/feedback` reports success while saving nothing.
4. None of the 43 routes checks who is signed in. They act on any `userId` in the request. Any route kept or moved to Supabase (option a) must use the signed-in Supabase user instead.

## Suggested order of work

Each step is one small PR. Most visible first.

1. **Profile: records card and export** (`performance/records`, `performance/export`), option b, S. Users currently see no PRs and download empty files.
2. **Chat: "Save to profile" and reply ratings** (`user-data`, `coaching/feedback`), option b, S. One shows an error every time; the other fakes success.
3. **Today: goal recommendations** (`goals/recommendations`, `goals` PUT), option b, M. Needs one decision first: where Pro status comes from.
4. **Chat: coaching preferences** (`coaching/profile`), option b, M.
5. **/recovery page** (`recovery/wellness`, plus the score and trends routes above), option b, M. Stops showing invented numbers.
6. **Remove community** (`cohort/stats`, `cohort/join`, both widgets, the Join modal), option c, S.
7. **Delete the 14 dead-UI routes and their unrendered components** (Table B), S. If you want share-a-run, plan it as a new browser-side feature afterwards.
8. **Delete the 19 uncalled routes** (Table C), S. Steps 6 to 8 also shrink the `exclude` list in `v0/tsconfig.typecheck.json`, so those files leave the type-check exception.

Goals note: the "goals screens" mentioned in the brief are split. Goal **recommendations** (Today card) are live and broken. Goal **analytics** is not rendered anywhere.
