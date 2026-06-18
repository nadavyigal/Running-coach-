# Garmin Production Enablement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get RunSmart promoted from Garmin's Evaluation environment to Production, unlocking unlimited users, all 15 data types, and backfill — timed so Production is live before App Store launch.

**Architecture:** No new code. Four sequential tasks: (1) confirm the P0 fixes are live and healthy, (2) finalize and publish the privacy policy, (3) take required screenshots, (4) submit the Production enablement request to Garmin Developer Support. Post-approval tasks (5-6) run after Garmin responds (~2-4 weeks later).

**Tech Stack:** Next.js 14 App Router, Supabase, Vercel (env vars), Garmin Developer Portal, Garmin Developer Support email.

---

## What "Production" Means and Why It Matters

Garmin's Developer Program has two tiers:

| Capability | Evaluation (current) | Production |
|---|---|---|
| Registered users | ~10 (manually registered by you in the portal) | Unlimited — any Garmin user can connect |
| Backfill (90-day history) | Not provisioned (`400 Endpoint not enabled`) | Available via `HISTORICAL_DATA_EXPORT` |
| Live webhook pings | Only for registered test users | All users |
| Rate limits | Low | Standard production limits |
| Endpoint coverage | Restricted (sleep, HRV, etc. may 404) | All 15 data types enabled |
| Credentials | Evaluation Consumer Key / Secret | New Production Consumer Key / Secret |
| Cost | Free | Free (approval is a compliance/trust gate, not a payment) |

**Why the sync "is not working so good" right now:**
- Evaluation restricts you to ~10 test users. Anyone else who connects gets a token that passes OAuth but hits 400/404 on every data endpoint — their data is simply never imported.
- Endpoint errors documented in `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md` confirm this: `InvalidPullTokenException`, `Endpoint not enabled for summary type: CONNECT_ACTIVITY`, sleep endpoints returning 404.

**What changes technically after Production approval:**
- New GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET (separate from Evaluation). Update in Vercel.
- Existing test users who authorized under Evaluation credentials will need to re-authorize under Production credentials. This causes a one-time reconnect prompt.
- Webhook URL must be registered in the Production app in the Developer Portal (same URL: `https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>`).
- Token refresh and revoke now use the correct `diauth.garmin.com` domain (fixed in the P0 plan).
- Backfill becomes possible — when a new user connects, RunSmart can pull up to 90 days of history.

**When is the right moment?**
Submit the Production request as soon as:
1. P0 fixes are live in production (token refresh works, daily metrics store)
2. Privacy policy is published at `runsmart-ai.com/privacy` with Garmin section filled in
3. Screenshots are ready

Garmin's review takes 2-4 weeks. You want Production credentials in hand **before** App Store launch. Submit the moment you can, so the review runs in parallel with other development work. Do not wait for the App Store to be ready.

---

## Existing Materials (Pre-Built — Read Before Doing Anything)

| File | What it is | Status |
|---|---|---|
| `docs/garmin-developer-application.md` | Filled application for initial Evaluation access | Complete — already submitted (gives us the Dev Portal access we have now) |
| `docs/garmin-portal-create-app-setup.md` | How to create the app in the Dev Portal | Done for Evaluation; need a Production-level app after approval |
| `docs/garmin-application/00-APPLICATION-COPYPASTE.md` | Older template with `[[FILL:...]]` placeholders | Superseded by the filled version |
| `docs/garmin-application/02-DATA-FLOW-SECURITY.md` | Security narrative for Garmin | Has `[[FILL:...]]` gaps — not needed for the request, useful for Garmin's review |
| `docs/garmin-application/04-GAPS-AND-TODO.md` | Checklist of gaps before submission | Review — most items blocked on privacy policy |
| `docs/garmin-application/05-DRAFT-PRIVACY-POLICY-GARMIN.md` | Draft Garmin privacy section | Has `[[FILL:...]]` gaps — Task 2 fills these |
| `docs/garmin-application/08-SCREENSHOT-CHECKLIST.md` | 5 required screenshots | Not yet taken — Task 3 |
| `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md` | Support ticket to Garmin to upgrade to Production | Ready to send — Task 4 |

---

## File Map

