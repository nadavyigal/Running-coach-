# Garmin Application Screenshot Checklist

**Canonical platform:** RunSmart **iOS** (TestFlight, device, or Simulator DEBUG demo mode).  
Web screenshots are **not** used for Gate 4 evidence.

Provide 5 PNG screenshots (1920×1080 or higher preferred; **iOS Simulator portrait 1320×2868 accepted** when labeled as mobile UX). Under 5 MB each.

**Run sheet:** `11-GATE-4-IOS-FOUNDER-RUN-SHEET.md` (founder steps, shot 2 device retake, re-zip)  
**Automated capture:** `scripts/capture-gate4-ios-screenshots.sh`  
**Output zip:** `runsmart-garmin-screenshots-ios-2026-06-21.zip`

---

1. Connect Garmin in device/settings
- **iOS:** Profile tab → CONNECTED → Garmin → sheet shows **Disconnected** and **Connect** control.
- File: `screenshots/01-connect-garmin-devices.png`

2. Garmin OAuth consent screen
- **iOS:** Tap Connect → Safari / `ASWebAuthenticationSession` → Garmin **permission consent** before approval.
- File: `screenshots/02-garmin-oauth-consent.png`
- **Note:** Simulator may show Garmin SSO Sign In only; capture consent on device/TestFlight during real Connect if needed.

3. Post-connection "Connected" state
- **iOS:** Same Garmin sheet with **Connected** status and last sync.
- File: `screenshots/03-garmin-connected-state.png`

4. Imported Garmin activities in run history
- **iOS:** Report tab → Runs list with **Garmin** source labels on imported activities.
- File: `screenshots/04-garmin-imported-runs.png`

5. Data usage (recovery/analytics dashboard)
- **iOS:** Today → Recovery sheet (readiness, HRV, recovery signals from Garmin wellness).
- File: `screenshots/05-garmin-recovery-analytics.png`

---

## 2026-06-21 status

- [x] iOS Simulator capture attempted (iPhone 17 Pro Max, DEBUG demo mode)
- [x] Shots 1, 3, 4, 5 — simulator PASS
- [ ] Shot 2 — replace SSO login with founder OAuth **consent** capture (device/TestFlight)
- [x] Zip: `runsmart-garmin-screenshots-ios-2026-06-21.zip`

## 2026-06-22 correction

- [x] **Found and fixed:** shot 3 (`03-garmin-connected-state.png`) actually showed Garmin **Disconnected** — stale app-container state carried over from shot 1's launch because the capture script only `terminate`d the app between shots instead of reinstalling it. Re-captured with a clean install; now correctly shows **Connected, last sync 22 Jun 2026 at 9:02**. Zip updated in place.
- [x] Capture script (`scripts/capture-gate4-ios-screenshots.sh`) patched to uninstall/reinstall before shot 3 so this doesn't regress on next run.
- [x] All 5 shots now verified correct by visual inspection: 1 disconnected (Connect CTA), 2 Garmin SSO sign-in (not post-login consent — known partial), 3 connected, 4 Garmin-labeled imported runs, 5 recovery dashboard.
