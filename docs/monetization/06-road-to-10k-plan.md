# RunSmart: the road to $10K a month

Version 3, 2026-10-29. Supersedes `02-monetization-plan.md` (Paddle, $9.99, 7-day trial) and the 2026-07-26 business review's $29.99 12-week block.
Living page: https://claude.ai/artifact/HPAx4KiAc6XTTPJJ892f1r (private to the founder).

## Verdict

Test the offer, do not forecast from it yet. The price and the staged approach hold. Not proven: that runners finish three weeks, pay, and keep paying, and that any channel brings them in cheaply. The next goal is 30 qualified runners, a clear week-4 result, then real payments and renewals.

Real numbers (Gate A root cause, 2026-10-29): of 13 iOS "people" in PostHog over 30 days, 5 were unit tests sending to live PostHog, 1 was the founder, 5 were Apple App Review, and 2 were real runners. Real runners had 0 sign-in failures and 1 plan failure, from a bare-domain redirect bug fixed on 18 Oct (iOS commit `c606eb9`). Recruiting, not reliability, is the bottleneck.

## The offer

- Free, always: weeks 1-3 of the real adaptive plan, every rebuild inside those weeks, phone GPS, saved runs, history, Apple Health import, basic reflection, safety, account recovery, export and delete.
- Pro, $12.99 a month until cancelled: the plan from week 4 to race day and beyond, every rebuild after the free window, the next goal.
- Garmin stays free. No chat message cap.
- Billing follows the calendar: a runner who pays on day 21 is charged again around day 51 and day 81, so a week-12 race usually comes after a third charge. If a renewal falls in the last 10 days before the race, send a reminder 3 days before it (date, amount, how to cancel). Race day shows: goal done, next charge, cancel in Settings, or pick the next goal.

### Free-window rules

- One free window per account: 21 days from the first plan start.
- An injury or illness pause freezes the clock, up to 14 days, once.
- A new goal, a rebuild, or a reinstall does not restart the window.
- Buying needs an account. Guest mode keeps runs, not the plan past week 3.
- The price is shown at onboarding: "3 weeks free, then $12.99 a month".
- Apple has no 3-week trial, so the free weeks are app-managed with no card. The Apple subscription starts at the week-4 paywall.

## Access groups (decided 2026-10-29)

| Group | Who | Price | Kept / month | Closes |
|---|---|---|---|---|
| Beta club | Runners the founder invites personally | Free for life | -$0.75 (AI cost) | Cap 50 (proposed) |
| Early signers | First 100 who sign up | $6.49 / month while subscribed | $4.57 | 100 members or the day purchases go live, whichever is first |
| Everyone else | All other runners | 3 weeks free, then $12.99 | $9.90 | Never |

- The early-signer deadline keeps the $12.99 test on time; "first 100 payers" would take over a year at current volume.
- Wording: "$6.49 a month for as long as you stay subscribed." Cancel and return means normal price.
- Beta access is tied to the account, granted by the server from a one-time invite code, no Apple purchase.
- Early signers see a second App Store subscription at $6.49 in the same subscription group. Apple offer codes cannot do "for life".
- 100 early signers add at most ~$460 a month, so $10K still needs about 965 runners at $12.99.

## First customer

A runner coming back after a break, with a race or target date, whose week keeps changing. Promise: a usable next workout after life breaks your plan. Proof: a rebuild followed by a completed run.

Do not sell "cheaper than Runna". Runna is $19.99 a month or $119.99 a year (about $10 a month) with one free week (runna.com, checked 2026-10-29).

## Price

Kept per paid month = price minus Apple 15% (Small Business Program, enrollment not yet verified), minus 3% refunds, minus ~$0.75 AI and server cost. US prices; VAT-inclusive storefronts keep less.

| Price | Kept per paid month | Payers for $10K kept |
|---|---|---|
| $9.99 | $7.44 | 1,344 |
| **$12.99** | **$9.90** | **1,010** |
| $14.99 | $11.54 | 866 |

$12.99 needs 25% fewer payers than $9.99. If people do not buy, check the purchase flow and ask why before changing the price. Annual plan only when there is an observed reason.

## What $10K needs

"$10K" here means kept after Apple, before marketing and tax.

- 1,010 payers are charged ~$13.1K and RunSmart keeps ~$10.0K.
- After winning ~289 new payers a month at $15 each, ~$5.7K is left.
- $10K left after marketing needs ~1,780 payers and ~15,100 installs a month.
- $15 per payer at the middle funnel allows at most $0.51 per install, so paid ads are out until conversion is much higher.

| How long a payer stays | New payers / month | Installs / month | Left after $15 per payer |
|---|---|---|---|
| 2.0 months | 505 | 14,960 | $2,425 |
| 2.5 months | 404 | 11,970 | $3,940 |
| 3.0 months | 337 | 9,980 | $4,950 |
| **3.5 months (middle)** | **289** | **8,550** | **$5,670** |
| 5.0 months | 202 | 5,990 | $6,970 |

