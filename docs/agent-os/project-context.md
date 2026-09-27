# RunSmart — Project Context

> Living document. Update this file whenever an architecture decision is made, a scope change is approved, or an open question is resolved. Agents should read this file at the start of any session.
>
> Last checked against the code: 2026-09-27, at `origin/main` ccb1fc5 (P0 Story 4 of `docs/specs/2026-09-19-web-p0-hardening-plan.md`). Counts and versions below are from that commit; re-count before relying on them.

---

## Product Name
RunSmart

## Product Vision
An AI-powered running coach that builds sustainable running habits for recreational runners. RunSmart focuses on intrinsic motivation — personal milestones, adaptive plans, and habit science — rather than social competition or overwhelming data.

## Target Users

| Persona | Key Job to Be Done |
|---------|-------------------|
| **Morning-Routine Rookie** | "Help me start and stick to a simple morning run without overthinking." |
| **Self-Improver Striver** | "Guide me to beat my 10K PB while avoiding injury and boredom." |

Beta cohort: ~100 runners (70 EN / 30 HE) recruited via local running clubs and Instagram ads.

## Core User Problems
1. Novice runners abandon plans after 1–2 weeks due to unclear guidance and injury fear.
2. Existing apps overwhelm users with data or social pressure.
3. Habit formation requires consistent cues and quick feedback loops.

## Current MVP Scope

### In Scope
- **Size:** 117 API route files under `v0/app/api/` (112 once the P0 Story 1 deletions merge) and 266 component `.tsx` files under `v0/components/` (51 of them in `components/ui/`). The core app is a client-only SPA: `app/page.tsx` renders `app/page-client.tsx`, which mounts every screen (Onboarding, Today, Plan, Record, Run Report, Chat, Profile) with `dynamic(..., { ssr: false })`.
- **21-day challenges:** three optional templates in `lib/challengeTemplates.ts` (`start-running`, `morning-ritual`, `plateau-breaker`). The runner can pick one at onboarding; none is seeded automatically.
- **Dexie (IndexedDB) is the primary store:** 52 tables in `lib/db.ts`. Supabase provides auth and mirrors 6 tables (`profiles`, `runs`, `goals`, `shoes`, `plans`, `workouts`, via `lib/sync/`) for signed-in users only. Anonymous users' data lives only in the browser.
- **OpenAI GPT-4o** chat coach (`OPENAI_MODEL`, default `gpt-4o`) with last-3-runs context built in `components/chat-screen.tsx`
- **Garmin Connect:** paused. The app was deactivated; on 2026-09-27 `garmin_connections` had 8 rows, all `reauth_required`, 0 connected. New connections are gated off (`lib/server/garmin-connect-gate.ts`).
- **PostHog** analytics (custom events, `person_profiles: 'identified_only'`)
- **Data export/delete:** no GDPR delete or export endpoint exists. The only export route is `app/api/performance/export/route.ts`.
- **iOS:** `v0/capacitor.config.ts` (Capacitor 7) loads `https://www.runsmart-ai.com`, but its `ios.path` is `../apps/ios`, which does not exist (the repo has `apps/ios-native/` and `apps/ios-old-old/`). A separate native SwiftUI app (`IOS RunSmart app` repo) calls this app's API (`/api/generate-plan`, `/api/run-report`, `/api/coach/voice-cue`).
- **Payments:** none. No Paddle, Stripe or RevenueCat code. `lib/subscriptionGates.ts` gates 2 routes (`app/api/goals/recommendations`, `app/api/recovery/recommendations`); the tier comes from `user.subscriptionTier`, and the only code that writes it sets `'free'`.

### Out of Scope (Backlog)
- Stripe direct integration
- BLE sensor support
- Community/social feed
- Android app
- Apple Watch native app

## Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| Weekly Plan-Completion (W1→W4) | ≥ 55% |
| Day-30 Retention | ≥ 40% (**blocked:** not computable until P0 Story 3 ships, because `posthog.identify()` ran only at signup, so returning users had no person profile) |
| Avg. Daily Active Minutes | ≥ 12 min |
| Crash-free Sessions | ≥ 99.6% |

