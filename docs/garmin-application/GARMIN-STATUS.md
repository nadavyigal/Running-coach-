# Garmin Production — Live Status

> **Read this first in any Garmin work session.** Update it before closing.
> Full plan: `docs/superpowers/plans/2026-06-15-garmin-production-roadmap.md`

---

## Current Phase: PHASE 2 — Garmin Production Gate Remediation

**Open gate:** Garmin Production Gates 1-4 from Garmin's 2026-06-15 response.
**Status as of:** 2026-06-21

---

## Milestone Gates

| Gate | Status | Unblocks |
|---|---|---|
| **B0** — Commercial terms email sent | DONE — email sent and Garmin answers received 2026-06-15 | C4 App Store copy, B7 paid gate |
| **T1** — P0 fixes verified live in production | BLOCKED — web diagnose flow needs iOS/live verification path | T4 submission |
| **T2** — Privacy policy Garmin section live | DONE — Garmin section, anchor, and OpenAI disclosure committed | T4 submission |
| **T3** — 5 screenshots taken | PARTIAL — iOS simulator 4/5; shot 2 OAuth consent needs device capture | T4 submission |
| **T4** — Garmin Production enablement submitted | IN PROGRESS — awaiting Garmin response / Gate 1-4 evidence | T5, T6, Phase 4 |
| **T5** — Production credentials live in Vercel | NOT DONE | C5 beta email |
| **T6** — Reconnect prompt for existing users | NOT DONE | C5 beta email |
| **B7** — Go/No-Go checklist passed (free gate) | NOT DONE | Public launch |
| **B7+** — Go/No-Go paid gate (B0 answered) | PARTIAL — Q1-Q4 answered, Q5/Q6 brand review pending | Paid marketing |

---

## Garmin Production Gates

| Gate | Requirement | Status |
|---|---|---|
| **Gate 1** | Privacy policy anchor link + OpenAI disclosure | IN PROGRESS — code committed; confirm live deployment and Garmin review |
| **Gate 2** | PUSH webhook verified, User Deregistration endpoint, Data Generator + Partner Verification, Training/Courses API screenshot, 2+ users authorized | PARTIAL — Data Generator + Partner Verification run 2026-06-21; 7 active users, HTTP/Ping PASS; GC_ACTIVITY_UPDATE coverage resolved organically (2026-06-25, 11 real receipts/21 days); USER_DEREG coverage still open (no deregistration event received yet); Training API being removed from scope rather than producing a transfer screenshot |
| **Gate 3** | API Blog signup, team accounts using non-Gmail/non-freemail addresses | PASS — team audit + blog notify enabled (nadav.yigal@runsmart-ai.com) 2026-06-21 |
| **Gate 4** | Zipped UX screenshots, brand compliance with GCDP Branding Assets v2 | BRAND FIXES DONE (2026-06-22) — Marc rejected shots 01/04/05; fixed in iOS app (3 Swift files, build PASS) and re-captured → `runsmart-garmin-screenshots-ios-2026-06-22.zip`. All 4 flagged shots verified compliant against the real brand PDF + approved examples. Remaining: swap official Garmin Connect tile into modal (founder fetches asset); capture full UX flow if Marc wants every surface. See `12-MARC-2026-06-22-REJECTION-REMEDIATION-PLAN.md` |

---

## Commercial Terms

| Gate | Garmin Answer | Status | Impact |
|---|---|---|---|
| **Q1** — Subscription use | YES | Confirmed | Garmin-imported activity data may be used inside a subscription product |
| **Q2** — AI coaching from Garmin data | YES | Confirmed | AI coaching, training adjustments, and recovery insights may derive from Garmin data |
| **Q3** — License fees | NO fees | Confirmed | No Garmin license fees, revenue share, or Health API usage fees were stated |
| **Q4** — Historical data | 30 days max | Confirmed limit | Marketing and product copy must not claim more than 30 days of historical data |
| **Q5/Q6** — Attribution + "Works with Garmin Connect" | Deferred to brand guidelines | Pending compliance review | Keep conservative wording until brand approval |

---

## What's Done

