---
name: run-insights-recovery
description: Analyzes completed runs to provide effort assessment, recovery recommendations, and next-session guidance. Use immediately after user saves a run, asks "how did I do?", or requests recovery advice.
metadata:
  short-description: Post-run insights with effort assessment, recovery tips, and safety flags.
  agent: cursor
---

## When Cursor should use this skill
- Immediately after a run is saved
- When the user asks "how did I do?" or "what should I do next?"
- When user requests recovery advice or post-run analysis
- When implementing post-run feedback features or debugging run analysis

## Invocation guidance
1. Provide `RecentRunTelemetry` plus derived metrics (pace stability, splits) and upcoming workouts.
2. Map effort to easy/moderate/hard based on HR zones, pace, and RPE.
3. Generate concise insight bullets (3-5 points max).
4. Return `Insight` with `RecoveryRecommendation` and optional `nextSessionNudge`.
5. Check for warning signals (high HR, pain mentions, poor form) and emit SafetyFlags.

## Input schema (JSON)
```ts
{
  "run": RecentRunTelemetry,
  "derivedMetrics": { 
    "paceStability": string, 
    "cadenceNote"?: string, 
    "hrNote"?: string,
    "splitAnalysis"?: string[] 
  },
  "upcomingWorkouts": Workout[],
  "userFeedback"?: { "rpe"?: number, "soreness"?: string, "notes"?: string }
}
```

## Output schema (JSON)
```ts
Insight
```

## Integration points
- **API/hooks**: Post-run pipeline in `v0/lib/run-recording.ts` 
- **Chat**: `v0/lib/enhanced-ai-coach.ts` - Conversational insights
- **UI**: 
  - Today screen banners
  - Run detail modal
  - Post-run summary screen
- **Database**: 
  - Save alongside run in `runs` table
  - Store insights in `run_insights` table (if added)
  - Link to recovery recommendations

## Safety & guardrails
- If HR missing, default to pace/RPE and add `SafetyFlag` with `missing_data`.
- If user reports pain/dizziness, advise stopping and consulting a professional; downgrade next session.
- Keep guidance ≤120 words; no medical diagnosis.
- If abnormal HR patterns (too high for easy runs, erratic), emit `SafetyFlag` with `heat_risk` or `injury_signal`.
- Never blame user for poor performance; frame constructively.

## Effort classification

### Easy (Zone 2-3, conversational pace)
- **Indicators**: HR 60-75% max, RPE 3-5, could hold conversation
- **Typical pace**: 30-60s/km slower than tempo pace
- **Recovery**: 24-48 hours

### Moderate (Zone 3-4, tempo pace)
- **Indicators**: HR 75-85% max, RPE 5-7, breathing harder but controlled
- **Typical pace**: 10-20s/km slower than race pace
- **Recovery**: 48-72 hours

### Hard (Zone 4-5, intervals/race pace)
- **Indicators**: HR 85-95%+ max, RPE 7-9, difficult to talk
- **Typical pace**: At or faster than goal race pace
- **Recovery**: 72-96 hours

## Recovery recommendations structure

### Priority actions (always include)
- Hydration target
- Nutrition window (within 30-60 minutes)
- Sleep recommendation
- Next easy run timing

### Optional enhancements
- Foam rolling/stretching
- Compression gear
- Ice bath/cold therapy
- Active recovery suggestions

## Telemetry
- Emit `ai_skill_invoked` and `ai_insight_created` with:
  - `run_id`
  - `effort` (easy/moderate/hard)
  - `safety_flags`
  - `latency_ms`
  - `recovery_hours` (suggested recovery time)

## Common edge cases
- **First run ever**: Celebrate completion, set realistic expectations, emphasize recovery
- **Missed workouts recently**: Acknowledge gap, suggest gentle return
- **Overperformance**: Celebrate but caution against overtraining
- **Underperformance**: Normalize bad days, check for external factors (sleep, stress, weather)
- **Pain mentions**: Immediate SafetyFlag, recommend rest and evaluation
- **Weather impact**: Account for heat, cold, wind, rain in assessment

## Next-session nudge patterns

### After easy run
"Great foundation work! Your next tempo session on [day] will build on this."

### After hard workout
"Solid effort! Take it easy tomorrow - you've earned recovery time."

### After long run
"Nice endurance building. Rest up for [X] hours before your next run."

### After struggled run
"Tough days happen. Focus on recovery and your next easy run will feel better."

## Testing considerations
- Test with various effort levels (easy, moderate, hard)
- Verify effort classification matches HR/pace/RPE
- Test with missing data (no HR, no RPE, etc.)
- Validate recovery recommendation appropriateness
- Test SafetyFlag emission for abnormal patterns
- Verify next-session nudge relevance to upcoming workouts
