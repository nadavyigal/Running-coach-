# RunSmart — Project Context

> Living document. Update this file whenever an architecture decision is made, a scope change is approved, or an open question is resolved. Agents should read this file at the start of any session.

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
- **5 Screens:** Today Dashboard, Plan Overview, Record Run, AI Coach Chat, Onboarding Wizard
- **21-Day Rookie Challenge** seeded at onboarding
- **Supabase** for auth and server-side data persistence
- **OpenAI GPT-4o** chat coach with last-3-runs context
- **Garmin Connect API** bi-directional sync (webhooks + polling)
- **PostHog** analytics (autocapture + custom events)
- **GDPR compliance** — delete/export endpoints
- **iOS app** via Capacitor v6 wrapping the Next.js PWA (in progress — current branch: `ios`)
- **Subscription gating** via Paddle (paywall UI exists, not yet enforced)

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
| Day-30 Retention | ≥ 40% |
| Avg. Daily Active Minutes | ≥ 12 min |
| Crash-free Sessions | ≥ 99.6% |

## Main Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + Radix UI primitives |
| Client DB | Dexie.js (IndexedDB) |
| Server DB + Auth | Supabase (PostgreSQL + Auth) |
| AI / Chat | OpenAI GPT-4o via Vercel AI SDK |
| Analytics | PostHog (cloud) |
| Deployment | Vercel (hobby plan) |
| iOS Wrapper | Capacitor v6 |
| Testing | Vitest (unit) + Playwright (e2e) |
| Monorepo | pnpm workspaces |

## Repository Layout

```
RunSmart/
├── v0/                     # Main Next.js app (all commands run from here)
│   ├── app/                # Next.js App Router — pages and API routes
│   ├── components/         # React components (screen + UI + modal)
│   ├── lib/                # DB schema, utilities, recovery engine
│   ├── hooks/              # Custom React hooks
│   └── __tests__/ e2e/     # Vitest unit tests + Playwright e2e
├── apps/ios/               # Capacitor iOS shell (do NOT edit when working on v0/)
├── docs/                   # Stories, plans, PRD, agent-os
│   ├── prd.md              # Product Requirements Document (source of truth)
│   ├── stories/            # Development stories (numbered by epic)
│   └── plans/              # Implementation plans
├── tasks/lessons.md        # Shared debugging memory — read before triage
├── CLAUDE.md               # Claude Code operating instructions
├── AGENTS.md               # Codex operating instructions
└── .claude/agents/         # Claude Code subagent definitions
```

## Key Integrations

| Integration | Purpose | Notes |
|-------------|---------|-------|
| Supabase | Auth, server-side DB, RLS | `.env.local` must point to correct project URL |
| OpenAI GPT-4o | Chat coach + plan generation | Token budget ~$50/mo at <5k MAU |
| Garmin Connect API | Bi-directional activity sync | Webhooks + daily polling cron; Dexie cache reconciled against Supabase |
| PostHog | Product analytics | Autocapture + custom events; check `NEXT_PUBLIC_POSTHOG_KEY` |
| Vercel | Hosting + cron jobs | Hobby plan — cron limited to daily |
| Capacitor v6 | iOS native wrapper | HealthKit, APNs, App Store distribution |
| Apple HealthKit | Health data (planned) | Read scope TBD |

## Known Risks

1. **Solo founder velocity** — every decision trades off scope vs. speed
2. **Capacitor performance ceiling** — hybrid app may feel less native than SwiftUI; acceptable for MVP
3. **Garmin webhook reliability** — webhooks can miss; reconciliation cron is the safety net
4. **LLM cost scaling** — GPT-4o at $50/mo budget requires rate limiting; structured generation keeps tokens predictable
5. **Supabase env mismatch** — wrong project URL in `.env.local` is the #1 cause of 406 errors (see `tasks/lessons.md`)

## Open Questions

- [OPEN QUESTION] Final subscription pricing tiers (Paddle)
- [OPEN QUESTION] HealthKit read scope for iOS — which data types to request
- [OPEN QUESTION] Android roadmap — timeline and approach
- [OPEN QUESTION] Community/social features — whether and when to build
- [OPEN QUESTION] Whether to enforce Paddle paywall for beta cohort

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
- `apps/ios/` is the Capacitor shell — never add business logic there
- After any `v0/` build, run `npx cap sync ios` before iOS testing
- Native capabilities (HealthKit, APNs) added via Capacitor plugins, not custom Swift
- Performance ceiling exists — acceptable for MVP, revisit if user feedback demands it

---

### ADR-002: Data layer split — Dexie for local, Supabase for server

**Decision:** Use Dexie (IndexedDB) as the local read layer and Supabase as the authoritative server-side store. Garmin sync reconciles Dexie against Supabase on each sync.

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
