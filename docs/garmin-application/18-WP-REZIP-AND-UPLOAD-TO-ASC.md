# Work Packet: Re-zip Gate-4 screenshots + place into App Store Connect

> Run this in a new session inside `/Users/nadavyigal/Documents/RunSmart` (Codex, with browser
> control). The founder will handle App Store Connect login/2FA manually whenever a password or
> verification code is needed — pause and wait for them at that point rather than guessing
> credentials or trying to bypass auth.

## Why this exists

The 6 Garmin Gate-4 evidence screenshots (brand-fixed, plus the new Garmin Wellness shot) already
exist on disk and are already correct — no new captures needed. Two things are still open:

1. They're currently zipped under last week's filename/date. The Garmin reply draft
   (`docs/garmin-application/17-GARMIN-REPLY-DRAFT-2026-06-25.md`) references a zip named
   `runsmart-garmin-screenshots-ios-2026-06-25.zip` — the actual zip on disk is dated `2026-06-22`.
   Repackage with today's date so the filename matches what the email body says.
2. The founder wants these placed into App Store Connect (ASC) via the browser, not just emailed
   to Garmin. Do this through the actual ASC web UI — there is no API/CLI step here, it's a manual
   upload flow that needs a logged-in browser session.

## Step 1 — Verify and re-zip the screenshots

The 6 source PNGs live at:

```
docs/garmin-application/screenshots/01-connect-garmin-devices.png
docs/garmin-application/screenshots/02-garmin-oauth-consent.png
docs/garmin-application/screenshots/03-garmin-connected-state.png
docs/garmin-application/screenshots/04-garmin-imported-runs.png
docs/garmin-application/screenshots/05-garmin-recovery-analytics.png
docs/garmin-application/screenshots/06-garmin-wellness.png
```

Confirm all 6 exist and are non-empty (`ls -la`). Do not regenerate or recapture them — they were
already verified correct against Garmin's brand guidelines on 2026-06-22/24. If any file is
missing or looks wrong (0 bytes, wildly different size from its neighbors), stop and flag it
rather than improvising a replacement.

Create a new zip at `docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-25.zip`
containing exactly these 6 files (flat, no enclosing folder — match the structure of the existing
`runsmart-garmin-screenshots-ios-2026-06-22.zip`, which you can inspect with `unzip -l` for
reference). Leave the old 2026-06-22 zip in place; don't delete it.

## Step 2 — Place the screenshots into App Store Connect

Open App Store Connect in the browser (https://appstoreconnect.apple.com). When a login page or
2FA prompt appears, stop and tell the founder you're waiting on credentials — do not attempt to
fill in a password yourself.

Once logged in, navigate to the RunSmart app's listing. The founder hasn't specified the exact
destination tab (App Store screenshots for the public listing vs. some other surface) — ask them
to confirm which of these they mean before uploading anything, since these are Garmin Gate-4
*evidence* screenshots (Profile/Garmin Connect, Recovery dashboard, Garmin Wellness, etc.), not
necessarily intended as public App Store marketing screenshots:

- If they mean the **App Store product page screenshots** (Media Manager, per-device-size
  screenshot sets): confirm which device-size slot and which screenshot(s) should be
  added/replaced before uploading — don't overwrite an existing live screenshot without explicit
  confirmation of which slot.
- If they mean something else (e.g. attaching to a TestFlight build's "What to Test" notes, or a
  review-notes attachment), confirm the exact location first.

Do not publish/submit any App Store Connect change without the founder explicitly confirming it
first — uploading to a draft/unpublished version is fine, but don't trigger a new submission for
review as a side effect of this task.

## Done when

- `runsmart-garmin-screenshots-ios-2026-06-25.zip` exists in `docs/garmin-application/` with the
  6 correct files inside.
- The founder has confirmed where in App Store Connect the screenshots should go, and they're
  placed there (or the founder has explicitly deferred that step).
- Report back exactly what was uploaded and where, plus anything left pending the founder's
  decision.
