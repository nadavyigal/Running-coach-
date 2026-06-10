# RunSmart Aha Moments Phase 1 — Implementation Prompt

Paste this into a fresh agent session opened in:

`/Users/nadavyigal/Documents/RunSmart`

## Goal

Implement Phase 1 of the RunSmart Aha Moment system in the RunSmart web app: Moment #1 "This knows me" and Moment #3 "I can see where I'm going".

## Source Of Truth

Read these before planning or editing:

1. `/Users/nadavyigal/Documents/Projects /Agentic OS/AGENTS.md`
2. `/Users/nadavyigal/Documents/RunSmart/AGENTS.md`
3. `/Users/nadavyigal/Documents/RunSmart/tasks/MEMORY.md`
4. `/Users/nadavyigal/Documents/RunSmart/tasks/ERRORS.md`
5. `/Users/nadavyigal/Documents/RunSmart/tasks/lessons.md`
6. `/Users/nadavyigal/Documents/RunSmart/AHA_MOMENTS.md`

The implementation spec is in `AHA_MOMENTS.md`. Follow the "Moment #1", "Moment #3", "Shared Infrastructure", "PostHog Event Schema", "Database Schema", and "Rollout Order" sections.

## Task

Implement Phase 1 only:

- Moment #1: "This knows me"
- Moment #3: "I can see where I'm going"
- Shared infrastructure needed by those two moments
- Analytics/events needed to measure the Phase 1 quantitative gate
- Persistence needed to prevent duplicate firing

Work in the RunSmart web app under:

`/Users/nadavyigal/Documents/RunSmart/v0`

## Do Not Implement Yet

Do not implement these in this packet:

- Moment #2 achievement / first-run overlay
- Moment #4 noticed/context card
- Weather API integration
- Any paid service setup
- Any deploy, production migration, or external publishing action
- New dependencies unless Nadav explicitly approves them in the current session

## Product Requirements

Moment #1 fires after onboarding completion, before the user enters the home tab.

Moment #1 should:

- Classify a runner identity from onboarding answers using a deterministic pure function
- Render a concise identity moment using existing UI patterns
- Store the selected identity on the user profile when the existing data model supports it
- Log `aha_moment_fired`, `aha_moment_cta_clicked`, and `aha_moment_dismissed`
- Persist that the moment fired so it does not show repeatedly

Moment #3 fires after Moment #1, on a separate onboarding scene before entering the app.

Moment #3 should:

- Project a goal timeline from onboarding pace, fitness level, and target goal
- Use a deterministic lookup or local typed rules, not an LLM call
- Render a simple timeline: today, midpoint milestone, goal
- Store `goal_timeline_weeks` and projected goal date when the existing data model supports it
- Log `aha_moment_fired`, `aha_moment_cta_clicked`, and `plan_viewed_from_moment`
- Persist that the moment fired so it does not show repeatedly

## Engineering Requirements

- Use existing app patterns in `v0/` for onboarding, analytics, Supabase access, UI components, and feature flags.
- Keep edits scoped. If implementation expands beyond 3 unexpected files outside the onboarding/shared-infrastructure surface, stop and report the scope expansion.
- Prefer pure functions for identity and timeline logic so they can be unit tested.
- Do not hardcode secrets, API keys, production URLs, or environment-specific values.
- Do not modify unrelated dirty files.
- If the repo already has PostHog helpers, use them. If not, add a small local abstraction following existing analytics patterns.
- If the database migration path is clear, create a migration for `user_aha_moments` and profile fields. If migration execution would touch production, do not run it. Only create the file and explain how to apply it later.

## Suggested Implementation Shape

Use judgment from the codebase, but start by looking for:

- Onboarding flow components/routes
- Existing analytics/PostHog utilities
- Existing Supabase client/server utilities
- Existing profile persistence/update code
- Existing modal/overlay/card primitives
- Existing tests around onboarding

Expected building blocks may include:

- `AhaMomentOverlay`
- `RunnerIdentityMoment`
- `GoalTimelineMoment`
- `UserInsightService` or equivalent pure utility
- `AhaMomentEngine` or lightweight state helper
- Unit tests for runner identity and goal timeline projection
- Focused onboarding integration test if the current test setup supports it

## Quantitative Gate For Phase 2

Instrument Phase 1 so the team can measure:

- At least 50 onboarding completions
- Moment #1 CTA rate greater than 40%
- Moment #3 plan-open rate greater than 45%

Do not proceed to Moment #2 until those metrics are measurable and the gate is met.

## Validation

Before declaring done:

1. Run targeted tests for new pure logic and affected onboarding behavior.
2. Run from `v0/`:
   - `npm run lint`
   - `npm run type-check`
   - `npm run build`
3. If full build/type-check is blocked by pre-existing unrelated errors, capture the exact failure, run the narrowest relevant tests/checks that can pass, and clearly label the blocker as pre-existing or newly introduced.
4. Run `git diff --check`.
5. Report:
   - Files changed
   - Tests/checks run with results
   - Checks not run and why
   - Open questions
   - What was not done

## Final Response Required

The final response must include:

- Whether Phase 1 is implemented
- Where it was implemented
- How duplicate firing is prevented
- Which analytics events are emitted
- Whether a migration was created or only documented
- Validation evidence
- Confirmation that #2, #4, and weather API were not implemented
