# AI Skill: Run Insights & Recovery Coach

Turns raw run logs into concise insights, recovery guidance, and next-step nudges surfaced on the Today screen and in chat.

## What it delivers
- Post-run summary with effort assessment, pacing stability, and route notes.
- Recovery checklist (sleep, mobility, fueling) tailored to intensity and recent load.
- Next-session nudge that references the current plan (e.g., "Shift tomorrow to easy if legs feel heavy").

## Inputs & context
- **Run telemetry**: distance, duration, pace trace, HR zones, pauses (`v0/lib/run-recording.ts`, `v0/lib/heartRateZones.ts`).
- **Derived stats**: cadence/pace variability, positive split detection (`v0/lib/run-breakdowns.ts`, `v0/lib/goalProgressEngine.ts`).
- **Plan context**: upcoming 3 sessions and goals (`v0/lib/planGenerator.ts`, `v0/lib/planAdaptationEngine.ts`).
- **User signals**: RPE, soreness flags, surface type, weather tag (Dexie `Run` records).

## Output contract (suggested)
```ts
interface RunInsight {
  runId: number;
  summary: string[]; // 2–4 bullets, user-friendly
  effort: 'easy' | 'moderate' | 'hard';
  metrics: { paceStability: string; cadenceNote?: string; hrNote?: string };
  recovery: { priority: string[]; optional: string[] };
  nextSessionNudge?: string;
}
```

## Prompting scaffold
```
You are a concise running coach. Summaries must be supportive and specific.
Inputs:
- Run stats: {{run_stats}}
- Derived metrics: {{derived_metrics}}
- Upcoming sessions: {{upcoming_sessions}}
- User feedback: {{user_feedback}}
Goals: keep to <=120 words total; highlight one actionable recovery step.
Return JSON matching RunInsight.
```

## Execution flow
1. Ingest run data and compute derived metrics with `v0/lib/run-breakdowns.ts` and `v0/lib/heartRateZones.ts`.
2. Fetch next 3 scheduled workouts from Dexie and summarize targets.
3. Build prompt payload and call the chat adapter (`v0/lib/enhanced-ai-coach.ts` or `v0/app/api/chat/route.ts`).
4. Validate JSON; if invalid, fall back to template-driven text based on derived metrics.
5. Persist `RunInsight` alongside the run record (`v0/lib/db.ts`) for UI rendering and chat recall.

## Integration points
- **API**: hook into `v0/app/api/run` (or new `run/insight` route) triggered after a run is saved.
- **UI**: Today screen banner; modal on run detail page; optional push/email via `v0/lib/email.ts`.
- **Chat**: preload latest insight into chat history using `v0/lib/conversationStorage.ts`.
- **Security**: reuse `v0/lib/security.middleware.ts` and redact PII before logging.

## Evaluation & success metrics
- Insight open rate and scroll depth.
- % of users applying suggested recovery (self-reported toggle).
- Correlation between insights and reduced missed-session rates.
- Latency: target <800ms post-save.

## Observability
- Emit analytics events: `run_insight_created`, `run_insight_fallback`, `run_insight_viewed` (`v0/lib/analytics.ts`).
- Attach prompt hash + model version to traces via `v0/lib/backendMonitoring.ts`.
- Monitor error budgets with `v0/lib/performance.monitoring.ts`.

## Failure & mitigation
- **Missing HR data** → Default to pace/RPE-based effort detection and mark `hrNote` as unavailable.
- **Route data corrupted** → Skip route-specific guidance and log a soft error.
- **API timeout** → Retry once; otherwise write deterministic summary and notify monitoring.

## Extensions
- Weather-aware fueling suggestions once a weather provider is integrated.
- Shoe mileage checks (link to `Shoe` model) to recommend rotations.
- Community benchmarking: compare pace stability to personal 30-day median.