| Item | Commit | Date |
|---|---|---|
| OAuth token/revoke URL fixed (`diauth.garmin.com`) | `ed0142d` | 2026-06-15 |
| HRV field names fixed (`lastNight`, `weeklyAvg`) | `ed0142d` | 2026-06-15 |
| iOS native OAuth gateway (`/app/garmin/connect`) | `39ed45c` | 2026-06-15 |
| Signed state carries `authUserId` + `profileId` | `39ed45c` | 2026-06-15 |
| Callback fallback for iOS (no session cookie) | `39ed45c` | 2026-06-15 |
| iOS GoalFocusEditor build error fixed | `8eadd88` | 2026-06-15 |
| Unified Garmin roadmap plan committed | `061a115` | 2026-06-15 |
| Privacy policy Garmin section | `f9b3297` | 2026-06-15 |
| `/support/garmin` help page | `e1cfb3e` | 2026-06-15 |
| Privacy anchor + OpenAI disclosure for Gate 1 | `5fe7ab0` | 2026-06-15 |
| Webhook async 200 + User Deregistration handling | `2cc4228` | 2026-06-15 |
| Commercial terms answers recorded | docs update | 2026-06-15 |

---

## In Progress

| Item | Date | Notes |
|---|---|---|
| T4 Garmin Production enablement | 2026-06-15 | Garmin responded with Gate 1-4 requirements; preparing evidence package |
| Gate 2 evidence package | 2026-06-15 | Webhook async response and deregistration code are fixed; Garmin portal/data-generator steps remain manual |

---

## Blocked / Waiting

| Item | Waiting on |
|---|---|
| Gate 1 privacy review | Live deployment check + Garmin compliance review of anchor/OpenAI disclosure |
| Gate 2 endpoint coverage | GC_ACTIVITY_UPDATE + USER_DEREG need webhook receipt in 24h (may clear after next live user activity/deregistration) |
| Gate 4 brand package | Shot 2 OAuth consent (device) + Q5/Q6 formal badge review |
| T4 Garmin Production submission | Gate 1 + Gate 2 + Gate 3 + Gate 4 evidence |
| T5 credential rotation | Garmin Production approval (~Day 17) |
| T6 reconnect prompt | T5 |
| C5 beta email | T5 + T6 |
| C4 App Store keywords | Brand guidance Q5/Q6 + v14 approved |
| B7 paid marketing gate | Brand guidance Q5/Q6 + positive unit economics |
| `garmin_activity_points` migration (GPS routes) | Post-v14 sprint |
| Vitest OOM fix | Background task running |

---

## Session Log

