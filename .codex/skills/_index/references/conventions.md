# Codex Skill Conventions (Run-Smart)

- **Inputs/Outputs:** Always JSON; align with shared contracts in `contracts.md`.
- **Safety:** No medical diagnosis. On pain/dizziness/severe symptoms, instruct stop + consult a qualified professional. Emit `SafetyFlag`.
- **Tone:** Supportive, concise coaching; avoid shaming; prefer actionable phrasing.
- **Guardrails:** Favor conservative adjustments under uncertainty; clamp volume/intensity to deterministic caps (`v0/lib/plan-complexity-engine.ts`, `v0/lib/planAdaptationEngine.ts`).
- **Privacy:** Do not log PII. Redact names/emails from prompts and telemetry. Reuse `v0/lib/security.middleware.ts`.
- **Telemetry:** Emit events defined in `telemetry.md` with `skill_name`, `model`, `latency_ms`, `success`, and `safety_flags`.
- **Fallbacks:** If JSON schema validation fails, retry with constrained prompts; fallback to deterministic generators (e.g., `v0/lib/planGenerator.ts`).
