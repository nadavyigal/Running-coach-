# Current Product State

RunSmart Web is an AI running coach web app built as a mobile-first PWA.

## Current Capabilities
- Daily coaching experience centered around Today, next workout, readiness, recovery, and progress.
- Training plan generation and plan display.
- Activity tracking, manual run entry, GPS recording, route maps, and run reports.
- AI coach chat and plan/run guidance through API routes.
- Profile, onboarding, goals, shoes, badges, challenges, wellness, recovery, and insights areas.
- Supabase Auth and cloud persistence/sync are present alongside local-first IndexedDB behavior.
- Garmin integration work exists through device routes, migrations, dashboards, and docs.
- Future direction includes Garmin, Apple Health, native iOS, richer recovery/readiness, and deeper personalization.

## Main Product Principle
RunSmart should feel useful to everyday runners every day: clear next action, trustworthy training guidance, low clutter, and concrete progress feedback.

## Product Standards
- Mobile-first and fast to scan.
- AI-first but not gimmicky.
- Trustworthy around training, recovery, readiness, and limitations.
- Clear about next workout, why it matters, and what to do if the runner feels tired.
- Compatible with future native iOS and wearable integrations.
- Preserve existing behavior unless a spec intentionally changes it.

## Primary User Jobs
- Know what to do today.
- Understand whether to train, recover, or adjust.
- Track runs without friction.
- See progress without parsing dense metrics.
- Ask the coach for practical guidance.
- Keep a plan aligned with real life.

## Main Routes
- `/` and `/today`: main app shell / daily command center.
- `/onboarding`: runner setup and profile creation.
- `/plan`: training plan.
- `/record`: run recording.
- `/chat`: AI coach.
- `/profile`: runner profile and settings.
- `/recovery`, `/wellness`, `/insights/weekly`: health, recovery, and progress insights.
- `/activities/[id]`: activity details.
- `/garmin/*`: Garmin connection and callback flows.
- `/admin/*`: admin analytics/dashboard guarded by admin email config.

## Current Unknowns
- Exact production domain and canonical Vercel project should be confirmed before deploy-specific automation.
- Current source of truth between existing `docs/stories/`, `docs/prd/`, and new `docs/specs/` should be clarified per feature.
