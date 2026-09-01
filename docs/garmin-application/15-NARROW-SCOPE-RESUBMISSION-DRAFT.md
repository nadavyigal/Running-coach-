# Garmin Production Resubmission — Deferred Q1 Activity-Only Draft

> Draft prepared 2026-08-30 and founder decision recorded 2026-09-01.
> Context: the previous application was deactivated 2026-07-01 (Evaluation tier
> was connecting real external users, which Garmin's terms do not permit). See
> `GARMIN-STATUS.md` and Agentic OS WP-24.
>
> **Decision:** Activity API only. Do not submit or reopen commercial Garmin work
> before the later of business registration or Q1 2027 (Agentic OS EXD-031).
> This document is a deferred, decision-ready draft, not an instruction to apply
> now. Health API remains a separate future application.
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

Third-party comparison: FMP's "Fitness AI Connector" (`fmp.it.com/en/fitness-ai/`)
appears to expose a small, read-only Garmin integration. This is anecdotal product
evidence only. It is not official Garmin approval evidence and must not be used to
claim that RunSmart's application will be accepted.

**Sequencing after EXD-031 unlocks:** prepare Application A for founder-owned test
accounts, then apply for Application B with Activity API scope only. Do not mention
Health API features in either Activity submission. A later Health application must
stand on its own user need and approval evidence.

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

Applying for the Activity API while exposing Garmin Health API features is the
same class of terms mismatch that caused the 2026-07-01 deactivation. Resolve it
**before** any future submission:

- **Option 1 — selected 2026-09-01:** apply for the Activity API only, and
  gate every Garmin-sourced wellness surface off until a later Health API
  application is approved. Smallest scope, fastest approval, but the Wellness
  tab loses its Garmin content.
- **Option 2 — declined for this submission:** apply for Activity + Health API together, and justify each
  wellness field against a named user-facing feature. Larger scope, slower
  review, closer to what is already built.

Garmin's public program FAQ permits multiple APIs in one app, so this is a scope
choice rather than a platform limitation. The selected narrow scope follows the
core running-coach use case and keeps wellness hidden until separately approved.

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

- **Initial import window — [CORRECTED 2026-09-01]: up to 30 days.** Garmin's
  2026-06-15 response in `commercial-terms.md` confirms that historical data is
  available for a maximum of 30 days and data older than 30 days is unavailable.
  Garmin's public Activity API page also lists backfill among its developer tools.
  The application must request no more than the confirmed 30-day window.
- **Ongoing sync:** user-triggered manual sync, plus webhook/push delivery when
  Garmin Connect syncs.
- Background sync cadence: `[[FILL: confirm the production webhook cadence actually configured]]`

### Backfill behaviour

- **Limited backfill is supported; full history is not.** Request up to the
  confirmed 30-day maximum. Do not repeat the unsupported claim that Garmin only
  provides post-connection data.
- Product consequence, already handled in-app: a newly connected runner sees an
  initially limited history that fills as ongoing activities sync.

### Data storage and user control

- Tokens encrypted at rest, used only to retrieve the connected user's activities.
- Disconnect at any time; tokens deleted and revoked on disconnect.
- Deletion of imported Garmin activities on request — `[[FILL: name the actual deletion flow and the SLA you can honour]]`

### Brand compliance
Garmin device-sourced data must carry Garmin attribution on primary and secondary
screens, and derived insights must follow Garmin's derivation requirements. Treat
the existing `RunSmartAttribution` and wellness implementation as items to verify
against the current Garmin Developer API Brand Guidelines before submission, not
as pre-approved compliance.

---

## Do not request unsupported metrics in the Activity-only submission

The selected application is for completed running activities only. Do not request
or claim the following metrics unless Garmin partner documentation or support
explicitly confirms access under an approved scope:

- Training Readiness
- Recovery Time
- Training Status
- Acute Load
- Endurance Score

**Live consequence in the shipped app:** in the iOS repository,
`GarminMappers.readinessValue` prefers `trainingReadiness` and falls back to
`bodyBattery`, while `WellnessTrendsView` labels the result **"Training Readiness
(7-day)"**. The currently verified contract does not support presenting those two
metrics as interchangeable. Rename the panel to match the actual value, or remove
the branch, before any Garmin surface is re-enabled. Do not claim that the branch
is impossible without a partner-document or Garmin-support citation.

RunSmart's own acute/chronic load (`Services/TrainingLoadCalculator.swift`) is
computed in-app from session-RPE and is **not** Garmin-derived. Keep that
distinction explicit in the submission, and keep the Garmin attribution off it.

---

## Pre-submission checklist

| # | Item | State |
|---|---|---|
| 1 | Decide Option 1 vs Option 2 above | **done — Option 1, 2026-09-01** |
| 2 | Rename the "Training Readiness (7-day)" panel | open — required before Garmin re-enable, not Q4 work |
| 3 | Split test/production Garmin credentials (WP-24) | open |
| 4 | Resolve remaining `[[FILL]]` in `00`, `01`, `02`, `05`, `06` (61 markers) | open |
| 5 | Confirm `GARMIN_CONNECT_ENABLED` still off in production | open |
| 6 | Re-verify the 9 historical `garmin_connections` rows before re-enabling | open |

## Sources to re-check at the future submission gate

- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) — activity fields, push/ping delivery and backfill tools.
- [Garmin Connect Developer Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/) — multiple APIs may be used in one app.
- [Garmin Developer Program overview](https://developer.garmin.com/gc-developer-program/overview/) — Activity versus Health API boundaries.
- [Garmin Developer API Brand Guidelines](https://developer.garmin.com/downloads/brand/Garmin-Developer-API-Brand-Guidelines.pdf) — attribution and derived-data presentation.
- `commercial-terms.md` — RunSmart's 2026-06-15 Garmin response confirming the 30-day historical-data maximum.
