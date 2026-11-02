## Superseding approved execution

The founder approved steps1–5 after reviewing the handoff: dependency repair/install, inspect Vercel, then release147→149→150 with setup and one fictional test/readback/cleanup. Historical “no permission” statements below describe the preparation stage. Two new audit blockers were cleared via targeted overrides minimatch11.0.1 and glob>=9→14.0.2 in an isolated install. No allowlist additions. Current audit-ci moderate policy PASS; two existing documented Vitest advisories remain. Broader validation completed after the repair: full suite1,483 passed/2 skipped (184 test files passed,1 skipped); lint0 errors/1,657 warnings; type-check PASS; production build PASS; audit-ci moderate PASS. File-discovery/Minimatch include-exclude smoke PASS. The beta candidate also passes26 focused tests and6 script tests on the same repaired install. Live release evidence remains pending.

# RunSmart web PR readiness — 2 November 2026

Scope: #147 privacy → #149 Road-to-$10K decision record → #150 beta funnel.
No T7/iOS/voice changes, #152 edits, Resumely work, external writes, paid calls,
dependency installs, commits, pushes, branch merges or deployments performed.

## Evidence and local composition

Remote main verified at `33dcbc4fcce380691bbb10975ca76fe3213cc8c5`.
PR147 head `2cc608eb68aa992c385c620a15e141e37a17efe0` remains open, with the
Garmin/OpenAI review thread unresolved. The source now restores that disclosure and
updates the policy date locally, with a red-first regression test (failed before fix;
6/6 passed after). Historical native storage, Health, sharing and account-linked
analytics disclosures remain intact. The old manual October publication was later
replaced: current public GET /privacy is 200 with February 2, 2026; /beta is 404.
The old “published” statement in PR147 must not be treated as current runtime truth.

PR147's quality/security failures were the 23 October audit-ci steps (12 reported
vulnerabilities, not a privacy test failure). Main's merged #151 fixes are copied
locally into the PR147 working tree, including package/lockfile, audit config and
Zod4 API compatibility edits. This is an uncommitted working-tree reconciliation;
HEAD and index were not merged or advanced. The copied v0 files match origin/main
except privacy and its tests. The dependency symlink now points to the existing
#151 dependency tree used by PR150; overlapping installed-lockfile versions match
with zero mismatches. No dependencies installed.

PR149 head `3a27ec25f566b4fbb8a84e4fb56299d7c21b30e1` remains unchanged and clean.
Only its three documented files differ from main. No unresolved inline review.
Exact-head Codex clean receipt and green hosted checks verified. Recalculated kept
amounts: $7.44/$9.90/$11.54/$4.57; required payer counts 1,344/1,010/866 agree.
The plan remains a dated founder-approved model, not verified recruitment, revenue,
current analytics or proof of Small Business enrollment. No strategy changes needed.

PR150 head `5d2ac9df6ce65a634df80ce58224ea541baf85c8` remains open. Both prior
inline findings are resolved; no unresolved inline thread. Existing hosted checks
are green at that head, with current Codex clean receipt. Local script regression
proved missing/duplicate headers returned success; fixed by requiring each of the
13 registration headers exactly once before appending. Script is pinned to the
read-only verified `Untitled` tab, ID1723145691. Six local script tests pass with
in-memory API stand-ins. No Google write occurred.

The beta working tree also copies PR147's privacy page/tests and PR149's two plan
documents for combined validation; beta privacy additionally discloses the Google
Sheet, participation email and removal request. These predecessor copies must be
reconciled after upstream merges before committing the #150 update. Its independent
old head must not be promoted over the corrected policy.

## Checks completed

- Privacy: red-first regression, then 6/6 pass on PR147; lint 0 errors/1,657 existing
  warnings; type-check pass; production build pass on reconciled source.
- Beta original route/analytics: 19/19 pass; lint 0 errors/1,657 existing warnings;
  type-check and targeted route/test/page type-check pass; production build pass.
- Combined privacy/beta route/analytics: 26/26 pass (7 privacy, 11 route, 8 readiness).
- Apps Script: 6/6 pass (ID/header order/formula/founder fields/secret/missing row/
  missing and duplicate headers). Both new header tests failed before the code fix.
- PR149 docs delta whitespace check and financial arithmetic pass. No app tests
  needed for the unchanged docs-only branch.
- No full-suite rerun: focused behavior and builds checked; earlier reported full
  suite had 1,491 pass/2 fail/2 skip, both failures reported to reproduce on main.
  That historical report is not a full-suite pass in this session.

Final combined browser/build evidence and screenshots are in the beta worktree's
`docs/qa/web-readiness-2026-11-02/` and its README. Runtime proof against Google remains
pending even if the local stand-in succeeds.

## Current security gate — BLOCKED

Fresh audit-ci at moderate policy fails after carrying #151: new unallowlisted
`GHSA-3g3m-2fjr-6pw4` (glob) and `GHSA-g3hv-75wg-m249` (minimatch). npm audit on
PR150 reports 20 moderate affected dependency entries, 0 high, 0 critical; entries
include transitive effects and pre-existing allowlisted Vitest issues. Do not call
this clean or use old hosted success as current security clearance.

Primary advisory records: https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 and
https://github.com/advisories/GHSA-g3hv-75wg-m249 . Patched versions listed there are
glob14.0.2 and minimatch11.0.1. Both can require major compatibility changes for
callers. No new overrides/allowlist waivers or untested lockfile edits were made.
Permission is required for the dependency installation/remediation pass by the
user's explicit track restriction; do not bypass it.

## Remaining release gates and approval

1. Approve local dependency remediation/install only, resolve current blockers,
   validate, then review the final diff and updated hosted checks.
2. Authorize commit/push for #147/#150. No local-only commits exist now; all new
   changes are uncommitted. Review thread resolution/comment posting not performed.
3. Named merge/deployment approval in order147→149→150. Main merges automatically
   deploy via Vercel, including docs-only149. Preserve corrected native privacy.
4. Beta Apps Script + Production environment setup, staged build, one authorized
   fictional registration/readback/cleanup, then named public release approval.
   Exact target/settings/payload/rollback are in beta `docs/beta/README.md`.
5. Vercel connector team-scope403 prevents current project/env verification. Founder
   needs team-access consent before retry. Sheet metadata/headers verified read-only;
   participant rows and Apps Script deployment were not inspected.
6. Founder verifies support mailbox delivery separately; no message was sent.
   No tester recruitment, invitations, billing or public post permission inferred.

Readiness:147 source issue fixed locally but security/review/release blocked;
149 ready for founder docs approval after147;150 local fixes/setup package ready,
security/setup/live-registration proof still blocked. Do not merge/deploy yet.

## Retrospective

Durable source reconciliation matters more than a historical manual deployment.
Current audits caught drift that older green checks missed. Header-only reads were
sufficient to validate the sheet contract without exposing participant data. Keep
this order and evidence boundary in future release handoffs; no skill edits needed.
