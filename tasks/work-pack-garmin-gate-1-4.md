# Work Pack: Garmin Production Gate 1-4 Evidence Package

> Open this in the RunSmart web repo.
> Gates 1-4 are all evidence/submission tasks — minimal code changes.
> **Deadline: 2026-06-17-19 — Marc Lussi (Garmin Partner Services) is waiting.**

**Repo:** `/Users/nadavyigal/Documents/RunSmart`
**Context:** Marc Lussi from Garmin Partner Services confirmed 4 gates (2026-06-15) that RunSmart must satisfy before Garmin promotes to Production tier. Production unlocks unlimited users and all 15 data types. Without it, any Garmin user who connects gets silent 400/404 failures on every data endpoint. The deadline is within the next 1-3 days.

---

## Gate 1: Legal — Privacy Policy Live with Garmin Section (30 min)

**What Garmin requires:** A live, publicly accessible privacy policy that includes a Garmin-specific section with explicit AI/OpenAI disclosure. Must be linkable from within the app.

**Status:** Code was committed 2026-06-15. Confirm it is deployed and accessible.

- [ ] **Verify the privacy policy is live**
  ```bash
  curl -s https://runsmart-ai.com/privacy | grep -i garmin | head -10
  ```
  Expected: returns HTML containing the words "Garmin" and "OpenAI".

- [ ] **Verify the anchor link works**
  Open in browser: `https://runsmart-ai.com/privacy#garmin-connect-data`
  Expected: page scrolls to the Garmin section header.

- [ ] **If the section is missing or the anchor is broken:**
  - Read `v0/app/landing/privacy/page.tsx`
  - Add/fix the Garmin section (full copy in `docs/superpowers/plans/2026-06-15-garmin-production-enablement.md`, Task 2)
  - Deploy: `vercel --prod` or push to main and let CI deploy
  - Re-verify with `curl` before continuing

- [ ] **Note the live URL for the evidence package:**
  ```
  Privacy URL: https://runsmart-ai.com/privacy#garmin-connect-data
  OpenAI disclosure: confirmed present (yes/no)
  ```

---

## Gate 2: Technical — Portal Verification Steps (45 min, manual in Garmin Developer Portal)

**What Garmin requires:**
1. PUSH webhook endpoint responds with async 200 (code fixed 2026-06-15, needs portal verification)
2. User Deregistration endpoint is registered and reachable
3. Data Generator sends test events through the portal
4. Partner Verification step in the portal is completed
5. At least 2 users authorized under this app's credentials

### Step 2a: Verify P0 webhook fix is deployed

- [ ] Confirm the webhook commits are on production
  ```bash
  git log --oneline origin/main | head -10
  ```
  Look for commits containing "webhook" or "async 200" from 2026-06-15.

- [ ] Check the webhook endpoint responds correctly
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST https://runsmart-ai.com/api/devices/garmin/webhook/test
  ```
  Expected: 200 (even for an unrecognized test body — the endpoint must not return 5xx or 4xx on format errors, it must return 200 immediately and process async).

### Step 2b: Developer Portal verification steps

Open the Garmin Developer Portal: https://developerportal.garmin.com/

- [ ] Navigate to your RunSmart app → **Health API** tab
- [ ] Find **Push Notifications** or **Webhook** section
  - [ ] Confirm webhook URL is set: `https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>`
  - [ ] Click **Test Push** or **Send Test Event** if available — confirm it returns 200 in the portal log

- [ ] Find **User Deregistration** section
  - [ ] Confirm the deregistration endpoint URL is registered: `https://runsmart-ai.com/api/devices/garmin/deregister` (or equivalent)

- [ ] Find **Data Generator** (may be labeled "Test Data Generator" or "Simulate Data")
  - [ ] Run the Data Generator for at least one data type (e.g., Daily Summary, Activity)
  - [ ] Confirm the data appears in Supabase:
    ```sql
    SELECT date, steps, hrv FROM garmin_daily_metrics
    WHERE updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC LIMIT 3;
    ```

