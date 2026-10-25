# Garmin commercial readiness — 25 October 2026

## Product brief and scope

Prepare a completed-run Activity-only integration with a reliable webhook and permission-aware connection flow. Keep Health wellness, Training and Courses out of the proposed commercial scope. This is an engineering readiness slice, not approval to launch, change credentials, submit applications or edit published policy. Native wearable work remains independent.

## Story 1 — Preserve webhook processing after acknowledgement

As a runner, I want Garmin pushes processed after acknowledgement so imported runs are not lost merely because the request returned.

Acceptance criteria:
- Next 16 path-token GET/POST await promised route params and preserve secret/body forwarding.
- Authorized valid requests return HTTP 200 before persistence completes.
- Next `after()` tracks subsequent persistence, deregistration handling and activity enqueueing.
- Unauthorized requests never schedule work; processing errors are logged.
- Existing duplicate handling and secret checks remain intact.

Validation: red-first route tests with promised params; manually execute registered post-response callbacks in tests to assert processing and error behavior. Post-response tracking is not a durable queue or a payload-size compliance claim.

## Story 2 — Respect historical-export permission during connection

As an Activity-only user, I want my connection to succeed without attempting history my Garmin access does not permit.

Acceptance criteria:
- Initial backfill is queued only if returned permissions include HISTORICAL_DATA_EXPORT.
- ACTIVITY_EXPORT alone, or ACTIVITY_EXPORT plus HEALTH_EXPORT, stores the connection without queuing backfill.
- Entitled backfill still queues and queue failure remains nonfatal to connection.

Validation: red-first callback tests for all three permission combinations plus existing token/session/credential regression coverage. This guard applies to initial OAuth backfill only, not every historical request path.

## Implementation and verification

These stories change only server routes/tests plus a focused Node Vitest configuration. No UI, schema, privacy policy, iOS or environment changes. Run from v0:

```sh
npm run test -- --run --config vitest.garmin-readiness.config.ts
npm run type-check
npm run lint
```

The focused configuration avoids loading browser/IndexedDB test setup for server contracts. The reused local dependency install lacks the global setup's @testing-library/dom peer; no package or lockfile changes are needed for these Node tests.

## Remaining launch gates — not implemented by these stories

- Complete Activity-only gate across raw ingestion, data fetches, stored Health data exposure, wellness derivation, AI context and UI; portal permissions/UI hiding alone are insufficient.
- Align diagnostic/status requirements with Activity-only permission.
- Guard manual and lower-level historical request paths against absent entitlement; Starter must not request backfill.
- Implement/verify permission-change lifecycle using the authenticated API contract; deregistration exists but needs portal evidence.
- Prove host acceptance of required large Activity payloads and acknowledgement timing end-to-end. Neither small route tests nor after() prove delivery durability or 100 MB ingress.
- Reconcile deployed privacy/source provenance. Garmin-related policy changes require written Garmin approval before implementation.
- Verify internal app status, separate credentials, two authorized test users, Data Generator/Partner Verification, brand assets and real-device full UX evidence. Training/Courses transfer evidence is irrelevant when unused.

Acceptance scenarios for the next Activity-only gate: mixed Activity/Health pushes persist only approved datasets while preserving deregistration events; direct wellness routes and stored/AI contexts reveal no gated data; Activity import/dedup/plan completion still works; direct historical requests with no entitlement cause no Garmin calls. Keep old stored history separate from authorized new collection/use decisions.