| Action | File |
|---|---|
| Modify | `v0/app/landing/privacy/page.tsx` (add Garmin data section) |
| Modify | `docs/garmin-application/05-DRAFT-PRIVACY-POLICY-GARMIN.md` (fill placeholders) |
| Create | `docs/garmin-application/screenshots/` folder with 5 PNGs (manual step) |
| No code change | Tasks 1, 3, 4 — diagnostic run, screenshots, email submission |

---

## Task 1: Confirm P0 Fixes Are Live (Gate Check)

Before submitting anything to Garmin, the integration must actually work. A broken integration at submission time risks rejection.

**Files:** None — this is a diagnostic-only task.

- [ ] **Step 1: Confirm the P0 plan's three commits are merged and deployed**

```bash
cd /Users/nadavyigal/Documents/RunSmart
git log --oneline origin/main | head -10
```

Expected: you see commits for:
- "fix: correct Garmin OAuth token/revoke domain from connectapi to diauth"
- "fix: add missing garmin_daily_metrics extended columns to schema"
- "fix: correct HRV field name extraction to match Garmin API response"

If not: wait for the P0 plan to complete and deploy before continuing.

- [ ] **Step 2: Verify the migration is applied in production**

Open Supabase Studio for the RunSmart project. Run:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'garmin_daily_metrics'
  AND column_name IN (
    'body_battery_charged', 'body_battery_drained', 'body_battery_balance',
    'spo2', 'respiration_rate', 'skin_temp_c',
    'blood_pressure_systolic', 'blood_pressure_diastolic'
  );
```

Expected: 8 rows returned. If fewer: run the migration `20260615000000_garmin_daily_metrics_extended_columns.sql` against production.

- [ ] **Step 3: Run the diagnostic endpoint against production and capture the JSON**

As a logged-in user who has Garmin connected, call:

```
GET https://runsmart-ai.com/api/devices/garmin/diagnose
```

Save the full JSON response. You will attach this to the Garmin support ticket in Task 4.

In the response, verify:
- `garminToken.valid: true` — token refresh now works (confirms domain fix)
- `garminProfile.status: 200` — user profile API reachable
- `garminPermissions` includes `ACTIVITY_EXPORT` and `HEALTH_EXPORT`
- Daily metrics upsert no longer appears in `errors` (confirms migration fix)

If `garminToken.valid` is false: the P0 token URL fix is not yet deployed. Stop — do not proceed.

- [ ] **Step 4: Trigger a manual sync and verify data appears in Supabase**

In the RunSmart app, trigger "Sync Garmin" from the profile screen. Then check Supabase:

```sql
SELECT date, steps, hrv, resting_hr, stress, body_battery, sleep_score, updated_at
FROM garmin_daily_metrics
WHERE user_id = <your-user-id>
ORDER BY date DESC
LIMIT 7;
```

Expected: rows exist with non-null values for at least some fields. If all fields are null: the analytics store is still failing — debug before proceeding to Task 2.

---

## Task 2: Finalize and Publish the Privacy Policy

Garmin explicitly requires a live privacy policy that mentions Garmin data collection before they approve Production. The draft exists at `docs/garmin-application/05-DRAFT-PRIVACY-POLICY-GARMIN.md`. The live page is at `v0/app/landing/privacy/page.tsx`.

**Files:**
- Modify: `v0/app/landing/privacy/page.tsx`

- [ ] **Step 1: Read the current live privacy page**

Open `v0/app/landing/privacy/page.tsx`. Locate the existing sections — find where to insert the Garmin data section. It should go after the "What we collect" intro and before the "Analytics" section.

- [ ] **Step 2: Add the Garmin section to the live privacy page**

Insert this section into `v0/app/landing/privacy/page.tsx` in the appropriate position (after general data collection, before analytics):

```tsx
<section className="mb-8">
  <h2 className="text-xl font-semibold mb-3">Garmin Data (if you connect a Garmin device)</h2>
  <p className="mb-3 text-gray-700">
    If you choose to connect your Garmin account, we import completed running activities and 
    wellness data from Garmin after you explicitly authorize access via Garmin's OAuth flow. 
    You can disconnect at any time from your profile settings.
  </p>
  <p className="mb-3 text-gray-700">Imported data may include:</p>
  <ul className="list-disc pl-6 mb-3 text-gray-700 space-y-1">
    <li>Activity records: timestamps, distance, duration, pace, elevation, GPS track</li>
    <li>Heart rate: per-activity averages, resting heart rate, HRV (last night and weekly average)</li>
    <li>Wellness: sleep quality and duration, daily stress, body battery, steps</li>
    <li>Training: VO2 max estimates, training load (when available from your device)</li>
  </ul>
  <p className="mb-3 text-gray-700">
    This data is used exclusively to power your coaching insights, training plan adjustments, 
    and recovery recommendations inside RunSmart. We do not sell or share Garmin data with 
    third parties.
  </p>
  <p className="mb-3 text-gray-700">
    <strong>Token storage:</strong> Garmin OAuth tokens are stored server-side in our database, 
    encrypted at rest using AES-256-GCM. Tokens are used only to fetch your data and are 
    deleted when you disconnect Garmin.
  </p>
  <p className="mb-3 text-gray-700">
    <strong>Disconnecting:</strong> Go to Profile &rarr; Device Settings &rarr; Disconnect Garmin. 
    This deletes your stored Garmin tokens and stops all future imports. Imported activity records 
    remain in RunSmart until you delete your account or request data deletion.
  </p>
  <p className="text-gray-700">
    <strong>Data deletion:</strong> To request deletion of all imported Garmin data, email 
    hello@runsmart.ai with the subject "Delete my Garmin data". We process deletion requests 
    within 30 days.
  </p>
