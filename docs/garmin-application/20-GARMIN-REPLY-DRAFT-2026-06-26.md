# Email Draft — Reply to Marc Lussi's 2026-06-26 Rejection (01-03 + 04-06)

**Send from:** nadav.yigal@runsmart-ai.com (reply, to preserve thread)
**Reply to:** Elena Kononova / Marc Lussi thread (Garmin Connect Partner Services, ticket 213145/213165)
**Status:** READY TO SEND — `1.0.6 (19)` confirmed live on App Store (2026-07-01), all 6 screenshots recaptured and verified against this build.
**Prepared:** 2026-06-26
**Updated:** 2026-07-01
**Supersedes:** `17-GARMIN-REPLY-DRAFT-2026-06-25.md` (written before Marc's 2026-06-26 rejection; described the wrong/insufficient fixes — kept for history only, do not send)

---

## Pre-send verification (completed 2026-07-01)

1. **Recaptured all 6 Gate-4 screenshots** on the live `1.0.6 (19)` build on a real device (iOS commit `6660f75`, "complete brand compliance for Gate 4 resubmission"):
   - 01: Garmin Connect connection screen — official square `GarminConnectTile` logo, "Connected" status
   - 02: Garmin's own OAuth consent screen (data-sharing permission toggles: Activities/Daily Health Stats/Training)
   - 03: Connected confirmation — same tile, "Connected, Last sync 1 Jul 2026 at 6:40"
   - 04: Report tab activity list — each run shows "Garmin Forerunner 965"
   - 05: Recovery dashboard — Training Readiness + HRV tiles both show "Garmin Forerunner 965"
   - 06: Garmin Wellness screen — "Garmin Forerunner 965" directly under the heading, above the fold
2. **Verified** each against Marc's 2026-06-26 feedback and the Hashiri.AI/NeverDone reference pattern (device model in the metadata line, not bare "Garmin").
3. **Re-zipped** as `runsmart-garmin-screenshots-ios-2026-07-01.zip`.
4. **Asset risk resolved:** unlike the 2026-06-26 fallback (Garmin's general corporate wordmark), build 19 wires in the actual official Garmin Connect square tile (`GarminConnectTile` asset, `IOS RunSmart app/Assets.xcassets/GarminConnectTile.imageset`) — this is the Connect-specific tile Marc asked for, not a substitute. The reply body below has been updated accordingly.

---

## Subject

```
Re: RunSmart — Garmin Production Enablement — Corrected Brand Compliance, All 6 Screens (Ticket 213145/213165)
```

---

## Body (copy/paste — ready to send)

```
Hi Marc, hi Elena,

Thank you for the specific feedback. We've addressed both points and re-verified on a live device.

1. Screens 01-03 (Garmin Connect connection screen):
   Replaced the generic connection icon with Garmin's official Garmin Connect square tile logo.
   It's rendered at its original aspect ratio with no cropping, stretching, or recoloring, per the
   brand guidelines.

2. Screens 04-06 (activity feed, Recovery dashboard, Garmin Wellness):
   These now show the specific connected device model (e.g. "Garmin Forerunner 965") instead of
   the bare word "Garmin." Device identity is captured from Garmin's activity-sync payloads -
   Garmin's daily/wellness summary payloads don't carry a device field, so we cache the most
   recently seen device name per user and reuse it across all three screens.

All fixes are live in production in RunSmart iOS v1.0.6 (build 19), confirmed live on the App
Store on July 1, 2026 and verified on device. Updated screenshot zip attached, 6 screenshots,
recaptured against this build.

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
• runsmart-garmin-screenshots-ios-2026-07-01.zip (6 screenshots)

Happy to provide anything else you need.

Best,
Nadav Yigal
RunSmart
nadav.yigal@runsmart-ai.com
```

---

## Founder checklist before send

- [x] Merge web PR #103 and confirm its ingestion changes are actually deployed to production
- [x] Locally archive/export iOS build 18 for App Store packaging validation
- [x] Move build 18 to `1.0.5 (18)` after App Store Connect rejected the closed `1.0.4` train
- [x] Upload/submit `1.0.5 (18)` → superseded by `1.0.6 (19)` (iOS PR #68, "complete brand compliance for Gate 4 resubmission")
- [x] Confirm `1.0.6 (19)` is genuinely **live** on the App Store — confirmed 2026-07-01, release notes call out "clearer device attribution on runs, recovery, and morning check-in"
- [x] Recapture all 6 Gate-4 screenshots against the live `1.0.6 (19)` build (2026-07-01)
- [x] Re-verify each screenshot against Marc's feedback + Hashiri.AI/NeverDone reference examples — device model shows correctly on 04/05/06, real Garmin Connect square tile shows on 01/03
- [x] Fill in attachment filename in the body above (`runsmart-garmin-screenshots-ios-2026-07-01.zip`)
- [x] Removed the wordmark-vs-Connect-tile caveat — the real square tile is now wired in, no longer a risk to disclose
- [ ] **Send as a reply in the existing thread (ticket 213145/213165), not a new email — this is the one remaining founder-only step**
