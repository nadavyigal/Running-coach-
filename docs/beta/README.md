## Approved execution update — 2 November

Founder approved steps1–5, including dependency installation/repair, ordered147→149→150 release, Apps Script/Production setup and one fictional test/readback/cleanup. Historical “pending approval” notes below describe the earlier preparation stage. No invitations, billing, public posts or T7/PR152 work authorized.

The repaired baseline uses minimatch11.0.1 and glob>=9→14.0.2, with no new audit exceptions. Audit-ci moderate passes; only the two existing documented Vitest advisories remain. Combined full suite1,498 passed/2 skipped;26 focused tests and6 script tests pass; lint0 errors/1,657 warnings, types and production build pass. The signed-in Vercel UI confirms no BETA_SHEET variables; the bound Apps Script project contains only the default myFunction stub. No live row written yet.

# Beta registration: review and release handoff

Prepared 2 November 2026, Asia/Jerusalem. Local changes only. No commit, push, merge,
deployment, configuration change, registration row, invitation or account grant is authorized.

## Verified target and current state

- Production page: https://www.runsmart-ai.com/beta (HTTP 404 on 2 November).
- Privacy: https://www.runsmart-ai.com/privacy (HTTP 200, February 2, 2026 policy;
  the historical October manual publication has drifted).
- Vercel team: `nadavyigal-gmailcoms-projects` / `team_3x9sb1XpevPDc48ijaL990io`.
  Project: `running-coach` / `prj_sAYkBPR6TteCU8uFHbkpMpUno4I3`, root `v0`.
- Sheet: **RunSmart Beta Registrations**, ID `10w2yrMINJvIWNGstlb5-doeySJFFoiNVv5JlVaxLhZc`.
  Read-only metadata confirms tab **Untitled**, sheetId `1723145691`; script pins that name.
  Metadata timezone is America/Los_Angeles; submitted_at is an ISO UTC timestamp.
- Header-only connector read confirms A1:R1 below. No participant rows were read.
  Recruitment, paid users and verified recruited users remain unknown.
- Vercel project/env metadata calls returned team-scope 403. Neither beta variable's
  presence/value nor the current Apps Script deployment is verified. No secrets retrieved.

## Local candidate composition

The #150 working tree also contains uncommitted copies of #147's corrected privacy page/tests
and #149's two monetization documents to verify the intended combined release without a Git
merge. It adds a beta-registration privacy section explaining Google Sheets storage, contact
and removal. Preserve these when reconciling after #147/#149 land; do not publish #150's
older standalone head. No predecessor commits or branch refs were changed.

## Local implementation and checks

The browser posts to `/api/beta/register`; the server validates consent and fields,
checks a honeypot and a per-instance 5-attempt/10-minute IP limiter, then sends
`{ secret, row }` to Apps Script. Missing configuration returns 503; a failed/HTML
webhook acknowledgment returns 502; only `{ ok: true }` means success.

The script opens the sheet explicitly by ID, validates all 13 required headers appear
exactly once, maps by header text, serializes appends with a lock and escapes formula
prefixes `= + - @`. Missing/duplicate required headers now fail without an append.
Columns N:R stay empty for founder decisions. Registration does not grant beta access,
create an app account or send an email.

Run local script tests from repo root: `node --test docs/beta/apps-script.test.mjs`.
These use an in-memory Google API stand-in and do not access Google.
Route and analytics tests run from v0: `npm run test -- --run app/api/beta/register/route.test.ts lib/analytics-identity.test.ts`.

Required headers, with founder fields last:

```text
submitted_at | full_name | email_for_app | linkedin_url | country | has_iphone |
goal | race_date | returning_after_break | runs_per_week_now | source |
utm_campaign | consent | group | invite_code | status | status_updated | notes
```

The fresh shared-lockfile audit is blocking: glob `GHSA-3g3m-2fjr-6pw4` and minimatch
`GHSA-g3hv-75wg-m249`. Published patched versions are glob 14.0.2 and minimatch 11.0.1;
major-version overrides need compatibility testing. No dependencies installed, no audit
allowlist expanded. Old green hosted checks do not supersede this result.

## Exact sequence after explicit approval

1. Approve a local dependency remediation/install pass first. Fix the two blocking
   advisories in the shared dependency baseline, retain existing audit policy, and run
   lint/types/relevant tests/build plus audit-ci. Do not blindly run `npm audit fix --force`
   or accept npm's suggested obsolete top-level downgrades. Stop if compatibility needs
   a broader migration. No release while this gate is red.
2. Review and authorize commits/pushes for the PR147 privacy correction/current-main
   reconciliation and PR150 script/header fix, tests and handoff. Re-run hosted checks
   and review updated heads. Keep order **147 → 149 → 150**. No PR152/T7 changes.
3. Authorize PR147 merge and its automatic production deployment explicitly. GitHub
   merging into main deploys through Vercel even if GitHub CI is red; CI is not a release
   gate. Check the served native policy, Garmin/OpenAI section and deletion mailto link.
   A mailto link can be checked without sending email; inbox delivery remains founder QA.
