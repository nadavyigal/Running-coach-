## Current result — 2 November, after live integration QA

Google authorization is complete, with the founder's explicit at-screen approval of the single all-spreadsheets scope. The handler still opens only the fixed beta spreadsheet and checks the shared secret. Google deployment version2 is active at the same /exec URL; no additional Google scopes, sharing change or new credential was introduced for version2.

Both Vercel values are Secret and Production only. A wrong-secret POST returned {ok:false,error:unauthorized}. Staged production deploymentdpl_6HTyBcvP5rucC4e9s5UvXi5gGJH8 is Ready using commitcc26d4f2 application source and the actual Production values. It is not assigned to www.runsmart-ai.com; public /beta still returns404 and the corrected native policy remains served. The staged URL is reachable without login; it must not be described as a private deployment or shared as a public launch.

At375px, the staged form hydrated with no horizontal overflow, correct App Store ID6768297840 and Smart App Banner. Live form submission showed success and created exactly one matching fictional row. Raw CellData found that1-2 was initially a date serial. That row was removed. A red-first regression was added, literal-text handling fixed and Google version2 deployed with identical source readback. Reused the same fictional identity once after cleanup: all13 fields matched, every nonempty raw value was a string (including1-2), five founder fields stayed blank. Removed that record and verified0 remaining matches. Two QA submissions used one fictional identity, never overlapping stored rows. No emails sent or accounts/beta access granted. Evidence: live-runtime-proof.json, live-registration-success-v2.png and sheet-after-test-cleanup.png. Current script tests6/6 PASS; the web-app source is unchanged from the earlier1,498-pass/2-skip full suite.

### Hosting eligibility gate — public release held

Current connected Vercel account/team is nadavyigal-7990 / nadavyigal-gmailcoms-projects, Hobby; CLI teams list contains only that team. Projectprj_sAYkBPR6TteCU8uFHbkpMpUno4I3 / running-coach, rootv0, Node22.x. The initial deployment block was specifically author-email mapping, resolved using the verified owner identity from the successful main merge; it was not evidence of a missing paid seat. No paid collaborator, plan upgrade, trial, public repository conversion or access change was used to bypass that block.

Official current Hobby policy restricts the plan to non-commercial personal use: https://vercel.com/docs/plans/hobby . RunSmart's business beta includes planned pricing, so commercial eligibility is not established. The founder's new plan/account preference requires a concrete decision before public promotion or merging150. Pending choices: verify existing commercial permission/another plan; review hosting options and exact costs; or hold the public beta. No paid action authorized or taken. Google consumer-account capabilities are supported by the published quotas: https://developers.google.com/apps-script/guides/services/quotas . No Workspace subscription was assumed.

PR147 and149 remain merged/deployed. PR150 remains open and technically validated, with public merge/promotion held for hosting eligibility. The older handoff record below is superseded where it differs.

## Updated execution — Google and Vercel setup completed

The founder explicitly confirmed the Sheets permission at Google's consent screen after being told it covers all spreadsheets. Project owner/container and the single spreadsheets scope were verified. Saved Google handler text matches the tested repository source exactly. Google authorization completed; web-app version1, execute as Me, access Anyone, deploymentAKfycbx8pxyZYvVNQvb0gvx6lXaEdoTa1zxTut4IsLy1cwz8jDKRjJUqm6Zrv6qRWBrgmtgpeg.

Copied the existing user-saved WEBHOOK_SECRET privately into Vercel. Both BETA_SHEET_WEBHOOK_URL and BETA_SHEET_WEBHOOK_SECRET are now saved as Secret, Production only. No secret value was printed or written to local files. The browser runtime copy was cleared. UI readback confirms both scopes/types. The source still rejects missing/wrong secrets.

Pre-test sheet search for the unique fictional email returned0 matches; no participant records were read. The first staged production deployment9Q8rCmsPe1wWfHHMfeRxgdFSSNJX was blocked before building because CLI commit emailnadav@runsmart.dev was not mapped to a Git account. Public production stayed unchanged. The successful merged main commit identifies the owner asnadavyigal <nadav.yigal@gmail.com>; the next documentation-only commit uses that verified owner identity without changing global/repo git configuration. Staging will be retried with that attribution. Live test/promotion still pending.

The statements below are the earlier handoff record and are superseded by this update.

# Approved release progress — 2 November 2026

Founder approved steps1–5 in chat. The earlier local-only restriction was superseded
for dependency repair/install, ordered147→149→150 release/setup and one fictional
registration/readback/cleanup. Billing, posts, invitations, T7 and PR152 remain outside scope.

## Completed

1. Targeted dependency repair: minimatch11.0.1, glob>=9→14.0.2. Installed in
   /Users/nadavyigal/Developer/runsmart-web-deps/release-2026-11-02. Prior dependency
   trees untouched. audit-ci moderate passes with only the two existing Vitest exceptions.
