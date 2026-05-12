# Testing Standards

## Baseline Commands
Run from `v0/`:
- Lint: `npm run lint`
- Typecheck: `npm run type-check`
- Tests: `npm run test -- --run`
- Build: `npm run build`
- E2E: `npm run test:e2e`

## Choose the Smallest Useful Check
- Component or utility change: focused Vitest test plus lint/typecheck.
- API route change: route tests or focused integration test plus error cases.
- UI route change: focused unit/component tests plus browser/mobile smoke check.
- Data or Supabase change: migration review, RLS review, local/API integration check.
- Deployment config change: build plus Vercel/env review.

## Test Expectations
- Prefer tests that verify behavior, not implementation details.
- Include failure, empty, and loading states when changing async behavior.
- Mock IndexedDB/Supabase/OpenAI thoughtfully; do not hide real contract changes.
- Update existing tests when behavior intentionally changes.

## QA Evidence
- Record commands run and results.
- For UI changes, include screenshot or clear viewport notes.
- If a check cannot run, document the blocker and residual risk.