- [ ] Find **Partner Verification** tab or button — click it and complete any verification steps shown

- [ ] Confirm at least 2 users are authorized
  ```bash
  # Check in Supabase
  ```
  ```sql
  SELECT COUNT(*) FROM garmin_tokens WHERE expires_at > NOW();
  ```
  If fewer than 2: authorize a second test account via the Garmin OAuth flow in the RunSmart app.

- [ ] Note evidence for submission:
  ```
  Webhook URL: https://runsmart-ai.com/api/devices/garmin/webhook/<secret>
  Test push: [PASS/FAIL + portal screenshot]
  Data Generator run: [PASS/FAIL + Supabase row count]
  Partner Verification: [PASS/FAIL]
  Authorized users: [count]
  ```

---

## Gate 3: Account — API Blog + Team Email Hygiene (15 min, manual)

**What Garmin requires:**
1. The app owner account is signed up for the Garmin Developer API Blog (newsletter)
2. Team accounts use non-freemail addresses — `hello@runsmart.ai` only (no gmail.com, icloud.com etc.)

- [ ] **Subscribe to the API Blog**
  Go to: https://developer.garmin.com/blog/ (or the signup link Marc Lussi provided)
  Subscribe with: `hello@runsmart.ai`

- [ ] **Audit team accounts in the Developer Portal**
  - Navigate to Developer Portal → Team / Members
  - Remove any accounts with `@gmail.com`, `@icloud.com`, or other freemail domains
  - The only allowed account is `hello@runsmart.ai` (or custom domain)

- [ ] **Note evidence:**
  ```
  API Blog subscription: confirmed for hello@runsmart.ai
  Team accounts: only hello@runsmart.ai remains
  ```

---

## Gate 4: UX + Brand — Screenshots + GCDP Compliance (45 min)

**What Garmin requires:**
1. Zipped folder of screenshots showing all Garmin surfaces in RunSmart
2. Compliance with GCDP Branding Assets v2 (pages 2 + 4) — Marc confirmed: any test/seeded data is fine

### Step 4a: Take the 5 required screenshots

Marc confirmed any data is acceptable. Use simulator or real device with your connected Garmin test account.

Per `docs/garmin-application/08-SCREENSHOT-CHECKLIST.md`:

| # | Screen | Where to find it |
|---|--------|-----------------|
| 1 | Connect Garmin button | Settings → Devices |
| 2 | Garmin OAuth consent screen | Trigger OAuth flow, screenshot the Garmin login/auth page |
| 3 | Post-connection "Connected" state | Settings → Devices after successful auth |
| 4 | Garmin activities in run history | Today or History tab with Garmin-imported runs visible |
| 5 | Data usage in recovery/analytics | Recovery or Today screen showing Garmin-derived metrics |

- [ ] Take screenshot 1 — Settings → Devices with "Connect Garmin" button
- [ ] Take screenshot 2 — Garmin OAuth consent page (trigger reconnect if already connected)
- [ ] Take screenshot 3 — Post-connection "Connected" state
- [ ] Take screenshot 4 — Run history with Garmin activities listed
- [ ] Take screenshot 5 — Recovery or analytics screen showing Garmin data influence

- [ ] Save all 5 as PNGs at 1920x1080 or higher (under 5MB each)
  ```bash
  mkdir -p docs/garmin-application/screenshots/
  # Move your PNGs here:
  # docs/garmin-application/screenshots/01-connect-garmin-button.png
  # docs/garmin-application/screenshots/02-garmin-oauth-consent.png
  # docs/garmin-application/screenshots/03-connected-state.png
  # docs/garmin-application/screenshots/04-run-history-garmin.png
  # docs/garmin-application/screenshots/05-recovery-garmin-data.png
  ```

- [ ] Zip the folder
  ```bash
  cd docs/garmin-application/
  zip -r runsmart-garmin-screenshots-2026-06-16.zip screenshots/
  ls -lh runsmart-garmin-screenshots-2026-06-16.zip
  ```

