# Regression Checklist

Run the relevant parts after meaningful app changes.

## Core Pages
- [ ] `/`
- [ ] `/today`
- [ ] `/onboarding`
- [ ] `/plan`
- [ ] `/record`
- [ ] `/chat`
- [ ] `/profile`
- [ ] `/recovery`
- [ ] `/wellness`
- [ ] `/insights/weekly`

## Core Flows
- [ ] New user onboarding.
- [ ] Auth sign-up/sign-in/sign-out if auth touched.
- [ ] Today next workout and readiness display.
- [ ] Training plan display and adjustment if plan logic touched.
- [ ] Manual activity/run entry.
- [ ] GPS recording UI if record flow touched.
- [ ] AI coach chat and fallback behavior if AI touched.
- [ ] Profile/settings updates.
- [ ] Supabase sync status and error handling if data touched.
- [ ] Garmin connection/status if integration touched.

## Data Safety
- [ ] Existing local data still loads.
- [ ] Empty/new user state works.
- [ ] No destructive schema changes without migration and rollback notes.
- [ ] RLS policies reviewed for Supabase changes.
