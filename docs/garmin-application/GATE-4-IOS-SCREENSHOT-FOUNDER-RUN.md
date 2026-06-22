# Gate 4 — iOS Screenshot Founder Run

**Purpose:** Capture 5 PNGs for Marc Lussi Gate 4 evidence from **RunSmart iOS** (canonical UX surface).  
**Checklist:** `08-SCREENSHOT-CHECKLIST.md`  
**Zip target:** `runsmart-garmin-screenshots-ios-2026-06-21.zip`

---

## Option A — Automated Simulator (recommended first)

Requires Xcode, iPhone 17 Pro Max simulator (or set `SIM_NAME`).

```bash
cd "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/scripts"
chmod +x capture-gate4-ios-screenshots.sh
./capture-gate4-ios-screenshots.sh
```

**What it does:**
- Builds Debug with `-RUNSMART_DEMO_MODE` (seeded demo data, no Supabase login)
- Uses launch args from `RunSmartGate4ScreenshotMode.swift` to open the right screens
- Saves PNGs to `docs/garmin-application/screenshots/`
- Zips to `runsmart-garmin-screenshots-ios-2026-06-21.zip`

| # | Output file | Launch args | Screen |
|---|---|---|---|
| 1 | `01-connect-garmin-devices.png` | `-GATE4_GARMIN_DISCONNECTED -OPEN_SECONDARY garminConnect` | Profile → Garmin Connect (disconnected, Connect visible) |
| 2 | `02-garmin-oauth-consent.png` | Safari OAuth URL | Garmin sign-in / consent entry |
| 3 | `03-garmin-connected-state.png` | `-OPEN_SECONDARY garminConnect` | Profile → Garmin Connect (connected + sync) |
| 4 | `04-garmin-imported-runs.png` | `-INITIAL_TAB Report` | Report tab with Garmin-imported runs |
| 5 | `05-garmin-recovery-analytics.png` | `-OPEN_SECONDARY recoveryDashboard` | Recovery dashboard (Garmin wellness) |

**Shot 2 caveat:** Simulator opens Garmin OAuth in Safari. If the capture shows sign-in instead of consent, replace with a **device capture** during a live Connect flow (see Option B step 2).

---

## Option B — Physical device (TestFlight / App Store build)

Use when Garmin requires real OAuth consent or you want production UI.

**Prereqs:** Logged in, onboarding complete. For shots 3–5, Garmin connected with at least one imported run.

| # | Steps | What to show |
|---|---|---|
| 1 | **Profile** tab → tap **Garmin Connect** row (or Devices) | "Connect Garmin" / disconnected state |
| 2 | Tap **Connect** → stop on Garmin **consent** screen **before** Approve | OAuth consent with RunSmart app name + permissions |
| 3 | After connect → **Profile** → **Garmin Connect** | Connected chip, last sync, Sync / Disconnect actions |
| 4 | **Report** tab → scroll run list | Runs labeled **Garmin Connect •** or Garmin import source |
| 5 | **Today** or **Recovery** → open recovery / readiness using Garmin data | HRV, sleep, readiness, or wellness from Garmin |

**Capture:** iPhone screenshot (Side + Volume Up). Portrait is fine; Garmin accepts mobile UX. Aim for legible text; no personal emails in frame if possible.

---

## After capture

1. Confirm 5 PNGs in `docs/garmin-application/screenshots/`
2. Re-zip if needed:
   ```bash
   cd "/Users/nadavyigal/Documents/RunSmart/docs/garmin-application/screenshots"
   zip -j ../runsmart-garmin-screenshots-ios-2026-06-21.zip 0*.png
   ```
3. Attach zip to Marc Lussi email (`10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md`)
4. Optional: replace shot 2 only if Garmin feedback asks for post-login consent

---

## Share-back (paste in chat when done)

```
Gate 4 iOS screenshots: [PASS / PARTIAL — shot 2 device retake needed]
Zip path: docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip
Shot 2 note: [simulator sign-in / device consent captured]
Ready to send Marc email: [yes / no]
```
