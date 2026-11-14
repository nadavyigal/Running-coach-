# Repo audit: RunSmart web, 2026-11-11

Branch `claude/2026-11-11-runsmart-repo-audit`, from `main` at 8b067bc1.
Baseline on `main` (`v0/`): lint 0 errors / 1,657 warnings; `type-check` and `tsc --noEmit` clean; Vitest 1,498 passed, 2 skipped; `next build` passes.

## Urgent: credentials committed to this public repo

| File | What |
|------|------|
| `v0/scripts/apply-migrations.js`, `check-db.js`, `test-supabase.js` | **service_role** key for Supabase project `biilxiuhufkextvwqdob` (bypasses row-level security) |
| `v0/scripts/test-complete-backend.js`, `test-implementation.js` | anon key, same project |
| `docs/implementation-reports/SUPABASE_FIX_IMPLEMENTATION.md` | service_role key, same project |
| `SUPABASE-AUTH-CONFIGURATION.md` | anon key for `dxqglotcyirxzyqaxqln` |

The code points at `dxqglotcyirxzyqaxqln` 20 times and `biilxiuhufkextvwqdob` 7 times. If `biilxiuhufkextvwqdob` still exists, anyone can read and write all of its data. This branch deletes the scripts and redacts the docs. **The keys stay in git history until rotated.**

## Fixed in this branch

| What | Why it was safe |
|------|-----------------|
| Deleted the 5 key-bearing scripts; redacted the 2 docs | One-off scripts from 2025-11, referenced only by an old ESLint error dump |
| Pre-commit hook also blocks `sbp_…` and `sb_secret_…` | Same gap as Resumely web |
| **Untracked the root `node_modules/` (3,757 files)** | Committed in the initial commit even though `.gitignore` excludes it. Verified with it moved away (as a fresh CI clone sees it): lint, both type-checks, Vitest and build all pass |
| Deleted 70 `v0/` source files nothing imports (26 old dashboard/feature components, 21 unused shadcn primitives, 1 hook, 22 `lib/` modules incl. 5 `lib/debugging/*.js`). Kept `lib/server/ai-insights-worker.ts`: it is a BullMQ worker started as its own process, which an import graph cannot see | Import resolution across all of `v0/` incl. tests and dynamic `import()`; newest file last touched 2026-04-27. Lint, type-check, Vitest, build pass after |
| Deleted `apps/ios-old-old/` (50 files) | `tasks/progress.md` already records it as dead; the shipping app is the `apps/ios-native` submodule |
| `v0/` root: 26 reports moved to `docs/archive/v0-root-reports/`; 111 debug scripts, logs, screenshots, Lighthouse dumps, `.ps1`/`.bat`, backups and Vitest output files deleted (Vitest outputs now ignored) | Nothing in code, config or CI reads them; the screenshot PNGs are outputs of debug e2e specs |
| Repo root: 61 → 18 tracked files. Reports moved to `docs/archive/root-reports/`; accidental files deleted (`tatus --porcelain`, `e --abbrev-ref …`, `patch.txt`, `commit_message.txt`, `tmp_chat_screen_backup.tsx`, `tsc-output.txt`); orphan `BMAD-METHOD` gitlink removed (no `.gitmodules` entry) | Kept `AHA_MOMENTS.md`, `DEPLOYMENT-STATUS.md` and the architecture `.txt` because docs link to them |

## For your review (not changed)

1. **Rotate the leaked keys** (founder only). See the PR.
2. **`v0/capacitor.config.ts` points iOS at `../apps/ios`, which does not exist.** Recommend: delete the Capacitor config and `@capacitor/*` deps if the native app replaced it, or point it at the right path.
3. **1,657 lint warnings.** Recommend: one pass on the top rule, then make new warnings fail CI.
4. **`tsconfig.typecheck.json` excludes `app/api/**`**, so the 22 API routes the zod-4 migration touched are not type-checked (noted in progress 2026-10-29). Recommend: bring `app/api` back into the type-check.
5. **Two test failures noted in progress (2026-10-29)** did not reproduce today (1,498/1,498).
6. **`tasks/progress.md` fields run to thousands of words**; the rule is 25 words per field. Recommend: move history to the session log.
7. **Repo pack is 325 MB.** Old `node_modules` and screenshots stay in history. Recommend: leave, or rewrite history only alongside key rotation.
8. **Unclear folders:** `backend/` (a Python file and `yolo_log.txt`, 2025-12), `services/` and `packages/shared` (not referenced from `v0/`), `video-production/` (40 files), `GTM/`, `.bmad-core/` (2025-07), `.codex/` (189 files), `.cursor/` (146 files). Recommend: archive what no longer runs.
9. **41 stale remote branches** (20 unmerged, 21 merged and not deleted).
10. **Is `v0/lib/server/ai-insights-worker.ts` running anywhere?** The Garmin sync enqueues `ai-insights` jobs (`lib/server/garmin-sync-queue.ts`), but nothing in this repo starts the worker (`services/worker` consumes a different queue; no script, cron or CI step). If no host outside the repo runs it, those jobs pile up in Redis unprocessed. Recommend: check your worker host; if nothing runs it, either start it or stop enqueueing.
11. **Stale doc pointers to deleted files:** `v0/docs/QUICK-WINS-DEPLOYMENT.md:280` (`lib/seo.ts`), `v0/docs/OPTIMIZATION_SUMMARY.md` and `v0/docs/IMPLEMENTATION_GUIDE.md` (`use-optimized-state`, `lib/debugging/`). No runtime effect.
12. **`docker-compose.yml`, `.dockerignore`, `README-DOCKER.md`**: nothing in CI or Vercel uses Docker. Recommend: confirm and remove.

