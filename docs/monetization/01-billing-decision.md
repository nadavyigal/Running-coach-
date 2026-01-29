# Phase 1 Billing Decision (Israel-first, no entity)

## Decision criteria (score 1-5)
- Onboarding without entity
- Tax/VAT handling and invoicing
- Subscription features (trials, upgrades, proration)
- Webhooks and API quality
- Checkout UX and Apple Pay / Google Pay
- Fees for $9-$15/month product
- Scale from Israel to US/EU
- Time to ship

## Decision matrix (1-5)
| Option | Onboard no entity | Tax/VAT | Subscriptions | Webhooks | Checkout UX | Fees | Scale | Time-to-ship | Total | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A) MoR (Paddle, Lemon Squeezy) | 4 | 5 | 5 | 4 | 4 | 3 | 5 | 5 | 35 | MoR handles tax and invoicing; best for no-entity founders. |
| B) PSP / gateways (Rapyd, PayPal, Israeli gateways) | 1 | 2 | 4 | 4 | 3 | 4 | 4 | 2 | 24 | Usually requires a legal entity and local VAT handling. |
| C) Apple IAP (iOS only) | 1 | 5 | 5 | 4 | 5 | 1 | 5 | 2 | 28 | Required for iOS app subscriptions but not usable for web today. |

## Recommendation (web now)
Primary: Paddle (MoR)
- Why: Fastest path with no entity, handles VAT/sales tax and invoicing, solid subscriptions.
- Checkout: hosted checkout to minimize ops and PCI scope.
- Webhooks: reliable and well-documented.

Plan B fallback: Lemon Squeezy (MoR)
- Use if Paddle onboarding for Israel without entity is blocked or slow.

## Migration path once an Israeli entity exists
- Keep MoR if the ops burden and tax handling are worth the fee.
- If moving to PSP (Stripe, Rapyd, or Israeli gateways), keep the same entitlements model and swap the billing provider in server routes.
- Data migration: map MoR subscription IDs to the new PSP subscription IDs, preserve entitlements in Supabase.

## Open items to verify (marking UNKNOWN)
- UNKNOWN: Does Paddle allow Israeli individual onboarding without an entity? Verify in Paddle onboarding docs or sales chat.
- UNKNOWN: Lemon Squeezy payouts for Israel and any restrictions. Verify in their country support list.
- UNKNOWN: Preferred payout currency and settlement timeline. Verify in provider dashboard during onboarding.
