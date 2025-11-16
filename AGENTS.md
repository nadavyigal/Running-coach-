# Repository Guidelines

## Project Structure & Module Organization
- `V0/` — Next.js app (App Router). Key folders: `app/`, `components/`, `lib/`, `hooks/`, `public/`, `styles/`, `__tests__/`, `e2e/`, `scripts/`.
- `docs/` — user stories, troubleshooting, and PRD notes.
- `backend/` — placeholder for future services.
- Build artifacts live under `V0/.next/`; avoid committing generated files.

## Build, Test, and Development Commands
Run all commands from `V0/` unless noted.
- Dev server: `npm run dev` (or `./start-dev.ps1 -Port 3010` on Windows).
- Build/Start: `npm run build` / `npm run start`.
- Lint/Type check: `npm run lint` · `npm run lint:fix` · `npm run type-check`.
- Unit tests (Vitest): `npm run test`, coverage: `npm run test:coverage`.
- E2E (Playwright): `npm run test:e2e` · report: `npm run test:e2e:report`.
- Quality/CI: `npm run quality:check` · `npm run ci:full`.

## Coding Style & Naming Conventions
- Language: TypeScript, React, Next.js (App Router).
- Indentation: 2 spaces; Prettier defaults; keep imports sorted logically.
- Files: kebab-case (e.g., `community-stats-widget.tsx`). Components export PascalCase.
- Paths: use aliases like `@/components`, `@/lib` (see `vitest.config.ts`/Next config).
- Lint rules: prefer `const`, no `debugger`, `console` limited to `warn`/`error`, unused vars must be removed (tests may relax some rules). Fix warnings before PRs.

## Testing Guidelines
- Unit/integration: Vitest + Testing Library (`*.test.ts[x]`, `*.spec.ts[x]` included). Run: `npm run test`.
- E2E: Playwright under `V0/e2e/` with `playwright.config.ts`; run `npm run test:e2e` (dev server auto-starts).
- Aim for meaningful coverage; use `npm run test:coverage` locally. Add test IDs and test helpers where appropriate.

## Commit & Pull Request Guidelines
- Commits: Conventional style, e.g., `feat(onboarding): add DOB step` (see `commit_message.txt`).
- PRs: concise title/description, linked issue, screenshots/GIFs for UI, note migrations or env changes.
- Pre-push: `npm run quality:check` then `npm run ci:full` from `V0/`.

## Security & Configuration
- Never commit secrets. Copy `V0/.env.example` to `V0/.env.local` and fill values.
- `OPENAI_API_KEY` is optional (chat falls back when missing). PostHog keys are optional.
- For a fresh local run, open `V0/reset-onboarding.html` to clear Dexie data.

