# Garmin Application - Gaps & TODO Checklist

This checklist captures the missing details (or missing proof) to finalize a Garmin Connect Developer Program submission.

CRITICAL: Do not invent facts. Fill the placeholders and/or implement the missing items before submitting.

---

## Required Form Fields (fill)

- [ ] Legal entity / company name: `[[FILL]]`
- [ ] Company address + country: `[[FILL]]`
- [ ] Primary contact (name/email/phone): `[[FILL]]`
- [ ] Canonical website URL to use in the form: `[[FILL]]`
- [ ] Support email and/or help URL: `[[FILL]]`
- [ ] Launch stage (alpha/beta/production): `[[FILL]]`
- [ ] Regions served: `[[FILL]]`

## Privacy / Terms (must align to Garmin)

Repo has marketing pages:
- Privacy: `V0/app/landing/privacy/page.tsx` (route `/landing/privacy`)
- Terms: `V0/app/landing/terms/page.tsx` (route `/landing/terms`)

Gaps to address before submission:
- [ ] Update Privacy Policy to explicitly describe Garmin activity data import (data types, purposes, retention, deletion).
- [ ] Add explicit instructions for "Disconnect Garmin" and "Delete imported Garmin data".
- [ ] Confirm whether the privacy/terms URLs are publicly accessible on the canonical domain you will submit.

## Security / Data Handling (confirm + document)

- [ ] Confirm final production storage for Garmin OAuth tokens (server-side recommended) and document it in `docs/garmin-application/02-DATA-FLOW-SECURITY.md`.
- [ ] Ensure `ENCRYPTION_KEY` is set in production (repo has a development fallback in `V0/app/api/devices/garmin/token-crypto.ts`).
- [ ] Confirm if token revocation is implemented on disconnect; if not, implement or document support process.

## Garmin Scope Minimization

- [ ] Verify requested Garmin OAuth scopes are minimal for activity import.
  - Repo currently lists: `activities workouts heart_rate training_data` in `V0/app/api/devices/garmin/connect/route.ts`.
  - For the application, request only what is required for importing activities.

## Screenshots / Proof (commonly requested)

- [ ] Screenshot(s) of the “Connect Garmin” UI
- [ ] Screenshot(s) of the consent/connect flow (post-auth “connected” state)
- [ ] Screenshot(s) showing imported runs in RunSmart history
- [ ] Link to privacy/terms pages (live URLs)

## Optional (nice-to-have)

- [ ] A short “support/troubleshooting” page for Garmin syncing issues
- [ ] An in-app “Export my data” flow that includes imported Garmin activities
