# Standard Telemetry Events

- `ai_skill_invoked`: { skill_name, context, model, request_id, user_id?, latency_ms }
- `ai_plan_generated`: { plan_version, user_id?, workouts_count, safety_flags?, fallback_used? }
- `ai_adjustment_applied`: { user_id?, adjustments_count, confidence, safety_flags? }
- `ai_insight_created`: { run_id, effort, safety_flags?, latency_ms }
- `ai_safety_flag_raised`: { skill_name, flag: SafetyFlag, user_id?, run_id? }
- `ai_user_feedback`: { skill_name, rating: number, comment?, run_id?, plan_version? }

Emit via `v0/lib/analytics.ts` and trace with `v0/lib/backendMonitoring.ts`. Redact PII before logging.
