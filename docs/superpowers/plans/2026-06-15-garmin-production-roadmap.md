# Garmin Production Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take RunSmart's Garmin integration from Evaluation environment to a commercially safe, measurable, and user-trusted Production feature — timed to ship alongside App Store v14.

**Three tracks run in parallel:**
- **Technical** — Garmin Production credentials, webhook, credential rotation
- **Commercial** — UX, attribution, analytics, App Store listing, support
- **Business** — Legal terms confirmation, packaging, launch gate

---

## Current Status

| Item | Status |
|---|---|
| OAuth token/revoke URL fixed (`diauth.garmin.com`) | DONE — `ed0142d` |
| HRV field names fixed (`lastNight`, `weeklyAvg`) | DONE — `ed0142d` |
| DB health columns (`spo2`, `respiration_rate`, etc.) | DONE — existing migrations |
| iOS native OAuth gateway (`/app/garmin/connect`) | DONE — `39ed45c` |
| Signed state carries `authUserId` + `profileId` | DONE — `39ed45c` |
| Callback session fallback for iOS (no cookie) | DONE — `39ed45c` |
| iOS build error (`GoalFocusEditor`) fixed | DONE — `8eadd88` submodule |
| Garmin commercial terms email sent to Garmin | NOT STARTED — **send today** |
| Privacy policy Garmin section published | NOT STARTED |
| Garmin Production enablement request submitted | NOT STARTED |
| Production credentials live | NOT STARTED |
| Support page `/support/garmin` | NOT STARTED |
| Post-connect success modal | NOT STARTED |
| Analytics funnel | NOT STARTED |
| App Store listing updated | NOT STARTED |

---

## Implementation Order

This is the critical path. Follow it exactly — tasks marked **GATE** block everything downstream.

```
DAY 1
├── B0  Send commercial terms email to Garmin        ← GATE for C4, B7 paid section
└── T1  Verify P0 fixes are live in production       ← GATE for T4

DAYS 1–5  (run in parallel)
├── T2  Add Garmin section to privacy policy
├── T3  Take 5 required screenshots
└── C3  Build /support/garmin page

DAY 5
└── T4  Submit Production enablement request         ← GATE for T5, T6
        (needs T1 + T2 + T3 complete)
        [GARMIN REVIEW STARTS — 2-4 week window]

DAYS 5–17  (build during review — all parallel)
├── C1   Value UX: rewrite connect card + success modal
├── C1.5 Attribution audit and fixes
├── C2   Analytics funnel events
├── C2.5 Business impact events
├── C4   App Store metadata (conservative, gated on B0)
└── B6   Packaging decision

DAY ~17  (when Garmin approves Production)
├── T5  Create Production app, rotate credentials    ← GATE for C5
└── T6  Add reconnect prompt for Evaluation users    ← GATE for C5

DAY 17+  (launch)
├── C5  Send beta user email
└── B7  Go/No-Go checklist → public announcement
```

**Why this order:**
- B0 goes first — App Store copy and paid positioning are blocked until Garmin responds on commercial terms
- T1 must clear before T4 — Garmin rejects broken integrations; the diagnostic output also attaches to the request
- T2 + T3 must precede T4 — both are stated submission requirements in Garmin's process
- C1.5 (attribution) must precede C4 (screenshots) — screenshots that show Garmin data without attribution may violate the developer agreement
- T6 (reconnect prompt) must precede C5 (beta email) — if users click "reconnect" before the prompt is live they hit a generic error

**What can slip without blocking launch:**
- C2.5 business impact events — valuable but metrics need 2+ weeks of Production data anyway; can ship 1 week post-launch
- App Store keyword update — can be a metadata-only update with no new binary

---

## Phase 1: Send and Verify (Days 1–3)

### B0 — Garmin Commercial Terms Email

**This is the highest-priority action. Send today before writing any code.**

Nothing about paid positioning, App Store "Works with Garmin Connect" language, or AI coaching copy referencing Garmin data should be finalised until Garmin responds. This email starts the clock.

**Files:**
- Create: `docs/garmin-application/commercial-terms.md`

- [ ] **Step 1: Create the commercial terms tracker**

Create `docs/garmin-application/commercial-terms.md`:

```markdown
# Garmin Commercial Terms — RunSmart

Status: PENDING — email sent [DATE], awaiting response from api.feedback@garmin.com

## Questions sent

Q1. May RunSmart use Garmin-imported activity data inside a subscription product?
Q2. Are AI coaching insights derived from Garmin data permitted?
Q3. Do Health API metrics (sleep, HRV, stress, Body Battery, resting HR, Pulse Ox,
    respiration) carry license fees, revenue sharing, or usage caps in Production?
Q4. Is HISTORICAL_DATA_EXPORT (30-day maximum historical export) enabled by default in Production,
    or does it require a separate enablement request?
Q5. Is attribution required inside AI insights, run reports, App Store screenshots,
    or exported content? What is the approved attribution language?
Q6. May RunSmart use the phrase "Works with Garmin Connect" in App Store metadata?

## Garmin's answers

[Fill in date, contact name, and exact wording of each answer after response]

## Decisions unblocked by each answer

| Answer | Unblocks |
|---|---|
| Q1 | Using Garmin in Pro subscription copy |
| Q2 | AI insights that cite Garmin data by name |
| Q3 | Unit economics confirmation; paid positioning |
| Q4 | Mentioning "recent history" vs "up to 30 days" in marketing |
| Q5 | Attribution wording in UI and screenshots |
| Q6 | "Works with Garmin Connect" in App Store |
```

- [ ] **Step 2: Send the email**

