# AI Skills Blueprint

This folder outlines high-impact AI skills tailored for the Run-Smart coaching experience. Each skill includes inputs, outputs, data dependencies, prompting guidance, integration points, and evaluation notes. Use these playbooks to scope implementations that plug into the existing Next.js (App Router) stack, Dexie persistence (`v0/lib/db.ts`), and OpenAI-based chat APIs under `v0/app/api/`.

## Skills

1. **Personalized Plan Generator** — Drafts 14–21 day training blocks grounded in onboarding data and plan templates. See [`personalized-plan-generator.md`](./personalized-plan-generator.md).
2. **Adaptive Plan Adjuster** — Recomputes future sessions nightly based on completed runs, fatigue, and trends. See [`adaptive-plan-adjuster.md`](./adaptive-plan-adjuster.md).
3. **Run Insights & Recovery Coach** — Translates GPS logs and effort signals into post-run summaries and recovery guidance. See [`run-insights-and-recovery.md`](./run-insights-and-recovery.md).
4. **Conversational Goal Discovery Coach** — Guides users through goal clarification and micro-habit commitments via chat. See [`conversational-coach.md`](./conversational-coach.md).
5. **Solo Founder Ops Playbook** — Operational skills for backlog triage, release QA, feedback synthesis, GTM cues, and stakeholder updates. See [`solo-founder-ops.md`](./solo-founder-ops.md).

## How to use

- Start from the skill most adjacent to the current feature work (e.g., onboarding → plan generator; post-run → insights). 
- Wire the data dependencies first (Dexie models, plan generators, run summaries), then layer prompting and API routes.
- Keep prompts modular so they can be A/B tested via `v0/lib/abTestFramework.ts` and observed through `v0/lib/analytics.ts` and `v0/lib/backendMonitoring.ts`.
- When shipping, add type-safe request/response contracts under `v0/app/api/<skill>/route.ts` and reuse `v0/lib/security.middleware.ts` for headers and rate limits.
