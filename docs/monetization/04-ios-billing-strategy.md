# Phase 4 iOS Billing Strategy (No Rewrite Later)

## Core rule
- Server is the source of truth for entitlements.

## Entitlement model (shared)
- Use the same entitlement flags for web and iOS:
  - `ai_coaching_unlimited`
  - `wearables_sync`
  - `advanced_plans`
  - `gps_routes_history`
  - `route_compare_analytics`
  - `advanced_insights`

## iOS purchase flow (future)
1) iOS app uses StoreKit 2 to purchase subscription.
2) App sends the App Store transaction or receipt to server.
3) Server validates with App Store Server API.
4) Server updates `billing_subscriptions` with `provider = 'apple'` and sets entitlements.
5) Client fetches `/api/billing/status` and uses the same gating logic.

## Mapping rules
- Web subscription and iOS subscription both map to `plan_tier = premium`.
- Store provider-specific ids in `provider_subscription_id` and `provider_customer_id`.
- Keep provider logic out of UI. UI only reads entitlements.

## Additional endpoints (future)
- `v0/app/api/billing/apple/verify/route.ts`
  - POST: receipt payload
  - Validates and updates entitlements

## Avoid rewrite traps
- Do not hard-code provider names in UI.
- Keep entitlement logic in one place (`v0/lib/entitlements.ts`).
- Keep subscription status in Supabase, not only in Dexie.