Send to: **api.feedback@garmin.com**

Subject: `RunSmart — commercial use clarification for Production app`

Body:

```
Hello Garmin Developer Support,

I am the founder of RunSmart (runsmart-ai.com), an AI-powered running coach
currently in the Garmin Connect Developer Program (Evaluation). I am preparing
our Production enablement request and want to confirm several commercial terms
before publicly marketing Garmin as a featured integration.

App details:
- App: RunSmart — AI running coach (PWA + iOS native)
- OAuth flow: OAuth 2.0 PKCE
- Permissions: ACTIVITY_EXPORT, HEALTH_EXPORT, HISTORICAL_DATA_EXPORT
- Redirect URI: https://runsmart-ai.com/garmin/callback

Questions:

1. May RunSmart use Garmin-imported activity data inside a subscription product?

2. RunSmart generates AI coaching recommendations (training load adjustments,
   recovery scores, plan modifications) derived in part from Garmin data.
   Is this permitted?

3. Do Health API datasets — sleep, HRV, stress, Body Battery, resting heart rate,
   Pulse Ox, respiration rate — carry license fees, revenue sharing requirements,
   or usage caps in Production?

4. Is HISTORICAL_DATA_EXPORT (30-day maximum historical export) enabled by default in Production,
   or does it require a separate enablement request after approval?

5. Are we required to attribute Garmin Connect as the data source in AI insights,
   run reports, App Store screenshots, or exported content? If so, what is the
   approved attribution language?

6. May we use the phrase "Works with Garmin Connect" in App Store metadata
   and in-app marketing copy?

I want to ensure RunSmart is fully compliant before marketing the integration.
Happy to provide app ID, team ID, or our privacy policy URL.

Thank you,
Nadav Yigal
Founder, RunSmart
hello@runsmart.ai
```

- [ ] **Step 3: Log the send date**

In `commercial-terms.md`, replace `[DATE]` with today's date. Set a calendar reminder for 10 business days as a follow-up trigger.

- [ ] **Step 4: Apply safe defaults until Garmin responds**

| Claim | Safe default (use until B0 answered) |
|---|---|
| "Works with Garmin Connect" in App Store | Do not use — use "Syncs with Garmin" |
| Garmin in Pro subscription copy | Do not reference Garmin in paid tier marketing |
| AI insights citing Garmin by name | Use "Based on your connected device data" |
| More than 30 days of history | Use "recent history" or "up to 30 days" |
| Health API metrics as paid upsell | Do not list individual metrics as Pro features |

---

### T1 — Verify P0 Fixes Are Live (Production Gate Check)

**This gates T4. Do not submit the Garmin enablement request with a broken integration.**

- [ ] **Step 1: Confirm the three fix commits are deployed**

```bash
cd "/Users/nadavyigal/Documents/Projects /RunSmart /Running-coach-"
git log --oneline origin/main | head -10
```

Expected: `ed0142d fix(garmin): correct token/revoke domain...` is present and deployed to `runsmart-ai.com` (check Vercel dashboard — deployment should be green).

- [ ] **Step 2: Verify the migration is applied in production**

In Supabase Studio for the RunSmart project, run:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'garmin_daily_metrics'
  AND column_name IN (
    'body_battery_charged','body_battery_drained','body_battery_balance',
    'spo2','respiration_rate','skin_temp_c',
    'blood_pressure_systolic','blood_pressure_diastolic'
  );
```

Expected: 8 rows. If fewer: the migration `20260227131500_garmin_body_battery_balance.sql` or `20260322000001_garmin_daily_metrics_health_columns.sql` has not been applied to production. Apply it before continuing.

- [ ] **Step 3: Run the diagnostic endpoint and save the JSON**

As a logged-in user with Garmin connected, call:

```
GET https://runsmart-ai.com/api/devices/garmin/diagnose
```

Save the full JSON response as `docs/garmin-application/diagnose-output-[DATE].json`. You will attach this to the enablement request in T4.

In the response, verify:
- `garminToken.valid: true` — token refresh uses correct `diauth.garmin.com` domain
- `garminProfile.status: 200` — user profile API is reachable
- `garminPermissions` includes `ACTIVITY_EXPORT` and `HEALTH_EXPORT`

If `garminToken.valid: false`: the fix is not yet deployed. Stop — do not proceed to T4.

- [ ] **Step 4: Trigger a manual sync and verify data stores**

In the RunSmart app, trigger "Sync Garmin". Then check Supabase:

```sql
SELECT date, steps, hrv, resting_hr, stress, body_battery, sleep_score, updated_at
FROM garmin_daily_metrics
WHERE user_id = <your-user-id>
ORDER BY date DESC
LIMIT 7;
```

Expected: rows with non-null values in at least `steps`, `hrv` (if your device measures HRV), and `sleep_score`. If all null: debug the analytics store before submitting to Garmin.

---

## Phase 2: Submit to Garmin (Days 2–5)

### T2 — Add Garmin Section to Privacy Policy

Garmin explicitly requires a live, public privacy policy that mentions Garmin data collection before approving Production.

**Files:**
- Modify: `v0/app/landing/privacy/page.tsx`

- [ ] **Step 1: Add the Garmin data section**

In `v0/app/landing/privacy/page.tsx`, insert after the "What we collect" section:

```tsx
<section className="mb-8">
  <h2 className="text-xl font-semibold mb-3">Garmin Connect data (if you connect a Garmin device)</h2>
  <p className="mb-3 text-gray-700">
    If you choose to connect your Garmin account, we import completed running activities and
    wellness data after you explicitly authorize access via Garmin's OAuth flow. You can
    disconnect at any time from Profile → Devices.
  </p>
  <p className="mb-2 text-gray-700">Imported data may include:</p>
  <ul className="list-disc pl-6 mb-3 text-gray-700 space-y-1">
    <li>Activity records: timestamps, distance, duration, pace, elevation, GPS track</li>
    <li>Heart rate: per-activity averages, resting heart rate, HRV (last night and weekly average)</li>
    <li>Wellness: sleep quality and duration, daily stress, body battery, steps</li>
    <li>Training: VO2 max estimates and daily step count (device-dependent)</li>
  </ul>
  <p className="mb-3 text-gray-700">
    This data is used exclusively to power your coaching insights, training plan adjustments,
    and recovery recommendations inside RunSmart. We do not sell or share Garmin data with
    third parties.
  </p>
  <p className="mb-3 text-gray-700">
    <strong>Token storage:</strong> Garmin OAuth tokens are stored server-side, encrypted at
    rest using AES-256-GCM. Tokens are deleted when you disconnect Garmin.
  </p>
  <p className="mb-3 text-gray-700">
    <strong>Disconnecting:</strong> Go to Profile → Devices → Disconnect Garmin. This deletes
    your stored tokens and stops all future imports.
  </p>
  <p className="text-gray-700">
    <strong>Data deletion:</strong> To request deletion of all imported Garmin data, email{' '}
    <a href="mailto:hello@runsmart.ai" className="text-blue-600 underline">hello@runsmart.ai</a>{' '}
    with subject "Delete my Garmin data". We process requests within 30 days.
  </p>
