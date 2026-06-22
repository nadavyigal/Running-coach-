# Gate 4 — iOS Founder Run Sheet

**Purpose:** Capture or refresh 5 PNGs for Marc Lussi Gate 4 evidence from **RunSmart iOS** (canonical UX surface).  
**Checklist:** `08-SCREENSHOT-CHECKLIST.md`  
**Email draft:** `10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md`  
**Zip target:** `runsmart-garmin-screenshots-ios-2026-06-21.zip`

**Current status (2026-06-21):** Simulator capture **4/5 PASS**. Shot 2 shows Garmin **sign-in** (not post-login consent). Zip is ready to attach; replace shot 2 on device only if Garmin asks or you want a stronger consent frame.

---

## Automated script (Simulator)

Requires Xcode and **iPhone 17 Pro Max** simulator (override with `SIM_NAME`).

```bash
bash "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/scripts/capture-gate4-ios-screenshots.sh"
```

**What it does:**

1. Builds RunSmart iOS **Debug** for Simulator (`CODE_SIGNING_ALLOWED=NO`)
2. Boots simulator, installs app, uses `-RUNSMART_DEMO_MODE` + `-RUNSMART_SCREENSHOT_MODE` launch args (no Supabase login)
3. Writes 5 PNGs to `docs/garmin-application/screenshots/`
4. Zips to `docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip`

**Optional env vars:**

| Variable | Default | Purpose |
|---|---|---|
| `SIM_NAME` | `iPhone 17 Pro Max` | Simulator device name |
| `SETTLE_SECONDS` | `12` | Wait before each screenshot |

**Verified 2026-06-21:** script exit 0; 5 PNGs + zip created.

---

## Shot map (5 screenshots → iOS screens)

| # | Output file | iOS screen | How captured (script) | Status |
|---|---|---|---|---|
| 1 | `01-connect-garmin-devices.png` | **Profile** → Garmin Connect sheet, **Disconnected**, **Connect** visible | `-INITIAL_TAB Profile -GATE4_GARMIN_DISCONNECTED -OPEN_SECONDARY garminConnect` | ✅ Simulator |
| 2 | `02-garmin-oauth-consent.png` | **Safari** / `ASWebAuthenticationSession` → Garmin OAuth (consent **after** sign-in) | Opens Garmin OAuth URL in Simulator Safari | ⚠️ Partial — sign-in screen, not consent |
| 3 | `03-garmin-connected-state.png` | **Profile** → Garmin Connect **Connected**, last sync | `-INITIAL_TAB Profile -OPEN_SECONDARY garminConnect` | ✅ Simulator |
| 4 | `04-garmin-imported-runs.png` | **Report** tab → runs with **Garmin** source labels | `-INITIAL_TAB Report` | ✅ Simulator |
| 5 | `05-garmin-recovery-analytics.png` | **Today** → Recovery sheet (readiness, HRV, Garmin wellness) | `-INITIAL_TAB Today -OPEN_SECONDARY recoveryDashboard` | ✅ Simulator |

Resolution: iPhone portrait **1320×2868** (Simulator). Under 5 MB each; all pass.

---

## Founder-only: replace shot 2 on device

Simulator cannot complete Garmin login, so shot 2 may show **Garmin Connect sign-in** instead of the **permission consent** screen. The current zip is acceptable for submission (email draft notes this); retake only if you want a stronger consent frame or Garmin requests it.

**Prereqs:** TestFlight or App Store build, logged into RunSmart, Garmin **not** connected (or disconnect first for a clean Connect flow).

1. Open **Profile** → **Garmin Connect** → tap **Connect**.
2. Complete Garmin sign-in if prompted.
3. Stop on the **OAuth consent** screen (app name + permission scopes) **before** tapping Approve / Allow.
4. Capture: iPhone screenshot (Side + Volume Up).
5. Save over `docs/garmin-application/screenshots/02-garmin-oauth-consent.png` (keep filename).
6. Re-zip (below).

**Tips:** Use a frame without personal email if possible. Portrait is fine. Do not approve until after capture.

---

## Re-zip after any PNG change

From repo:

```bash
cd "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/screenshots"
zip -j ../runsmart-garmin-screenshots-ios-2026-06-21.zip \
  01-connect-garmin-devices.png \
  02-garmin-oauth-consent.png \
  03-garmin-connected-state.png \
  04-garmin-imported-runs.png \
  05-garmin-recovery-analytics.png
```

Confirm:

```bash
ls -lah "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip"
unzip -l "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip"
```

---

## After capture — founder checklist

- [x] 5 PNGs in `screenshots/` (4/5 simulator PASS; shot 2 partial)
- [x] Zip at `runsmart-garmin-screenshots-ios-2026-06-21.zip`
- [ ] Optional: replace shot 2 with device OAuth consent
- [ ] Optional: `curl -H "Authorization: Bearer <token>" https://runsmart-ai.com/api/devices/garmin/diagnose > garmin-diagnose-output.json`
- [ ] Review `10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md` and send from **hello@runsmart.ai**

---

## Share-back

```
Gate 4 iOS: PARTIAL (4/5 simulator; shot 2 sign-in)
Zip: docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip
Shot 2: simulator Garmin sign-in — device consent optional
Marc email: READY FOR FOUNDER REVIEW
```
