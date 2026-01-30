# Phase 5 Israel Entity Setup Guide (Step-by-step)

## Disclaimer
This is not legal or tax advice. Confirm details with an Israeli accountant.

## Step 1: Choose business type
- Osek Patur: low revenue, no VAT collection; simpler reporting.
- Osek Mursha: VAT registered, required above the exemption threshold or if working with VAT-registered B2B clients.
- Ltd (Hevra Baam): more overhead but better separation and investor-ready.

UNKNOWN: Exact VAT thresholds change; verify with an accountant or the tax authority site.

## Step 2: Register with authorities
- Open file with Income Tax Authority (Mas Hachnasa).
- Register for VAT (if Osek Mursha or company).
- Register with National Insurance (Bituach Leumi).

## Step 3: Open a business bank account
- Required for clean bookkeeping and payout routing from billing providers.

## Step 4: Accounting and invoicing
- Pick an Israeli invoicing tool or accountant-managed solution.
- Ensure invoices align with VAT status (Patur vs Mursha).

## Step 5: Payments impact after entity exists
- Keep MoR (Paddle) if you want tax handling and lower ops.
- Or migrate to PSP (Stripe, Rapyd, Israeli gateways) for lower fees and direct merchant control.
- Update billing onboarding with entity documents and bank account.

## Step 6: Compliance and policies
- Publish Terms and Privacy at `v0/app/landing/terms/page.tsx` and `v0/app/landing/privacy/page.tsx` (already present).
- Keep refund policy short and visible in pricing and checkout.

## Step 7: When entity exists, update the system
- Update Paddle account to business entity details.
- If migrating to PSP, swap provider logic in `v0/lib/billing/*` and keep entitlements model intact.
