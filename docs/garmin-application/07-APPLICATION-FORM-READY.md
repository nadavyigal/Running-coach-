# Garmin Connect Developer Application - Ready to Submit

Use this as the copy-paste source for the Garmin application form.
Business fields are marked with [USER: ...] placeholders to fill manually.

## Business Details (fill placeholders)
- Legal entity name: [USER: legal entity name]
- Company address: [USER: company address]
- Country: [USER: country]
- Primary contact name: [USER: primary contact name]
- Primary contact email: [USER: primary contact email]
- Primary contact phone: [USER: primary contact phone]
- Canonical website URL: [USER: canonical website URL]
- Support email: [USER: support email]

## App Details (pre-filled)
- App name: RunSmart
- Launch stage: Beta
- Regions: Global (primary: Israel)
- Platform: Web (PWA) on Next.js

## Integration Description (pre-filled)
RunSmart is a progressive web app that acts as an AI running coach. It helps runners build consistent habits with adaptive plans, run logging, and coaching insights. Garmin integration lets users import completed running activities after OAuth consent so their real activity history powers coaching, recovery insights, and progress analytics.

## OAuth Scopes Requested and Justification (pre-filled)
- activities: required to import completed run activities (distance, duration, pace, timestamps).
- heart_rate: required for recovery insights and training load context.
- training_data: required for training metrics used in coaching analytics.
- workouts: currently requested in OAuth config but not required for MVP. We can remove this scope if Garmin prefers a minimal scope set.

## Security Summary (pre-filled)
- OAuth tokens are encrypted at rest using AES-256-GCM before storage.
- Tokens are stored locally for the authenticated user and only used to retrieve Garmin activities.
- All Garmin and RunSmart traffic uses HTTPS/TLS in transit.

## Data Use and Controls (pre-filled)
- Data accessed: running activities, heart rate, and training metrics.
- Purpose: import to RunSmart for coaching, recovery scores, and analytics.
- No data resale. No write-back to Garmin.
- Disconnect flow: Settings -> Devices -> Garmin -> Disconnect.
- Deletion: users can delete all imported Garmin data from the app.

## Links (fill placeholders)
- Privacy policy URL: [USER: canonical website URL]/privacy
- Terms of service URL: [USER: canonical website URL]/terms