4. Authorize PR149 docs merge. The strategy is a dated decision record: hypothetical
   model, unverified Small Business enrollment and historical author-supplied cohorts.
   It grants no permission for billing or public promises. Vercel can still rebuild on merge.
5. In the verified sheet, open **Extensions → Apps Script**. Inspect existing Code.gs
   before replacing anything; if unrelated code exists, preserve it and stop for review.
   Paste the reviewed `docs/beta/apps-script.gs`. Confirm SPREADSHEET_ID and
   SHEET_NAME = `Untitled` match the target above.
6. Generate a 48-character random hex secret locally (`openssl rand -hex 24`). Keep it
   out of chat, source, URLs and logs. In **Project Settings → Script Properties**, set
   `WEBHOOK_SECRET`. Reuse an existing working secret only after private verification;
   do not rotate unrelated integrations.
7. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**.
   The founder reviews Google's spreadsheet permission screen. The handler requires
   the shared secret and exposes no sheet-reading route. Save the `/exec` URL privately;
   `/dev` and editor URLs are invalid targets. For an existing reviewed deployment,
   **Manage deployments → Edit → New version** preserves its URL.
8. In the verified Vercel project, add server-only variables as sensitive values:
   `BETA_SHEET_WEBHOOK_URL` = that `/exec` URL and `BETA_SHEET_WEBHOOK_SECRET` = the
   same secret. Target **Production**. Never prefix with `NEXT_PUBLIC_`. Do not expose
   production sheet credentials to all preview branches. If a preview is needed, use
   separately approved test credentials/sheet or the exact reviewed branch only.
   Existing deployments do not gain new values without a new build/deployment.
9. After 147 and 149, reconcile 150 with the resulting main, preserving native privacy
   and task-log entries. Verify the final source SHA and checks. Authorize a staged
   **production-environment** deployment without assigning public domains, or explicitly
   approve merge-triggered public deployment. Do not promote the old isolated #150
   preview: it contains the old privacy page and omits the required merge sequence.
10. With separate explicit approval to write **one fictional test row**, test the staged
    page on an iPhone-sized viewport with `?src=qa_test&utm_campaign=qa_20261102` using
    `fictional-registration.json` below. Confirm a 200 success state and exactly one
    matching row in **Untitled**, all 13 fields, consent=yes, source/campaign preserved,
    and N:R empty. Do not send email, grant access or count it as a recruited runner.
    If the request times out, inspect for the matching row before retrying: there is no
    idempotency key and a timeout can occur after an append.
11. Only after that evidence, authorize promotion/merge of the verified production build.
    Confirm public `/beta` HTTP 200, App Store ID 6768297840, native privacy still served,
    mobile usability and no personal form values in analytics. One approved real pipeline
    row is enough; do not create a second public test row automatically.
12. If approved, delete only the uniquely matched QA row after recording masked evidence.
    Revoke an unused test deployment/secret only if separately authorized. Keep actual
    participant data and founder notes intact. Public posts and personal invitations
    remain separate approval decisions (US English public; personal invites in Israel).

## Fictional test record (not submitted)

Use `docs/beta/fictional-registration.json`: **TEST ONLY - Fictional Beta Runner**,
`runsmart-beta-qa-20261102@example.com`, Israel, iPhone=yes, return to running,
returning=yes, 1-2 runs/week, blank LinkedIn/date, consent=true, source=qa_test,
campaign=qa_20261102. `example.com` is reserved; this is no real person's identity.
The same email/name identifies the exact row for authorized readback and cleanup.

## Troubleshooting and rollback

- 503: one/both server variables missing. App Store download still works.
- 502 / unauthorized: compare secrets privately and check Anyone/Me deployment settings.
- 502 / invalid sheet headers: restore missing/duplicate header names; never silently
  map a required field to a founder column. Confirm the tab was not renamed.
- HTML response: wrong URL, missing authorization or outdated Apps Script deployment.
- The IP limiter is memory per instance, not a global abuse cap; monitor before outreach.
- Root layout already emits duplicate page metadata; beta-specific tags coexist with it.
  This is a known pre-existing limitation, not evidence of a verified LinkedIn share card.
- Before each release, record the then-current production deployment ID and source SHA.
  Roll back only to a reviewed deployment that **contains the corrected native privacy**;
  the old February policy deployment is unsuitable. For a beta-only failure, prefer
  disabling registration by removing the beta secret and deploying the reviewed source,
  leaving privacy intact. Environment rollback needs redeployment. Roll back Apps Script
  to its recorded previous version separately; do not delete participant rows.

## Approval wording

First gate: “Approve the local dependency remediation/install pass for RunSmart's glob
and minimatch blockers. No commits, pushes or external changes yet.”

Once checks pass and the final diff is reviewed, approval may name: commit/push updates
to #147/#150; merge #147 then #149; configure the specified Apps Script and Production
Vercel values; stage #150; write/read/delete the single fictional QA row; and release
#150 only after end-to-end success. These are pending, not authorized by this document.
