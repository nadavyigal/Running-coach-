---
name: running-coach-index
description: Reference catalog for all running coach AI skills, shared TypeScript contracts, safety guardrails, and telemetry conventions. Use when working with any running coach feature to understand data schemas, safety patterns, or integration points.
metadata:
  short-description: Catalog of AI skills, contracts, telemetry, and guardrails for Run-Smart.
---

## Purpose
Defines the shared conventions, contracts, safety posture, and telemetry used by all Run-Smart AI skills. This index allows Claude to discover available skills and the rules they follow.

## When Claude should use this skill
- Before invoking any Run-Smart skill to understand shared schemas, safety guidance, and telemetry
- When onboarding a new skill to ensure compliance with common contracts
- When working with running coach features and need to understand data schemas or safety patterns

## Invocation guidance
1. Load shared references in `running-coach-index/references/` (contracts, telemetry, conventions, smoke-tests).
2. Select the appropriate skill directory based on the user's need (plan generation, adjustment, insights, etc.).
3. Validate request/response payloads against the schemas in `contracts.md` and skill-specific schemas.

## Shared components
- **Contracts:** `running-coach-index/references/contracts.md`
- **Telemetry:** `running-coach-index/references/telemetry.md`
- **Conventions:** `running-coach-index/references/conventions.md`
- **Smoke tests:** `running-coach-index/references/smoke-tests.md`

## Safety & guardrails
- No medical diagnosis. If pain/dizziness/severe symptoms appear, advise stopping activity and consulting a qualified professional.
- Prefer conservative adjustments under uncertainty.
- Emit `SafetyFlag` objects when thresholds are crossed and log via `ai_safety_flag_raised`.

## Integration points
- Skills are invoked from chat flows (`v0/app/api/chat/route.ts`, `v0/lib/enhanced-ai-coach.ts`), plan generation APIs (`v0/app/api/generate-plan/route.ts`), background jobs (plan adjustment), and post-run screens.

## Telemetry events (standard)
- `ai_skill_invoked`
- `ai_plan_generated`
- `ai_adjustment_applied`
- `ai_insight_created`
- `ai_safety_flag_raised`
- `ai_user_feedback`

## Agent Team (Swarm) Coordination
RunSmart skills are designed to work in agent teams (Opus 4.6+). When running in
a swarm, each teammate inherits all skills via CLAUDE.md and .claude/skills/.

### Swarm-Aware Skills
- **swarm-orchestrator**: Master patterns for spawning and coordinating teams
- **dev-swarm**: Parallel development with architect/frontend/backend/QA roles
- **marketing-swarm**: Multi-channel marketing campaigns with specialist agents
- **ops-deploy**: Deployment and production operations
- **growth-analytics**: Metrics, funnels, and experiment frameworks
- **pwa-distribution**: App store optimization and distribution channels
- **community-growth**: User acquisition and community building

### Coordination Conventions
1. Running coach domain skills (plan-generator, readiness-check, etc.) are used
   by individual teammates — they don't need their own team.
2. Swarm skills (dev-swarm, marketing-swarm) define team compositions and
   task dependency patterns for multi-agent work.
3. The swarm-orchestrator skill provides the master patterns that all other
   swarm skills follow.
4. All teammates respect safety guardrails from this index.