## Main Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.0 (App Router; `next build --webpack`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + Radix UI primitives |
| Client DB (primary) | Dexie.js 4 (IndexedDB), 52 tables |
| Auth + mirror | Supabase (Auth; PostgreSQL mirror of 6 tables for signed-in users) |
| AI / Chat | OpenAI GPT-4o via Vercel AI SDK (`ai` 5) |
| Analytics | PostHog (cloud) |
| Deployment | Vercel; merging `main` auto-deploys production (plan tier not checked from code) |
| iOS | Capacitor 7 config in `v0/`; separate native SwiftUI app in its own repo |
| Testing | Vitest (unit) + Playwright (e2e) |
| Package manager | npm (`v0/package-lock.json`, `npm ci` in CI). The root `pnpm-workspace.yaml` lists `packages/*` and `apps/*`, not `v0/` |

## Repository Layout

```
RunSmart/
├── v0/                     # Main Next.js app (all commands run from here)
│   ├── app/                # Next.js App Router — pages and API routes
│   ├── components/         # React components (screen + UI + modal)
│   ├── lib/                # DB schema, utilities, recovery engine
│   ├── hooks/              # Custom React hooks
│   └── __tests__/ e2e/     # Vitest unit tests + Playwright e2e
├── apps/ios-native/        # iOS shell project (do NOT edit when working on v0/)
├── apps/ios-old-old/       # Older iOS shell, kept for reference
├── docs/                   # Stories, plans, PRD, agent-os
│   ├── prd.md              # Product Requirements Document (source of truth)
│   ├── stories/            # Development stories (numbered by epic)
│   └── plans/              # Implementation plans
├── tasks/lessons.md        # Shared debugging memory — read before triage
├── CLAUDE.md               # Claude Code operating instructions
├── AGENTS.md               # Agent router for Claude Code, Codex and Cursor
└── .claude/agents/         # Claude Code subagent definitions
```

## Key Integrations

