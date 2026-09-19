# RunSmart Web — P0 Hardening Plan

Status: ready to implement
Created: 2026-09-19
Source: CTO review 2026-09-12, revised 2026-09-19. Vault note `02-Products/RunSmart/2026-09-12-runsmart-web-cto-review.md` in Nadav Builder OS.
Scope decision: **maintenance-only.** Phase 1 needs no new founder decision. Phase 2+ does — see "Gated" at the bottom.

All paths are relative to `v0/`.

---

## Why this exists

Three defects are live on production and were reproduced with unauthenticated requests on 2026-09-12:

1. `POST /api/chat` returns a streamed GPT-4o completion to any anonymous caller, billed to the founder's OpenAI account.
2. `GET /api/test-openai-direct` executes a real OpenAI call per request and returns `"apiKeyPrefix":"sk-proj-"`.
3. `posthog.identify()` never fires on login, so returning users carry no person profile and retention cannot be computed.

Two of these cost money. The third makes every RunSmart metric untrustworthy.

---

## STORY 0 — OpenAI budget cap (do this first, 5 minutes, no code)

Set a hard monthly budget cap and a usage alert in the OpenAI dashboard for the key used by this project.

This is the only control that works while STORY 1 and 2 are in progress. It is not a substitute for them.

**Acceptance:** a cap exists and is below a figure the founder is willing to lose.

---

## STORY 1 — Delete dead test and debug endpoints

Delete these route directories entirely:

- `app/api/test-openai-direct/` — public GET, real OpenAI call per request, leaks key prefix
- `app/api/debug-env/` — returns Supabase project ref and publishable key prefix
- `app/api/chat-test/`
- `app/api/test-chat/`
- `app/api/test-onboarding-chat/`

Before deleting each, confirm no reference exists:

```
grep -rn "test-openai-direct\|debug-env\|chat-test\|test-chat\|test-onboarding-chat" \
  components/ hooks/ lib/ app/ contexts/ --include="*.ts" --include="*.tsx" | grep -v "^app/api/"
```

**Acceptance criteria**
- `npx tsc --noEmit` exits 0
- `NODE_ENV=production npm run build` exits 0
- After deploy, `curl -o /dev/null -w "%{http_code}"` against all five paths returns 404

**Tests:** none required — this is deletion. The build is the check.
**Analytics:** none.
**Complexity:** trivial. **Model: Sonnet.** **Astra: not required.**

---

## STORY 2 — Require a session on OpenAI-calling routes

Create one shared helper `lib/api-auth.ts` that resolves the Supabase user from request cookies and returns a 401 JSON response when absent. Apply it to:

```
app/api/chat/route.ts
app/api/ai-activity/route.ts
app/api/ai/garmin-insights/route.ts
app/api/analysis/run-from-photo/route.ts
app/api/coach/voice-cue/route.ts
app/api/generate-plan/route.ts
app/api/goals/discovery/route.ts
app/api/onboarding/goalWizard/route.ts
app/api/run-report/route.ts
app/api/workouts/generate/route.ts
app/api/chat-simple/route.ts
```

**CARVE-OUT — do not gate `app/api/onboarding/chat/route.ts`.** It is called during anonymous onboarding, before any account exists. Gating it breaks the primary activation path. Leave it as-is and name it as still-open in the final report. A signed device token for that route is a separate story and needs founder sign-off.

Also in `app/api/chat/route.ts`: line ~60 accepts `role: "system"` from the request body. Drop client-supplied `system` messages rather than forwarding them, so the coaching persona and safety text cannot be replaced by the caller.

Note on the rate limiter: `lib/security.config.ts:189` backs it with an in-memory `Map`. On Vercel that is per-lambda-instance and is not a real control. Do not try to fix this in the same story — once auth is required, the exposure drops enough that a durable limiter becomes a P2. Record it as known.

**Acceptance criteria**
- Each gated route returns 401 with no session and 200 with a valid one
- `/api/onboarding/chat` still works unauthenticated (regression check)
- A request containing `{"role":"system","content":"..."}` does not alter model behaviour

**Required tests**
- One integration test per gated route: 401 unauthenticated, 200 authenticated
- One unit test asserting client `system` messages are stripped in `app/api/chat/route.ts`
- One regression test asserting `/api/onboarding/chat` is reachable without a session

**Analytics:** confirm `onboarding_started` volume is unchanged 48h after deploy. A drop means the carve-out was broken.
**Complexity:** medium. **Model: Sonnet** — mechanical once the helper exists.
**Astra checkpoint: REQUIRED**, on `lib/api-auth.ts` specifically. Applying one helper 11 times is exactly where a subtle bypass hides.

---

## STORY 3 — Identify returning users in PostHog

Current state: `lib/analytics.ts:615` `setUserId()` is the only caller of `posthog.identify()`, and it runs in exactly one place — `components/auth/signup-form.tsx:134`. `components/auth/login-form.tsx:102` tracks a `login` event and never identifies. `lib/posthog-provider.tsx:75` sets `person_profiles: 'identified_only'`.

Consequence: a user who signs up Monday and returns Thursday arrives as a fresh anonymous ID with no person profile. D7 and D30 are not computable.

**Fix**
1. Call `setUserId(session.user.id)` from the `onAuthStateChange` handler in `lib/auth-context.tsx` (~line 92) on `SIGNED_IN` **and** on initial session restore, not only at signup.
2. Emit one explicit `activated` event at first completed run. The catalog at `lib/analyticsEvents.ts` names `first_run_recorded`, but nothing emits it and nothing imports that catalog; the app emits `run_completed`. Pick one name, emit it once, and say which in the report.

