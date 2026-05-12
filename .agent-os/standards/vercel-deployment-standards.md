# Vercel Deployment Standards

## Assumptions
- The main deployable app is `v0/`.
- Vercel is the expected hosting platform.
- `v0/vercel.json` defines cron jobs.

## Before Deploy
- Run `npm run lint` from `v0/`.
- Run `npm run type-check` from `v0/`.
- Run relevant tests.
- Run `npm run build` for deployment-sensitive changes.
- Confirm required env vars exist in Vercel for the target environment.

## Environment Safety
- Keep secrets in Vercel env vars, not code.
- Confirm Supabase project URL matches the intended environment.
- Confirm `NEXT_PUBLIC_SITE_URL` and callback URLs before auth, email, Garmin, or sharing changes.

## Production Verification
- Check deployment status and build logs.
- Smoke test the live route when production behavior changed.
- Check browser console for missing assets/chunks.
- Verify cron/API behavior when touched.

## Rollback
- For risky deploys, note rollback command/path or previous deployment to promote.
- For schema work, include rollback notes in the spec or QA report.