| Integration | Purpose | Notes |
|-------------|---------|-------|
| Supabase | Auth, mirror of 6 tables for signed-in users, RLS | `.env.local` must point to correct project URL |
| OpenAI GPT-4o | Chat coach + plan generation | Token budget ~$50/mo at <5k MAU. At this commit the OpenAI routes are callable anonymously, billed to our key. P0 Story 2 (PR #134, `lib/api-auth.ts`) gates them; `/api/onboarding/chat` stays anonymous by design |
| Garmin Connect API | Activity sync | **Paused.** 0 connected users (8 rows, all `reauth_required`, 2026-09-27). Cron jobs still scheduled in `vercel.json` |
| PostHog | Product analytics | Custom events; check `NEXT_PUBLIC_POSTHOG_KEY`. Loaded lazily in `lib/posthog-provider.tsx` |
| Vercel | Hosting + cron jobs | 3 daily crons in `v0/vercel.json` (Garmin nightly, Garmin jobs, email sequences) |
| Capacitor 7 | iOS web wrapper config | `server.url` is production; `ios.path` points at a missing `apps/ios` |
| Apple HealthKit | Health data (planned) | Read scope TBD |

## Known Risks

1. **Solo founder velocity** — every decision trades off scope vs. speed
2. **Capacitor performance ceiling** — hybrid app may feel less native than SwiftUI; acceptable for MVP
3. **Garmin** — paused with 0 connected users; restoring it needs a production credential set (see `tasks/progress.md`)
4. **LLM cost scaling** — the rate limiter in `lib/security.config.ts` is an in-memory `Map`, per Vercel instance, so it is not a real control. Session auth on the OpenAI routes is the control; a durable limiter is a P2
5. **Supabase env mismatch** — wrong project URL in `.env.local` is the #1 cause of 406 errors (see `tasks/lessons.md`)

## Open Questions

- [OPEN QUESTION] Payments: no provider is integrated. Which one, and what tiers?
- [OPEN QUESTION] HealthKit read scope for iOS — which data types to request
- [OPEN QUESTION] Android roadmap — timeline and approach
- [OPEN QUESTION] Community/social features — whether and when to build
- [OPEN QUESTION] iOS strategy: ADR-001 chose Capacitor, but a separate native SwiftUI app now exists and calls this API. Does ADR-001 still stand?
- [OPEN QUESTION] Anonymous users: after P0 Story 2 they lose AI features except onboarding chat. Is that the intended product, or should plan generation get an account prompt / signed device token?

---

## Architecture Decision Records

### ADR-001: iOS strategy — Capacitor hybrid, not native rewrite

**Decision:** Wrap the existing Next.js PWA as a native iOS app using Capacitor v6, rather than rewriting in SwiftUI or React Native.

**Context:** The PWA had reached feature parity (~150 components, Supabase auth, Garmin sync, AI coaching, GPS tracking) when the iOS decision was made. A solo founder needed App Store presence without a 3–6 month rewrite.

**Options considered:**

| Option | Verdict |
|--------|---------|
| Capacitor v6 (chosen) | Reuses 95%+ of existing code; native bridge for iOS APIs; App Store compliant |
| React Native rewrite | Full rewrite of ~150 components; 3–6 months; dual codebase forever |
| Swift/SwiftUI native | Best performance; complete rewrite; not viable solo |
| PWA only | No App Store; limited push notifications; iOS Safari limitations |

**Chosen option:** Capacitor v6

**Consequences:**
- The Capacitor shell must never hold business logic. As built (2026-09-27): the dependency is Capacitor 7, `capacitor.config.ts` still points `ios.path` at `apps/ios/`, which no longer exists, and the shell projects are `apps/ios-native/` and `apps/ios-old-old/`
- After any `v0/` build, run `npx cap sync ios` before iOS testing
- Native capabilities (HealthKit, APNs) added via Capacitor plugins, not custom Swift
- Performance ceiling exists — acceptable for MVP, revisit if user feedback demands it

---

### ADR-002: Data layer split — Dexie for local, Supabase for server

**Decision:** Use Dexie (IndexedDB) as the local read layer and Supabase as the authoritative server-side store. Garmin sync reconciles Dexie against Supabase on each sync.

**As built (2026-09-27):** Dexie is the primary store (52 tables). Supabase mirrors only 6 of them (`profiles`, `runs`, `goals`, `shoes`, `plans`, `workouts`) and only for signed-in users. For anonymous users Supabase holds nothing, so Supabase is not authoritative for most data.

**Context:** The app was originally local-only (Dexie). Supabase was added for cross-device sync, auth, and Garmin webhooks. The two layers now coexist.

**Rules derived from this decision:**

| Data type | Owner | Reason |
|-----------|-------|--------|
| Active UI state | React state | Ephemeral |
| User prefs, plans, runs, HRV, sleep | Dexie | Local-first, offline |
| Auth, cross-device sync | Supabase | Requires server durability |
| Garmin sync state | Dexie cache + Supabase source of truth | Reconciled on sync |
| Analytics | PostHog SDK | Fire-and-forget |

**Key invariant:** Any sync function that mirrors Supabase data into Dexie must include a deletion reconciliation step (not insert-only). See `tasks/lessons.md` — "Garmin sync: Dexie cache not reconciled" for the bug this prevents.

**Consequences:**
- Never add a new state management library (Redux, Zustand) — React state + Dexie is the pattern
- When adding a new entity, decide upfront: Dexie-only, Supabase-only, or both with a sync function
- Dexie schema changes require a version bump in `v0/lib/db.ts`

---

### ADR-003: No global state management library

**Decision:** React state (`useState`, `useReducer`, context) for UI state. Dexie for persistent client state. No Redux, Zustand, Jotai, or equivalent.

**Context:** The app started simple. Adding a state library would add complexity and a new pattern for a solo founder to maintain. The current pattern scales sufficiently for the MVP scope.

**Consequences:**
- Screen-level state lives in the screen component or a custom hook
- Shared state is lifted to the nearest common ancestor or stored in Dexie
- Do not introduce a state library without an explicit architectural discussion and approval
