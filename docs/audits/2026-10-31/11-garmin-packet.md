# 11. Garmin packet: where RunSmart stands and the smallest permitted route

State: READY FOR APPROVAL
Date: 2026-10-31
Scope: read-only. No Garmin portal action, no email, no env change, no agreement accepted.

## Answer first

Garmin changed its program. The public overview now shows two business tiers, Starter and Enterprise. Starter includes the Activity, Health and Training APIs, push-only delivery, no historical data and limited user capacity. The old Evaluation tier, which caused the July deactivation, is not listed any more.

That opens a permitted route for a few real testers: one Starter app, Activity API only, push-only, with the UX, brand and privacy items done first. It must be confirmed with Garmin in writing before any real user connects, because the July deactivation was for exactly that.

Today nothing works for users. Connect is off in production, all 8 stored connections are `reauth_required`, and no Garmin data has arrived since 30 June.

## Sources

| Source | Notes |
| --- | --- |
| [Garmin Connect Developer Program overview](https://developer.garmin.com/gc-developer-program/overview/) | Public. Fetched 2026-10-31. Tier facts in this doc come from here. |
| [Garmin Connect brand guidelines](https://developer.garmin.com/brand-guidelines/connect/) | Public. Official logos, badges, tile, colors, "do not alter". |
| Garmin developer program guide | Founder's private copy, marked confidential. This repo is public, so nothing from it is reproduced or cited here. |
| Web `origin/main` `33dcbc4f`, PR [#148](https://github.com/nadavyigal/Running-coach-/pull/148), PR #131 (merged 1 Sep) | Code and docs |
| Supabase production, read-only aggregate SQL | Connection states, last data |
| Live probes of `www.runsmart-ai.com` | Gate and page state |
| Gmail | **Not available.** The Gmail connector needs authentication. Latest Garmin correspondence is missing until the founder reconnects it. |

## Five separate things

| Stage | What it means | RunSmart today | Evidence |
| --- | --- | --- | --- |
| 1. Developer acceptance | A business account in the Garmin Connect Developer Program, with team members verified | Account existed. The app was deactivated on 1 Jul. Current portal state (any new app, its tier, its client ID) is **unknown**. | GARMIN-STATUS.md, PR #131. Portal not checked. |
| 2. Sandbox or test access | A way to build and test before real users | The public overview no longer lists a separate evaluation or sandbox tier. Starter is described as for building, testing and launching. Whether a separate test client exists under the new program is **not stated publicly**. | Overview page |
| 3. Production approval | Permission to connect real users | Under the new program, Starter apps can launch to a limited number of users and are marked unverified. Verification happens as part of Enterprise onboarding. RunSmart has neither a Starter app nor an Enterprise review on record. | Overview page. Founder to confirm portal. |
| 4. Health API | Wellness data: sleep, HRV, Body Battery, stress | Included in Starter. Founder chose Activity-only on 1 Sep. The iOS Wellness Trends screen still reads stored Health data. PR #148 filters new Health data unless explicitly enabled. | PR #131, PR #148, iOS code |
| 5. Training API | Pushing workouts to Garmin devices | Included in Starter. Not built in production and removed from scope. | `16-WORKOUT-PUSH-PLAN.md`, GARMIN-STATUS.md |
| 6. Working user authorization | A real user completes OAuth and data flows | No. `GARMIN_CONNECT_ENABLED` is off in production (live `/garmin/connect` returns 503 "temporarily unavailable"). 8 connections, all `reauth_required`, last updated 5 Sep. 6 token rows still stored. 95 activity rows, last 30 Jun. | Live probe, Supabase |

The progress note said 9 `reauth_required` connections in July. The live count today is 8.

## Data flow (as built in main)

1. iOS calls `POST https://www.runsmart-ai.com/api/devices/garmin/connect` (from `RUNSMART_GARMIN_GATEWAY_URL`). Gate checked first.
2. Server builds a PKCE OAuth URL for Garmin. No scope parameter is sent; Garmin's consent page sets permissions.
3. User approves on Garmin. Redirect to `runsmart://garmin/callback` (native) or `/garmin/callback` (web).
4. `POST /api/devices/garmin/callback` exchanges the code at `diauth.garmin.com`, reads the user's granted permissions, stores tokens server-side (AES-256-GCM per privacy page).
5. Garmin pushes data to `/api/devices/garmin/webhook` and `/api/devices/garmin/webhook/[token]`. Rows go to `garmin_activities`, `garmin_daily_metrics` and related tables.
6. iOS reads those tables from Supabase. Some RunSmart AI features send derived data to OpenAI, as the privacy page discloses.

Main still has pull-style sync, backfill and range routes. PR #148 changes delivery to push-only by default, gates history on Enterprise plus permission, and handles permission-change notifications. PR #148 is draft, and its `quality-gates` and `security-scan` checks fail on two dependency advisories.

## Deletion and disconnect

| Path | In code (main) | Live or verified |
| --- | --- | --- |
| User disconnect | `POST /api/devices/garmin/disconnect` revokes the connection. PR #148 adds removing the Garmin user registration before revoking tokens. | Not tested live |
| Garmin deregistration push | Webhook handles `deregistrations`: deletes tokens, marks `revoked`. Imported data stays. | GARMIN-STATUS.md says no deregistration event was ever received |
| Permission change push | Only in PR #148 | Not merged |
| Account deletion | `delete_account` edge function wipes Garmin tables, tokens and connections | Deployed function is version 2 (June). Whether it matches the repo source was not diffed. |
| Delete Garmin data only | Privacy page: email `hello@runsmart.ai` | That domain is not verified as RunSmart's (see 08). The rest of the site uses `support@runsmart-ai.com`. |

## Missing evidence

1. Current portal state: which app exists, its tier, its client ID, team members.
2. Written confirmation from Garmin that a Starter app may connect a small number of real testers, given the July history.
3. Endpoint configuration at Garmin's API tools: push URLs, deregistration, user permission. Domain security review passed.
4. A received deregistration event and a received permission-change event, end to end.
5. Device screenshots of the current UX, including Garmin's OAuth consent screen, using the unaltered official tile from the brand page.
6. Live privacy page that matches the actual scope (Activity-only) and names one working deletion address.
7. Live App Store description that matches reality. Today it says RunSmart imports Garmin data "when connected". The repo copy says unavailable.
8. A demo account for Garmin's reviewer (below).
9. Latest Garmin emails (Gmail not connected).

## Demo account

Needed if Garmin asks to review. Prepare, do not create from this track.

- A RunSmart account with a non-personal email on `runsmart-ai.com`.
- A Garmin Connect account owned by RunSmart with a supported device, or a Garmin-provided test user if Garmin offers one.
- Seeded state: one plan, two recorded runs, Garmin disconnected, so the reviewer can see the full consent flow.
- Credentials go in the Garmin portal or a private channel, never in this repo.

## Consent flow, callbacks and scopes

| Item | Current | Needed for Starter, Activity-only |
| --- | --- | --- |
| Consent entry | Profile, Connections, Garmin tile | Official tile, unaltered. Plain text on what is imported. |
| Redirect URIs | `runsmart://garmin/callback`, `https://www.runsmart-ai.com/garmin/callback` | Register exactly these in the new app |
| Push endpoints | `/api/devices/garmin/webhook`, `/api/devices/garmin/webhook/[token]` | Register, pass domain security review |
| Scopes | Set on Garmin's consent page. Server reads granted permissions after callback. | Activity only. Health off. |
| Historical data | Code exists for backfill | Off. Starter has no historical data. |
| Disconnect | In app | Must also remove the registration at Garmin (PR #148) |

## Smallest permitted route for a few real testers

1. **Founder reads the Garmin program guide** and checks the portal. Records the current app, tier and team list in a private note.
2. **Founder asks Garmin in writing** (through the program's support contact): "We plan a Starter app, Activity API only, push only, no history, for under 10 named testers. Is that permitted for our account after the July deactivation?" Wait for a yes.
3. **Ship the compliance basics on web.** Merge PR #147 (accurate privacy page), set one deletion address, rebase and finish PR #148, get its checks green.
4. **Create one Starter app** in the portal, Activity API only. Put its client id and secret in Vercel production. Configure push and deregistration endpoints. Pass the domain review.
5. **Clean the old state.** Decide with Garmin's guidance whether to delete the 6 stored tokens and the old imported rows from the deactivated app. Ask the 8 old users to reconnect only after step 2's yes.
6. **Next iOS build.** Rename or hide anything Health-based if Health stays off. Use the official tile. Fix App Store text.
7. **Turn on `GARMIN_CONNECT_ENABLED`** only after steps 1 to 6. Invite testers one by one. Watch the first webhook, deregistration and disconnect.

Do not: reuse the old credentials, connect real users before Garmin's written yes, request history, or enable Health "just to test".

## Owner actions

| # | Action | Who | Blocks |
| --- | --- | --- | --- |
| 1 | Reconnect Gmail so the latest Garmin thread can be read | Founder | Accurate status |
| 2 | Read the program guide and the portal; record state privately | Founder | Everything |
| 3 | Send the written question to Garmin | Founder | Real testers |
| 4 | Approve merging #147, finishing #148 | Founder | Privacy, delivery |
| 5 | Pick one support and deletion address | Founder | Privacy page |
| 6 | Create the Starter app and set env vars | Founder | Connect |
| 7 | Decide what to do with old tokens and data | Founder, with Garmin's guidance | Clean restart |
| 8 | Update App Store description | Founder | Store accuracy |

Related concern: `docs/garmin-application/` in this public repo already names Garmin staff and quotes their emails. Consider moving private correspondence out of the public repo. Not changed here.
