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

This reply is **not** a resubmission. It's short and text-only: tells Marc we're fixing the codebase, that real screenshots follow once the new build is Apple-approved, and asks two short questions before we do the larger "start all over" work — filing a fresh Developer Portal Production application (tracked as Agentic OS WP-24) is a bigger, harder-to-reverse step than a code fix, and we'd rather sequence it correctly than guess a 4th time.

---

## Subject

```
Re: RunSmart — Garmin Production Enablement (Ticket 213145/213165)
```

---

## Body (copy/paste — ready to send once reviewed)

```
Hi Marc, hi Elena,

We're fixing our codebase now to comply with your comments — removing "Garmin Wellness" and
fixing the logo issue. Once the new build is approved by Apple, I'll send another email with
screenshots as requested.

Two quick questions on "start all over":

1. Does that mean a new Developer Portal app with new credentials? That would disconnect our
   current connected users — can we reset the existing application instead?
2. Should we verify on a real device first, then file the new app — or file it now and send
   evidence after?

Thanks,
Nadav
```

---

## Attachment

None — this reply is text only. Real-device screenshots follow in a separate email once `1.0.7 (20)` is approved by Apple and confirmed live, per the body above.

The simulator screenshots captured this session (`docs/garmin-application/runsmart-garmin-screenshots-ios-2026-07-01-simulator-v2.zip`) are kept in the repo for the founder's own reference/confidence check, but are not attached to this email.

---

## Founder checklist before send

- [x] Root-caused and fixed both defects Marc flagged (iOS PR #69, merged)
- [x] Version bumped to 1.0.7 (20) for the next archive (iOS PR #70, merged)
- [x] Simulator screenshots captured confirming both fixes visually
- [ ] Review the two clarifying questions above — edit wording if you'd phrase the credential-rotation concern differently
- [ ] Send as a reply in the existing thread (ticket 213145/213165), not a new email
- [ ] Separately: archive/upload/submit 1.0.7 (20) to App Store Connect, wait for approval, confirm live, then recapture all 6 screenshots on a real device — see WP-24 for the fresh Production application filing once Marc responds to the questions above
