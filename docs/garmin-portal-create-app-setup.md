# Garmin Developer Portal - Create App Setup (RunSmart)

Use this when filling:
`https://developerportal.garmin.com/teams/runsmart_ai/create-app`

Verified on live portal (February 17, 2026): page title `Add App | Garmin Developer Portal`.

---

## 1) Exact Portal Fields (Label -> Value)

- `App name` -> `RunSmart AI`
- `OAuth redirect URL` -> `https://runsmart-ai.com/garmin/callback`
- `Description` -> Use the paragraph in section 3 below
- `Do you plan to use activity data provided by Garmin in an aggregated and anonymous manner, or do you plan to associate the activity data with identifiable users?` -> `Associated with identifiable users`
- `APIs` -> select:
  - `Activity API`
  - `Health API`
  - `Training API`
- `Branding image that we can display when your users register, maximum size is 300x300. Must be URL to hosted image.` -> hosted square logo URL (optional but recommended)
- `Company Website` -> `https://runsmart-ai.com`
- `Contact Phone Number` -> your full number with country code
- `Do you plan to sell activity data provided by Garmin to any third parties?` -> `No`
- `Full Legal Company Name` -> your registered legal entity name
- `Please provide a link to your privacy statement/policy that informs users of the ways you use and disclose their activity.` -> `https://runsmart-ai.com/privacy`
- `Please provide details about how the data will be used and whether you will inform users that their data is being sold.` -> Use section 4 text below
- `What are the specific purposes for which you would use activity data provided by Garmin?` -> Use section 5 text below
- `Product` -> `Connect Developer - Evaluation (1st app should be an evaluation level)`

## 2) Important Defaults to Change

- The form currently preselects `Anonymous` -> change to `Associated with identifiable users`.
- The form currently preselects `Yes` for selling data -> change to `No`.

## 3) Core App Details

- App name: `RunSmart AI`
- Company/Organization: `RunSmart AI`
- App type/platform: `Web Application (PWA)`
- Website URL: `https://runsmart-ai.com`
- Support email: `hello@runsmart.ai` (or your preferred support inbox)
- Privacy policy URL: `https://runsmart-ai.com/privacy`
- Terms URL: `https://runsmart-ai.com/terms`

## 4) Data Use Description (paste-ready)

RunSmart is an AI-powered running coach web app that creates adaptive training plans and coaching insights. Garmin integration is used to import a user's completed running activities and related training metrics after explicit OAuth consent. Data is used only to improve that user's in-app coaching, recovery insights, and progress analytics. We do not sell Garmin data and users can disconnect at any time.

## 5) Purpose Text (paste-ready)

Garmin data is used to personalize each runner's training and recovery recommendations inside RunSmart. We use activity, heart-rate, and training metrics to analyze performance trends, generate adaptive workout plans, and provide post-run coaching insights. Data is processed only for the authenticated user experience in RunSmart and is never sold to third parties.

## 6) Minimal Data Categories to Request

- Running activities (distance, duration, timestamps, pace/speed)
- Heart rate metrics
- Training metrics
- Optional activity fields when available (elevation, running dynamics, GPS track)

## 7) OAuth Configuration in Code (for reference)

- Redirect URI (exact): `https://runsmart-ai.com/garmin/callback`
- Scope string used by app auth URL: `activities workouts heart_rate training_data`
- Source: `v0/app/api/devices/garmin/connect/route.ts`

## 8) After Clicking Create App

Copy credentials from Garmin portal and set:

```env
GARMIN_CLIENT_ID=<from-garmin-portal>
GARMIN_CLIENT_SECRET=<from-garmin-portal>
GARMIN_OAUTH_REDIRECT_URI=https://runsmart-ai.com/garmin/callback
GARMIN_WEBHOOK_SECRET=<random-long-secret>
```

Add these to:
- `v0/.env.local`
- Vercel project environment variables

## 9) Garmin Notification Endpoint (Required For Export Sync)

RunSmart export sync now relies on Garmin notification delivery (Ping/Pull or Push).

- Configure Garmin callback/notification URL to:
  - `https://runsmart-ai.com/api/devices/garmin/webhook?secret=<GARMIN_WEBHOOK_SECRET>`
- Route source:
  - `v0/app/api/devices/garmin/webhook/route.ts`
- Sync consumer route:
  - `v0/app/api/devices/garmin/sync/route.ts`

## 10) Smoke Test

1. Open RunSmart while logged in.
2. Go to profile/device settings and click Connect Garmin.
3. Complete Garmin consent.
4. Confirm redirect lands on `/garmin/callback` and returns to profile.
5. Create/update a Garmin activity (or wait for Garmin export ping/push).
6. Trigger Garmin sync in RunSmart and verify records are imported.
