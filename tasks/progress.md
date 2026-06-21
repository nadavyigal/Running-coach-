# Project Progress

Project: RunSmart Web
Status: Active
Current Phase: Garmin production enablement (web/backend audit + hardening)
Active Story: Garmin worker-RPC grant lockdown migration (written, awaiting founder approval to apply)
Last Completed Story: Garmin production-enablement audit (2026-06-21): cleared stranded branch fix/garmin-ios-branch-fixes (fully landed via PR #94, deleted local), confirmed Gate 1 privacy policy live in code, webhook async-200 + deregistration handler verified, table grants confirmed scoped
Next Recommended Story: Founder approval to apply migration 20260621000000_restrict_garmin_worker_rpc_grants.sql; then manual Gate 2/3/4 portal+email tasks (see tasks/work-pack-garmin-gate-1-4.md)
Estimated Completion: Web/backend code is production-ready; remaining gates are Garmin-portal/email/manual founder tasks
Blockers: Migration apply needs founder "yes" (no DB push without approval). Garmin Production approval is external (~2-4 weeks after submission).
Risks: Worker RPCs (claim/requeue/fail_garmin_import_job) are SECURITY DEFINER and PUBLIC-executable until the lockdown migration is applied; SECURITY DEFINER functions also lack set search_path (noted follow-up)
Last Validation: 15/15 Garmin route tests pass (webhook, activities, sleep) via npx vitest in v0/ on 2026-06-21. Migration not yet applied.
Latest QA Report: —

<!--
Seeded 2026-06-12 per Agentic OS MANUAL.md "How to make a project reach High confidence"
(open decision in Agentic OS tasks/progress.md, approved by founder 2026-06-12).
The app lives in v0/ — run lint/type-check/test from there. Keep the keyed block above
current after each significant validation; the Agentic OS refresh parser reads it.

Note found during seeding: v0/node_modules was inconsistent with package-lock.json
(eslint-scope missing, lint crashed). Fixed with npm ci on 2026-06-12. If lint crashes
with "Cannot find module", run npm ci in v0/ first.
-->
