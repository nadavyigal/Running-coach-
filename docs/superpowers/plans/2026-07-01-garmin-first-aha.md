# Garmin First Aha First Build Plan

Date: 2026-07-01
Repo: RunSmart web
Mode: Builder
Status: Planned, not implemented

## Objective

Build the first Garmin-connected aha moment for RunSmart: after a user connects Garmin, RunSmart should generate a clear personal running profile, a safe 14-day adaptive starter block, and one recommended beginner-friendly challenge.

## Recommendation

The first build should be Garmin First Aha, but it should not be a standalone insight card. It should be a complete activation moment:

1. "Here is what your Garmin history says about you."
2. "Here is the safest next 14 days."
3. "Here is the challenge that best fits your current pattern."

This validates the research recommendation. Runcaster shows that a Garmin-trained AI coach becomes compelling when it immediately turns history into a near-term plan. Hashiri.AI shows the value of deep activity understanding, but RunSmart should avoid overwhelming everyday runners with dense analysis. Never Done shows that challenges can improve motivation, but the challenge should be personalized by Garmin history rather than generic.

## Success Criteria

- A first-time Garmin-connected user lands on a dedicated post-connection experience instead of being dropped into a generic profile screen.
- The page can generate a personal running profile from recent Garmin data.
- The page recommends a safe 14-day starter block using recent consistency, load, intensity, and recovery signals when available.
- The page recommends exactly one challenge, with a short explanation.
- The user can accept the plan, start the challenge, or skip without being trapped.
- The output is transparent about missing Garmin data and does not overstate wellness signals.
- The implementation reuses existing Garmin, plan, readiness, ACWR, challenge, and AI insight services where possible.

## Non-Goals

- Do not build Garmin workout push in this first version.
- Do not build a coach dashboard.
- Do not build a full 12-week adaptive coach flow.
- Do not require sleep, HRV, Body Battery, or stress data for the experience to work.
- Do not silently replace an existing active plan.
- Do not make medical, diagnostic, or injury-prevention claims.

## Target User

Everyday Garmin runner who has just connected Garmin and wants to know:

- What kind of runner am I right now?
- Am I training safely?
- What should I do next?
- How do I get moving without overthinking?

## First Five-Minute UX

### Entry Point

Current likely entry point:

- `v0/app/garmin/callback/page.tsx`

Today the callback completes Garmin auth, stores the local device, tracks `garmin_callback_completed`, and redirects to `/?screen=profile`.

First build change:

- First successful Garmin connection should redirect to a new Garmin First Aha route or screen.
- Returning reconnects can continue to profile unless the user explicitly opens the aha experience.

Recommended route:

- `v0/app/garmin/first-aha/page.tsx`

### Screen Structure

The screen should feel like a coach reviewing the user's actual data, not a dashboard.

1. Loading state
   - "Reading your recent Garmin runs"
   - Show steps for activities, consistency, recovery, and plan draft.

2. Running profile
   - Runner type: examples include "building consistency", "returning runner", "base-building runner", "fitness runner", "race-focused runner".
   - Recent consistency: runs per week and recent gap pattern.
   - Intensity pattern: easy/moderate/hard distribution when HR or pace data exists.
   - Load pattern: recent volume, longest run, and ACWR status when available.
   - Recovery context: sleep, HRV, resting HR, stress, Body Battery only if available.

3. Safety read
   - One plain-language sentence about the main guardrail.
   - Examples:
     - "Your recent volume looks stable, so the next two weeks can build gently."
     - "Your last week jumped quickly, so the plan starts with a lighter reset."
     - "You have enough run history for a plan, but not enough wellness data for recovery-based adjustments yet."

4. 14-day starter block
   - 3 to 5 planned sessions per week depending on current pattern.
   - Each session has day, type, duration or distance, intensity, and purpose.
   - Include at least one rest or recovery day.
   - Prefer easy-run discipline over aggressive progression.

5. Recommended challenge
   - One challenge recommendation, not a grid.
   - Options should map to existing or near-term challenge templates:
     - Start running / consistency
     - Easy-run discipline
     - Return to running
     - First consistent month
     - Build base safely

6. Actions
   - Accept plan
   - Start challenge
   - Adjust goal
   - Skip for now

## Product Output Contract

Create a server-side result shape that the UI can render without reinterpreting raw Garmin data.

