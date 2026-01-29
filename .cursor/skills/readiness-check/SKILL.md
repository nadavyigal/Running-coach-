---
name: readiness-check
description: Pre-run safety gate that evaluates readiness and recommends proceed/modify/skip decisions. Use before scheduled workouts to assess recovery status, injury signals, and training load based on sleep, soreness, and recent activity.
metadata:
  short-description: Pre-run safety and readiness gate with conservative recommendations.
  agent: cursor
---

## When Cursor should use this skill
- Before starting a planned workout or recording a run
- When the user reports fatigue, soreness, or poor sleep
- When user asks if they should run today or if they're ready for a workout
- When implementing pre-run readiness features or debugging readiness assessments

## Invocation guidance
1. Supply `UserProfile`, recent `TrainingHistory`, and `selfReport` (sleep, soreness, mood).
2. Evaluate against load/monotony caps and health signals; prefer conservative outcomes.
3. Return a readiness decision with `SafetyFlag[]` and recommended modifications.
4. Calculate training load from past 7-14 days.
5. Check for injury signals, illness, or extreme fatigue.

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Decision framework

### PROCEED
- Good sleep (7+ hours)
- Low/moderate soreness
- No pain or illness
- Training load within normal range
- Good mood/energy

### MODIFY
- Poor sleep (5-7 hours)
- Moderate soreness
- Minor fatigue
- Slight load spike (15-25%)
- Moderate stress
**Modifications**: Reduce intensity OR volume by 20-30%, convert hard → easy

### SKIP
- Very poor sleep (<5 hours)
- High soreness or pain
- Illness symptoms
- Extreme fatigue
- Major load spike (>30%)
- Injury signals
**Recommendation**: Rest day, consider cross-training if feeling better later

## Integration points
- **UI**: 
  - Pre-run modal (before GPS start)
  - Today screen readiness widget
  - Disable GPS start if decision is `skip` with override option
- **API**: `v0/app/api/run/readiness` (to add)
- **Background**: Can run nightly to precompute next-day readiness
- **Database**: Store readiness checks in `readiness_checks` table (if added)

## Safety & guardrails
- If pain/dizziness/injury keywords detected → decision must be `skip`, advise stop and consult professional.
- If data missing or uncertain → default to `modify`, emit `SafetyFlag` `missing_data`.
- Never provide medical diagnosis.
- Err on side of caution - when in doubt, recommend modify or skip.
- If user overrides skip decision, log override and suggest extra caution.

## Self-report indicators

### Sleep quality
- **Good**: 7-9 hours, restful
- **Fair**: 5-7 hours or restless
- **Poor**: <5 hours or very restless

### Soreness level
- **None**: No soreness
- **Mild**: Some stiffness, goes away with movement
- **Moderate**: Noticeable soreness, affects movement
- **Severe**: Pain that alters gait

### Mood/Energy
- **Energized**: Eager to run
- **Normal**: Ready to run
- **Fatigued**: Low energy
- **Exhausted**: Drained, struggling

### Stress level
- **Low**: Relaxed, calm
- **Moderate**: Some stress, manageable
- **High**: Very stressed, overwhelmed

## Training load assessment

### Acute:Chronic Workload Ratio (ACWR)
- **Safe**: 0.8-1.3
- **Caution**: 1.3-1.5 or <0.8
- **Danger**: >1.5

### Week-over-week volume change
- **Safe**: <20% increase
- **Caution**: 20-30% increase
- **Danger**: >30% increase

### Consecutive hard days
- **Safe**: 0-1 hard days in past 3 days
- **Caution**: 2 hard days in past 3 days
- **Danger**: 3+ hard days in past 3 days

## Telemetry
- Emit `ai_skill_invoked` and `ai_safety_flag_raised` (if any) with:
  - `decision` (proceed/modify/skip)
  - `safety_flags`
  - `model`
  - `latency_ms`
  - `override_count` (if user overrides)
  - `factors` (array of contributing factors)

## Common edge cases
- **First run ever**: Bias toward proceed with encouragement
- **Return from injury**: Bias toward modify, very conservative
- **After illness**: Skip if any symptoms, modify if recovered <7 days
- **Race day**: Allow proceed even with mild fatigue (but warn)
- **Taper period**: Bias toward proceed (reduce pre-race anxiety)
- **Missing data**: Request more info, default to modify

## Testing considerations
- Test all three decision outcomes (proceed/modify/skip)
- Verify SafetyFlag emission for each danger signal
- Test with missing self-report data
- Validate modification suggestions match fitness level
- Test load calculations accuracy
- Verify override behavior and logging