</section>
```

- [ ] **Step 2: Build and deploy**

```bash
cd v0 && npm run build && git add app/landing/privacy/page.tsx
git commit -m "feat: add Garmin Connect data section to privacy policy"
git push
```

- [ ] **Step 3: Verify the live URL**

Open `https://runsmart-ai.com/privacy` and confirm the Garmin section is visible. This URL is what you submit to Garmin.

---

### T3 — Take Required Screenshots

Garmin's review process requires evidence of a working integration. Five PNGs at 1920×1080 or higher, under 5MB each.

**Files:**
- Create: `docs/garmin-application/screenshots/` (5 PNG files)

- [ ] **Step 1: Take the five screenshots** (use a browser at 1920×1080 as a Garmin-connected user with real data)

| File | What to capture |
|---|---|
| `01-connect-garmin-button.png` | Profile → Devices showing the Garmin Connect card with the Connect button |
| `02-oauth-consent-screen.png` | The Garmin.com authorization page showing RunSmart is requesting access |
| `03-connected-state.png` | Profile → Devices after connection — showing "Connected", sync timestamp, capabilities |
| `04-imported-activities.png` | Run history or Today page showing Garmin-imported activities |
| `05-data-in-coaching.png` | Recovery score, HRV display, or body battery — any view showing Garmin data in coaching |

- [ ] **Step 2: Verify file sizes**

```bash
ls -lh docs/garmin-application/screenshots/
```

Expected: 5 PNGs, each under 5MB.

---

### T4 — Submit Production Enablement Request

**Gate: T1 (healthy integration), T2 (live privacy policy), T3 (screenshots) must all be complete.**

- [ ] **Step 1: Compose the email**

Send to: **api.feedback@garmin.com**

Subject: `RunSmart Health API enablement request: Production access + CONNECT_ACTIVITY backfill + CONNECT_SLEEP`

Body:

```
Hello Garmin Developer Support,

I am the owner of the RunSmart app in the Garmin Connect Developer Program and am
requesting promotion to Production along with endpoint enablement.

App details:
- App: RunSmart
- Environment: Evaluation → Production upgrade request
- OAuth flow: OAuth 2.0 PKCE
- Redirect URI: https://runsmart-ai.com/garmin/callback
- Privacy policy: https://runsmart-ai.com/privacy

Current Evaluation environment diagnostics:
[ATTACH: docs/garmin-application/diagnose-output-[DATE].json]

Observed endpoint behavior in Evaluation:
- GET /wellness-api/rest/user/id → 200 (token is valid)
- GET /wellness-api/rest/user/permissions → 200 with ACTIVITY_EXPORT, HEALTH_EXPORT
- GET /wellness-api/rest/activities?uploadStartTimeInSeconds=... → 400 InvalidPullTokenException
- GET /wellness-api/rest/backfill/activities?... → 400 Endpoint not enabled for CONNECT_ACTIVITY
- GET /wellness-api/rest/sleep?... → 404 Not Found

Requests:
1. Production environment access (unlimited users, all provisioned endpoints)
2. Enable CONNECT_ACTIVITY backfill endpoint
3. Enable sleep export endpoints (CONNECT_SLEEP upload + backfill windows)
4. Reset pull token state for affected Evaluation users (InvalidPullTokenException)

Why we need Production:
RunSmart syncs user-authorized Garmin data for recovery coaching, readiness scoring, and
adaptive training plan adjustment. We use only official Wellness API endpoints and
user-granted permissions. Integration is complete and tested.

I can provide app ID, team ID, or affected user IDs immediately.

Thank you,
Nadav Yigal
hello@runsmart.ai
```

- [ ] **Step 2: Attach files**

- `docs/garmin-application/diagnose-output-[DATE].json`
- `docs/garmin-application/screenshots/01-connect-garmin-button.png`
- `docs/garmin-application/screenshots/03-connected-state.png`
- `docs/garmin-application/screenshots/04-imported-activities.png`

- [ ] **Step 3: Log the submission**