2. PR147 updated, reviewed disclosure thread resolved, all hosted checks passed,
   merged at3dc61d749cf2a10be0ede479529882eb42b0d87e.
   Production deployment: https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/3iDmg3VYqChdexrSdbeyo97x7qcb
   GitHub Production deployment7493178040. Public/privacy200 verified November2
   date, native storage/Health/sharing, explicit Garmin/OpenAI and deletion mailto.
   Local full suite1,483 passed/2 skipped; lint/types/build passed.
3. PR149 docs-only plan merged atc789a102d84a0217fa656cf641669eedb33f7811.
   Production deployment: https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/5GxLzErco1qLUuFdXPN2L1xKHiZz
   GitHub Production deployment7493267287. Native policy preserved after this deployment.
4. PR150 reconciled with both predecessors and pushed ata1e34da40ebb1463a5780409c6fc1b910abfc590.
   All hosted checks pass at that head. Preview deployment:
   https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/2k5BSDjggv42v6N2ZQDRXhgduPTz
   Full combined suite1,498 passed/2 skipped;26 focused tests and6 script tests passed;
   lint/types/production build pass. API/analytics/browser source unchanged by the
   final main merge; only task/history records needed conflict reconciliation.
5. Saved reviewed Apps Script handler in the sheet's bound project (replaced only
   default myFunction stub). Whole-editor text readback found an escaped-hyphen
   transport issue; corrected to an equivalent trailing-hyphen character class,
   updated repo source and numeric/date-string regression, reran6 script tests.
   Source and editor agree. No execution, web-app deployment or sheet append yet.

## Required user secure step (question already pending)

Apps Script settings open at:
https://script.google.com/u/0/home/projects/1MwmE4xomIV2fyQ8ZCDjq51ZRcNC71KH_KirMLAMW4QXwWU3POONbwZ0I/settings

Property name WEBHOOK_SECRET is prepared, value blank. Browser security rules require
user entry of the new credential and Google permission approval. User must save one
random secret; deploy web app Me/Anyone after reviewing Google scopes; save its /exec
URL as BETA_SHEET_WEBHOOK_URL and the same secret as BETA_SHEET_WEBHOOK_SECRET in
Vercel running-coach Production (secret type Secret). Do not paste secret into chat.
Screenshot script-secret-handoff.png contains no secret.

Vercel connector still returns team-scope403, but the existing local CLI sign-in works.
Project inspection confirms projectprj_sAYkBPR6TteCU8uFHbkpMpUno4I3, team
team_3x9sb1XpevPDc48ijaL990io, rootv0, Node22.x. CLI linked the beta repo root locally
(.vercel/project.json ignored); no project setting changed. No connector consent
needed to continue with this authenticated fallback. Earlier signed-in UI search
showed no BETA_SHEET values. Do not retrieve/decrypt unrelated secrets.

## Next actions after user confirms setup

- Verify only beta environment metadata and Apps Script deployment identity.
- Stage this exact reconciled PR150 source with Production settings without assigning
  public domains (CLI deploy --prod --skip-domain in the verified linked repo root).
  Do not use local .next output built with fictional keys. Remote build uses the
  approved project's Production settings. Inspect resulting source SHA and ready state.
- On the staged page, submit exactly one fictional fixture from
  docs/beta/fictional-registration.json with sourceqa_test/campaignqa_20261102.
  Confirm200/success and exactly one matching Google row, all13 supplied fields and
  five blank founder fields. If timeout, search for it before retrying (no idempotency).
- Delete only that disposable, uniquely matched QA row after masked readback.
- Merge150/promote only after runtime proof, then verify main production SHA,
  public/beta200 and corrected native/beta privacy. Avoid competing deployments
  completing out of order. Record final deployment ID and public results.
- No real users, invitations, payments or emails inferred/authorized.

## Worktrees and status at handoff

- /Users/nadavyigal/Developer/runsmart-web-worktrees/privacy-native-strava-2026-10-23,
  branchcodex/privacy-native-strava-2026-10-23: clean, zero local-only commits; PR147 merged.
- /Users/nadavyigal/Developer/runsmart-web-worktrees/road-to-10k-plan-2026-10-29,
  branchdocs/road-to-10k-plan-2026-10-29: unchanged/clean, zero local-only commits; PR149 merged.
- /Users/nadavyigal/Developer/RunSmart/.claude/worktrees/busy-euler-cf7894,
  branchclaude/beta-landing-page-b41d9c: code fully pushed, zero local-only commits;
  this progress note and secret-free handoff screenshot are local handoff artifacts.
  PR150 remains open, pending secure setup and live integration proof.
