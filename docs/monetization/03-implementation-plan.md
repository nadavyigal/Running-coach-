# Phase 3 Technical Implementation Plan (Repo-specific)

## 3.1 Billing architecture (web)
Provider: Paddle (MoR) with hosted checkout and webhooks.

### New env vars (add to `v0/.env.example` and `v0/.env.local`)
- `PADDLE_ENV=sandbox|production`
- `PADDLE_API_KEY=`
- `PADDLE_WEBHOOK_SECRET=`
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=`
- `PADDLE_PRICE_ID_MONTHLY=`
- `PADDLE_PRICE_ID_ANNUAL=`
- `PADDLE_PRODUCT_ID=` (optional, if needed for catalog queries)

### New server helpers
- Add `v0/lib/billing/paddle.ts`:
  - create Paddle client
  - helper to create checkout session
  - helper to verify webhook signature
  - helper to map Paddle event payloads to internal subscription status

## 3.2 API routes
Add new API routes under `v0/app/api/billing/`:

1) `v0/app/api/billing/checkout/route.ts`
- POST
- Input: `{ priceId, returnUrl }`
- Use Supabase auth (server) to resolve `auth_user_id` and `profile_id`.
- Create checkout session via Paddle API with customer email and `metadata.profile_id`.
- Return checkout URL.

2) `v0/app/api/billing/portal/route.ts`
- POST
- Input: `{ returnUrl }`
- Create customer portal session (if supported by Paddle).
- Return portal URL.

3) `v0/app/api/billing/webhook/route.ts`
- POST
- Verify signature with `PADDLE_WEBHOOK_SECRET`.
- Idempotency: store webhook event id.
- Update subscription record and entitlements in Supabase.

4) `v0/app/api/billing/status/route.ts`
- GET
- Uses Supabase auth to return current entitlements and subscription status to client.

## 3.3 Database/schema changes (Supabase)
Add a new migration in `v0/supabase/migrations/008_billing.sql`.

Suggested tables:
- `billing_customers`
  - `id uuid`, `profile_id uuid`, `provider text`, `provider_customer_id text`, `email text`, `created_at`.
- `billing_subscriptions`
  - `id uuid`, `profile_id uuid`, `provider text`, `provider_subscription_id text`,
  - `plan_tier text` (free|premium), `status text` (trialing|active|past_due|canceled|incomplete),
  - `current_period_end timestamptz`, `cancel_at_period_end boolean`,
  - `price_id text`, `created_at`, `updated_at`.
- `billing_events`
  - `id uuid`, `provider text`, `event_id text`, `payload jsonb`, `processed_at timestamptz`.

Also add RLS policies to ensure `profile_id` scoped access.

## 3.4 Entitlements and feature gating
### Server source of truth
- Add `v0/lib/entitlements.ts`:
  - `getEntitlementsByProfile(profileId)` reads `billing_subscriptions`.
  - map to flags: `ai_coaching_unlimited`, `wearables_sync`, `advanced_plans`, `gps_routes_history`, `route_compare_analytics`, `advanced_insights`.

### Client caching
- After auth, fetch `/api/billing/status` and update local `users` row in Dexie via `v0/lib/dbUtils.ts`.
- Store `subscriptionTier` and `subscriptionStatus` locally for offline gating.

### Gate usage
- Replace testing stub in `v0/lib/subscriptionGates.ts` with entitlements check.
- Keep `ProFeature` enum but map to entitlements.

## 3.5 UI changes
- Pricing page: update `v0/app/landing/pricing/page.tsx` with tiers and CTA.
- Upgrade modal: add `v0/components/upgrade-modal.tsx` and reuse in gated screens.
- Profile badge: update `v0/components/profile-screen.tsx` to show Premium status and manage subscription link.
- Manage subscription page: add `v0/app/billing/page.tsx` to link to portal.
- Graceful past_due: show a banner in `v0/components/today-screen.tsx` or profile.

## 3.6 Analytics (PostHog)
- Add helper functions in `v0/lib/analytics.ts`:
  - `trackUpgradeModalViewed`, `trackCheckoutStarted`, `trackTrialStarted`,
    `trackSubscriptionActivated`, `trackPaymentFailed`, `trackSubscriptionCanceled`.
- Emit events from UI and webhook handlers.

## 3.7 QA and deployment
- Local testing with Paddle sandbox and webhook forwarding.
- Verify:
  - checkout flow
  - webhook updates in Supabase
  - entitlements updated in Dexie
  - UI gating toggles correctly
- Vercel env var checklist: add Paddle keys, PostHog key, Supabase service role key.

## PR-style checklist (execution order)
- [ ] Add Paddle env vars to `v0/.env.example` and Vercel.
- [ ] Add billing tables migration `v0/supabase/migrations/008_billing.sql`.
- [ ] Add Paddle client helper `v0/lib/billing/paddle.ts`.
- [ ] Add `/api/billing/checkout`, `/api/billing/webhook`, `/api/billing/portal`, `/api/billing/status`.
- [ ] Implement entitlements in `v0/lib/entitlements.ts` and update `v0/lib/subscriptionGates.ts`.
- [ ] Update UI: pricing page, upgrade modal, profile badge, manage subscription page.
- [ ] Add PostHog events and wire them to UI and webhook flows.
- [ ] Validate in sandbox and document steps in `docs/monetization/03-implementation-plan.md`.
