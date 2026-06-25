# Plan: Garmin Workout-Push (Training API) — D1 = BUILD

> **PARKED 2026-06-25.** Founder ran this plan in a Cursor session; the resulting spec confirmed
> the real blocker is Garmin's Training API workout-schema contract (endpoint URLs, payload shape,
> sport-type enum) is not in any public doc the founder has access to — closing this gap requires
> directly petitioning Garmin Partner Services, the same team gatekeeping Production approval. Not
> worth blocking the Gate-4 reply on. **Decision: drop Training API from the Garmin Developer
> Portal scope now (import-only product), revisit workout-push once RunSmart has enough traffic to
> justify reopening that conversation with Garmin.** This file and the Cursor-session spec are kept
> as reference for that future attempt, not deleted. The Garmin reply going out now states
> RunSmart is import-only and Training API is being removed from scope.

> Run this in a new session inside `/Users/nadavyigal/Documents/RunSmart`. This is a plan to
> execute via `superpowers:brainstorming` first, then `superpowers:writing-plans` /
> `superpowers:test-driven-development` — do not start writing implementation code before the
> brainstorm step below resolves the open scoping questions with the founder.

## Why this exists

Garmin's Gate-4 review (Marc Lussi / Elena Kononova, ticket 213145/213165) requires a screenshot
showing a successful **transfer** via the Training/Courses API. RunSmart's Garmin Developer Portal
scope currently includes Training API, but the product is **import-only** today — it reads Garmin
activity/health data, it never pushes anything back to a Garmin device. There is no code anywhere
in `v0/lib/integrations/garmin/` or `v0/lib/server/garmin-endpoints.ts` that writes to Garmin.

Two ways to close this gap were on the table: drop Training API from the Developer Portal scope
(fastest, no new code), or build real workout-push so the transfer screenshot is genuine. **Founder
decision (2026-06-24, reaffirmed): build it.** The Garmin reply stays on hold until this ships and
a real transfer is captured.

Context docs (read before starting): `docs/garmin-application/12-MARC-2026-06-22-REJECTION-REMEDIATION-PLAN.md`
section 7 (original scoping questions), `GARMIN-STATUS.md` (overall gate status).

## What's already known (don't re-derive — verified directly against the database today)

- **Workout data model**: Supabase table `workouts` — columns `id, plan_id, week, day, type, distance,
  duration, pace, intensity, training_phase, workout_structure (jsonb), notes, completed,
  scheduled_date, auth_user_id, completed_at, actual_distance_km, actual_duration_minutes,
  actual_pace`.
- **`workout_structure` is jsonb but currently NULL on every row in production** — checked directly.
  Whatever this column was intended for (structured interval steps?), it isn't populated by the
  current plan-generation pipeline. Do not assume rich interval data exists to map from. The only
  reliably populated fields are the flat ones: `type`, `distance`, `duration`, `pace`, `intensity`,
  `scheduled_date`. The Garmin workout you push will need to be synthesized from these flat fields
  (e.g. a single main-effort step at the target pace/distance), not from a step-by-step structure
  that doesn't exist yet. Building richer `workout_structure` population is out of scope here unless
  the brainstorm step decides it's required for a credible Garmin workout payload.
- **`garmin_connections.scopes` is an empty array `[]` in production** despite an active, healthy,
  syncing connection (already filed as a separate tracked issue, task: "Investigate Garmin
  scopes-empty + non-running activity tags"). This is directly relevant here: before writing any
  push code, confirm whether Garmin's OAuth model for this app even returns per-scope grant strings,
  or whether API access (Health/Activity/Training) is gated at the **Developer Portal app level**
  only (one Evaluation/Production key, broad access, no per-user scope negotiation) — common for
  Garmin's API model. If it's app-level, no user re-consent is needed to start pushing workouts;
  if it's per-user OAuth scope, existing connected users will need to reconnect. Resolve this via
  Garmin's own developer docs and the existing `garmin-oauth-store.ts` implementation
  (`v0/lib/server/garmin-oauth-store.ts` — scopes are threaded through but possibly never actually
  requested/returned) before assuming either way.
- **No existing push code**: confirmed nothing in `v0/lib/integrations/garmin/` or
  `v0/lib/server/garmin-endpoints.ts` writes to Garmin today. This is genuinely new surface area.

## Step 1 — Brainstorm (required before any code)

Use `superpowers:brainstorming`. Resolve these with the founder before writing a spec:

1. **Scope: workouts only, or workouts + courses (GPX routes)?** Workouts-only is the smaller MVP
   and is sufficient to produce the transfer screenshot Garmin wants. Courses (GPX route transfer)
   is a separate Garmin API surface and roughly doubles the work. Recommend workouts-only for this
   round unless the founder has an independent reason to want courses now.
2. **Garmin Training API contract** — read Garmin's actual Training API documentation (Developer
   Portal) for the real endpoint URLs, required OAuth scope/token type, and the workout JSON schema
   (steps, targets, repeats, sport type enum). Do not guess this from general API-design intuition;
   Garmin's workout schema is proprietary and specific. If the founder doesn't have direct doc
   access in this session, flag it as a blocking question rather than inventing a plausible-looking
   schema.