Middle funnel: 30% of installs start a plan, 45% still training at week 4, 25% of those pay (3.4% install to paid). All guesses; steady state, not a date.

## Gates

**Gate A, current truth.** Unit tests stop sending events to live PostHog; a "Build my plan" card for runners left with no plan (one real runner is stuck this way); a reason on every plan failure; a PostHog filter that excludes tests, TestFlight and App Review; counts reconciled against Supabase. Pass: all done.

**Gate B, 30 runners.** Recruit 30 returning runners (beta club, LinkedIn outreach). Six-week intake window for manual outreach at 5-8 invites a day. Follow each for 28 days. Record invites, source, founder time, rebuilds followed by a run, drop-off reasons. Read 5 real plans and rebuilds for sense and safety.
Engaged at week 4: a prescribed run in the first 7 days, runs in at least 2 of weeks 1-3, and a prescribed run in days 22-28.
- 10+ of 30: go to the payment test. Do not raise the forecast yet.
- 5-9: one fix based on what failed, then a fresh 30.
- 0-4: stop. Look at value, reliability, and who was recruited.
- Under 30 recruited: report as a recruiting failure; do not extend the window.

**Gate C, pay and renew.** Simplest reliable monthly purchase. 30 real paywall views by runners who saw the price at onboarding. Track purchases, refunds, running after paying, second and third charges. Only "everyone else" runners at $12.99 count; beta club and early signers are reported separately. Gate B's runners are mostly the free beta club, so the 30 paywall views come from newly recruited runners outside it, not from Gate B graduates. Friends buying to help do not count.
- Stop: zero purchases after 30 views (under ~10% would pay). One revision allowed, tied to the failure reason.
- Pass: 10 real payers who keep running after paying.

**Gate D, one channel.** One channel, fixed cash and time budget, source kept through the 3-week delay. Judge on payers who stayed. Then rebuild the model with real numbers and a monthly cash view. $1K, $3K, $10K are milestones after Gate D, not dates.

## Build order (one story at a time)

1. Gate A fixes: unit tests stop sending to live PostHog; "Build my plan" recovery card; plan-failure reasons; PostHog filter for tests, TestFlight and App Review.
2. Tracking: plan started, plan week completed, prescribed run done, rebuild followed by a run, paywall seen, purchase, renewal, cancel, race completed; every event keeps the runner's source.
3. Beta registration landing page with a Google Sheet registration table (App Store download + beta sign-up).
4. Price at onboarding and free-window rules, before Gate B.
5. Account groups: beta (invite code), early signer, standard.
6. Server check of Apple purchases: start from Resumely `src/lib/iap.ts` (PR 197); test purchase, restore, expiry, refund, billing retry, duplicate and late notifications.
7. Two App Store products in one group: $12.99, and $6.49 for early signers. Check Paid Apps agreement, Small Business Program enrollment, required subscription text, Terms and Privacy links.
8. Week-4 paywall, renewal reminder, race-day screen, Restore Purchases.

Web billing (Paddle) waits; the paying product is the iOS app.

## Red-team review, 2026-10-29

Accepted: "$10K kept" is before marketing and tax; $0.51 per install ceiling; payer lifetime unproven (sensitivity table); three charges in 12 weeks (reminder); stale activation and vague week-4 bar (Gate A, definition, 5-9 rule); low buy rate is not proof of price; narrow first customer; free-window rules; annual deferred, one channel, Osek Patur before first payment, Apple checks.
Deferred to Gate D: six monthly cohorts by billing date (no payers yet).
Partly: three money lines until revenue exists (charged, kept, left after marketing).

## Risks

- Almost no real runners yet: 2 in the last 30 days. One is stuck with no plan after a bug that is now fixed.
- Osek Patur yearly turnover cap counts Resumely and RunSmart together; confirm the 2026 limit with the accountant before the first payment.
- VAT-inclusive storefronts keep less than the US table.
- Short goals finish inside the free window; count as acquisition cost.
- $0.75 per paid month and free-user AI cost are estimates; measure in Gate B.

## Sources

- Red-team review of v1, 2026-10-29.
- PostHog project 171597: iOS events last 30 days (2026-10-29); people by month (2026-10-28).
- runna.com pricing, 2026-10-29. App Store lookup id 6768297840: RunSmart 1.2.1 live in US and IL, 2026-10-29.
- `docs/monetization/00-05`; Builder OS `Strategy/Monetization.md`, `2026-07-26-runsmart-business-mot.md`.
- Agentic OS `executive-os/EXECUTIVE-METRICS.md` (2026-09-01 activation read).
