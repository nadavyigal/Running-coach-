---
name: load-anomaly-guard
description: Detects unsafe training load spikes (>20-30% week-over-week) and emits safety flags. Use in nightly background jobs or when reviewing weekly training volume with conservative adjustment recommendations.
metadata:
  short-description: Background load monitor that flags spikes and proposes protective changes.
  agent: cursor
---

## When Cursor should use this skill
- Nightly background check on training data
- Immediately after a high-intensity or long run is logged
- When analyzing weekly training load patterns for safety issues
- When implementing load monitoring features or debugging training load calculations

## Invocation guidance
1. Provide recent `TrainingHistory`, planned `Plan` window, and any injury flags.
2. Compute week-over-week changes and monotony; flag spikes > deterministic caps.
3. Calculate Acute:Chronic Workload Ratio (ACWR) and training monotony.
4. Suggest adjustments (rest/swaps) and emit `SafetyFlag[]`.
5. Use deterministic thresholds from `v0/lib/plan-complexity-engine.ts`.

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Load metrics

### Weekly Volume
- **Calculation**: Sum of all running duration/distance in past 7 days
- **Safe increase**: <20% week-over-week
- **Caution**: 20-30% increase
- **Danger**: >30% increase

### Acute:Chronic Workload Ratio (ACWR)
- **Acute load**: Average daily load over past 7 days
- **Chronic load**: Average daily load over past 28 days (rolling 4-week average)
- **ACWR**: Acute / Chronic
- **Safe zone**: 0.8-1.3
- **Caution zone**: 1.3-1.5 or 0.5-0.8
- **Danger zone**: >1.5 or <0.5

### Training Monotony
- **Calculation**: Mean daily load / Standard deviation of daily load
- **Low**: <1.5 (good variety)
- **Moderate**: 1.5-2.0 (acceptable)
- **High**: >2.0 (concerning - too repetitive)

### Training Strain
- **Calculation**: Weekly load × Monotony
- **Low**: <1000
- **Moderate**: 1000-2000
- **High**: >2000 (injury risk)

## Detection rules

### Spike detection
1. Calculate current week volume
2. Calculate previous week volume
3. If increase >20%, emit `load_spike` warning
4. If increase >30%, emit `load_spike` danger

### Monotony detection
1. Calculate daily load variance over 2 weeks
2. If monotony >2.0, emit `high_monotony` warning
3. Suggest adding variety or rest days

### ACWR violation
1. Calculate 7-day and 28-day average loads
2. If ACWR >1.5, emit `acwr_high` danger
3. If ACWR <0.5 (after training), emit `detraining` warning

### Consecutive hard days
1. Count hard sessions (HR >80% max or RPE >7) in past 7 days
2. If 3+ hard days without 48h recovery, emit `inadequate_recovery`

## Integration points
- **Background job**: Nightly cron (via `v0/lib/backgroundJobs.ts` if added)
- **API**: `v0/app/api/plan/load-guard` (to add) returning flags + suggested adjustments
- **UI**: 
  - Badge on Plan/Today screens showing load status
  - Push/email via `v0/lib/email.ts`
  - Warning modal before high-load workouts
- **Database**: 
  - Calculate from `runs` and `workouts` tables
  - Store load metrics in `training_load` table (if added)

## Safety & guardrails
- If spike >20–30% week-over-week, emit `load_spike` and recommend rest or reduced volume.
- If injury signals present, bias toward `rest-day` adjustments.
- No medical diagnosis; advise professional consult on repeated spikes or pain.
- Always prefer conservative adjustments.
- Never suggest increasing load to "make up" for previous low weeks.

## Adjustment recommendations

### For load spike (20-30%)
- Reduce next week's volume by 15-20%
- Add extra rest day
- Convert 1 hard session to easy
- Maintain intensity but reduce duration

### For load spike (>30%)
- Mandatory rest day insertion
- Reduce volume by 30-40% next week
- All runs at easy pace
- Consider cross-training substitution

### For high monotony (>2.0)
- Add variety: mix distances, paces, surfaces
- Include cross-training day
- Vary workout types more
- Add optional rest day

### For ACWR >1.5
- Immediate volume reduction
- Extra recovery day
- Monitor for injury signals
- Extend build phase timeline

### For inadequate recovery
- Insert rest day before next hard session
- Convert upcoming hard session to easy
- Increase recovery time between efforts
- Monitor sleep and soreness

## Telemetry
- Emit `ai_skill_invoked`, `ai_safety_flag_raised`, and optionally `ai_adjustment_applied` when suggestions are auto-applied with:
  - `load_spike_percent`
  - `acwr_value`
  - `monotony_value`
  - `safety_flags` (array)
  - `adjustment_recommended`
  - `auto_applied` (boolean)

## Common edge cases
- **First week of training**: No comparison data, establish baseline
- **Return from break**: Low ACWR is expected, don't flag as detraining
- **Taper period**: Low load is intentional, don't flag
- **Race week**: Allow slight spike for race day
- **Illness/injury**: Pause monitoring during recovery
- **Data gaps**: Don't flag if data is incomplete

## Testing considerations
- Test spike detection with various volume increases
- Verify ACWR calculation accuracy
- Test monotony calculation with different training patterns
- Validate adjustment recommendation appropriateness
- Test with missing or incomplete data
- Verify no false positives during taper or planned down-weeks
