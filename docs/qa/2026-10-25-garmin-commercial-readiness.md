# Garmin commercial readiness QA — refreshed 26 October 2026

Recommendation: keep PR148 in draft. Scoped code is reviewable; commercial launch and production deployment are blocked. Founder-reported public1.2.0 is the current device baseline; no obsolete build36 upload blocker applies.

## Final behavior under review

- Next16 promised webhook params and tracked post-response persistence retain auth/duplicate/deregistration handling.
- Current shared partner-gateway user endpoints; callback accepts object-wrapped/legacy-array permissions and empty grants.
- Default/unknown access tiers are push-only. Initial/manual/worker history requires explicit Enterprise configuration and history permission. Direct legacy range APIs reject Starter without upstream calls. One-time Activity File retrieval remains available.
- Default new ingress removes Health/unknown datasets before raw-event persistence; export-store Health writes/reads are blocked. Status/diagnose do not demand Health permission when disabled.
- Permission-only notifications update scopes without deleting still-valid tokens or overwriting status. Malformed/sequential stale events are ignored; ordering is not atomic across concurrent DB writers. Queued Activity imports skip processing after scope removal.
- Disconnect calls the documented registration DELETE before OAuth revocation, uses the current rotated token pair and reports upstream failure honestly while preserving local cleanup.
- Safe Next/DOMPurify/Vite patches remove the critical audit findings; no audit gate or allowlist changes.

## Validation

Run app commands from v0. Final result: 106 tests in 16 files PASS; slim type-check and CI-equivalent TypeScript PASS; lint PASS with 0 errors and 1,657 warnings; production build PASS; configured audit-ci FAILS the two migration advisories listed below. Commit/head are recorded in PR148. Commands:

```sh
npm run test -- --run --config vitest.garmin-readiness.config.ts
npm run type-check
npx tsc --noEmit
npm run lint
npm run build
npx audit-ci --moderate --config .audit-ci.jsonc
```

The focused Node configuration exercises server contracts without browser/IndexedDB setup. Red-first regressions captured: promised params/lifetime, missing history permission, stale Starter history grant, mixed raw/store Health persistence, permission handler module, object-wrapped OAuth scopes and registration deletion. Legacy Enterprise tests explicitly opt in rather than silently treating Starter as full access. Independent QA found and corrected a Health-only-notification enqueue regression caused by filtering; regression coverage was added.

Build on Next16.4.3 completed locally. Full CI-equivalent TypeScript and lint outcomes are recorded in final progress. This is not a full browser suite or real-device Garmin validation claim. No UI or native source changed. Dependencies are installed in a dedicated off-Documents directory; no shared dependency install was mutated.

## Known audit blockers

Audit improved from2critical/2high/2moderate to0critical/1high/2moderate. Unresolved Zod GHSA-mrhx-c7xc-m3w5 requires4.6.6+ from current3.25.76; Vitest mocker GHSA-qxg6-89mg-rqv8 requires4.1.12+ from current3.2.7. Existing GHSA-82fw-gwwq-j7x9 remains in the raw audit with its pre-existing allowlist treatment. No new exceptions. Major Zod/Vitest migrations are broader compatibility work; do not report CI green or disable the checks.

## Remaining launch/deployment gates

- Full legacy Health data read/use/AI/native/UI gating is not complete. Ingestion filtering alone does not remove stored wellness influence. Activity File pipeline/old queued-file revocation still need end-to-end proof.
- Current Vercel request ingress4.5MB is below the case-specific10/100MB requirement: https://vercel.com/docs/functions/limitations . No huge request was posted to production. Need compatible/durable receiver or Garmin-approved configuration; after() is not durable acceptance.
- Portal mapping/current commercial approval, approved privacy baseline, API Tools configuration and two-user Data Generator/Partner Verification evidence remain open. No credentials or endpoint settings changed; no OAuth consent triggered.
- Live policy was manually deployed from still-open PR147, while main has older policy source. Deploying this branch could restore older policy. Reconcile approved source before any production deployment. PR147's Garmin-specific OpenAI omission remains valid against actual processing code; proposal is private pending written Garmin approval.
- A prior hosted clean review covers only its reviewed head. Updated code needs review for the new head; do not reuse a stale clean receipt.

## Rollback and authorization

No schema migration or live environment change. Revert the code patch if behavior regresses; do not use rollback as permission to republish unapproved privacy text. No merge/deployment, commercial connection enablement, credential change, message/application submission or privacy publication occurred in this session.
