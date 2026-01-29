# Phase 2 Monetization Plan (Freemium + Subscription)

## Goals and principles
- Fast to ship in 3-7 days, minimal ops burden.
- Freemium with clear premium value drivers: wearables sync, unlimited AI coaching, periodized plans, GPS routes + analysis.
- Keep entitlements server-driven for future iOS parity.

## Tier design
### Free (forever)
- 1 active plan (basic only).
- Limited AI coaching (example: 10 messages/month).
- Manual run logging and basic GPS tracking.
- Basic history and insights (last 30 days).
- Community and streaks remain available.

### Premium
- Unlimited AI coaching.
- Wearables sync (Garmin now; Apple/Strava later).
- Advanced plans and periodization (plan_type advanced/periodized).
- Full GPS route history and route comparison analytics.
- Advanced insights dashboards (performance, recovery, analytics).

## Pricing (Israel-first, then global)
- Israel monthly: 29-39 ILS (recommended: 34 ILS).
- Israel annual: 299-349 ILS (recommended: 319 ILS, ~20% discount).
- Global monthly: 9.99 USD.
- Global annual: 99 USD.
- Early adopter: 24 ILS / 7.99 USD for first 3 months (limited-time).

## Trial and refunds
- 7-day trial, card required.
- Simple refund policy: full refund within 7 days of initial charge.

## Entitlements (hard spec)
| Entitlement | Free | Premium | Notes |
| --- | --- | --- | --- |
| ai_coaching_unlimited | no | yes | Gate AI chat message limit. |
| wearables_sync | no | yes | Gate device connect and sync. |
| advanced_plans | no | yes | Gate advanced/periodized plans. |
| gps_routes_history | limited | yes | Free keeps last 7 GPS runs; Premium full history. |
| route_compare_analytics | no | yes | Gate compare/analysis screens. |
| advanced_insights | no | yes | Gate performance and recovery dashboards. |

## Gating rules mapped to existing UI
- AI coaching limit: `v0/components/chat-screen.tsx` + chat API call flow.
- Wearables sync: `v0/components/device-connection-screen.tsx` and Garmin routes under `v0/app/api/devices/garmin/*`.
- Advanced plans: `v0/components/plan-customization-dashboard.tsx`, `v0/components/plan-template-flow.tsx`, `v0/app/api/training-plan/generate-advanced/route.ts`.
- GPS routes and history: `v0/components/record-screen.tsx`, `v0/components/maps/RunMap.tsx`, `v0/components/route-selection-wizard.tsx`.
- Advanced insights: `v0/components/performance-analytics-dashboard.tsx`, `v0/components/recovery-dashboard.tsx`.

## Upgrade moments (6-10 triggers + copy)
1) AI limit reached
- Copy: "You have hit your free coaching limit. Unlock unlimited AI coaching."

2) Attempt to connect wearable
- Copy: "Sync Garmin and more with Premium for automatic runs and recovery data."

3) Attempt advanced plan feature (periodized or multi-goal)
- Copy: "Advanced plans and periodization are Premium features."

4) Open route comparison analytics
- Copy: "Compare routes and see trends with Premium."

5) After 3rd recorded run
- Copy: "Great start. Unlock deeper insights and full GPS history."

6) End-of-week summary
- Copy: "Upgrade for a personalized coaching plan and advanced analytics."

7) Recovery dashboard access
- Copy: "Unlock recovery insights with Premium."

8) Attempt to view full GPS history
- Copy: "Premium keeps your full GPS history and route analysis."

## Metrics and PostHog events
Add new events to PostHog (client and server):
- upgrade_modal_viewed
- checkout_started
- trial_started
- subscription_activated
- payment_failed
- subscription_canceled
- churn_survey_submitted

Funnels and targets (initial benchmarks):
- Activation (onboarding complete -> first run): 40-60%.
- Trial start rate: 5-12% of activated users.
- Trial to paid: 40-60%.
- Monthly churn: < 6%.
- ARPU: 8-12 USD.

## Solo founder ops loop (playbook usage)
Use `docs/ai-skills/solo-founder-ops.md` for weekly monetization ops:
- Backlog triage for pricing and paywall experiments.
- Release QA before billing changes.
- Growth and GTM cues tied to trial and conversion funnels.
- Advisor update draft with monetization metrics.
