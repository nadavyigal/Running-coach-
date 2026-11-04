# Beta registration page (approved 2026-10-29)

Founder approved the plan and copy in chat on 2026-10-29. Source plan:
`docs/monetization/06-road-to-10k-plan.md` (Gate B: 30 qualified returning runners).

## Goal
One link the founder sends in LinkedIn messages. A visitor can (1) download the iOS app and
(2) register for the beta group. Each registration is a row in the Google Sheet
"RunSmart Beta Registrations".

## Scope
- `v0/app/beta/page.tsx`: metadata, Apple Smart App Banner (`app-id=6768297840`), share tags.
- `v0/app/beta/beta-client.tsx`: step 1 App Store button, step 2 form, groups, PostHog events
  `beta_page_viewed`, `beta_app_store_clicked`, `beta_registration_submitted` (no PII).
- `v0/app/api/beta/register/route.ts`: zod validation, 5 tries per IP per 10 minutes,
  honeypot, POST to `BETA_SHEET_WEBHOOK_URL` with `BETA_SHEET_WEBHOOK_SECRET`.
- `docs/beta/apps-script.gs` and `docs/beta/README.md`: sheet script and founder setup.

## Copy rules
No performance or medical promises, no competitor claims, no AI-led positioning, no em
dashes, short plain sentences. Groups shown exactly as: Beta club (free for life, invited
personally, up to 50), Early signers (first 100 runners who register, $6.49 a month while
subscribed, closes when paid plans go live), Everyone else (3 weeks free, then $12.99 a
month). Paid plans are not live.

## Not in scope
Deploying, setting Vercel env vars, writing to the sheet from anywhere but the route.
