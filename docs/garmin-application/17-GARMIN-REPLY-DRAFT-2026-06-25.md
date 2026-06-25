# Email Draft — Gate 1-4 Corrected Evidence + Training API Scope Update

**Send from:** nadav.yigal@runsmart-ai.com (reply, to preserve thread)
**Reply to:** Elena Kononova thread (Garmin Connect Partner Services, ticket 213145/213165)
**Status:** READY FOR FOUNDER REVIEW
**Prepared:** 2026-06-25
**Context:** Reply to Marc Lussi's 2026-06-22 rejection of screenshots 01/04/05 on brand grounds. All flagged issues fixed and verified live on the App Store (RunSmart iOS v1.0.4, build 17, confirmed live by founder 2026-06-25). This reply also resolves the Training/Courses API transfer-screenshot requirement by removing Training API from scope rather than building workout-push (see "Decision" note below).

---

## Subject

```
Re: RunSmart — Garmin Production Enablement — Corrected Gate 4 Evidence + Scope Update (Ticket 213145/213165)
```

---

## Body (copy/paste)

```
Hi Elena, hi Marc,

Thank you for the detailed feedback on the screenshots. We've fixed all three flagged issues and
re-verified them on a live device, plus closed two other open items from Gate 2. Updated status
below — full details if useful, otherwise the attached zip and this summary should be sufficient.

What changed since our last submission:

1. Brand fixes (Marc's feedback on shots 01/04/05) — all corrected and shipped to the App Store:
   • Shot 01/03 (Garmin Connect connection screen): removed the RunSmart logo paired with the
     "Garmin Connect" name; replaced with a neutral glyph per GCDP Branding Assets v2.
   • Shot 04 (imported runs): removed the recolored green "Garmin" pill; activity rows now show
     plain "date · Garmin" text attribution only.
   • Shot 05 (Recovery dashboard): added a proper "Garmin" title-level attribution and the
     required footer text, "Insights derived in part from Garmin device-sourced data."
   • A related issue we caught ourselves during this pass: our Garmin Wellness screen had the
     same logo-pairing problem and lacked attribution. Fixed the same way, and added a real
     in-app entry point to it (Profile → Connected → Garmin Wellness) — previously that screen
     was only reachable via a debug screenshot harness, which we've replaced with a permanent
     product surface.
   • All fixes are live in production: RunSmart iOS v1.0.4 (build 17), confirmed live on the App
     Store 2026-06-25. Updated screenshot zip attached, now 6 screenshots (added Garmin Wellness).

2. Gate 2 — Partner Verification Endpoint Coverage:
   • GC_ACTIVITY_UPDATE: resolved organically — we've now received and processed multiple real
     activity-update webhook deliveries from connected users over the past three weeks.
   • USER_DEREG: still open. No user has disconnected their Garmin account yet, so we haven't had
     a live deregistration event to demonstrate receipt against. We're monitoring for one and will
     confirm as soon as it clears, or can trigger a controlled test disconnect if that's the
     faster path for you — let us know which you'd prefer.

3. Training/Courses API — removing from scope:
   RunSmart is an import-only product today: we read activity, health, and wellness data from
   Garmin Connect, and we do not write workouts, courses, or any other data back to a Garmin
   device. We don't have a transfer screenshot to provide because there's no transfer
   functionality in the product. Rather than build that out solely to produce a screenshot, we'd
   like to remove Training API from our Developer Portal scope now and keep our enablement request
   scoped to Health + Activity (import-only). We may revisit a workout-push feature once we have
   more usage data to justify the investment, and would reapply for Training API access at that
   point with a real implementation to demonstrate.

Current state, otherwise unchanged from our June 22 evidence:
   • Gate 1 (Legal): privacy policy + OpenAI disclosure, live at
     https://runsmart-ai.com/privacy#garmin-connect-data
   • Gate 3 (Account): API Blog subscription enabled, single non-freemail team account
     (nadav.yigal@runsmart-ai.com)
   • Connected users: still growing organically since our last count (7 active)

Attached:
• runsmart-garmin-screenshots-ios-2026-06-25.zip (6 screenshots, corrected + Garmin Wellness)

Happy to provide anything else you need — let us know on the USER_DEREG path above and we'll move
as fast as you'd like on it.

Best,
Nadav Yigal
RunSmart
nadav.yigal@runsmart-ai.com
```

---

## Founder checklist before send

- [ ] Re-zip the 6 current Gate-4 screenshots (corrected 01/03/04/05 + new Garmin Wellness shot 06) into `runsmart-garmin-screenshots-ios-2026-06-25.zip` — confirm filename matches the body text above
- [ ] Confirm v1.0.4 (build 17) is genuinely the live App Store version before sending (done — founder confirmed 2026-06-25 via the App Store app itself)
- [ ] Decide USER_DEREG path: wait for an organic disconnect, or trigger a controlled test disconnect from your own connected account before sending (your call — either is honest, pick whichever you want to commit to in the email)
- [ ] In the Garmin Developer Portal, actually remove Training API from the app's enabled API scope (manual portal action — not something I can do from here) so the portal state matches what this email claims
- [ ] Send as a reply in the existing Elena Kononova thread (ticket 213145/213165), not a new email

---

## Reference: what this supersedes

- `10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md` — the original Gate 1-4 evidence email, already sent 2026-06-22. Kept for history/structure reference, not to be resent.
- `16-WORKOUT-PUSH-PLAN.md` — parked 2026-06-25; see that file's header note. Training API build-out deferred until traffic justifies revisiting it with Garmin.
```