### Step 4b: GCDP Branding Assets v2 compliance check

- [ ] Open the GCDP Branding Assets v2 PDF Marc sent (should be in your email/downloads)
- [ ] Check page 2: badge/logo usage rules — verify RunSmart uses the correct "Works with Garmin Connect" badge if it appears anywhere
- [ ] Check page 4: attribution language — verify any "Works with Garmin" copy matches exact GCDP phrasing
- [ ] If any copy is wrong, fix it before submission

---

## Phase 5: Assemble and Send the Evidence Package (30 min)

Once all 4 gates are verified, send the evidence package to Marc Lussi.

- [ ] **Run the diagnostics endpoint and save the JSON**
  ```bash
  curl -s -H "Authorization: Bearer <your-session-token>" \
    https://runsmart-ai.com/api/devices/garmin/diagnose > garmin-diagnose-output.json
  cat garmin-diagnose-output.json | python3 -m json.tool | head -40
  ```
  Confirm `garminToken.valid: true` in the output.

- [ ] **Draft the email** — reply to Marc Lussi's 2026-06-15 thread:

```
Subject: Re: RunSmart — Garmin Production Enablement — Gate 1-4 Evidence

Hi Marc,

Following up on your June 15 email with our Gate 1-4 evidence:

Gate 1 — Legal:
• Privacy policy live at: https://runsmart-ai.com/privacy#garmin-connect-data
• Includes Garmin data collection section + OpenAI disclosure

Gate 2 — Technical:
• PUSH webhook endpoint: https://runsmart-ai.com/api/devices/garmin/webhook/<secret>
• Async 200 response confirmed (portal test: attached screenshot)
• Data Generator test run: [PASS — see attached screenshot + Supabase confirmation]
• Partner Verification: completed in the portal
• Authorized users: [N] accounts currently connected

Gate 3 — Account:
• API Blog subscription: hello@runsmart.ai subscribed
• Team accounts: only hello@runsmart.ai on non-freemail domain

Gate 4 — UX + Brand:
• Screenshots attached: 5 PNGs showing Connect button, OAuth flow, connected state, activity history, recovery dashboard
• GCDP Branding Assets v2 pages 2+4 reviewed — attribution language confirmed compliant

Attached:
• runsmart-garmin-screenshots-2026-06-16.zip (5 UX screenshots)
• garmin-diagnose-output.json (live diagnostic output, UTC timestamp: [NOW])

Please let me know if any additional information is needed.

Best,
Nadav Yigal
RunSmart
hello@runsmart.ai
```

- [ ] Attach:
  - `runsmart-garmin-screenshots-2026-06-16.zip`
  - `garmin-diagnose-output.json`
  - Portal test push screenshot (if you captured one)

- [ ] Send from `hello@runsmart.ai`

---

## Phase 6: Update status files

- [ ] Commit screenshots to the repo
  ```bash
  git add docs/garmin-application/screenshots/ docs/garmin-application/runsmart-garmin-screenshots-2026-06-16.zip
  git commit -m "docs(garmin): add Gate 4 UX screenshots for production enablement request"
  git push origin main
  ```

- [ ] Update `tasks/progress.md`:
  ```
  Last Completed Story: Garmin Gate 1-4 evidence package submitted to Marc Lussi (2026-06-16)
  Next Recommended Story: Await Garmin Production approval (~2-4 weeks). Once credentials received: update GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET in Vercel, test with a fresh user, enable HISTORICAL_DATA_EXPORT backfill.
  ```

- [ ] Run `./agentic-os refresh` in Agentic OS repo

---

**Done when:** Email with Gate 1-4 evidence sent to Marc Lussi from `hello@runsmart.ai`, and `tasks/progress.md` is updated with submission confirmed.

**What happens next:** Garmin reviews in ~2-4 weeks. On approval, new Production credentials arrive. Update `GARMIN_CLIENT_ID` + `GARMIN_CLIENT_SECRET` in Vercel. Existing test users will need to re-authorize — implement the reconnect prompt at that point.
