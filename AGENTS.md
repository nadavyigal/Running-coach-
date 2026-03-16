# Repository Guidelines

## Project Structure & Module Organization
- `v0/` is the main Next.js app. Key folders: `app/`, `components/`, `lib/`, `hooks/`, `public/`, `styles/`, `__tests__/`, `e2e/`, `scripts/`.
- `docs/` holds stories, plans, troubleshooting, and cowork prompts.
- `tasks/lessons.md` is the shared debugging memory. Treat it as required input for triage work.
- Build output lives in `v0/.next/`. Do not commit generated artifacts.

## Build, Test, and Development Commands
- Run app commands from `v0/`, not the repo root.
- `npm run dev` starts local development.
- `npm run lint`, `npm run type-check`, and `npm run build` are the minimum deployment gate.
- `npm run test` runs Vitest. `npm run test:e2e` runs Playwright flows.
- `npm run quality:check` and `npm run ci:full` remain the pre-push quality gates.

## Coding Style & Naming Conventions
- TypeScript + React + Next.js App Router, 2-space indentation, kebab-case files, PascalCase components.
- Prefer aliases such as `@/components` and `@/lib`.
- Keep lint clean. Remove unused vars and keep `console` limited to `warn` and `error`.

## Codex Workflow Overrides
- Before any debug session, read `tasks/lessons.md`. If a recurring bug is listed there, reuse that fix path first.
- Do not retry the same fix more than twice. After two failed attempts, switch approach and widen the investigation.
- Prefer plan/spec flow for multi-step work. Use the new Codex skills to shape the spec before broad implementation.
- Use Playwright, Supabase, and Vercel workflows proactively when the task touches UI, backend config, or deployment.

## Deployment Workflow
- Before any production deploy, run `npm run lint`, `npm run type-check`, and `npm run build` from `v0/`.
- Verify `v0/.env.local` points at the intended Supabase project, especially `NEXT_PUBLIC_SUPABASE_URL`.
- After deploy, run a Playwright smoke test on the live URL and check the browser console. Production is not complete with console errors or missing assets.

## Error Triage Protocol
1. Check `tasks/lessons.md`.
2. Inspect browser behavior and console output with Playwright for frontend or runtime issues.
3. Check Supabase config and logs for backend/auth/data issues.
4. Check Vercel build or deployment logs for release issues.
5. Record any new reusable fix in `tasks/lessons.md` before closing the session.

## Known Recurring Bugs
| Bug | Root Cause | Default Fix |
| --- | --- | --- |
| `406` from Supabase lookup | `.single()` on 0 or multiple rows | Replace with `.maybeSingle()` unless exactly one row is guaranteed |
| Supabase "missing tables" | Wrong project ref in `.env.local` | Re-copy the project URL from Supabase Settings > API |
| UI regression after redesign | Visual changes landed without comparison | Run screenshot diff before commit |
| Production missing latest code | Cached or failed deploy | Check Vercel status and redeploy before debugging app code |
| Post-deploy console errors | Asset, CSS, or chunk loading failure | Review Vercel logs and live console immediately |

## Self-Improvement Loop
- When a fix exposed a new recurring failure mode, add a short lesson entry to `tasks/lessons.md`.
- Keep entries concrete: mistake, why it failed, correct approach, and how to prevent it next time.
- Prefer updating lessons in the same session that found the bug.