In `docs/garmin-application/commercial-terms.md`, add:

```
## Production enablement request

Submitted: [DATE]
Reference: [auto-reply ticket number]
Expected response: 5-10 business days
Follow-up if no response by: [DATE + 10 business days]
```

---

## Phase 3: Build During Review (Days 5–17)

Garmin's review takes 2–4 weeks. Run all of the following in parallel.

---

### C1 — Benefit-Led Connect UX + Post-Connect Modal

**Files:**
- Modify: `v0/components/device-connection-screen.tsx`
- Create: `v0/components/garmin-connect-success-modal.tsx`

#### Part A — Rewrite the Garmin connect card copy

- [ ] **Step 1: Update the Garmin device descriptor in `device-connection-screen.tsx`**

Find the `supportedDevices` array. Change the Garmin entry:

```typescript
// Before
{
  type: 'garmin' as const,
  name: 'Garmin Device',
  description: 'Advanced metrics, VO2 max, and training load',
  capabilities: ['heart_rate', 'activities', 'advanced_metrics', 'running_dynamics'],
}

// After
{
  type: 'garmin' as const,
  name: 'Garmin Connect',
  description: 'Import your runs automatically and unlock recovery coaching powered by your real sleep, HRV, and body battery.',
  capabilities: [
    'Auto-import runs and GPS routes',
    'Sleep and HRV recovery scoring',
    'Body battery and stress signals',
    'VO2 max and training load',
  ],
}
```

- [ ] **Step 2: Update the capabilities render**

```tsx
// Before
{deviceType.capabilities.map((capability) => (
  <div key={capability} className="flex items-center space-x-1">
    <Heart className="h-3 w-3 text-red-500" />
    <span className="text-xs">{capability.replace('_', ' ')}</span>
  </div>
))}

// After
{deviceType.capabilities.map((capability) => (
  <div key={capability} className="flex items-center space-x-1">
    <CheckCircle className="h-3 w-3 text-emerald-500" />
    <span className="text-xs text-gray-700">{capability}</span>
  </div>
))}
```

Ensure `CheckCircle` is imported from `lucide-react`.

#### Part B — Post-connect success modal (data-conditional)

- [ ] **Step 3: Create `v0/components/garmin-connect-success-modal.tsx`**

```tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, Activity, Moon, Brain, Zap } from 'lucide-react'

interface GarminImportSummary {
  runsImported: number
  sleepRecords: number
  hrvRecords: number
  hasBodyBattery: boolean
}

interface GarminConnectSuccessModalProps {
  open: boolean
  summary: GarminImportSummary
  onDismiss: () => void
}

export function GarminConnectSuccessModal({ open, summary, onDismiss }: GarminConnectSuccessModalProps) {
  const hasAnyData = summary.runsImported > 0 || summary.sleepRecords > 0
    || summary.hrvRecords > 0 || summary.hasBodyBattery

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Garmin Connect connected</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {hasAnyData ? (
            <>
              <p className="text-sm text-gray-600 text-center">Imported from your Garmin Connect account:</p>

              {summary.runsImported > 0 && (
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                  <Activity className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    <strong>{summary.runsImported}</strong>{' '}
                    recent {summary.runsImported === 1 ? 'run' : 'runs'}
                  </p>
                </div>
              )}
              {summary.sleepRecords > 0 && (
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                  <Moon className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    <strong>{summary.sleepRecords}</strong>{' '}
                    sleep {summary.sleepRecords === 1 ? 'record' : 'records'}
                  </p>
                </div>
              )}
              {summary.hrvRecords > 0 && (
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                  <Brain className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    <strong>{summary.hrvRecords}</strong>{' '}
                    HRV {summary.hrvRecords === 1 ? 'record' : 'records'}
                  </p>
                </div>
              )}
              {summary.hasBodyBattery && (
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                  <Zap className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm">Body battery and stress data available</p>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center pt-1">
                Garmin Connect data is used only after your authorization.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 text-center py-2">
                Garmin Connect is connected. Open the Garmin Connect app and confirm
                your device has synced, then come back — your data will appear shortly.
              </p>
              <p className="text-xs text-gray-400 text-center">
                Garmin Connect data is used only after your authorization.
              </p>
            </>
          )}
        </div>

        <Button className="w-full" onClick={onDismiss}>Go to Today</Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Wire the modal after a fresh Garmin connect in `device-connection-screen.tsx`**

Add state and the detection effect:

```tsx
const [showGarminSuccess, setShowGarminSuccess] = useState(false)
const [garminSummary, setGarminSummary] = useState<{
  runsImported: number; sleepRecords: number
  hrvRecords: number; hasBodyBattery: boolean
} | null>(null)

