# Deploy Runbook — RunSmart

> Step-by-step procedures for deploying the web app (Vercel) and iOS app (Capacitor / TestFlight).
> The Release Manager agent role (`docs/agent-os/agent-roles.md`) is responsible for running these checklists.
>
> **Never skip steps.** These exist because skipping them has caused production incidents.

---

## Part 1: Web Deploy (Vercel)

### Pre-deploy Checklist

Run all commands from `v0/`:

```bash
# 1. Lint
npm run lint
# Must exit 0. Fix all errors before continuing.

# 2. Type check
npx tsc --noEmit
# Must exit 0 (or pre-existing errors documented).

# 3. Full test suite
npm run test -- --run
# Must exit 0 (or pre-existing failures documented with evidence).

# 4. Production build
npm run build
# Must complete with no new errors. Warnings are acceptable but investigate.
```

**Environment check (before deploying):**

Verify `v0/.env.local` has these set and pointing at the correct Supabase project:
```
NEXT_PUBLIC_SUPABASE_URL         → must match Supabase Settings > API
NEXT_PUBLIC_SUPABASE_ANON_KEY    → must match same project
SUPABASE_SERVICE_ROLE_KEY        → must match same project
NEXT_PUBLIC_POSTHOG_KEY          → PostHog project key
OPENAI_API_KEY                   → OpenAI key
INTERNAL_JOBS_SECRET             → or CRON_SECRET — used by Garmin job routes
```

Print and verify:
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

The URL subdomain (e.g., `xxxxxxxxxxxx.supabase.co`) must match the project in your Supabase dashboard.

---

### Deploy to Vercel

**Auto-deploy (normal flow):**
```bash
git push origin main
```
Vercel auto-deploys from `main`. Open the Vercel dashboard and wait for the deployment to turn green before running post-deploy checks.

**Manual deploy (if auto-deploy is not configured):**
```bash
cd v0
vercel --prod
```

**Check deployment status:**
- Open [Vercel Dashboard](https://vercel.com/dashboard)
- Confirm the deployment SHA matches your latest commit
- Confirm status is "Ready" (green), not "Error" or "Building"

---

### Post-deploy Checklist

Run within 10 minutes of a successful Vercel deploy:

```bash
# 1. Playwright smoke test on the preview URL
cd v0
PLAYWRIGHT_BASE_URL=https://your-preview-url.vercel.app npm run test:e2e
```

**Manual spot-checks (open the live URL in a browser):**

- [ ] App loads without a white screen
- [ ] Open browser DevTools Console — zero errors, zero 404s
- [ ] Open DevTools Network — no failed API calls on load
- [ ] Navigate to Today screen — loads correctly
- [ ] Navigate to Chat screen — sends a message, gets a response
- [ ] Check PostHog dashboard — events are flowing (within 5 minutes of deploy)

**If any check fails:**
1. Do not promote the preview to production
2. Check Vercel function logs (Vercel Dashboard > Deployment > Functions)
3. Check Supabase logs for backend errors
4. Fix, push, and re-run this checklist from the start

---

## Part 2: iOS Deploy (Capacitor → TestFlight)

### Pre-deploy Checklist

```bash
# 1. Fresh web build
cd v0
npm run build

# 2. Sync to Capacitor
cd ..
npx cap sync ios

# 3. Open in Xcode
npx cap open ios
```

In Xcode, before building:
- [ ] Bundle ID matches App Store Connect: `com.runsmart.app` (verify in Signing & Capabilities)
- [ ] Version number and build number are bumped (increment build number for every TestFlight upload)
- [ ] Signing certificate is valid and not expired
- [ ] Provisioning profile is "App Store Distribution" (not development)
- [ ] HealthKit entitlement is present (if HealthKit is enabled in this build)
- [ ] Push notifications entitlement is present (APNs)

---

### Build and Archive

In Xcode:
1. Select "Any iOS Device (arm64)" as the build target (not a simulator)
2. Product → Archive
3. Wait for archive to complete
4. In the Organizer window: Distribute App → App Store Connect → Upload

---

### TestFlight Distribution

In App Store Connect:
1. Go to your app → TestFlight tab
2. Wait for the build to finish processing (usually 10–30 minutes)
3. Add the build to the "Internal Testing" group first
4. Install on a physical device via TestFlight and run the post-deploy spot-checks below
5. If internal testing passes, add to the "External Testing" group (beta cohort)

---

### Post-deploy Spot-checks (iOS)

Run on a physical iPhone (not a simulator) via TestFlight:

- [ ] App launches without crash
- [ ] Onboarding flow completes
- [ ] Today screen loads correctly
- [ ] Record Run — GPS lock achieved, run records correctly
- [ ] Chat screen — message sends, AI responds
- [ ] Garmin connection status displays correctly (if user has Garmin connected)
- [ ] Push notifications arrive (if applicable to this build)
- [ ] No crash reporter events in Xcode Organizer within 10 minutes of testing

---

## Part 3: Rollback Procedures

### Web rollback (Vercel)

1. Open Vercel Dashboard → Deployments
2. Find the last known-good deployment
3. Click the three-dot menu → "Promote to Production"
4. Verify the previous build SHA is now live

### iOS rollback

TestFlight builds cannot be unpublished once submitted to external testers. Options:
- Submit a new build with the fix as quickly as possible
- Remove the build from the "External Testing" group to prevent new installs
- Contact users directly if a critical crash affects the cohort

---

## Common Failure Modes

| Symptom | First thing to check |
|---------|---------------------|
| Vercel build fails | Run `npm run build` locally in `v0/` — the error is usually visible there |
| 500 on API routes after deploy | Check Vercel Functions tab for the exact error; check env vars |
| Supabase 406 after deploy | Wrong `NEXT_PUBLIC_SUPABASE_URL` — re-copy from Supabase Settings > API |
| iOS app crashes on launch | Check Xcode crash logs; likely a native plugin or entitlement issue |
| Garmin sync not firing | Check Vercel cron logs; verify `CRON_SECRET` env var is set on Vercel |
| PostHog events not flowing | Verify `NEXT_PUBLIC_POSTHOG_KEY` is set in Vercel environment variables |
| Chunk 404 in browser | Force a CDN purge or redeploy; clear browser cache for testing |

See `tasks/lessons.md` for full root-cause analysis on each.