```ts
type GarminFirstAhaResult = {
  status: "ready" | "partial" | "insufficient_data" | "error"
  generatedAt: string
  dataWindow: {
    activitiesDays: number
    wellnessDays?: number
  }
  profile: {
    runnerType: string
    headline: string
    summaryBullets: string[]
    confidence: "high" | "medium" | "low"
  }
  signals: {
    consistency: {
      runsLast14Days: number
      runsLast28Days: number
      weeklyPatternLabel: string
    }
    load: {
      weeklyDistanceTrend?: string
      acwrLabel?: "low" | "stable" | "elevated" | "unknown"
      longestRunLabel?: string
    }
    intensity: {
      label: string
      easyShare?: number
      hardShare?: number
      source: "heart_rate" | "pace" | "mixed" | "insufficient"
    }
    recovery?: {
      readinessLabel: string
      availableSignals: string[]
      missingSignals: string[]
    }
  }
  guardrails: {
    level: "green" | "yellow" | "red"
    message: string
    reasons: string[]
  }
  starterPlan: {
    title: string
    rationale: string
    days: Array<{
      date: string
      type: "easy_run" | "long_run" | "recovery" | "rest" | "strength" | "walk_run"
      label: string
      target?: string
      intensity: "easy" | "moderate" | "hard" | "rest"
      purpose: string
    }>
  }
  recommendedChallenge: {
    id: string
    title: string
    reason: string
    fitScoreLabel: string
  }
  disclaimers: string[]
}
```

## Existing Repo Surfaces To Reuse

### Garmin Data

- `v0/lib/garmin/datasets.ts`
  - Garmin dataset catalog already includes activities, activity details, sleep, stress, HRV, user metrics, and other wellness keys.

- `v0/lib/integrations/garmin/importGarminActivity.ts`
  - Imports Garmin activities into canonical `runs`.

- `v0/lib/integrations/garmin/mapGarminActivityToRun.ts`
  - Identifies run-like Garmin activities and maps them into RunSmart run rows.

- `v0/app/api/devices/garmin/backfill/route.ts`
  - Existing path for 90-day activity and daily backfill.

### Readiness And Load

- `v0/lib/garminReadinessComputer.ts`
  - Computes readiness from HRV, sleep, resting HR, stress, and optional wellness signals.

- `v0/lib/garminAcwr.ts`
  - Computes ACWR, monotony, strain, weekly volume, and elevated load flags.

### AI Insights

- `v0/lib/server/garmin-insights-service.ts`
  - Existing AI insight service supports daily, weekly, and post-run insights.

- `v0/lib/garminInsightBuilder.ts`
  - Existing prompt and summary builder for Garmin daily, weekly, and post-run context.

- `v0/app/api/ai/garmin-insights/route.ts`
  - Existing API route for streaming and fetching Garmin insights.

### Plan Generation

- `v0/lib/planGenerator.ts`
  - Existing plan generator supports configurable `totalWeeks`; fallback already has 2-week behavior for `rookie_challenge`.

- `v0/app/api/generate-plan/route.ts`
  - Existing plan generation route accepts preferences, training history, and goals.

- `v0/lib/planAdaptationEngine.ts`
  - Existing assessment logic for recent runs, goals, performance, and recovery.

### Challenges

- `v0/lib/challengeTemplates.ts`
  - Existing challenge templates include start-running style templates.

- `v0/lib/challengeEngine.ts`
  - Existing client-side challenge start and active challenge logic.

- `v0/app/api/challenges/route.ts`
  - Existing server challenge list and join route.

## Proposed Build Stories

### Story 1: First Aha Server Endpoint

Add a server endpoint that returns the normalized Garmin First Aha result.

Suggested file:

- `v0/app/api/garmin/first-aha/route.ts`

Responsibilities:

- Authenticate current user.
- Load recent Garmin activities and canonical runs.
- Load wellness/readiness data if available.
- Compute consistency, load, intensity, and readiness labels.
- Generate a 14-day starter block.
- Select one recommended challenge.
- Return a structured result with partial-data handling.

Implementation preference:

- Start deterministic first.
- Use AI only for final wording once the data contract is stable.
- Keep plan safety logic rule-based so guardrails are testable.

### Story 2: First Aha Domain Service

Create a small service so the API route stays thin.

Suggested file:

- `v0/lib/server/garmin-first-aha-service.ts`

Responsibilities:

- Fetch and normalize inputs.
- Call or reuse readiness and ACWR helpers.
- Build the `GarminFirstAhaResult`.
- Own partial-data behavior.

Suggested helper modules if needed:

- `v0/lib/garminFirstAhaTypes.ts`
- `v0/lib/garminFirstAhaPlan.ts`
- `v0/lib/garminFirstAhaChallenge.ts`

Keep the first implementation compact. Split helpers only when the service becomes hard to read.

### Story 3: Post-Callback Redirect