</section>
```

- [ ] **Step 3: Build and verify the page renders correctly**

```bash
cd v0 && npm run build
```

Expected: build passes. Open `https://runsmart-ai.com/privacy` in a browser and confirm the Garmin section is visible, readable, and the navigation links to it work.

- [ ] **Step 4: Run lint and type-check**

```bash
cd v0 && npm run lint && npm run type-check
```

Expected: both pass.

- [ ] **Step 5: Commit and deploy**

```bash
cd v0 && git add app/landing/privacy/page.tsx
git commit -m "feat: add Garmin data section to privacy policy"
git push
```

Verify the page is live at `https://runsmart-ai.com/privacy` before proceeding to Task 3. The URL must be publicly accessible when you submit to Garmin.

---

## Task 3: Take Required Screenshots

Garmin's review process asks for evidence that the integration is working. Per `docs/garmin-application/08-SCREENSHOT-CHECKLIST.md`, five PNG screenshots at 1920x1080 or higher, under 5MB each.

**Files:**
- Create folder: `docs/garmin-application/screenshots/`

- [ ] **Step 1: Set up the screen for screenshots**

Use a browser at 1920x1080 resolution. Log into RunSmart as a user who has Garmin connected and has synced at least some activity data.

- [ ] **Step 2: Screenshot 1 — Connect Garmin button**

Navigate to Profile → Device Settings. Screenshot the page showing the "Connect Garmin" (or "Garmin Connected") card visible.

Save as: `docs/garmin-application/screenshots/01-connect-garmin-button.png`

- [ ] **Step 3: Screenshot 2 — Garmin OAuth consent screen**

If you have a second Garmin account (not yet connected), trigger the OAuth flow. Screenshot the Garmin.com authorization page showing RunSmart is requesting access.

If you cannot easily trigger this: use a browser screenshot of a prior OAuth flow or use the dev console to show the authorization URL structure.

Save as: `docs/garmin-application/screenshots/02-oauth-consent-screen.png`

- [ ] **Step 4: Screenshot 3 — Post-connection "Connected" state**

Screenshot the device settings screen showing "Garmin Connected" status, the sync timestamp, and the capabilities grid (activities enabled, wellness data enabled).

Save as: `docs/garmin-application/screenshots/03-connected-state.png`

- [ ] **Step 5: Screenshot 4 — Imported Garmin activities in run history**

Navigate to the run history or Today page. Screenshot showing runs that were imported from Garmin (ideally with the Garmin badge/label visible, or with GPS data from a Garmin device).

Save as: `docs/garmin-application/screenshots/04-imported-activities.png`

- [ ] **Step 6: Screenshot 5 — Data usage (recovery or analytics view)**

Screenshot the Today page, readiness check, or any view that shows Garmin data influencing coaching (HRV display, recovery score, body battery, sleep score).

Save as: `docs/garmin-application/screenshots/05-data-in-coaching.png`

- [ ] **Step 7: Verify all 5 files exist and are under 5MB**