| Date | What was done | What's next |
|---|---|---|
| 2026-06-15 | Research, P0 implementation QA, iOS build fix, pushed to main, wrote all three plans + unified roadmap | Send B0 email; verify T1 live; write privacy policy; take screenshots; submit T4 |
| 2026-06-15 | Received Garmin commercial answers; recorded Q1 YES, Q2 YES, Q3 no fees, Q4 30-day max; added Privacy Gate 1 anchor/OpenAI disclosure; fixed webhook to return HTTP 200 asynchronously and handle User Deregistration | Push docs; confirm privacy deploy; complete Gate 2 portal verification, Gate 3 accounts, Gate 4 screenshots/brand review |
| 2026-06-21 | Supabase migration applied; portal audit: app Approved (Evaluation tier), 7 connected users, team members PASS; blog notify master switch off; API Tools blocked on credentials | Founder: API Tools login → Partner Verification + Data Generator + Test Push; enable blog notify; Gate 4 screenshots; send Marc Lussi email |
| 2026-06-21 | Browser session: Partner Verification run (HTTP/Ping/Active User PASS); Data Generator Daily+Activity; blog notify enabled | Optional: shot 2 OAuth consent on device; send Marc Lussi email from hello@runsmart.ai |
| 2026-06-21 | Gate 4 iOS: Simulator capture 4/5 (Profile Garmin connect/disconnect, Report Garmin runs, Recovery dashboard); zip `runsmart-garmin-screenshots-ios-2026-06-21.zip`; web Playwright path retired | Replace shot 2 with OAuth consent if Garmin requires; send Marc Lussi email |
| 2026-06-22 | Gate 4 docs: `11-GATE-4-IOS-FOUNDER-RUN-SHEET.md`; checklist + email draft aligned; zip/screenshots verified on disk | Founder: review `10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md`, optional shot 2 + diagnose JSON, send from hello@runsmart.ai |
| 2026-06-22 | QA caught shot 3 (`03-garmin-connected-state.png`) actually showing **Disconnected** — root cause: capture script only `terminate`d the app between launches, so shot 1's disconnected state persisted into shot 3's launch instead of resetting to the demo default (Connected). Reinstalled clean, re-captured (now correctly shows Connected), re-zipped, patched script to uninstall/reinstall before shot 3 | Founder: re-review zip before sending — all 5 shots now verified correct |
| 2026-06-22 | Caught and fixed bad sender/recipient in email draft (`hello@runsmart.ai` did not exist; salutation said "Hi Marc" but the real thread is with Elena Kononova). Corrected to reply from `nadav.yigal@runsmart-ai.com` | Founder sent Gate 1-4 evidence reply to Elena Kononova (ticket 213145/213165) |
| 2026-06-22 | **Gate 1-4 evidence email sent** to Elena Kononova (Garmin Connect Partner Services), reply from nadav.yigal@runsmart-ai.com, zip attached | Await Garmin review; respond promptly if she asks for fixes (GC_ACTIVITY_UPDATE/USER_DEREG coverage, shot 2 consent); do not touch Garmin env vars/credentials until Production approval + explicit founder go-ahead |
| 2026-06-22 | **Brand-completeness sweep + v1.0.4 (17).** Caught during screenshot verification: Garmin Wellness screen also paired the RunSmart logo with the "Garmin Wellness" title (same ownership issue) and lacked attribution. Fixed `GarminWellnessViews` (added "Garmin" attribution + approved insights line) and extended `FlowHeader` neutral-mark rule to `.garminWellness`. Bumped version 1.0.3(16) → 1.0.4(17). Committed previously-stranded Gate-4 screenshot infra. iOS PR #55; web evidence PR (this) adds shot 06 Garmin Wellness, zip now 6 shots | Founder: merge #55 → archive & upload 1.0.4(17) to App Store Connect → submit for review → then reply to Garmin ticket 213145/213165 |
| 2026-06-24 | **WP-15: Garmin Wellness entry point wired.** Shot 06 was previously reachable only via DEBUG screenshot-mode launch args (`RunSmartGate4ScreenshotMode`). Added Profile → Connected → **Garmin Wellness** tile in `ProfileTabView.swift` calling `open(.garminWellness)`; status shows "View" when Garmin Connect is connected, "Connect Garmin first" otherwise. See `15-WP-WIRE-UP-GARMIN-WELLNESS-ENTRY-POINT.md` | Founder: verify on device/TestFlight build 17+; include in next Garmin resubmission evidence if needed |
| 2026-06-22 | **Marc Lussi rejected shots 01/04/05 on brand grounds.** Studied actual `Garmin_Developer_API_Brand_Guidelines.pdf` + 5 approved partner examples. Wrote remediation plan `12-MARC-2026-06-22-REJECTION-REMEDIATION-PLAN.md`. Found rejected screenshots are from the **iOS SwiftUI app**, not web. Implemented 3 Swift brand fixes (build PASS each): (04) `ActivityRow.swift` — removed recolored green "Garmin" pill, now plain `date · Garmin` metadata under title; (05) `RecoveryDashboardView.swift` — added "Garmin" title-level attribution + verbatim "Insights derived in part from Garmin device-sourced data." footer, gated on Garmin connected; (01/03) `SecondaryFlowView.swift` `FlowHeader` — removed RunSmart RS logo paired with "Garmin Connect" name (neutral glyph fallback until official Garmin Connect tile asset added). Re-captured 5 iOS screenshots → `runsmart-garmin-screenshots-ios-2026-06-22.zip`; all 4 flagged shots verified compliant | Founder: (a) obtain official Garmin Connect tile from `creative.garmin.com/styleguide/brand/` and swap into `FlowHeader.headerMark`; (b) clear Partner Verification Endpoint Coverage (GC_ACTIVITY_UPDATE + USER_DEREG); (c) D1 build workout-push (Training API) for the transfer screenshot; (d) reply to ticket 213145/213165 with corrected zip |
| 2026-06-26 | **Marc Lussi rejected screenshots again — root cause is deeper than the 06-22 fix.** New feedback: 01-03 need the actual official Garmin Connect square logo/tile (we render an SF Symbol icon — no real logo asset exists in either repo); 04-06 need "Garmin [device model]" attribution, not bare "Garmin" (confirmed via reference examples Garmin sent — Hashiri.AI/NeverDone screenshots always show e.g. "Garmin Forerunner 265S"). Verified directly against live production webhook payloads: `activities[]` entries carry `deviceName` (e.g. "Garmin Forerunner 265"), but `dailies[]`/`stressDetails[]`/`epochs[]` (which feed Recovery dashboard + Garmin Wellness) carry no device field at all — a real Garmin API limitation, not a parsing bug. Wrote `19-MARC-2026-06-26-BRAND-COMPLIANCE-PLAN.md`: obtain the real Garmin Connect tile asset (ask Garmin directly or self-serve from their brand kit) for 01-03; add `device_name` columns to `garmin_activities` + `garmin_connections`, thread through iOS DTOs and into `ActivityRow`/`RecoveryDashboardView`/`GarminWellnessViews` for 04-06. Cross-repo, 6+ files — flagged for founder go-ahead before implementation. **Do not send `17-GARMIN-REPLY-DRAFT-2026-06-25.md` until this ships and is reverified on device** | Founder: approve the plan, then execute in a new session; do not reply to Garmin until screenshots are recaptured and verified against the brand PDF + reference examples |
| 2026-06-25 | **Training API D1 decision reversed: parked, not built.** Founder ran the workout-push plan in Cursor; resulting spec confirmed the real blocker is Garmin's undocumented Training API workout schema/endpoint contract, requiring direct engagement with the same Partner Services team gatekeeping Production approval. Founder agreed it's not worth blocking the reply on — decided to drop Training API from Developer Portal scope now (import-only product) and revisit workout-push once traffic justifies it. Marked `16-WORKOUT-PUSH-PLAN.md` as parked (not deleted). Separately confirmed via direct Supabase query that Gate 2's GC_ACTIVITY_UPDATE coverage gap has closed organically (11 real activity-webhook receipts in the last 21 days); USER_DEREG coverage is still genuinely open (zero deregistration events received). Wrote new reply draft `17-GARMIN-REPLY-DRAFT-2026-06-25.md` covering: corrected Gate-4 screenshots (incl. new Garmin Wellness entry point), GC_ACTIVITY_UPDATE resolution, USER_DEREG still-open status, and the Training API scope-removal decision | Founder: review/edit `17-GARMIN-REPLY-DRAFT-2026-06-25.md`, re-zip the 6 corrected screenshots, manually remove Training API from the Garmin Developer Portal scope, decide USER_DEREG path (wait vs. controlled test disconnect), then send |

---

## Key Contacts and URLs

| Item | Value |
|---|---|
| Garmin submissions email | `api.feedback@garmin.com` |
| Garmin Developer Portal | `developerportal.garmin.com` |
| Diagnose endpoint | `https://runsmart-ai.com/api/devices/garmin/diagnose` |
| Privacy policy live URL | `https://runsmart-ai.com/privacy` |
| Support page (to build) | `https://runsmart-ai.com/support/garmin` |
| Commercial terms tracker | `docs/garmin-application/commercial-terms.md` |
| Gate 4 iOS run sheet | `docs/garmin-application/11-GATE-4-IOS-FOUNDER-RUN-SHEET.md` |
| Gate 4 screenshot zip | `docs/garmin-application/runsmart-garmin-screenshots-ios-2026-06-21.zip` |
| Marc Lussi email draft | `docs/garmin-application/10-MARC-LUSSI-GATE-1-4-EMAIL-DRAFT.md` |
| Full roadmap | `docs/superpowers/plans/2026-06-15-garmin-production-roadmap.md` |