Update Garmin callback routing so first successful connection lands on the aha page.

Suggested file:

- `v0/app/garmin/callback/page.tsx`

Behavior:

- If Garmin connection just completed and the user has not seen Garmin First Aha, redirect to `/garmin/first-aha`.
- If they have already seen it, keep the existing profile redirect.

Open question for implementation:

- Whether "seen" should initially be local storage only, or persisted to the user profile/preferences table. For v1, local storage is acceptable if no obvious server preference storage already exists.

### Story 4: First Aha UI

Add a dedicated page that renders the result and lets the user act.

Suggested files:

- `v0/app/garmin/first-aha/page.tsx`
- `v0/components/garmin-first-aha-screen.tsx`

UI states:

- Loading
- Ready
- Partial data
- Insufficient data
- Error with retry

Primary actions:

- Accept 14-day plan
- Start recommended challenge
- Adjust goal
- Skip for now

Important UX rule:

- Do not show a dense dashboard. Show a short coach-style review that explains the next step.

### Story 5: Accept Plan And Start Challenge

Wire actions to existing plan and challenge infrastructure.

Plan options:

- Preferred: convert the `starterPlan.days` into the existing plan shape and save through the same path used by onboarding or plan generation.
- Fallback: call `v0/app/api/generate-plan/route.ts` with a 2-week goal preference and include the First Aha summary as context, if the route already supports this cleanly.

Challenge options:

- Use `v0/app/api/challenges/route.ts` for server challenge join if authenticated.
- Use `v0/lib/challengeEngine.ts` only where the existing app flow expects client-side challenge state.

Do not silently overwrite:

- If an active plan exists, show "Review and replace" instead of immediate accept.
- If an active challenge exists, show "Keep current challenge" and "Switch challenge".

## Aha Logic

### Runner Type Rules

Use simple transparent labels:

- `new_or_low_data_runner`
  - Fewer than 3 runs in 28 days.
- `building_consistency`
  - 3 to 7 runs in 28 days, irregular spacing.
- `consistent_base_builder`
  - 8+ runs in 28 days, mostly easy or moderate.
- `overreaching_risk`
  - Recent volume spike, too many hard runs, or poor recovery signal.
- `race_focused`
  - Recent structured workouts, long runs, or high weekly frequency.

Render user-facing labels, not internal ids.

### Guardrail Rules

Start with conservative heuristics:

- Yellow if weekly volume increased more than roughly 25-35 percent.
- Yellow if hard-run share is high and recovery signals are weak or missing.
- Yellow if recent longest run is far above normal weekly pattern.
- Red only for obvious "do less now" cases, such as severe load spike plus poor recovery signals.
- Green when volume is stable, consistency is adequate, and recovery is not concerning.

Use existing `garminAcwr` output where available instead of inventing a second load model.

### 14-Day Plan Rules

Plan should be based on recent behavior:

- If 0 to 1 runs per week recently: 2 to 3 walk/run or easy sessions per week.
- If 2 to 3 runs per week: maintain frequency, improve spacing, mostly easy.
- If 4+ runs per week: keep frequency stable, reduce intensity if guardrails are yellow.
- If load risk is elevated: reduce volume and add recovery.
- If wellness data is missing: do not punish the user, mark recovery confidence as lower.

Default progression:

- Week 1 stabilizes.
- Week 2 builds gently only if guardrails are green.

### Challenge Selection Rules

Recommended challenge should reinforce the safest next behavior:

- Low frequency: `start-running` or "Run 3x/week".
- Irregular spacing: "First consistent month".
- Too much intensity: "Easy-run discipline".
- Return after gap: "Return to running".
- Stable base: "Build base safely".

If the exact challenge template does not exist yet, the first implementation can map to the closest existing template and label future templates as backlog.

## Analytics

Track the activation funnel:

- `garmin_first_aha_viewed`
- `garmin_first_aha_generated`
- `garmin_first_aha_partial_data`
- `garmin_first_aha_plan_accepted`
- `garmin_first_aha_challenge_started`
- `garmin_first_aha_skipped`
- `garmin_first_aha_error`

Useful properties:

- `activity_count_28d`
- `has_wellness_data`
- `guardrail_level`
- `runner_type`
- `recommended_challenge_id`
- `plan_days_count`

Primary metric:

- Percent of newly connected Garmin users who accept a plan or start a challenge within the first session.

Secondary metrics:

- First post-connection run logged or synced within 7 days.
- Return visit within 7 days.
- Challenge completion.
- Plan adherence in first 14 days.

## Validation Plan

### Unit Tests

Add tests for deterministic service logic:

