# Email Draft — Reply to Marc Lussi's 2026-06-26 Rejection (01-03 + 04-06)

**Send from:** nadav.yigal@runsmart-ai.com (reply, to preserve thread)
**Reply to:** Elena Kononova / Marc Lussi thread (Garmin Connect Partner Services, ticket 213145/213165)
**Status:** NOT READY TO SEND — see "Why this isn't ready yet" below
**Prepared:** 2026-06-26
**Supersedes:** `17-GARMIN-REPLY-DRAFT-2026-06-25.md` (written before Marc's 2026-06-26 rejection; described the wrong/insufficient fixes — kept for history only, do not send)

---

## Why this isn't ready yet

Per the founder's standing rule: the live App Store build must match the screenshots by the time
Garmin reviews them. Right now it doesn't. Concretely, as of 2026-06-26:

1. **Web PR #103** (threads `deviceName` through ingestion, adds `device_name` columns) is
   **still open, not merged**. The Supabase migration itself is live in production (applied
   directly), but the ingestion code that actually *writes* `device_name` on each sync hasn't
   reached `main`/production yet — until it does, no real device names will populate.
2. **iOS PR #66** (Garmin logo + device-model UI) is **merged to `main`** (build 18), but build 18
   has **not been archived, submitted, or approved** — the last confirmed *live* App Store version
   is v1.0.4 build 17, which does **not** include either fix.
3. **No screenshots have been recaptured** against the new build. The current Gate-4 zip still
   shows the old SF Symbol connection icon and bare "Garmin" text.
4. **Asset risk carried over from the iOS PR**: the logo wired in is Garmin's general corporate
   wordmark ("Garmin Logo Without Delta"), not the Garmin-Connect-app-specific tile from Garmin's
   dedicated branding kit (`developer.garmin.com/downloads/brand/Garmin-Connect-Branding-Assets.zip`).
   This may or may not satisfy Marc's "Garmin square logo" ask — untested against real review.

**Sequence before send:** merge + deploy web PR #103 → bump iOS version, archive, submit, wait for
Apple approval and confirm *live* (not just "Ready for Distribution") → recapture all 6
screenshots on the live build → re-verify each against the brand PDF + Hashiri.AI/NeverDone
reference examples → re-zip → then send this email.

---

## Subject

```
Re: RunSmart — Garmin Production Enablement — Corrected Brand Compliance, All 6 Screens (Ticket 213145/213165)
```

---

## Body (copy/paste — edit screenshot filename/build number before sending)

```
Hi Marc, hi Elena,

Thank you for the specific feedback. We've addressed both points and re-verified on a live device.

1. Screens 01-03 (Garmin Connect connection screen):
   Replaced the generic connection icon with the official Garmin logo. It's rendered at its
   original aspect ratio with no cropping, stretching, or recoloring, per the brand guidelines.

2. Screens 04-06 (activity feed, Recovery dashboard, Garmin Wellness):
   These now show the specific connected device model (e.g. "Garmin Forerunner 265") instead of
   the bare word "Garmin." Device identity is captured from Garmin's activity-sync payloads -
   Garmin's daily/wellness summary payloads don't carry a device field, so we cache the most
   recently seen device name per user and reuse it across all three screens.

All fixes are live in production: RunSmart iOS v[VERSION] (build [BUILD]), confirmed live on the
App Store [DATE]. Updated screenshot zip attached, 6 screenshots, recaptured against this build.

Two items carried over from our last exchange, still open:

Gate 2 - Partner Verification Endpoint Coverage:
   • GC_ACTIVITY_UPDATE: resolved organically - multiple real activity-update webhook deliveries
     received and processed from connected users.
   • USER_DEREG: still open. No user has disconnected their Garmin account yet, so we haven't had
     a live deregistration event to demonstrate receipt against. Monitoring for one organically.

Training/Courses API - requesting your guidance:
   RunSmart is import-only today - we read activity, health, and wellness data from Garmin
   Connect, and don't write workouts or courses back to a device. We don't have a transfer
   screenshot because that functionality isn't built. We're weighing building real workout-push
   versus dropping Training API from scope until we do. Which would you recommend - is there a
   lighter-weight way to demonstrate compliance short of a full transfer, or is removing it from
   scope the cleaner path on your end?

Attached:
• [SCREENSHOT_ZIP_FILENAME].zip (6 screenshots)

Happy to provide anything else you need.

Best,
Nadav Yigal
RunSmart
nadav.yigal@runsmart-ai.com
```

---

## Founder checklist before send

- [ ] Merge web PR #103 and confirm its ingestion changes are actually deployed to production
- [ ] Bump iOS version/build, archive, submit to App Store Connect, wait for approval
- [ ] Confirm the new build is genuinely **live** on the App Store (check the App Store app itself, not just ASC status)
- [ ] Recapture all 6 Gate-4 screenshots against the live build
- [ ] Re-verify each screenshot against the brand PDF + Hashiri.AI/NeverDone reference examples before re-zipping
- [ ] Fill in `[VERSION]`, `[BUILD]`, `[DATE]`, `[SCREENSHOT_ZIP_FILENAME]` placeholders in the body above
- [ ] If Marc's review window is tight and you'd rather not wait for the logo asset risk to resolve itself, consider proactively asking for the Connect-specific tile in this same email rather than waiting for a third rejection
- [ ] Send as a reply in the existing thread (ticket 213145/213165), not a new email