```bash
ls -lh docs/garmin-application/screenshots/
```

Expected: 5 PNG files, each under 5MB.

---

## Task 4: Submit the Production Enablement Request to Garmin

This is the submission task. Do not submit until Tasks 1, 2, and 3 are complete.

**Files:** None — this is an email to Garmin Developer Support.

The template already exists at `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md`. Read it before sending.

- [ ] **Step 1: Confirm the target email address**

Garmin Developer Support is reached at: **api.feedback@garmin.com**

Log into the Garmin Developer Portal at `https://developerportal.garmin.com`. Confirm your app name and team ID, which you'll reference in the ticket.

- [ ] **Step 2: Fill in the missing fields in the template**

Open `docs/garmin-application/09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md`. The template already has the app details and specific endpoint error descriptions filled in. Verify these are still accurate against your current `/api/devices/garmin/diagnose` output (from Task 1 Step 3).

Update these fields if needed:
- Environment: `Production` — if you are still on Evaluation credentials, change to `Evaluation → Production upgrade request`
- Add the Team ID from the Garmin Developer Portal (looks like `runsmart_ai` or a numeric ID)
- Add one affected user's Garmin user ID from the diagnose endpoint output

- [ ] **Step 3: Compose and send the email**

Send to: **api.feedback@garmin.com**

Subject (from template):
```
RunSmart Health API enablement request: CONNECT_ACTIVITY backfill + CONNECT_SLEEP + pull token reset
```

Body: use the template exactly. Do not improvise the technical error descriptions — they need to match the exact error strings Garmin's system recognizes.

Attach:
- The full `/api/devices/garmin/diagnose` JSON (from Task 1, Step 3) — rename to `runsmart-garmin-diagnose-<date>.json`
- Three of the five screenshots (screenshot 1 "connect button", screenshot 3 "connected state", screenshot 4 "imported activities")

- [ ] **Step 4: Log the submission**

