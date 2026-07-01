# Email Draft — Reply to Marc Lussi's 2026-07-01 Rejection (3rd Rejection)

**Send from:** nadav.yigal@runsmart-ai.com (reply, to preserve thread)
**Reply to:** Marc Lussi / Elena Kononova thread (Garmin Connect Partner Services, ticket 213145/213165)
**Status:** DRAFT — awaiting founder review. Do NOT send until reviewed; this is an interim reply (fixes in progress, real evidence pending Apple approval), not a resubmission.
**Prepared:** 2026-07-01
**Supersedes:** Do not send `20-GARMIN-REPLY-DRAFT-2026-06-26.md` — it describes the evidence Marc just rejected.

---

## Context for this draft

Marc rejected the `1.0.6(19)` evidence the same day it was sent: "Garmin Wellness" is not a term in his brand guidelines (must be removed, not re-skinned), the logo is still non-compliant, and he asked us to "generate a production app to start all over."

Both root causes are already found and fixed in code (merged to `main` 2026-07-01):
- Renamed the feature away from "Garmin Wellness" everywhere (not just the visible title) — see iOS PR #69.
- Removed a `.clipShape(RoundedRectangle(...))` that was reshaping the official Garmin Connect tile in two places — same PR.
- Version bumped to `1.0.7 (20)` (PR #70) — this is the build the founder will archive/upload next.

This reply is **not** a resubmission. It tells Marc we've made the fixes, shares simulator screenshots as an early confidence check only, and asks two clarifying questions before we do the larger "start all over" work — filing a fresh Developer Portal Production application (tracked as Agentic OS WP-24) is a bigger, harder-to-reverse step than a code fix, and we'd rather sequence it correctly than guess a 4th time.

---

## Subject

```
Re: RunSmart — Garmin Production Enablement — Fixes In Progress, Two Questions Before We Resubmit (Ticket 213145/213165)
```

---

## Body (copy/paste — ready to send once reviewed)

```
Hi Marc, hi Elena,

Thank you for the direct feedback. We've found and fixed both root causes in our codebase:

1. "Garmin Wellness" — you're right that this was never an authorized term. We had invented a
   compound feature name pairing "Garmin" with a label your brand guidelines don't mention. We've
   removed it entirely — not just the on-screen title, but the underlying feature name and routing
   in the app. The screen is now called "Wellness Trends." Garmin device attribution still appears
   inside the screen exactly where your guidelines require it (e.g. "Garmin [device model]" next to
   health data derived from your API), but the feature itself no longer carries your brand name.

2. The logo — we found the official Garmin Connect tile was being rendered with rounded corners in
   our code (a clipShape applied to the image), which alters the mark. That was happening in two
   places in the app. We've removed it from both, so the tile now renders at its native shape with
   no reshaping or cropping.

Both fixes are code-complete and merged. Attached are simulator screenshots so you can confirm
we're heading in the right direction — please treat these as an early check only, not final
evidence. Our next build (v1.0.7, build 20) needs to go through Apple review before we can capture
real-device screenshots against it, and we don't want to send you evidence again that doesn't match
what's actually live. We'll follow up with real-device screenshots once that build is approved and
confirmed live.

Two questions before we do more, since your last message ("generate a production app to start all
over") is a bigger step than a code fix and we'd rather confirm than guess again:

1. To make sure we understand correctly: do you mean we should file a brand-new Production
   application in the Garmin Developer Portal, separate from the application that's now been
   rejected three times, rather than continuing to resubmit against that same record? If so, one
   thing we want to flag before we do it: our production backend currently authenticates using a
   single client ID and secret issued to the existing application. If starting over means a genuinely
   new application with new credentials, that would disconnect our currently-connected Garmin users
   until they reconnect. Is there a way to reset or restart the review on the existing application
   without new credentials, or is a fully new application the only path on your end?

2. What's the right order of operations from your side — should we (a) finish verifying the iOS
   fixes on a real device first and attach that verified evidence to the fresh application when we
   file it, or (b) file the fresh application now and follow up with corrected evidence once it's
   ready? We want to sequence this the way that's actually useful for your review, not assume.

Attached: 5 simulator screenshots (early confirmation only) showing the "Garmin Wellness" rename and
the unclipped Garmin Connect tile — runsmart-garmin-screenshots-ios-2026-07-01-simulator-v2.zip.

Thanks for your patience — we'd rather get this right than keep sending incremental fixes.

Best,
Nadav Yigal
RunSmart
nadav.yigal@runsmart-ai.com
```

---

## Attachment

`docs/garmin-application/runsmart-garmin-screenshots-ios-2026-07-01-simulator-v2.zip` (5 simulator screenshots, iPhone 17 Pro Max, `RUNSMART_DEMO_MODE`/`RUNSMART_SCREENSHOT_MODE`, built from `main` at commit including PR #69 + #70):
- `01-connect-garmin-devices.png` — disconnected state, unclipped Garmin Connect tile
- `03-garmin-connected-state.png` — connected state, unclipped tile
- `04-garmin-imported-runs.png` — Report tab
- `05-garmin-recovery-analytics.png` — Recovery dashboard
- `06-wellness-trends.png` — renamed "Wellness Trends" screen (was "Garmin Wellness")

These are simulator captures, explicitly labeled as such in the email body — not the on-device Gate-4 evidence set.

---

## Founder checklist before send

- [x] Root-caused and fixed both defects Marc flagged (iOS PR #69, merged)
- [x] Version bumped to 1.0.7 (20) for the next archive (iOS PR #70, merged)
- [x] Simulator screenshots captured confirming both fixes visually
- [ ] Review the two clarifying questions above — edit wording if you'd phrase the credential-rotation concern differently
- [ ] Send as a reply in the existing thread (ticket 213145/213165), not a new email
- [ ] Separately: archive/upload/submit 1.0.7 (20) to App Store Connect, wait for approval, confirm live, then recapture all 6 screenshots on a real device — see WP-24 for the fresh Production application filing once Marc responds to the questions above