useEffect(() => {
  const device = connectedDevices?.find(
    d => d.type === 'garmin' && d.connectionStatus === 'connected'
  )
  if (!device || showGarminSuccess || garminSummary) return
  const ageMs = Date.now() - new Date(device.createdAt ?? 0).getTime()
  if (ageMs > 5 * 60 * 1000) return  // only for fresh connects

  void fetch('/api/devices/garmin/sync/manual', { method: 'POST' })
    .then(r => r.json())
    .then(result => {
      setGarminSummary({
        runsImported: result.activitiesImported ?? 0,
        sleepRecords: result.sleepRecordsImported ?? 0,
        hrvRecords: result.hrvRecordsImported ?? 0,
        hasBodyBattery: Boolean(result.hasBodyBatteryData),
      })
      setShowGarminSuccess(true)
    })
    .catch(() => {
      setGarminSummary({ runsImported: 0, sleepRecords: 0, hrvRecords: 0, hasBodyBattery: false })
      setShowGarminSuccess(true)
    })
}, [connectedDevices, showGarminSuccess, garminSummary])
```

> **Note:** Check `v0/app/api/devices/garmin/sync/route.ts` response shape. If `sleepRecordsImported`, `hrvRecordsImported`, `hasBodyBatteryData` are not returned, extend the sync response or collapse to a single `additionalSummaryImported` count and show a generic "wellness data" row.

Add to JSX return:

```tsx
{showGarminSuccess && garminSummary && (
  <GarminConnectSuccessModal
    open={showGarminSuccess}
    summary={garminSummary}
    onDismiss={() => { setShowGarminSuccess(false); router.push('/') }}
  />
)}
```

- [ ] **Step 5: Build and verify**

```bash
cd v0 && npm run build && npm run type-check
```

- [ ] **Step 6: Commit**

```bash
cd v0 && git add components/device-connection-screen.tsx components/garmin-connect-success-modal.tsx
git commit -m "feat(garmin): benefit-led connect card + data-conditional post-connect modal"
```

---

### C1.5 — Garmin Attribution Audit

**This must complete before T3 screenshots and C4 App Store update.** Screenshots showing unattributed Garmin data may violate the developer agreement.

**Files:**
- Modify: activity list component, recovery card component, AI insight component

- [ ] **Step 1: Audit every surface where Garmin data appears**

Open the app as a Garmin-connected user with data. Check each surface:

| Surface | Required | Pass / Fail |
|---|---|---|
| Run history — Garmin-imported activities | "via Garmin Connect" badge | |
| Recovery card / readiness score | "Based on Garmin Connect data" when source is Garmin | |
| AI coaching insights referencing HRV or sleep | "Based on your connected device data" | |
| Today page — wellness metrics (HRV, body battery, sleep) | Source label or tooltip | |
| Activity detail for a Garmin-imported run | "Imported from Garmin Connect" | |
| Exported or shareable run summaries | Attribution preserved | |

- [ ] **Step 2: Add Garmin badge to imported activities**

In the run card component (likely `v0/components/run-card.tsx` or equivalent), where `run.source === 'garmin_sync'`:

```tsx
{run.source === 'garmin_sync' && (
  <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
    <WatchIcon className="h-3 w-3" />
    Garmin Connect
  </span>
)}
```

- [ ] **Step 3: Add source attribution to recovery cards**

In the recovery or readiness component, where Garmin data drives the score:

```tsx
{recoveryData?.source === 'garmin' && (
  <p className="text-xs text-gray-400 mt-1">Based on Garmin Connect data</p>
)}
```

- [ ] **Step 4: Add attribution to AI insights**

Where an AI message references sleep quality, HRV, or body battery from Garmin:

```tsx
{insight.usesGarminData && (
  <p className="text-xs text-gray-400 mt-2">Based in part on your connected device data.</p>
)}
```

Use "connected device data" until B0 Q5 gives approved attribution language.

- [ ] **Step 5: Verify no endorsement language**

```bash
grep -rn "endorsed\|certified\|official partner\|recommended by garmin" \
  v0/app v0/components --include="*.tsx" --include="*.ts" -i