After sending, note:
- Submission date: ______
- Garmin ticket/reference number (from auto-reply): ______
- Expected response window: 5-10 business days (based on Garmin's typical support response time)
- If no response in 10 business days: follow up with the same thread

Record this in `docs/garmin-application/04-GAPS-AND-TODO.md` as "Production enablement submitted on [date]".

---

## Task 5 (Post-Approval): Create Production App and Rotate Credentials

**Do this only after Garmin approves the Production request.** Garmin will either grant Production capabilities on your existing app OR ask you to create a new app at the Production tier in the Developer Portal.

**Files:**
- Vercel environment variables (via Vercel dashboard or CLI)
- Garmin Developer Portal (browser, `https://developerportal.garmin.com`)

- [ ] **Step 1: Create a Production-level app in the Garmin Developer Portal**

Go to `https://developerportal.garmin.com/teams/runsmart_ai/create-app`.

Use `docs/garmin-portal-create-app-setup.md` for the exact field values. For the `Product` field, select `Connect Developer - Production` instead of Evaluation.

Note the new credentials:
- Consumer Key (new Production value)
- Consumer Secret (new Production value)

- [ ] **Step 2: Update webhook URL in the Production app**

In the new Production app settings in the Garmin Developer Portal, configure the callback/notification URL:

```
https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>
```

This is the same URL used in Evaluation. The `GARMIN_WEBHOOK_SECRET` env var must already be set in Vercel.

- [ ] **Step 3: Update Vercel environment variables**

In the Vercel dashboard for the RunSmart project, update:

```
GARMIN_CLIENT_ID=<new Production Consumer Key>
GARMIN_CLIENT_SECRET=<new Production Consumer Secret>
```

Do NOT change:
- `GARMIN_OAUTH_REDIRECT_URI` (same: `https://runsmart-ai.com/garmin/callback`)
- `GARMIN_WEBHOOK_SECRET` (same — this is your own secret, not Garmin's)
- `ENCRYPTION_KEY` (same — used to encrypt/decrypt tokens, changing it breaks all existing tokens)

After updating, redeploy via Vercel dashboard (trigger a redeployment so env vars take effect).

- [ ] **Step 4: Smoke test with a fresh user connection**

As a user who has NOT previously connected Garmin, go through the full connect flow:
1. Profile → Device Settings → Connect Garmin
2. Complete Garmin OAuth consent
3. Confirm redirect to RunSmart succeeds
4. Trigger Sync Garmin
5. Check `garmin_activities` and `garmin_daily_metrics` in Supabase — verify rows appear

Expected: the connection succeeds and data imports within the sync window.

- [ ] **Step 5: Confirm backfill is now available**

After a successful connection with the new Production credentials, call the backfill endpoint:

```
GET https://runsmart-ai.com/api/devices/garmin/diagnose
```

In the response, check that `garminPermissions` now includes `HISTORICAL_DATA_EXPORT`. If yes, backfill is enabled.

To trigger a backfill sync manually:
```
POST https://runsmart-ai.com/api/devices/garmin/sync/backfill
```
(or trigger from the Garmin sync panel if a backfill button exists)

---

## Task 6 (Post-Approval): Handle Existing User Reconnects

When credentials rotate from Evaluation to Production, all existing users' tokens become invalid (they were issued by the Evaluation app). They will need to re-authorize.

**Files:**
- `v0/components/garmin-sync-panel.tsx` (add reconnect prompt on 401 response)

This is a small UX change, not a new feature. The sync panel already handles `needsReauth: true` from the sync result. Verify it shows a clear reconnect prompt:

- [ ] **Step 1: Confirm the reconnect flow is already handled**

In `v0/lib/garminSync.ts`, look for how `401` or `needsReauth` from the sync API is handled. In `v0/components/garmin-sync-panel.tsx`, look for what renders when `syncResult.needsReauth === true`.

If a "Reconnect Garmin" button with a clear message already renders: this task is done.

If the error is swallowed silently or shows a generic error: add a reconnect prompt that reads: "Your Garmin connection needs to be refreshed — tap here to reconnect." The button should navigate to `/api/devices/garmin/connect` (which starts a fresh OAuth flow).

- [ ] **Step 2: Test the reconnect flow**

Manually set a Garmin user's stored token to an invalid value in Supabase (set `access_token` to `invalid`). Then trigger a sync. Confirm the reconnect prompt appears. Confirm clicking it starts a fresh OAuth flow and successfully reconnects.

- [ ] **Step 3: Commit**

```bash
cd v0 && git add components/garmin-sync-panel.tsx
git commit -m "fix: show reconnect prompt when Garmin token is invalid after credential rotation"
git push
```

---

## Timeline

| Milestone | When |
|---|---|
| P0 bugs live in production | Day 0-3 (parallel plan executing now) |
| Privacy policy updated | Day 1-2 |
| Screenshots taken | Day 2 |
| Garmin support ticket submitted | Day 2-3 |
| Garmin review period | Day 3-17 (2+ weeks, their timeline) |
| Production credentials received | Day ~17 |
| Credential rotation + smoke test | Day 17-18 |
| First real user can connect | Day 18 |
| App Store launch window (target) | Day 18+ |

**Garmin's typical response time**: 5-10 business days. Some teams report 2-4 weeks. Submit as early as possible — the review runs in the background while you build other features.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Garmin rejects due to broken integration | Low (P0 fixes will be live) | Run diagnostics before submitting; include the diagnostic JSON |
| Garmin asks for more information | Medium | Respond promptly with screenshots and security narrative (`02-DATA-FLOW-SECURITY.md`) |
| Review takes 4+ weeks | Medium | Submit as soon as P0 fixes are deployed; do not wait |
| Credential rotation breaks all Evaluation-era tokens | Certain | Task 6 — reconnect prompt is in place before rotating |
| Backfill endpoints still 400 after Production | Low-Medium | Use the enablement request template to follow up specifically about `CONNECT_ACTIVITY` backfill |
| Privacy policy URL is not live at submission time | Low | Task 2 deploys it first; verify before sending |

---

## What Production Does NOT Fix

- Webhook delivery still requires the webhook URL to be registered in the new Production app (Task 5, Step 2). Until that's done, sync is still pull-only (polling the API).
- Evaluation-era test users must reconnect (Task 6). This is unavoidable when credentials change.
- Garmin's per-endpoint enablement (e.g., `CONNECT_SLEEP`) may require a separate follow-up support ticket after Production is granted, using the template in `09-GARMIN-ENABLEMENT-REQUEST-TEMPLATE.md`.
- `WORKOUT_IMPORT` (writing workouts back to Garmin Calendar) requires a separate permission request and is out of scope here.
