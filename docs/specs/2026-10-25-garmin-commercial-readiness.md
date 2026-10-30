# Garmin readiness spec — 25–26 October 2026

## Product brief

Prepare a reliable Activity-only completed-run integration and a concrete Internal Test path while leaving customer connection starts disabled. Public1.2.0 is the current founder-reported device baseline. Backend preparation does not establish commercial approval or authorize credential, endpoint, production or privacy changes.

## Scope and acceptance stories

1. **Webhook reliability:** await Next16 route params, preserve path-secret/body forwarding, return HTTP200 before persistence, track post-response work with Next after, preserve auth/duplicate/lifecycle behavior and log processing failures. after is not durable delivery.
2. **Current OAuth contract:** shared documented user profile/permission endpoints; accept object-wrapped permissions plus compatible bare arrays and empty grants.
3. **Least-privileged delivery:** default/unknown tiers use push only. Explicit Enterprise configuration plus history grant is required for initial, manual and queued backfill. Recheck permission before client history calls; skip queued Activity import after recorded grant removal. Starter Activity File callbacks remain supported as distinct one-time downloads. Configuration is not approval evidence.
4. **Activity-only ingress:** drop Health/unknown payload keys before raw-event persistence and export-store writes, gate Health export reads, retain lifecycle events, and do not demand Health in default status/diagnostics. Filtered Health-only notifications must not produce spurious activity errors.
5. **Permission lifecycle:** handle documented permission-change events, including removal of every grant, without deleting valid tokens or overwriting connection status. Reject malformed events and sequential stale timestamps; do not claim atomic ordering across concurrent writers.
6. **Disconnect lifecycle:** remove user registration before revoking the current token pair, account for refresh-token rotation, preserve local cleanup after upstream failures and report partial upstream failure honestly.

## Plan and verification

Use independent, red-first server contracts for each story; keep legacy Enterprise scenarios explicitly opted in. A dedicated Node Vitest config avoids unrelated browser/IndexedDB setup for server tests. Run from v0:

```sh
npm run test -- --run --config vitest.garmin-readiness.config.ts
npm run type-check
npx tsc --noEmit
npm run lint
npm run build
```

The refreshed QA report records results and residual audit failures. Include safe same-major dependency patches only; no major Zod/Vitest migration or audit exception in this slice. No schema migration, UI, native source, published policy or live environment changes. Access-policy examples document defaults without activating them.

## Remaining gates

Full legacy Health read/use/derived/AI/native/UI suppression and Activity File processing are not complete. New-ingress filtering alone is insufficient for commercial Activity-only readiness. Large-payload ingress/durable receipt, portal tier mapping, endpoint configuration, two internal users, Data Generator/Partner Verification, current-device UX/brand evidence and privacy approval remain open. Training/Courses transfers are outside the requested scope.

Before any production deployment, reconcile PR147's manually published privacy baseline with main. Main retains older policy text and a normal deployment could restore it. The Garmin-specific OpenAI disclosure finding remains valid against current code; proposed changes stay private until written Garmin approval. No commercial activation follows from Internal Test approval.
