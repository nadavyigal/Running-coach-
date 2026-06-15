# Garmin Production — Live Status

> **Read this first in any Garmin work session.** Update it before closing.
> Full plan: `docs/superpowers/plans/2026-06-15-garmin-production-roadmap.md`

---

## Current Phase: PHASE 1 — Send and Verify

**Open gate:** B0 (commercial terms email) — send before doing anything else.
**Status as of:** 2026-06-15

---

## Milestone Gates

| Gate | Status | Unblocks |
|---|---|---|
| **B0** — Commercial terms email sent | NOT DONE | C4 App Store copy, B7 paid gate |
| **T1** — P0 fixes verified live in production | NOT DONE | T4 submission |
| **T2** — Privacy policy Garmin section live | NOT DONE | T4 submission |
| **T3** — 5 screenshots taken | NOT DONE | T4 submission |
| **T4** — Garmin Production enablement submitted | NOT DONE | T5, T6, Phase 4 |
| **T5** — Production credentials live in Vercel | NOT DONE | C5 beta email |
| **T6** — Reconnect prompt for existing users | NOT DONE | C5 beta email |
| **B7** — Go/No-Go checklist passed (free gate) | NOT DONE | Public launch |
| **B7+** — Go/No-Go paid gate (B0 answered) | NOT DONE | Paid marketing |

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

---

## In Progress

_(Move tasks here when started, with date and notes)_

---

## Blocked / Waiting

| Item | Waiting on |
|---|---|
| T4 Garmin Production submission | T1 + T2 + T3 |
| T5 credential rotation | Garmin Production approval (~Day 17) |
| T6 reconnect prompt | T5 |
| C5 beta email | T5 + T6 |
| C4 App Store keywords | B0 answer + v14 approved |
| B7 paid marketing gate | B0 Q1-Q3 answered |
| `garmin_activity_points` migration (GPS routes) | Post-v14 sprint |
| Vitest OOM fix | Background task running |

---

## Session Log

| Date | What was done | What's next |
|---|---|---|
| 2026-06-15 | Research, P0 implementation QA, iOS build fix, pushed to main, wrote all three plans + unified roadmap | Send B0 email; verify T1 live; write privacy policy; take screenshots; submit T4 |

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
