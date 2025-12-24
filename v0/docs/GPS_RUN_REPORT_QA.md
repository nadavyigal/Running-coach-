# GPS + Run Report QA Checklist

## GPS Tracking (Live)
- Confirm site is served over HTTPS (or `localhost`).
- Start Run: watch callbacks increment and last fix timestamp updates (enable overlay via `?gpsDebug=1` or `NEXT_PUBLIC_GPS_DEBUG_OVERLAY=true`).
- Distance increases steadily during an outdoor run; does not stay near `0.00km` after several minutes.
- Map marker updates each GPS tick; camera follows when running (not paused).
- Low-accuracy behavior: if `Accuracy` stays worse than ±80m, app shows a “Low GPS accuracy” warning and distance may undercount.
- Pause/Resume: pausing stops GPS watch; resuming restarts it and distance continues from prior total.
- Stop: GPS watch is cleared and no further updates arrive (no leaks).

## Run Persistence
- Stopping a run creates a new run record in IndexedDB (Dexie `runs` table) with:
  - `distance`, `duration`, `type`, `completedAt`
  - `gpsPath` (JSON array with `lat`/`lng` + metadata)
  - `gpsAccuracyData` + start/end/avg accuracy (when available)

## Run Report Screen
- After stopping a run, the app navigates to the Run Report screen.
- Map preview renders a polyline and start/end markers.
- Coach Notes auto-generate on first load and persist to the run (`runReport`, `runReportSource`, `runReportCreatedAt`).
- Reloading the page shows the saved Coach Notes without regenerating.

## Coach Notes (AI / Fallback)
- With `OPENAI_API_KEY` configured: `runReportSource` is `ai`.
- Without `OPENAI_API_KEY`: notes still render and `runReportSource` is `fallback`.

