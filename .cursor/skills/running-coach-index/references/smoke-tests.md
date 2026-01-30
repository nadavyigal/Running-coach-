# Smoke Tests for Cursor Agent Skills

For each skill, validate:
- JSON schema compliance (input/output) against the shared contracts + skill-specific schemas.
- Telemetry emission of `ai_skill_invoked` and skill-specific events.
- Safety guardrails: ensure `SafetyFlag` is raised on pain/dizziness, missing HR data, or load spikes.

## Triggers & expectations
- **Plan Generator:** POST `v0/app/api/generate-plan/route.ts` with onboarding profile → returns `Plan` with 14–21 days; emits `ai_plan_generated`.
- **Plan Adjuster:** Scheduled job hitting `plan/adjust` → applies `Adjustment[]`; emits `ai_adjustment_applied`.
- **Run Insights & Recovery:** Post-run hook → returns `Insight` with recovery tips; emits `ai_insight_created`.
- **Conversational Goal Discovery:** Chat flow → returns `GoalDiscoveryResult`; emits `ai_skill_invoked`.
- **Readiness Check:** Pre-run screen → returns proceed/modify/skip with SafetyFlags when fatigued.
- **Post-Run Debrief:** After save → returns reflection + next-step; emits `ai_insight_created`.
- **Race Strategy Builder:** From race setup UI → pacing/fueling plan; emits `ai_plan_generated`.
- **Workout Explainer:** On workout detail modal → execution cues; emits `ai_skill_invoked`.
- **Route Builder:** Map planner → route spec; emits `ai_skill_invoked`.
- **Load Anomaly Guard:** Background monitor → flags unsafe spikes; emits `ai_safety_flag_raised`.
- **Adherence Coach:** Weekly digest → reshuffle suggestions + nudges; emits `ai_adjustment_applied`.

## Common failure modes
- Model returns non-JSON → retry with strict formatting or fallback template.
- Unsafe prescriptions (volume spike > deterministic cap) → clamp and emit `SafetyFlag`.
- Missing telemetry → ensure analytics call in handler.
- PII leakage → enforce redaction in prompts and logs.

## Testing strategies
- **Unit Tests:** Use Vitest with `fake-indexeddb` for database mocking
- **Integration Tests:** Test API routes with mock AI responses
- **E2E Tests:** Use Playwright to test complete user flows
- **Safety Tests:** Verify SafetyFlag emission for edge cases
- **Performance Tests:** Monitor latency_ms and set thresholds (<2000ms for most skills)
