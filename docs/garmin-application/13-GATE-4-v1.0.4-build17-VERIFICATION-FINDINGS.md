# Gate 4 v1.0.4 (build 17) — Screenshot + Attribution Verification

**Date:** 2026-06-23  
**Build:** RunSmart iOS 1.0.4 (17), `main` @ `804e386`  
**Capture:** iPhone 17 Pro Simulator, DEBUG demo mode, `SETTLE_SECONDS=25`  
**Zip:** `runsmart-garmin-screenshots-ios-2026-06-22.zip` (6 PNGs)

---

## (a) Is "Garmin Connect" an HRV source in Apple Health?

**Status: NOT VERIFIED ON DEVICE — requires founder hardware check.**

This agent session cannot access a physical iPhone. The open question must be answered manually:

1. iPhone → **Health** → **Browse** → **Heart** → **Heart Rate Variability**
2. Tap any value → **Data Sources & Access**
3. Record every source listed (e.g. "Garmin Connect", "Apple Watch", "iPhone")

**Code behavior (build 17 — conservative policy):**  
`HealthKitSyncService.readDailySnapshot` labels **all** HealthKit HRV as **"Apple Health"** (no per-sample `HKSource` bundle inspection). **"Garmin"** HRV attribution is reserved for the direct Garmin Connect API path only.

So even if Garmin Connect *does* write HRV to HealthKit, the app will still display **"Apple Health"** for that data — matching the stated policy: *"Data read from Apple HealthKit is attributed Apple Health (even if it originated on a Garmin device)."*

Third-party articles disagree on whether Garmin writes HRV to HealthKit; **the Health app source list is the ground truth.**

---

## (b) Simulator screenshot compliance (build 17 demo mode)

| Shot | File | Result | Notes |
|------|------|--------|-------|
| 01 | `01-connect-garmin-devices.png` | **PASS** | Neutral gray link icon (not RS logo) + "Garmin Connect" + **Disconnected** |
| 02 | `02-garmin-oauth-consent.png` | **PASS** (SSO entry) | Real `sso.garmin.com` Sign In page — acceptable per prior Garmin review |
| 03 | `03-garmin-connected-state.png` | **PASS** | Neutral icon + **Connected** + last sync timestamp |
| 04 | `04-garmin-imported-runs.png` | **PASS** | Run rows show plain gray `· Garmin` metadata — **no green Garmin pill** |
| 05 | `05-garmin-recovery-analytics.png` | **PASS** (partial) | "Garmin" under RECOVERY DASHBOARD; HRV tile shows value but **HRV "Garmin" attribution is below the fold** in portrait capture |
| 06 | `06-garmin-wellness.png` | **PASS** (partial) | Neutral header icon + "Garmin" under GARMIN WELLNESS; **footer line** *"Insights derived in part from Garmin device-sourced data."* **requires scroll** — present in code (`GarminWellnessViews.swift`) but not visible in full-screen capture. **Entry point (2026-06-24):** real users reach this screen via **Profile → Connected → Garmin Wellness** tile (WP-15); screenshot mode remains a secondary capture path only |

Demo/preview data intentionally uses `hrvSource: .garmin` for recovery surfaces, so production attribution on those tiles should read **"Garmin"** when demo Garmin data is active.

---

## (c) RS logo + Garmin pairing / recolored Garmin pill?

**No violations found in re-captured screenshots.**

- Garmin Connect sheet headers use a **neutral gray link icon**, not the green RS logo.
- Report imported runs use **plain gray text** `· Garmin` — no stylized green pill.
- The RS logo appears on the Profile avatar and Recovery sheet title ("Recovery"), but **is not paired with the word "Garmin"** on the same label.

**No code fix required for brand compliance based on simulator evidence.**

---

## Device verification checklist (founder — still required)

Install **1.0.4 (17)** via TestFlight/Xcode, then confirm:

- [ ] Health app HRV **Data Sources & Access** list recorded (see section a)
- [ ] Today HRV card: **"Apple Health"** when HealthKit-sourced; **"Garmin"** only for Garmin API or Garmin-via-HealthKit
- [ ] Recovery dashboard HRV tile: same attribution rule
- [x] Simulator: Profile → Connected → **Garmin Wellness** tile opens wellness screen (demo mode, WP-15, 2026-06-24)
- [ ] Profile → Garmin Connect + Garmin Wellness: neutral header icon, visible Garmin attribution (founder device)
- [ ] Report tab: `· Garmin` plain text on imported runs

---

## App Store / Garmin reply readiness

| Item | Status |
|------|--------|
| Brand-compliance screenshots (simulator) | **Ready** — zip updated 2026-06-23 |
| HRV HealthKit source ground truth | **Blocked on device check** |
| In-app attribution on real HealthKit data | **Blocked on device check** |

**Recommendation:** Complete the founder device checklist above before App Store submission and Garmin reply. If Health app shows no Garmin Connect HRV source, document that in the Garmin email — it strengthens the conservative attribution model.
