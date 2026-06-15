# Garmin Production — Live Status

> **Read this first in any Garmin work session.** Update it before closing.
> Full plan: `docs/superpowers/plans/2026-06-15-garmin-production-roadmap.md`

---

## Current Phase: PHASE 2 — Garmin Production Gate Remediation

**Open gate:** Garmin Production Gates 1-4 from Garmin's 2026-06-15 response.
**Status as of:** 2026-06-15

---

## Milestone Gates

| Gate | Status | Unblocks |
|---|---|---|
| **B0** — Commercial terms email sent | DONE — email sent and Garmin answers received 2026-06-15 | C4 App Store copy, B7 paid gate |
| **T1** — P0 fixes verified live in production | BLOCKED — web diagnose flow needs iOS/live verification path | T4 submission |
| **T2** — Privacy policy Garmin section live | DONE — Garmin section, anchor, and OpenAI disclosure committed | T4 submission |
| **T3** — 5 screenshots taken | NOT DONE | T4 submission |
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
| **Gate 2** | PUSH webhook verified, User Deregistration endpoint, Data Generator + Partner Verification, Training/Courses API screenshot, 2+ users authorized | BLOCKED / WAITING — webhook code fixed; remaining evidence is manual/Garmin portal |
| **Gate 3** | API Blog signup, team accounts using non-Gmail/non-freemail addresses | BLOCKED / WAITING — manual account setup |
| **Gate 4** | Zipped UX screenshots, brand compliance with GCDP Branding Assets v2 | BLOCKED / WAITING — screenshots + brand review package |

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
| Gate 2 PUSH verification | Garmin Data Generator + Partner Verification, Training/Courses API screenshot, 2+ authorized users |
| Gate 3 account readiness | API Blog signup and team accounts using non-Gmail/non-freemail addresses |
| Gate 4 brand package | Zipped UX screenshots and GCDP Branding Assets v2 compliance review |
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
| Full roadmap | `docs/superpowers/plans/2026-06-15-garmin-production-roadmap.md` |
