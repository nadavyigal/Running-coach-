# Garmin Connect Developer Program - Application Packet (Copy/Paste)

This file is written to be copy/paste-ready for the Garmin Connect Developer Program application form.

CRITICAL: Do not invent facts. Replace any `[[FILL: ...]]` placeholders with your real details before submitting.

---

## App / Company Name

- App name (public): RunSmart (also branded as "Run-Smart" in the marketing site)
- Company / legal entity: [[FILL: legal entity name]]

## Website URL

- Primary website: [[FILL: public website URL]]
- URLs found in repo (verify which is canonical):
  - https://running-coach-nadavyigal-gmailcoms-projects.vercel.app (production per `DEPLOYMENT-STATUS.md`)
  - https://running-coach-fhmqamnqd-nadavyigal-gmailcoms-projects.vercel.app (production per `V0/PRODUCTION_DEPLOYMENT.md`)
  - https://runsmart-ai.com (referenced in docs/emails)
  - https://runsmart.ai (referenced in marketing layout fallback)

## Primary Contact

- Name: [[FILL: primary contact name]]
- Email: [[FILL: primary contact email]]
- Phone (if required): [[FILL: phone]]

Notes (repo references - confirm what to use):
- Marketing footer shows: `hello@runsmart.ai` (`V0/app/landing/layout.tsx`)
- Privacy/terms pages show: `runsmartteam@gmail.com` (`V0/app/landing/privacy/page.tsx`, `V0/app/landing/terms/page.tsx`)

## Company Address / Country

- Address: [[FILL: address]]
- Country: [[FILL: country]]

## App Description (2-4 sentences)

RunSmart is an AI-powered running coach that helps runners build a consistent habit with adaptive training plans. The app supports planning, run logging, and coaching insights, and is designed to be offline-friendly as a Progressive Web App (PWA). With Garmin integration, users can connect their Garmin account and import completed running activities into RunSmart for coaching and training analysis.

## Detailed Use Case (bullet points)

- User taps "Connect Garmin" inside RunSmart.
- User completes Garmin OAuth authorization and explicitly consents to share activity data.
- RunSmart imports completed running activities and stores them in the user's run history.
- Imported runs power training consistency views, coaching insights, and plan adjustments (within RunSmart).
- User can disconnect Garmin at any time and control deletion of imported data.

## Garmin APIs Requested (minimal)

- Garmin Connect Activity API - read/import completed activities (runs) into RunSmart.

We are not requesting additional APIs beyond what's needed to import activity data.

## Data Types Requested (minimal list)

Required (MVP):
- Activity identifier, timestamps, activity type (running)
- Distance, duration, pace/speed, calories (if available)
- Elevation gain (if available)
- Heart rate summary (avg/max) (if available)

Optional (only if provided by the Activity API and user consent permits):
- GPS track/route data for the activity
- Cadence, power, running dynamics fields (when available)

## How Users Connect (OAuth + consent)

- Connection method: OAuth authorization flow initiated from within RunSmart
- User experience: user is redirected to Garmin to sign in and authorize, then returned to RunSmart to finish linking
- RunSmart does not collect Garmin usernames/passwords and does not scrape Garmin Connect

Repo reference (implementation evidence):
- `V0/app/api/devices/garmin/connect/route.ts` (OAuth initiation)
- `V0/app/api/devices/garmin/callback/route.ts` (token exchange + encrypted token storage)
- `V0/app/api/devices/garmin/activities/route.ts` (fetching activity list + filtering running activities)

## Where Data Is Stored (hosting + DB)

Hosting / runtime:
- Next.js (App Router) on Vercel (per `DEPLOYMENT-STATUS.md`, `V0/PRODUCTION_DEPLOYMENT.md`)

Storage (as implemented in repo):
- Local-first storage in the user's browser via IndexedDB (Dexie) (`V0/lib/db.ts`)
- Supabase is also present for server-side auth and beta waitlist storage (`V0/lib/supabase/*`, `V0/lib/server/betaSignupRepository.ts`)

NOTE: Confirm the production storage strategy for Garmin OAuth tokens and imported activities before submission:
`[[FILL: do we store Garmin tokens server-side (recommended) or client-side?]]`

## Who Can Access Data

- Default: Only the authenticated user can access their imported activities in RunSmart.
- Internal access: [[FILL: whether admins/support can access user data, and under what conditions]]

## Data Retention + Deletion Policy

[[FILL: confirm your real policy before submitting. Suggested baseline:]]

- Retention: Keep imported Garmin activities as long as the user keeps them in their account (or until deletion request).
- Disconnect: On Garmin disconnect, revoke/delete stored Garmin OAuth tokens for that user.
- Deletion: Provide an in-app "Delete imported Garmin data" option and/or support-request path; delete within [[FILL: N days]].

## Privacy Policy URL / Terms URL

- Privacy policy: [[FILL: privacy policy URL]]
- Terms of service: [[FILL: terms URL]]

Repo references (existing pages - verify public URLs):
- Privacy: `/landing/privacy` (`V0/app/landing/privacy/page.tsx`)
- Terms: `/landing/terms` (`V0/app/landing/terms/page.tsx`)

IMPORTANT: Update your privacy policy to explicitly cover Garmin-imported activity data before submitting.

## Support / Troubleshooting

- Support email: [[FILL: support email]]
- Support URL: [[FILL: support/help URL]]
- Troubleshooting notes (optional): [[FILL: troubleshooting URL or doc link]]

## Launch Stage

- Stage: [[FILL: alpha / beta / production]]

## Regions Served / Languages

- Regions served: [[FILL: regions]]
- Languages: English (UI uses `lang="en"` in `V0/app/layout.tsx`) + [[FILL: other languages if any]]