3. **Per-app vs per-user scope** (see above) — confirms whether existing connected users need a
   reconnect/reconsent prompt before they can receive a pushed workout.
4. **UX entry point** — where does a user trigger "Send to Garmin"? Candidates: a button on a
   workout detail view in the iOS app (Plan tab → tapped workout), or fully automatic (push the next
   N days of plan workouts on every plan generation/regeneration). Recommend starting with an
   explicit manual button — safer, easier to demo for Garmin, avoids accidentally spamming a user's
   watch with unwanted workouts. This entry point is **iOS work** — flag clearly that Step 4 below
   will need a session in the iOS repo
  (`/Users/nadavyigal/Documents/Projects /IOS RunSmart light /IOS RunSmart app`), not just this web
  repo.
5. **Mapping fidelity** — given `workout_structure` is empty in practice, agree on the simplest
   honest mapping: a single Garmin workout step using `type` (run/easy/tempo/etc. → Garmin sport
   type), `distance` or `duration` as the step target, `pace` as a target pace range if Garmin's
   schema supports it. Do not fabricate interval structure that doesn't exist in the source data.

Write the resolved answers into a short addendum at the bottom of this file (or a new
`17-WORKOUT-PUSH-SPEC.md`) before proceeding to Step 2.

## Step 2 — Build sequence (each its own story, TDD, one PR per story)

1. **Garmin Training API client** — `v0/lib/integrations/garmin/pushWorkoutToGarmin.ts`. Wraps the
   real endpoint(s) confirmed in Step 1. Unit tests with a mocked HTTP layer — do not hit Garmin's
   real API in unit tests.
2. **RunSmart workout → Garmin workout mapper** — pure function, `workouts` row in → Garmin workout
   JSON out, per the mapping agreed in Step 1.5. Unit tests covering: a plain easy run, a workout
   with only `duration` (no `distance`), a workout with only `distance` (no `duration`), missing
   `pace`.
3. **"Send to Garmin" API route** — e.g. `v0/app/api/devices/garmin/workouts/push/route.ts` (follow
   existing route conventions in `v0/app/api/devices/garmin/`). Auth-gated to the requesting user's
   own `workouts` row. Returns a clear error if the connected account's scope/tier doesn't permit
   Training pushes (don't let this fail silently).
4. **iOS UX entry point** — separate session/PR in the iOS repo, per the Step 1.4 decision. A button
   on the relevant workout view calling the new API route.
5. **End-to-end verification** — push a real workout from the founder's own connected Garmin
   account, confirm it appears in the Garmin Connect app (the founder will need to check this on
   their phone/Garmin Connect, not something verifiable from code), and capture that as the Gate-4
   transfer screenshot.

## Out of scope for this plan

- Courses/GPX route transfer (unless Step 1.1 brainstorm decides otherwise).
- Populating `workout_structure` with rich interval data (separate, larger plan-generation change).
- The two already-tracked, unrelated Garmin findings: `garmin_connections.scopes` empty array
  (cosmetic Permissions UI bug) and `garmin_activities` rows tagged `wheelchair_push_walk`/`unknown`
  excluded from the running feed.

## Done when

Workout-push ships, a real transfer is screenshotted from the founder's own Garmin Connect app, and
that screenshot is added to the Gate-4 evidence package — at which point the Garmin reply (currently
held per the founder's sequencing rule) can be drafted and sent.
