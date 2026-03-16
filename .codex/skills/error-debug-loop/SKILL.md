---
name: error-debug-loop
description: Systematic error triage workflow for RunSmart. Use when the user asks to debug an error, investigate a failing flow, fix a broken deploy, diagnose a console issue, or mentions recurring bugs like Supabase 406, missing tables, stale production, or post-deploy runtime failures.
---

# Error Debug Loop

Start every debug session by reading `tasks/lessons.md`. Reuse an existing fix pattern before inventing a new one.

## Workflow

1. Classify the failure:
   - frontend or runtime error
   - backend or Supabase issue
   - deploy or environment issue
2. If the same fix path has already failed twice in this session, stop repeating it and change strategy.
3. Route the investigation:
   - frontend: use Playwright or browser tooling to reproduce, inspect UI state, and capture console errors
   - backend: inspect environment variables, Supabase configuration, and query shape
   - deploy: inspect build logs, deployment status, live URL behavior, and console output
4. Check known RunSmart failures first:
   - `.single()` misuse causing `406`
   - wrong Supabase project ref in `.env.local`
   - cached or stale Vercel deployment
   - post-deploy chunk or CSS load failures
5. After landing a fix, add a short lesson to `tasks/lessons.md` if the failure mode was new or sharper than the existing guidance.

## Guardrails

- Do not mark a deploy issue resolved without checking the live URL.
- Do not treat a build success as runtime success.
- Do not hand-wave environment mismatches; verify the actual values being used.
- Prefer concrete evidence over intuition: console logs, network behavior, query shape, and active config.

## Skill Routing

- Use `supabase-config-validator` for config and query-shape checks.
- Use `ui-regression-guard` when the bug followed UI or design changes.
- Use `pre-deploy-checklist` or `post-deploy-validator` when the bug is tied to release verification.
