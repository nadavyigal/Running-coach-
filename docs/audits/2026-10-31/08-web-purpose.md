# 08. What the web app is for

State: READY FOR APPROVAL
Date: 2026-10-31
Scope: read-only. No product code, Vercel setting or PR changed.

## Answer first

Make the web an iOS acquisition and support site, but do it in two small reversible steps. Do not delete the web app.

1. Now: fix the live privacy page (PR #147), merge PR #149 (docs), and merge PR #150 so `/beta` becomes the one pilot link.
2. Later, behind an env flag: send signed-out visitors of web app screens to `/beta`. Turn it off by removing the flag.

Why: the web app gets almost no use, iOS depends only on a few web paths, and the web currently has no App Store link at all.

## Usage data

PostHog, last 90 days, all `$pageview` events: about 40 views in total.

| Host and path | Views | People |
| --- | --- | --- |
| www `/privacy` | 13 | 12 |
| www `/` | 13 | 10 |
| www `/terms` | 4 | 3 |
| running-coach-puce.vercel.app `/` | 4 | 4 |
| running-coach-puce.vercel.app `/onboarding` | 2 | 1 |
| www `/onboarding`, `/record`; apex `/`, `/privacy`, `/onboarding` | 1 each | 1 each |

Limits: web PostHog loads lazily, so bounces may be missed. Founder and agent traffic is not excluded. Vercel Analytics was not checked (Vercel MCP needs auth). Even with those limits, no web app screen shows real use.

## The three purposes compared

| Purpose | What exists today | What it needs | Risk |
| --- | --- | --- | --- |
| Full web app | `/` renders the full SPA (onboarding first), plus `/today`, `/plan`, `/record`, `/chat`, `/profile`. All return 200. | Ongoing QA on a second client. Parity with iOS. | Effort spent on a surface with near-zero use. The App Store "marketing URL" sends people here, not to the app. |
| iOS acquisition and support site | `/privacy`, `/terms`, `/support`, `/support/garmin`, `/account-deletion` exist. No App Store link anywhere in web main. No Smart App Banner. | App Store link, Smart App Banner, accurate privacy page. | Low, if iOS dependencies below stay untouched. |
| Pilot funnel | Pilot video ends with "Explore RunSmart on the App Store". `/beta` is 404 in production. PR #150 adds it. | `/beta` live, App Store button, optional sign-up form. | Form needs Apps Script and two Vercel env vars. Without them the form says "Registration is not open yet" and the App Store button still works. |

## What iOS and Garmin depend on (must not break)

Checked against iOS `origin/main` and the 1.2.2 (40) IPA `Info.plist`, then probed live on 2026-10-31.

| Path | Used by | Live result |
| --- | --- | --- |
| `/auth/callback?source=ios` | Email sign-in and reset, iOS | 307 to `runsmart://auth/callback` |
| `/auth/callback` | Web sign-in | 307 to `/` |
| `/auth/update-password` | Password reset | 200 |
| `/.well-known/apple-app-site-association` | Universal links. App ID `8VC4R5M425.com.runsmart.lite`, paths `/auth/callback*`, `/auth/update-password`. Entitlement lists `runsmart-ai.com` and `www.runsmart-ai.com`. | 200, `application/json` |
| `/api/generate-plan`, `/api/run-report`, `/api/coach/voice-cue` | iOS app (`RunSmartAPIBaseURL` = `https://www.runsmart-ai.com`) | 405 on GET, 401 on unauthenticated POST. Deployed. |
| `/api/devices/garmin/connect` | iOS Garmin gateway (`RUNSMART_GARMIN_GATEWAY_URL`) | 405 on GET (POST route) |
| `/garmin/connect` | Native Garmin gateway | 503 "temporarily unavailable" (flag off) |
| `/garmin/callback`, `/api/devices/garmin/callback`, `/api/devices/garmin/webhook*` | Garmin OAuth and push | 200 page, 405 on GET, present |
| `/privacy`, `/support`, `/terms`, `/account-deletion` | App Store listing, in-app links | 200 |
| `/api/health` | Monitoring | 200 |

Supabase edge functions `coach_message` and `delete_account` are on Supabase, not Vercel, and are not affected.

The Supabase Auth redirect allow-list was not checked. Any redirect change must keep `/auth/callback` working.

## Problems found

1. **Live privacy page is the old one.** Live `/privacy` says "Last updated February 2, 2026". It does not describe native background location recording or run sharing. PR #148's description says the October 23 policy from open PR #147 was published manually and that a normal deploy of `main` would restore the older one. The newest Production deployment is `main` `33dcbc4f` (29 Oct), and the live page is now the older one. The App Store privacy URL points to this page. This is the most urgent web item.
2. **No App Store link on the web.** The App Store marketing URL is `https://www.runsmart-ai.com`, which opens the web app onboarding.
3. **Two support domains.** `/privacy` and `/support/garmin` say `hello@runsmart.ai`. `/support` and `/account-deletion` say `support@runsmart-ai.com`. `runsmart.ai` has an MX record pointing to a Microsoft tenant. Ownership is not verified.
4. **Duplicate hosts.** `running-coach-puce.vercel.app` and the apex `runsmart-ai.com` both serve the full site with 200 instead of redirecting to `www`.
5. **Live App Store text overstates Garmin.** The live description says "When connected, RunSmart imports activity data from Garmin". The repo copy says Garmin is unavailable, and production Garmin connect is off. The repo copy was not pushed to App Store Connect.

## Options

| Option | What changes | Effort | Reversible by |
| --- | --- | --- | --- |
| A. Status quo | Nothing | 0 | n/a |
| B. Add `/beta` only (PR #150) | One new page and one API route | Merge plus about 30 min founder setup | Revert merge |
| C. B plus flagged redirect | Middleware: if `WEB_MODE=acquisition`, 307 signed-out `/`, `/onboarding`, `/today`, `/plan`, `/record`, `/chat`, `/profile` to `/beta`. Signed-in users and all paths in the table above are untouched. | About 2 to 3 hours plus tests | Unset the env var and redeploy |
| D. Remove the web app | Delete screens | Days | Hard |

Recommendation: B now, C after one week of pilot data. Do not do D.

## Redirect plan (option C)

1. Add the env check in `v0/middleware.ts`. Default off.
2. Allow-list, never redirected: `/auth/*`, `/api/*`, `/garmin/*`, `/.well-known/*`, `/privacy`, `/terms`, `/support*`, `/account-deletion`, `/beta`, `/challenges/*`, `/runs/*/report`, `/(share)/*`, static files.
3. Use 307, not 308, so browsers do not cache it.
4. Test on a Vercel preview: every path in the dependency table returns the same code as today. An iOS email sign-in on the preview host is not possible (AASA is per domain), so test sign-in on production right after the flip.
5. Flip in Vercel production. Probe the table again. Check the newest Production deployment SHA (lessons.md: a merge is not a deploy).
6. Rollback: unset `WEB_MODE`, redeploy.
7. Separately, in Vercel domains: redirect `running-coach-puce.vercel.app` and apex to `www`. Founder action.

## Action on PRs

| PR | State | Recommended action | Why |
| --- | --- | --- | --- |
| [#147](https://github.com/nadavyigal/Running-coach-/pull/147) | Open, mergeable | Merge first, after re-reading the open Garmin OpenAI disclosure note | Restores the accurate privacy page that production lost on 29 Oct |
| [#149](https://github.com/nadavyigal/Running-coach-/pull/149) | Open, mergeable, all checks green | Merge | Docs only. Records the plan approved on 29 Oct. Nothing ships. |
| [#150](https://github.com/nadavyigal/Running-coach-/pull/150) | Open, mergeable, all checks green, Codex review clean on `5d2ac9df` | Merge after #149, then do the setup in `docs/beta/README.md` | Adds the pilot link and the only App Store button on the web |

#149 and #150 both edit `tasks/progress.md`. Merge one, then rebase the other. After the last merge, confirm the Production deployment SHA and probe `/beta` and `/privacy`.

Before #150's form works, the founder must deploy the Apps Script and set `BETA_SHEET_WEBHOOK_URL` and `BETA_SHEET_WEBHOOK_SECRET` in Vercel. The App Store button works without them.

## Founder actions

1. Approve merge order: #147, #149, #150.
2. Set the two beta env vars, or accept that the form stays closed.
3. Confirm who owns `runsmart.ai` and pick one support address.
4. Push the repo App Store description (Garmin unavailable) to App Store Connect with the next submission.
5. Decide on option C after a week of `/beta` data.