## Addendum 2026-11-14: API routes that cannot run on the server

43 routes in `v0/app/api/` use the browser-only Dexie database (`lib/db.ts` / `lib/dbUtils.ts`), directly or (for `onboarding/chat`) through `OnboardingSessionManager`. On the server there is no IndexedDB, so their database calls throw "Database not available". They are excluded by name from `tsconfig.typecheck.json`; every other API route is now type-checked in CI. The iOS app calls none of them.

**Called by the website (24):** these are features that silently fail today.

- `/api/coaching/feedback` (from `components/coaching-feedback-modal.tsx`, `vitest.setup.ts`)
- `/api/coaching/profile` (from `components/coaching-preferences-settings.tsx`)
- `/api/cohort/join` (from `components/join-cohort-modal.tsx`)
- `/api/cohort/stats` (from `components/community-comparison.tsx`, `components/community-stats-widget.tsx`)
- `/api/data-fusion/conflicts/[id]/resolve` (from `components/conflict-resolution-center.tsx`)
- `/api/data-fusion/conflicts` (from `components/conflict-resolution-center.tsx`)
- `/api/data-fusion/sources` (from `components/data-sources-manager.tsx`)
- `/api/data-fusion/sync` (from `components/data-sources-manager.tsx`)
- `/api/devices/connect` (from `components/device-connection-screen.tsx`)
- `/api/devices` (from `app/garmin/callback/page.tsx`, `app/garmin/connect/route.ts`, `app/garmin/details/page.tsx` …)
- `/api/goals/analytics` (from `components/goal-analytics-insights.tsx`)
- `/api/goals/recommendations` (from `components/goal-recommendations.tsx`)
- `/api/goals` (from `components/goal-analytics-insights.tsx`, `components/goal-recommendations.tsx`)
- `/api/onboarding/chat` (from `hooks/use-ai-service-error-handling.ts`)
- `/api/performance/export` (from `components/performance-analytics-dashboard.tsx`)
- `/api/performance/records` (from `components/personal-records-card.tsx`)
- `/api/recovery/wellness` (from `components/recovery-dashboard.tsx`, `vitest.setup.ts`)
- `/api/share-run` (from `components/share-run-modal.tsx`)
- `/api/sync/jobs` (from `components/background-sync-status.tsx`, `vitest.setup.ts`)
- `/api/training-plan/customize/[workoutId]` (from `components/plan-customization-dashboard.tsx`)
- `/api/training-plan/customize` (from `components/plan-customization-dashboard.tsx`)
- `/api/training-plan/race-goal` (from `components/race-goal-modal.tsx`)
- `/api/training-plan/workouts` (from `components/plan-customization-dashboard.tsx`)
- `/api/user-data` (from `components/chat-screen.tsx`)

**Called by nothing (19):** safe to delete.

`/api/coaching/adaptive-recommendations`, `/api/data-fusion/quality`, `/api/data-fusion/rules`, `/api/engagement-optimization`, `/api/goals/milestones/achieve`, `/api/goals/milestones`, `/api/goals/progress`, `/api/heart-rate/[runId]`, `/api/heart-rate/zones/distribution`, `/api/heart-rate/zones`, `/api/metrics/advanced/[runId]`, `/api/metrics/running-dynamics/[runId]`, `/api/performance/analytics`, `/api/plan/adapt`, `/api/recovery/hrv`, `/api/recovery/sleep`, `/api/training-plan/generate-advanced`, `/api/training-plan/preview`, `/api/workouts/zone-based`

Recommend: delete the uncalled ones; for each called one, either move its data to Supabase (server) or remove the screen that calls it.

Also decided 2026-11-14: Capacitor stays (inert in browsers; removal would touch run recording). The AI-insights BullMQ worker question is closed: production has no `REDIS_URL`/`REDIS_HOST`, so `enqueueAiInsightsJob` returns `queued: false` and no jobs accumulate; the queue and worker code are unused in production.
