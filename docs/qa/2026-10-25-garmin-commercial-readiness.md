# Garmin readiness patch QA — 25 October 2026

Recommendation: limited patch ready for draft PR review; integration NOT ready for commercial launch.

## Acceptance and evidence

- Story 1: promised params covered on GET/POST; secret/body forwarding retained. Tests prove HTTP 200 before persistence and manually execute the registered Next after callback to verify persistence/enqueue, duplicate and deregistration behavior. Error logging/auth rejection covered. Red first: 6 expected failures before fix; 9 final webhook tests pass.
- Story 2: permission combinations ACTIVITY_EXPORT, ACTIVITY_EXPORT+HEALTH_EXPORT and ACTIVITY_EXPORT+HISTORICAL_DATA_EXPORT verify skipped/allowed initial history. Red first: 2 expected failures for missing history entitlement. Callback session and credential regressions remain covered. 6 final callback tests pass.
- Independent read-only QA reran all 15 tests with the committed Node config and inspected diff; no actionable regressions found. Permission lookup failure cannot enqueue initial history by source inspection; failure-specific regression test not added.

## Commands, from v0

- `npm run test -- --run --config vitest.garmin-readiness.config.ts`: PASS, 15 tests in 3 files; independently rerun with same result.
- `npm run type-check`: PASS.
- `npm run lint`: PASS, 0 errors and 1657 repository warnings.
- Scoped ESLint on changed TypeScript files: PASS, 0 errors and 1 existing object-injection warning in webhook dataset lookup.
- `git diff --check`: PASS.

Dependencies reused from the existing off-Documents install. No dependency/lockfile edits. Dedicated Node tests avoid global browser setup, whose reused install lacks @testing-library/dom. No full browser-suite claim. No build/deploy or live integration test: this pass does not have authenticated portal access, real Garmin test authorization or a physical-device evidence environment. No UI files changed.

## Material limits and next gates

Next after tracks request lifetime; it does not guarantee durable acceptance or recover from every post-ACK failure. Existing parse-before-ACK and host payload limits need end-to-end proof at Garmin-required 10 MB / 100 MB sizes. Initial backfill guard does not secure manual/lower-level history paths or validate a business tier by itself. Health datasets and stored/derived/AI wellness data still need complete capability gates; current status/diagnose still expect Health permission. Permission-change handling needs the authenticated contract and tests. No privacy policy was changed; deployment/source mismatch and written approval evidence remain unresolved. No portal changes, submissions, messages, terms acceptance, certificate uploads or production credential mutations occurred.

## Rollback

Revert this patch if route behavior regresses. It changes no schema or environment variables. Keep connection enablement and commercial cutover as separate approved actions.
