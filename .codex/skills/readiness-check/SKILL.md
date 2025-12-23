---
name: readiness-check
description: Classifies pre-run readiness (proceed/modify/skip) using recent load, recovery, and self-reported signals.
metadata:
  short-description: Pre-run safety and readiness gate with conservative recommendations.
---

## When Codex should use it
- Before starting a planned workout or recording a run.
- When the user reports fatigue, soreness, or poor sleep.

## Invocation guidance
1. Supply `UserProfile`, recent `TrainingHistory`, and `selfReport` (sleep, soreness, mood).
2. Evaluate against load/monotony caps and health signals; prefer conservative outcomes.
3. Return a readiness decision with `SafetyFlag[]` and recommended modifications.

## Input schema
See `references/input-schema.json`.

## Output schema
See `references/output-schema.json`.

## Integration points
- UI: Pre-run modal; disable GPS start if decision is `skip` or `modify`.
- API: New route `v0/app/api/run/readiness`.
- Background: Can run nightly to precompute next-day readiness.

## Safety & guardrails
- If pain/dizziness/injury keywords detected → decision must be `skip`, advise stop and consult professional.
- If data missing or uncertain → default to `modify`, emit `SafetyFlag` `missing_data`.
- Never provide medical diagnosis.

## Telemetry
- Emit `ai_skill_invoked` and `ai_safety_flag_raised` (if any) with `decision`, `safety_flags`, `model`, `latency_ms`.
