# AI Skill: Adaptive Plan Adjuster

Recalculates upcoming workouts nightly (or after a run) to maintain safe progression, integrate feedback, and improve plan relevance.

## What it delivers
- Updated next 7–10 days of workouts with adjusted intensity/volume.
- Recovery recommendations and rest-day swaps when fatigue or injury risk is detected.
- Change log explaining what shifted and why for UI transparency.

## Inputs & context
- **Current plan state**: future workouts and metadata (`v0/lib/planGenerator.ts`, `v0/lib/planAdjustmentService.ts`).
- **Completed runs & feedback**: distance, pace, HR zones, RPE, adherence flags (`v0/lib/db.ts`, `v0/lib/run-recording.ts`, `v0/lib/goalProgressEngine.ts`).
- **Adaptation rules**: load ceilings, monotony safeguards, and confidence checks (`v0/lib/planAdaptationEngine.ts`, `v0/lib/plan-regeneration.ts`).
- **User constraints**: schedule preferences, upcoming events, injury notes (Dexie `User` table).

## Output contract (suggested)
```ts
interface PlanAdjustments {
  userId: number;
  appliedAt: string; // ISO timestamp
  updates: Array<{
    date: string;
    change: 'intensity' | 'volume' | 'swap' | 'rest-day' | 'cross-train';
    previousSession: string;
    newSession: string;
    rationale: string;
  }>;
  recovery: {
    sleepTip?: string;
    mobility?: string;
    fueling?: string;
  };
  confidence: 'low' | 'medium' | 'high';
}
```

## Prompting scaffold
Use a deterministic adapter to precompute safe bounds, then ask the model to propose adjustments within those bounds.

```
You are an adaptive running coach. Adjust only future sessions; never rewrite completed history.
Constraints (precomputed): {{constraints}}
Recent runs (last 7 days): {{recent_runs}}
Upcoming plan window: {{plan_window}}
Respect user blackout days: {{blackout_days}}
Return JSON matching PlanAdjustments with a short rationale per change.
```

## Execution flow
1. Gather future workouts and recent runs from Dexie via `v0/lib/db.ts`.
2. Compute fatigue and load ceilings using `v0/lib/planAdaptationEngine.ts` and `v0/lib/plan-complexity-engine.ts`.
3. Build prompt payload bounded by those ceilings and schedule constraints.
4. Call OpenAI using the chat infrastructure in `v0/app/api/chat/route.ts` (or a dedicated route under `v0/app/api/plan/adjust`).
5. Validate the response; reject changes that exceed deterministic caps, then persist via `v0/lib/planAdjustmentService.ts`.
6. Write a change log for UI display and analytics.

## Integration points
- **Cron/Job runner**: nightly invocation via edge function or scheduled route hitting `plan/adjust`.
- **Today/Plan UI**: badge adjusted sessions; surface `rationale` and `recovery` tips.
- **Notifications**: optional email/push using `v0/lib/email.ts` with summaries.
- **Security**: enforce auth and rate limits with `v0/lib/security.middleware.ts` and request signing.

## Evaluation & success metrics
- Reduction in missed-session streaks after adjustments.
- Safety metrics: % of plans breaching load caps (target: 0%).
- Latency: p95 <1s for adjustment generation.
- User sentiment: thumbs up/down on adjustments.

## Observability
- Emit `plan_adjusted`, `plan_adjustment_skipped`, `plan_adjustment_failed` via `v0/lib/analytics.ts`.
- Attach prompt/version tags to traces in `v0/lib/backendMonitoring.ts`.
- Log deterministic caps vs. model suggestions for auditing.

## Failure & mitigation
- **No recent data** → Skip adjustments and flag `confidence: low`.
- **Model proposes unsafe load** → Clamp to deterministic caps and record `plan_adjustment_rejected`.
- **API failure** → Retry with exponential backoff; on repeated failure, keep current plan and alert monitoring.

## Extensions
- Integrate wearable fatigue scores once available.
- Allow user opt-out per week via settings toggle on the Plan screen.
- Experiment with microcycle rebalancing (2-week blocks) instead of single-session tweaks.