- Insufficient data returns a useful partial result.
- Low-frequency runner receives a conservative plan.
- Elevated load produces yellow or red guardrails.
- Missing wellness data lowers confidence without blocking the flow.
- Challenge recommendation maps to the correct pattern.

Likely test targets:

- `garmin-first-aha-service`
- `garminFirstAhaPlan`
- `garminFirstAhaChallenge`

### API Tests

Verify:

- Unauthenticated users are rejected.
- Authenticated users receive a stable response shape.
- Empty Garmin history returns `insufficient_data`, not a 500.
- Partial wellness data does not fail the endpoint.

### Manual QA

Use seeded or mocked states:

- No Garmin runs.
- 2 recent easy runs.
- 8 consistent runs.
- Big recent volume spike.
- Runs available, wellness unavailable.
- Runs and readiness data available.
- Existing active plan.
- Existing active challenge.

### UX QA

Check desktop and mobile:

- Loading state does not jump.
- Summary text fits on mobile.
- Actions are visible without scrolling through a long dashboard.
- Partial-data state still gives a next step.

## Risks And Mitigations

### Risk: Garmin Backfill Is Not Finished When The Page Loads

Mitigation:

- Page should poll or retry while backfill is pending if an existing sync status exists.
- If no status exists, show a partial result and a "Refresh after sync" action.

### Risk: AI Makes The Output Feel Generic

Mitigation:

- Compute facts deterministically.
- Let AI only phrase the profile and rationale.
- Include specific numbers from the user's history in the prompt.

### Risk: Plan Acceptance Conflicts With Existing Plans

Mitigation:

- Detect active plan before accepting.
- Require explicit review before replacement.

### Risk: Wellness Signals Are Not Available For Many Users

Mitigation:

- Make the experience valuable with activities alone.
- Treat recovery as an optional confidence layer.

### Risk: Too Much Product In One Screen

Mitigation:

- Show only one profile, one guardrail, one plan, and one challenge.
- Move advanced analysis into later post-run or deep analysis tools.

## Roadmap Split

### Immediate v1

- First Aha endpoint.
- First Aha page.
- Deterministic profile, guardrails, 14-day starter block, and challenge recommendation.
- Post-Garmin callback redirect.
- Accept plan and start challenge actions if existing APIs make this straightforward.

### v1.1

- Persist "Garmin First Aha seen".
- Improve plan acceptance flow for users with active plans.
- Add better sync-pending state.
- Add post-run check-in entry point from the First Aha page.

### v1.5

- Add richer challenge templates:
  - Easy-run discipline
  - Return to running
  - First consistent month
  - Build base safely
- Add adaptive plan revision after each synced Garmin run.
- Add readiness-based daily plan adjustment.

### Later

- Garmin workout push.
- Deep freemium analysis tools.
- Coach or accountability partner dashboard.
- Broader health intelligence.

## Recommended Implementation Order

1. Build `garmin-first-aha-service` with deterministic fixtures and tests.
2. Add `GET /api/garmin/first-aha`.
3. Add `/garmin/first-aha` page with loading, ready, partial, and insufficient states.
4. Wire Garmin callback redirect for first successful connection.
5. Wire accept plan and start challenge actions.

## Definition Of Done

- New Garmin-connected users see Garmin First Aha after successful connection.
- The page returns a useful result with activities only.
- The page gets better when wellness/readiness data exists.
- The 14-day plan is conservative, readable, and explicitly tied to recent Garmin history.
- One challenge is recommended with a clear reason.
- Users can accept, start, adjust, or skip.
- Unit tests cover the profile, guardrail, plan, and challenge selection rules.
- Existing Garmin callback and profile flows still work.
- No unrelated Garmin application assets are modified.

## Suggested Next Codex Implementation Prompt

```text
Implement the Garmin First Aha v1 from docs/superpowers/plans/2026-07-01-garmin-first-aha.md.

Scope:
- Add a deterministic Garmin First Aha server service.
- Add GET /api/garmin/first-aha.
- Add /garmin/first-aha page and component.
- Redirect first successful Garmin callback to /garmin/first-aha.
- Reuse existing Garmin activity, readiness, ACWR, plan, and challenge code where possible.

Constraints:
- Do not build Garmin workout push.
- Do not silently replace active plans.
- Do not require wellness data.
- Keep AI optional or limited to wording; deterministic safety logic must be testable.
- Do not touch unrelated Garmin application docs/assets.

Validation:
- Add targeted tests for First Aha service logic.
- Run the relevant test command for touched files.
- Run lint/typecheck if documented for this repo.
- Manually verify the first-connect route behavior.
```
