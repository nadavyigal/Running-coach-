# AI Skill: Personalized Plan Generator

Drafts a 14–21 day training block tailored to onboarding inputs and recency signals, then persists it for rendering on the Today and Plan screens.

## What it delivers
- A sequenced workout calendar with difficulty progression (goal: rookie → intermediate → speed) and built-in rest days.
- Metadata for UI rendering (session title, focus, duration, target pace/HR zone, surface, notes).
- Flags that support downstream logic (e.g., `rookie_challenge`, `is_quality_session`, `indoor_ok`).

## Inputs & context
- **Profile & onboarding**: goal, experience, schedule, time windows, preferred units, injury flags (`v0/lib/db.ts`, `v0/lib/onboardingManager.ts`).
- **Templates**: base workouts and microcycles (`v0/lib/plan-templates.ts`, `v0/lib/planGenerator.ts`).
- **Constraints**: periodization rules and load caps (`v0/lib/periodization.ts`, `v0/lib/plan-complexity-engine.ts`).
- **Recent runs (optional)**: last 3–5 sessions for pacing anchors (`v0/lib/run-recording.ts`, `v0/lib/run-breakdowns.ts`).

## Output contract (suggested)
```ts
interface GeneratedPlan {
  userId: number;
  startDate: string; // ISO
  days: Array<{
    date: string;
    sessionType: 'easy' | 'tempo' | 'intervals' | 'long' | 'rest' | 'cross';
    durationMinutes?: number;
    targetPace?: string; // e.g., mm:ss/km
    targetHrZone?: string;
    notes?: string;
    tags?: string[]; // ['rookie_challenge', 'indoor_ok']
  }>;
  rationale: string; // 2–3 bullet explanation for UI
  version: string; // e.g., plan template hash
}
```

## Prompting scaffold (system + planner)
Use a two-part prompt: (1) system guardrails, (2) planner context. Keep tokens small; prefer JSON output.

```
You are Run-Smart's training planner. Deliver concise, actionable running plans.
- Respect rest-day spacing (no more than 3 consecutive stress days).
- Match the user's stated goal and experience; avoid over-prescription.
- Prefer paces tied to recent easy pace if available; otherwise give RPE guidance.

Context:
- Goal: {{goal}}
- Experience: {{experience}}
- Schedule: {{weekly_schedule}}
- Constraints: {{constraints}}
- Recent runs: {{recent_runs_summary}}
Produce a 14–21 day plan starting {{start_date}}. Output JSON matching GeneratedPlan with short notes.
```

## Execution flow
1. Fetch profile and schedule from Dexie via `v0/lib/db.ts`.
2. Select a base template from `v0/lib/plan-templates.ts` using `goal` and `experience`.
3. Apply load/periodization rules from `v0/lib/plan-complexity-engine.ts` and `v0/lib/periodization.ts` to scale volume.
4. Optionally anchor paces using recent runs aggregated with `v0/lib/run-breakdowns.ts`.
5. Build prompt payload and call OpenAI (reuse the pattern in `v0/app/api/generate-plan/route.ts`).
6. Validate output against the `GeneratedPlan` schema; fall back to deterministic generator in `v0/lib/planGenerator.ts` if the model response is invalid.
7. Persist plan and workouts via `v0/lib/db.ts`, then broadcast analytics with `v0/lib/analytics.ts`.

## Integration points
- **API**: `v0/app/api/generate-plan/route.ts` (extend to accept schedule, injury flags, or pace anchors).
- **UI**: Today/Plan screens read from Dexie; surface `rationale` as coach notes.
- **Feature flags**: Gate prompt variants through `v0/lib/abTestFramework.ts`.
- **Security**: Apply `v0/lib/security.middleware.ts` and `v0/lib/apiKeyManager.ts` for outbound requests.

## Evaluation & success metrics
- Plan acceptance rate after onboarding completion.
- Day-7 adherence (sessions marked complete ÷ scheduled sessions).
- Error rate of schema validation or deterministic fallback usage.
- p95 latency of plan generation API (goal: <1.5s).

## Observability
- Trace OpenAI calls with `v0/lib/backendMonitoring.ts` and `v0/lib/performance.monitoring.ts`.
- Log prompt hash + template version for rollback safety.
- Emit analytics events: `plan_generated`, `plan_generation_failed`, `plan_fallback_used`.

## Failure & mitigation
- **Invalid JSON** → Retry with constrained format instructions; otherwise fall back to deterministic generator.
- **Overload or quota** → Serve cached template from `v0/lib/planGenerator.ts` and notify UI.
- **Risky prescriptions (too much volume)** → Hard-cap weekly deltas via `plan-complexity-engine.ts` before saving.

## Extensions
- Calendar export (ICS) via a secondary route under `v0/app/api/plan/export`.
- Localization of notes with a lightweight translation pass.
- Adaptive warm-up/cool-down builder based on injury flags.