```

Expected: no results near Garmin references.

- [ ] **Step 6: Commit**

```bash
cd v0 && git add components/ app/
git commit -m "feat(garmin): add data attribution to activity list, recovery cards, and AI insights"
```

---

### C2 — Analytics Connection and Sync Funnel

**Files:**
- Modify: `v0/components/device-connection-screen.tsx`
- Modify: `v0/components/garmin-sync-panel.tsx`

Confirm `trackAnalyticsEvent` is exported from `v0/lib/analytics.ts` before adding calls.

- [ ] **Step 1: Add `garmin_connect_screen_viewed`**

In `device-connection-screen.tsx`, fire once on mount:

```tsx
useEffect(() => {
  void trackAnalyticsEvent('garmin_connect_screen_viewed', {
    hasGarminDevice: Boolean(connectedDevices?.some(d => d.type === 'garmin')),
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

- [ ] **Step 2: Add `garmin_connect_completed` and `garmin_first_run_imported`**

In the detection `useEffect` from C1 Step 4, after `setGarminSummary(...)`:

```tsx
void trackAnalyticsEvent('garmin_connect_completed', {
  runsImported: summary.runsImported,
  sleepRecords: summary.sleepRecords,
  hrvRecords: summary.hrvRecords,
  hasBodyBattery: summary.hasBodyBattery,
})
if (summary.runsImported > 0) {
  void trackAnalyticsEvent('garmin_first_run_imported', { count: summary.runsImported })
}
```

- [ ] **Step 3: Add `garmin_sync_success` and `garmin_sync_failed` in `garmin-sync-panel.tsx`**

```tsx
if (result.errors.length === 0) {
  void trackAnalyticsEvent('garmin_sync_success', {
    activitiesImported: result.activitiesImported,
    additionalSummaryImported: result.additionalSummaryImported,
  })
} else {
  void trackAnalyticsEvent('garmin_sync_failed', {
    errorCount: result.errors.length,
    firstError: result.errors[0],
    needsReauth: result.needsReauth,
  })
}
```

- [ ] **Step 4: Verify events in PostHog Live Events**

Complete the full connect flow in dev with PostHog debug on. Confirm this sequence fires:
`garmin_connect_screen_viewed` → `garmin_connect_started` → `garmin_connect_completed` → `garmin_first_run_imported` → `garmin_sync_success`

- [ ] **Step 5: Commit**

```bash
cd v0 && git add components/device-connection-screen.tsx components/garmin-sync-panel.tsx
git commit -m "feat(garmin): add connection and sync analytics funnel events"
```

---

### C2.5 — Business Impact Events

Measure whether Garmin improves the business, not just feature adoption. Build cohort analysis in PostHog after 2 weeks of Production data.

**Files:**
- Modify: recovery card component, plan view component, subscription/trial checkout

- [ ] **Step 1: Add the five business impact events**

| Event | Where | Properties |
|---|---|---|
| `garmin_first_recovery_insight_viewed` | Recovery card first render for Garmin user | `source: 'garmin'` |
| `garmin_first_plan_adjustment_viewed` | When AI suggests plan change citing Garmin recovery | `hasSleepData`, `hasHRV` |
| `garmin_user_activated` | First complete week of logged training after Garmin connect | `daysSinceConnect`, `runsLogged` |
| `trial_started_after_garmin_connect` | On trial start — check if user has Garmin | `daysSinceGarminConnect` |
| `subscription_started_after_garmin_connect` | On subscription start — same check | `daysSinceGarminConnect` |

Find existing subscription events:

```bash
grep -rn "trial_started\|subscription_started" v0/app v0/components --include="*.tsx" --include="*.ts" -i | head -10
```

Add the Garmin context property to existing events rather than creating new ones where possible.

- [ ] **Step 2: Commit**

```bash
cd v0 && git add components/ app/
git commit -m "feat(garmin): add business impact analytics events"
```

- [ ] **Step 3: Build cohort comparisons in PostHog (after 2+ weeks Production data)**

Create these cohort comparisons in PostHog (manual — browser):

| Question | Measure |
|---|---|
| Does Garmin improve activation? | Garmin-connected vs non-connected users through core loop |
| Does Garmin improve retention? | Week 1 / Week 4 return rate per cohort |
| Does Garmin improve conversion? | Trial and subscription rate per cohort |
| Does Garmin increase support burden? | Tickets per Garmin-connected user |
| Does Garmin justify its cost and risk? | Revenue per Garmin-connected Pro user |

---

### C3 — Garmin Support Page

**Files:**
- Create: `v0/app/support/garmin/page.tsx`
- Modify: `v0/app/support/page.tsx`
- Modify: `v0/components/garmin-sync-panel.tsx`

- [ ] **Step 1: Create `v0/app/support/garmin/page.tsx`**

```tsx
export const metadata = { title: 'Garmin Connect Help — RunSmart' }

export default function GarminSupportPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <h1 className="text-3xl font-bold">Garmin Connect Help</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How to connect</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Go to <strong>Profile → Devices</strong>.</li>
          <li>Tap <strong>Connect Garmin Connect</strong>.</li>
          <li>Sign in to your Garmin account and tap <strong>Agree</strong>.</li>
          <li>You'll return to RunSmart automatically. Recent runs and wellness data sync within a few minutes.</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My data isn't syncing</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li><strong>Check Garmin Connect first.</strong> Open the Garmin Connect app and confirm the activity appears there. RunSmart can sync only after Garmin Connect has received the data from your device.</li>
          <li><strong>Wait a few minutes.</strong> Garmin pushes data to RunSmart after activities complete. The first sync after connecting may take 5–10 minutes.</li>
          <li><strong>Tap Sync now.</strong> In Profile → Devices, tap the Garmin card and tap <strong>Sync Garmin</strong> to trigger a manual pull.</li>
          <li><strong>Reconnect.</strong> If sync still fails, disconnect and reconnect. This refreshes your authorization.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Why some data may be missing</h2>
        <p className="text-gray-700">Not all metrics are available for every user. Whether a metric appears depends on:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Your Garmin device model — not all devices measure HRV, Pulse Ox, or Body Battery</li>
          <li>Whether you wore the device overnight — required for sleep and HRV data</li>
          <li>Whether the data has synced from your device to the Garmin Connect app</li>
          <li>Which permissions you approved when connecting RunSmart</li>
          <li>Which data types Garmin has enabled for RunSmart in your region</li>
        </ul>
        <p className="text-gray-500 text-sm mt-2">If a metric your device supports is still missing after 24 hours, try disconnecting and reconnecting Garmin to re-request permissions.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">What data RunSmart imports</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li><strong>Activities:</strong> completed runs including GPS route, pace, heart rate, elevation, cadence, and running dynamics (device-dependent)</li>
          <li><strong>Recovery signals:</strong> HRV, resting heart rate, sleep quality and duration, daily stress, and Body Battery — when available from your device and permissions</li>
          <li><strong>Training:</strong> VO2 max estimates and daily step count</li>
        </ul>
        <p className="text-gray-500 text-sm mt-2">Data is imported only after you authorize access. You can disconnect at any time.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How to disconnect</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Go to <strong>Profile → Devices</strong>.</li>
          <li>Tap the Garmin card and tap <strong>Disconnect</strong>.</li>
          <li>RunSmart revokes its authorization and stops all future imports. Previously imported runs remain in your history.</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Delete my Garmin data</h2>
        <p className="text-gray-700">
          Email{' '}
          <a href="mailto:hello@runsmart.ai" className="text-blue-600 underline">hello@runsmart.ai</a>{' '}
          with subject <strong>"Delete my Garmin data"</strong>. We process requests within 30 days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Still need help?</h2>
        <p className="text-gray-700">
          Email <a href="mailto:hello@runsmart.ai" className="text-blue-600 underline">hello@runsmart.ai</a> with your Garmin device model and what you see in the app. We typically reply within 24 hours.
        </p>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Link from main support page and sync panel**

In `v0/app/support/page.tsx`:
```tsx
<a href="/support/garmin" className="block rounded-lg border p-4 hover:bg-slate-50">
  <h3 className="font-medium">Garmin Connect</h3>
  <p className="text-sm text-gray-500 mt-1">Connecting, syncing, missing data, and disconnecting</p>
</a>
```

In `v0/components/garmin-sync-panel.tsx`, near error display:
```tsx
<a href="/support/garmin" className="text-xs text-blue-600 underline" target="_blank" rel="noopener noreferrer">
  Garmin sync help
</a>
```

- [ ] **Step 3: Build and commit**

```bash
cd v0 && npm run build
git add app/support/garmin/ app/support/page.tsx components/garmin-sync-panel.tsx
git commit -m "feat(garmin): /support/garmin help page with missing data section"
```

---

### C4 — App Store Metadata (Gated on B0)

**Gate: send B0 email first. Use conservative language until Garmin confirms Q6 ("Works with Garmin Connect").**

Manual task — App Store Connect at `appstoreconnect.apple.com`.

- [ ] **Step 1: Add Garmin paragraph to App Description**

After the first paragraph, add:

```
SYNCS WITH GARMIN CONNECT
Connect your Garmin device to import your runs automatically and unlock recovery
coaching powered by your real sleep, HRV, and body battery data. Supports
Forerunner, Fenix, Vivoactive, Instinct, and all Garmin running watches.
```

Feature bullet: `• Garmin sync — auto-import runs, HRV, sleep and body battery`

- [ ] **Step 2: Add keywords**

In Keywords (100-char limit): `garmin,garmin connect,garmin sync,hrv,running watch`

- [ ] **Step 3: Brand compliance check**

Allowed until B0 Q6 confirmed: "Syncs with Garmin Connect", "Import from Garmin Connect"
Blocked until B0 Q6 confirmed: "Works with Garmin Connect"
Never allowed: Garmin logo, "endorsed by Garmin", "official Garmin partner"

- [ ] **Step 4: Replace one screenshot with a Garmin data view** (optional for v14 — keywords have more impact)

---

### B6 — Pricing and Packaging Decision

**Record the decision in `docs/decisions/` before paid marketing goes out.**

The commercial risk: if RunSmart gates Garmin connection behind a paywall, and Garmin's answer to B0 Q1 restricts subscription use, the paywall must be rebuilt.

**Recommended approach:**

| Tier | Garmin | Paid value driver |
|---|---|---|
| Free | Connect Garmin, import runs, see activity history | Basic coaching and plan |
| Pro | Same Garmin data + AI recovery coaching, adaptive plan, HRV-based readiness | RunSmart's coaching system — Garmin is the input, not the feature |

Do not sell "Garmin access" as the paid feature. Position RunSmart's coaching as the value.

- [ ] **Step 1: Confirm the paywall does not gate Garmin connection itself**

```bash
grep -rn "subscription\|isPro\|isFreeTier\|paywall" \
  v0/components/device-connection-screen.tsx \
  v0/app/api/devices/garmin/ 2>/dev/null
```

Expected: no results. If found, remove the gate.

- [ ] **Step 2: Record the decision**

Create `docs/decisions/garmin-packaging.md`:

```markdown
# Garmin Connect — Packaging Decision

Date: 2026-06-15
Status: Active

Decision: Garmin Connect is free to connect on all RunSmart tiers. Garmin data is an
input to RunSmart's AI coaching, which is a Pro feature. We do not sell "Garmin access".

Rationale:
- Commercial terms not yet confirmed (see commercial-terms.md)
- Paywalling Garmin connection creates Garmin ToS exposure
- Coaching as the value is more defensible long-term
- Fallback coaching (without Garmin) must work for all users

Review trigger: revisit if Garmin confirms subscription use is allowed with no license fees.
```

---

## Phase 4: Production Approval Arrives (~Day 17)

### T5 — Create Production App and Rotate Credentials

**Gate: Garmin sends the Production approval email.**

- [ ] **Step 1: Create a Production-level app in the Garmin Developer Portal**

Go to `https://developerportal.garmin.com/teams/runsmart_ai/create-app`. Use `docs/garmin-portal-create-app-setup.md` for field values. For the `Product` field select `Connect Developer - Production` (not Evaluation).

Note the new credentials:
- Consumer Key (Production)
- Consumer Secret (Production)

- [ ] **Step 2: Register the webhook URL in the new Production app**

In the Production app settings in the portal, set callback/notification URL to:

```
https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>
```

`GARMIN_WEBHOOK_SECRET` must already be set in Vercel. This is the same URL as Evaluation — the secret is yours, not Garmin's.

- [ ] **Step 3: Update Vercel environment variables**

In Vercel dashboard → RunSmart project → Environment Variables:

```
GARMIN_CLIENT_ID=<new Production Consumer Key>
GARMIN_CLIENT_SECRET=<new Production Consumer Secret>
```

Do NOT change:
- `GARMIN_OAUTH_REDIRECT_URI` — same URL
- `GARMIN_WEBHOOK_SECRET` — your secret, keep it
- `ENCRYPTION_KEY` — changing this breaks all stored tokens

Trigger a redeployment after updating env vars.

- [ ] **Step 4: Smoke test with a fresh user**

As a user who has NOT previously connected Garmin:
1. Profile → Devices → Connect Garmin Connect
2. Complete OAuth consent
3. Confirm redirect to RunSmart succeeds
4. Trigger Sync Garmin
5. Check `garmin_activities` and `garmin_daily_metrics` in Supabase — verify rows appear

- [ ] **Step 5: Confirm backfill availability**

Call `/api/devices/garmin/diagnose`. In the response, check that `garminPermissions` includes `HISTORICAL_DATA_EXPORT`. If yes, backfill is enabled.

---

### T6 — Reconnect Prompt for Evaluation-Era Users

**Gate: must be live before C5 beta email goes out.**

When credentials rotate from Evaluation to Production, every previously connected user's token becomes invalid. They need a clear reconnect path.

**Files:**
- Modify: `v0/components/garmin-sync-panel.tsx`

- [ ] **Step 1: Verify reconnect already handled**

Search for `needsReauth` in `garmin-sync-panel.tsx`. If a "Reconnect Garmin" button already renders when `syncResult.needsReauth === true`, this task is done.

- [ ] **Step 2: If not handled, add the reconnect prompt**

```tsx
{syncResult?.needsReauth && (
  <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
    <p className="text-sm text-amber-800 font-medium">Your Garmin connection needs to be refreshed.</p>
    <p className="text-xs text-amber-700 mt-1">This happens once after a credentials update.</p>
    <Button
      size="sm"
      variant="outline"
      className="mt-3"
      onClick={() => router.push('/api/devices/garmin/connect')}
    >
      Reconnect Garmin
    </Button>
  </div>
)}
```

- [ ] **Step 3: Test the reconnect path**

In Supabase, set a test user's `access_token` to `invalid`. Trigger sync. Confirm the reconnect prompt appears. Click it. Confirm a fresh OAuth flow starts and completes successfully.

- [ ] **Step 4: Commit**

```bash
cd v0 && git add components/garmin-sync-panel.tsx
git commit -m "fix(garmin): add reconnect prompt for credential-rotated tokens"
```

---

## Phase 5: Launch (Day 17+)

### C5 — Beta User Email

**Gate: T5 (Production credentials live) + T6 (reconnect prompt working). Do not send before both are confirmed.**

- [ ] **Step 1: Export the send list from Supabase**

```sql
SELECT au.email, p.display_name
FROM auth.users au
JOIN profiles p ON p.auth_user_id = au.id
WHERE au.created_at < '<beta cutoff date>'
ORDER BY au.created_at;
```

- [ ] **Step 2: Send via Resend**

Subject: `Garmin Connect is now available in RunSmart`

Body:

```
Hey [first name],

Garmin Connect support is now available in RunSmart.

You can connect your Garmin account to import recent runs and, when available
from your device and permissions, recovery signals such as sleep, HRV, stress,
and Body Battery.

What you can do:
- Import Garmin runs into RunSmart
- See Garmin activities in your run history
- Use available Garmin recovery data to improve your daily coaching
- Keep new activities syncing automatically after Garmin Connect receives them

If you were already connected during beta, you may see a "Reconnect Garmin"
prompt. Tap it once to refresh your connection.

To connect:
Profile → Devices → Connect Garmin Connect

Need help?
runsmart-ai.com/support/garmin or reply to this email.

Run strong,
Nadav
RunSmart
```

**Do not say:** "no restrictions", "all devices", "more than 30 days of history", "unlocks Pro features" — none of these are approved.

---

### B7 — Launch Go/No-Go Review

Run this checklist before any public announcement or paid marketing.

**Free tier and App Store launch — all must be YES:**

- [ ] Production credentials are live and smoke test passed
- [ ] Fresh user OAuth completes on web and iOS
- [ ] First sync imports at least one activity for a new user
- [ ] Reconnect prompt appears when token is invalid
- [ ] Privacy policy is live at `runsmart-ai.com/privacy` with Garmin section
- [ ] `/support/garmin` is live and linked from the sync panel
- [ ] Garmin attribution appears in activity list, recovery cards, and AI insights
- [ ] App Store copy does not say "Works with Garmin Connect" unless B0 Q6 confirmed
- [ ] App Store copy does not claim more than 30 days of history; B0 Q4 confirmed a 30-day maximum
- [ ] No surface implies Garmin endorses RunSmart
- [ ] Fallback coaching works without Garmin connected
- [ ] Commercial terms email has been sent (B0 Step 3)

**Additional gate for paid marketing and Pro tier positioning — all must be YES:**

- [ ] B0 Q1: Garmin confirms subscription use is allowed
- [ ] B0 Q2: Garmin confirms AI coaching insights from Garmin data are allowed
- [ ] B0 Q3: Garmin confirms no license fees for Health API metrics
- [ ] B0 Q5: Garmin provides approved attribution language
- [ ] Unit economics confirmed: revenue per Garmin-connected Pro user is positive after any Garmin-related costs

Do not run paid ads referencing Garmin, include Garmin in App Store subtitle, or make "Powered by Garmin" a headline claim until the paid marketing gate is cleared.

---

## Success Metrics (Review 2 Weeks After Production Launch)

| Metric | Target | Source |
|---|---|---|
| Garmin connect rate (screen → completed) | >30% | PostHog funnel |
| First run import rate | >90% of connects | PostHog: `garmin_first_run_imported` / `garmin_connect_completed` |
| Sync success rate | >95% | PostHog: `garmin_sync_success` / total syncs |
| Week 1 retention — Garmin vs non-Garmin cohorts | Garmin ≥10pp higher | PostHog cohort |
| Support tickets per Garmin user | <5% | Email inbox |
| HRV data present for Garmin users | >60% | Supabase: `WHERE hrv IS NOT NULL` |
| App Store keyword rank for "garmin" | Top 20 running apps | App Store search |
| Revenue per Garmin-connected Pro user | Higher than non-Garmin Pro | PostHog + Stripe |
