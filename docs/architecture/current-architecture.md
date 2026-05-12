# Current Architecture

## Repository Shape
- Main app: `v0/`.
- Shared packages: `packages/shared/`, `services/shared/`.
- Worker service: `services/worker/`.
- Supabase migrations: `v0/supabase/migrations/`, plus older root `migrations/`.
- Existing docs and reports: `docs/`, root markdown files, `GTM/`, and implementation reports.

## Framework
- Next.js 14 App Router.
- React 18.
- TypeScript.
- Tailwind CSS and Radix UI/shadcn-style primitives.
- Vercel AI SDK and OpenAI packages for AI features.

## Package Manager
- Main app uses npm in `v0/`.
- Root has a minimal `package.json`; do not assume root scripts run the app.
- `pnpm-workspace.yaml` exists, but current app scripts are npm-based.

## Commands
Run from `v0/`:
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npm run type-check`
- Unit/component tests: `npm run test` or `npm run test -- --run`
- E2E tests: `npm run test:e2e`
- Quality gate: `npm run quality:check`
- Full CI-like gate: `npm run ci:full`

## App Structure
- `v0/app/`: routes, layouts, API routes, auth callbacks, admin, landing, debug pages.
- `v0/components/`: screen components, feature components, and `components/ui`.
- `v0/lib/`: domain logic, data access, AI helpers, sync, Supabase clients, utilities.
- `v0/contexts/`: shared React context, including data behavior.
- `v0/hooks/`: reusable client hooks.
- `v0/e2e/`, `v0/__tests__/`, `v0/tests/`: Playwright, Vitest, integration, and unit tests.
- `v0/public/`, `v0/styles/`: assets and global styling.

## Data and Supabase
- Local-first IndexedDB behavior exists through Dexie-related app code.
- Supabase Auth/session support is present through `@supabase/ssr`.
- Supabase client files live in `v0/lib/supabase/`.
- Middleware refreshes sessions and protects `/admin`.
- Migrations exist for auth profiles, beta signups, analytics, Garmin, plans, and sync-related data.
- Service role clients are server-only and must never be used in client components.

## Deployment Assumptions
- Vercel deployment is assumed.
- `v0/vercel.json` defines cron jobs for Garmin and email sequences.
- Next config sets security headers, CSP, image handling, and production optimizations.
- Environment variables are required for Supabase, OpenAI, Resend, Garmin, PostHog, maps, admin emails, and cron behavior depending on feature.

## Main Risks
- Typecheck config intentionally excludes several non-core areas, so passing typecheck may not cover every route.
- Existing docs are spread across many directories; new specs need a clear source of truth.
- Multiple migration locations exist and may confuse schema work.
- Supabase env placeholders allow build-time behavior but can hide runtime misconfiguration.
- UI regressions are easy without mobile screenshots.
- Debug/test routes exist and should be reviewed before production-sensitive work.