**Acceptance criteria**
- `identify` fires on auth-state change, verified by test
- Manual: log in as the QA account in a clean browser profile, confirm in PostHog Live Events that the session carries the identified distinct ID and that a person profile exists afterwards
- `activated` appears exactly once per user, not once per run

**Required tests:** unit test asserting `identify` is called on `SIGNED_IN`; test asserting `activated` is idempotent per user.
**Complexity:** low. **Model: Sonnet.** **Astra: light.**

---

## STORY 4 — Correct `docs/agent-os/project-context.md`

Six load-bearing claims are false. Agents read this file at the start of every session and have been planning against it.

| Replace this claim | With |
|---|---|
| "Supabase for auth and server-side data persistence" | Dexie/IndexedDB is the primary store (~25 tables); Supabase provides auth and mirrors 6 tables (profiles, runs, goals, shoes, plans, workouts) for signed-in users only |
| "5 Screens" | 124 API routes, 179 components; core app is a client-only SPA mounted from `app/page.tsx` with `ssr:false` |
| "Subscription gating via Paddle (paywall UI exists, not yet enforced)" | No payment integration exists. No Paddle, no Stripe, no RevenueCat. `lib/subscriptionGates.ts` gates 2 routes and tier is hardcoded `'free'` |
| "Next.js 14 (App Router)" | Next.js 16.3.0 |
| "Garmin Connect API bi-directional sync" | Paused. 0 connected users; all 9 connections `reauth_required` |
| "Day-30 Retention ≥ 40%" | Not computable until STORY 3 ships. Mark the metric as blocked rather than deleting it |

**Acceptance:** no statement in the file contradicts the code as of this commit.
**Complexity:** trivial. **Model: Sonnet.**

---

## STORY 5 — The suite is not green; three of four failures are environmental

A full `vitest run` on an idle machine (2026-09-19) gives **4 files failed, 2 tests failed, 1 unhandled error, 1400 passed, 2 skipped, 3436s**. `tasks/progress.md` recorded "1418 passed / 0 failed" from 2026-08-08; that no longer holds.

| Failure | Nature | Action |
|---|---|---|
| `lib/userInsightService.test.ts` | **Real.** Asserted a fixed ms delta against `setDate()` calendar math; off by exactly one hour because now + 8 weeks crosses the end of Israel Daylight Time on 2026-10-25. Production logic correct, test wrong | **Fixed 2026-09-19.** Lesson in `tasks/lessons.md` |
| `lib/habitAnalytics.test.ts` | `[vitest-worker]: Timeout calling "fetch"` on `dexie/import-wrapper.mjs` — dies at module load, not on an assertion | Environmental, see below |
| `lib/reminderService.test.ts` | `[vitest-worker]: Timeout calling "resolveId"` on `posthog-js` — same | Environmental, see below |
| `lib/integrations/garmin/service.test.ts` | Timed out at the 5000ms `testTimeout` | Re-run in isolation before treating as real |

The three environmental failures are consistent with the documented File Provider content-read stalls under `~/Documents`: `collect` alone took 4918s of the 3436s wall time. This is the same root cause already recorded for `xcodebuild` deadlocks and for `require('jsdom')` taking 27 minutes in ResumeBuilder Web. The durable fix is the founder's standing one: move the repo, or at least `node_modules`, off the synced path.

**Do not** raise `testTimeout` to make these pass. That hides a real environment problem behind a green build.

**Measurement hygiene, learned expensively while producing this plan.** An earlier two-file run in the same session took 2788s and reported a failure. That was contamination from two concurrent full-suite runs, not a property of the suite; a clean control run of the same two files is **15.77s, 31 passed, 0 failed**. Check the machine is idle before trusting any timing. And `~/Documents` **is** iCloud-managed — `defaults read com.apple.finder FXICloudDriveDesktop` returns 1. Do not re-derive the opposite from an inode comparison; that argument is invalid under Desktop & Documents sync and has now misled this project twice.

---

## Verification before declaring done

```
npx tsc --noEmit
npm run lint
npx vitest run
NODE_ENV=production npm run build
```

Run the full suite from an otherwise idle machine. A contaminated run produces meaningless timings — this was learned the expensive way during the review that produced this plan.

Then finish per the Session End Rule: `git status --short --branch`, `git log --oneline @{u}..`, push, open a PR, and update `tasks/progress.md` in the same response as the commit.

---

## Gated — do NOT start without explicit founder approval in-session

RunSmart is maintenance-only (2026-07-02, reconfirmed 2026-09-09). The following are real but are product work on a deprioritized product:

- **Delete the ~50 dead Dexie-on-server routes** and the duplicate `app/api/garmin/*` namespace. Defensible as attack-surface reduction; highest leverage for future velocity. Needs an Astra-reviewed deletion list first.
- **Close the Garmin IDOR shape** in `app/api/devices/garmin/{runs,sync,diagnose}` and `app/api/garmin/activities/[activityId]/recap`. These read `userId` from the query string and query with a service-role client. Not exploitable today only because 0 connections are healthy. **This is a precondition for any Garmin restoration, not a follow-up to it.**
- **Account prompt at plan generation** to stop anonymous users losing their plan. The only item here that plausibly moves retention.

Not now, at any priority: Dexie→Supabase migration, the `app/v2/` prototype, monetization, repairing (rather than deleting) the dead routes.
