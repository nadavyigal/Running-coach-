# Garmin Production Resubmission — Narrow Scope Draft

> Draft prepared 2026-08-30. Supersedes nothing until the founder approves it.
> Context: the previous application was deactivated 2026-07-01 (Evaluation tier
> was connecting real external users, which Garmin's terms do not permit). See
> `GARMIN-STATUS.md` and Agentic OS WP-24.
>
> **CRITICAL: do not invent facts.** Remaining `[[FILL]]` markers are genuine
> founder-only unknowns. Everything previously marked FILL that could be resolved
> from Garmin's published partner-API behaviour has been resolved and is marked
> **[RESOLVED 2026-08-30]** with its reason.

---

## Why this draft is narrower than the last one

The prior pack asked for what RunSmart eventually wants. This one asks for the
smallest scope that makes the app work at all, because approval probability is
inversely proportional to scope, and a second rejection costs more than a
smaller first win.

Comparable evidence: FMP's "Fitness AI Connector" (`fmp.it.com/en/fitness-ai/`)
holds production Garmin Health API access as a very small operation. Its approved
shape is read-only, single-purpose, no write path, no inferred health claims, and
an explicit "we never sell your data". That is the shape to imitate — not its
product.

**Sequencing:** apply for Application A now. Do not mention Application B's
features in A's submission. Apply for B only after A is approved and live.

---

## The mismatch that must be fixed before submitting

**This is the single highest-risk item in the pack.**

`03-GARMIN_INTEGRATION_SCOPE.md` requests **activity import only** (Activity API):
distance, duration, pace, calories, elevation, HR summary.

The shipped iOS app consumes **Garmin daily wellness data** (Health API):
Body Battery, HRV, sleep, and stress. See
`IOS RunSmart app/Services/Garmin/GarminMappers.swift` and
`Features/Wellness/WellnessTrendsView.swift`, which renders "Body Battery",
"Sleep", "HRV" and a 7-day trend.

Applying for the Activity API while shipping Health API features is the same
class of terms mismatch that caused the 2026-07-01 deactivation. Resolve it
**before** submitting, one of two ways:

- **Option 1 (recommended, narrowest):** apply for the Activity API only, and
  gate every Garmin-sourced wellness surface off until a later Health API
  application is approved. Smallest scope, fastest approval, but the Wellness
  tab loses its Garmin content.
- **Option 2:** apply for Activity + Health API together, and justify each
  wellness field against a named user-facing feature. Larger scope, slower
  review, closer to what is already built.

`[[FILL: founder picks Option 1 or Option 2 — this decision governs the whole pack]]`

---

## Application A — Internal Test

- **Purpose:** verification against founder-owned Garmin accounts only.
- **External users:** none, ever. This is the control that was violated last time.
- **Credentials:** `GARMIN_TEST_CLIENT_ID` / `GARMIN_TEST_CLIENT_SECRET`, never
  the production pair. Environment separation is the root fix from WP-24: today
  every route reads one shared `GARMIN_CLIENT_ID`/`GARMIN_CLIENT_SECRET`.
- **Gate:** `GARMIN_CONNECT_ENABLED` stays off in production until Application B
  passes Production review.

## Application B — Commercial

### What we want
"User connects Garmin, and their completed running activities sync into RunSmart
so the coaching plan reflects what they actually ran."

### What we will import
- Activity ID, start timestamp, activity type (running)
- Distance, duration, pace/speed
- Calories, elevation gain, heart-rate summary (avg/max), where available

### What we will NOT do
- No password collection — OAuth only
- No scraping of Garmin Connect pages
- No selling, reselling, or ad-targeting on Garmin data
- No write path back to Garmin
- No scopes beyond those listed above

### Timing and frequency

- **Initial import window — [RESOLVED 2026-08-30]: not applicable.** Garmin's
  partner APIs deliver only data recorded *after* the user connects (policy
  effective November 2025). There is no historical import to request.
- **Ongoing sync:** user-triggered manual sync, plus webhook/push delivery when
  Garmin Connect syncs.
- Background sync cadence: `[[FILL: confirm the production webhook cadence actually configured]]`

### Backfill behaviour

- **[RESOLVED 2026-08-30]: full-history backfill is not supported, and cannot be.**
  State this plainly — it is a Garmin platform constraint, not a RunSmart choice.
- Product consequence, already handled in-app: a newly connected runner sees an
  empty 7-day trend that fills as they sync. The UI now says so explicitly rather
  than showing a bare "need more data" string.

### Data storage and user control

- Tokens encrypted at rest, used only to retrieve the connected user's activities.
- Disconnect at any time; tokens deleted and revoked on disconnect.
- Deletion of imported Garmin activities on request — `[[FILL: name the actual deletion flow and the SLA you can honour]]`

### Brand compliance
Garmin device-sourced data carries "Garmin [device model]" attribution adjacent to
the heading, and derived insights carry the approved derivation line. Both are
implemented (see `RunSmartAttribution` and `WellnessTrendsView`).

---

## Do not request these — they are not available to partners

Confirmed unavailable through Garmin's partner APIs. Requesting them signals a
misunderstanding of the platform and invites rejection:

- Training Readiness
- Recovery Time
- Training Status
- Acute Load
- Endurance Score

**Live consequence in the shipped app:** `GarminMappers.readinessValue` prefers
`trainingReadiness` and falls back to `bodyBattery`. The first branch is dead code
— Garmin never sends it — so the panel titled **"Training Readiness (7-day)"** in
`WellnessTrendsView` actually renders Body Battery. Rename that panel before
submitting; a reviewer comparing the UI against the requested scope will see a
claim the data cannot support.

RunSmart's own acute/chronic load (`Services/TrainingLoadCalculator.swift`) is
computed in-app from session-RPE and is **not** Garmin-derived. Keep that
distinction explicit in the submission, and keep the Garmin attribution off it.

---

## Pre-submission checklist

| # | Item | State |
|---|---|---|
| 1 | Decide Option 1 vs Option 2 above | `[[FILL]]` |
| 2 | Rename the "Training Readiness (7-day)" panel | open |
| 3 | Split test/production Garmin credentials (WP-24) | open |
| 4 | Resolve remaining `[[FILL]]` in `00`, `01`, `02`, `05`, `06` (61 markers) | open |
| 5 | Confirm `GARMIN_CONNECT_ENABLED` still off in production | open |
| 6 | Re-verify the 9 historical `garmin_connections` rows before re-enabling | open |
