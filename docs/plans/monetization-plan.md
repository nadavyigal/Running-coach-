# RunSmart — Unified Monetization Plan
> Branch: `Monitization` | Merges: Group D (A-D execution pack) + existing subscription infrastructure + marketing psychology

---

## Current State Inventory

### Already Built (do not recreate)

| Asset | Location | State |
|---|---|---|
| `SubscriptionGate` class + `ProFeature` enum | `v0/lib/subscriptionGates.ts` | **Hardcoded `return true`** — testing bypass active |
| User subscription schema | `v0/lib/db.ts` (User interface) | `subscriptionTier`, `subscriptionStatus`, `trialStartDate`, `trialEndDate`, `subscriptionStartDate`, `subscriptionEndDate` |
| Subscription test suite | `v0/lib/__tests__/subscriptionGates.test.ts` | 251 lines, covers trial calc + tier logic |
| PostHog client | `v0/lib/posthog-provider.tsx` + `v0/lib/analytics.ts` | Lazy-loads posthog-js, enriches events with user context |
| PostHog server | `v0/lib/server/posthog.ts` → `captureServerEvent()` | HTTP capture, graceful no-op without env var |
| Analytics event store | `v0/app/api/analytics/events/route.ts` | POST to Supabase `analytics_events` table |
| Email infrastructure | `v0/lib/email.ts` | Resend API, domain `runsmart-ai.com` |
| Garmin callback | `v0/app/garmin/callback/page.tsx:112` | Redirects to `/?screen=profile` on success — hook point for trial |

### Existing ProFeature Enum (to extend, not replace)
```typescript
// v0/lib/subscriptionGates.ts
export enum ProFeature {
  SMART_RECOMMENDATIONS = 'smart_recommendations',      // → readiness drivers panel
  RECOVERY_RECOMMENDATIONS = 'recovery_recommendations', // → under-recovery signature
  ADVANCED_ANALYTICS = 'advanced_analytics',            // → 28-day trends, ACWR
  PERSONALIZED_COACHING = 'personalized_coaching',      // → unlimited AI coach
  UNLIMITED_PLANS = 'unlimited_plans',                  // → plan creation
}
```

---

## What Needs to Be Built (Group D)

### Critical Gap: Two-Layer Gate Problem
The existing `SubscriptionGate` reads from **Dexie (client-side IndexedDB)** — it cannot enforce gates on the server. Group D adds a **Supabase-backed server layer** (`user_entitlements` table) that API routes use, while the existing Dexie layer is updated to sync from Supabase and serve as the client-side cache.

---

## Implementation Plan

### Step 0 — Supabase Migration

**File:** `v0/supabase/migrations/YYYYMMDDHHMMSS_entitlements_group_d.sql`

```sql
create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free', -- free | trial | coached | athlete
  trial_ends_at timestamptz,
  subscription_status text,          -- active | cancelled | expired | null
  stripe_customer_id text,           -- populated when Stripe is wired
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

create policy "user_entitlements_rw_own" on public.user_entitlements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-provision free tier on signup
create or replace function public.handle_new_user_entitlement()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_entitlements (user_id, plan, updated_at)
  values (new.id, 'free', now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_entitlement
  after insert on auth.users
  for each row execute procedure public.handle_new_user_entitlement();

-- View for expiring trials (used by day-5 nudge cron)
create or replace view public.expiring_trials as
  select user_id, trial_ends_at,
         extract(day from trial_ends_at - now())::int as days_remaining
  from public.user_entitlements
  where plan = 'trial'
    and trial_ends_at > now()
    and trial_ends_at <= now() + interval '3 days';
```

---

### Step 1 — Server-Side Entitlements

#### D1a) `v0/lib/billing/entitlements.ts`

Maps plan tiers to allowed features. Bridges to existing `ProFeature` enum.

```typescript
import type { ProFeature } from '@/lib/subscriptionGates'

export type Plan = 'free' | 'trial' | 'coached' | 'athlete'

export type Feature =
  | ProFeature                          // bridge existing enum
  | 'readiness_drivers'                 // Group B panel (drivers + confidence)
  | 'weekly_report_generate'            // Group B POST weekly report
  | 'history_90d'                       // 90-day trend panels
  | 'ai_coach_unlimited'                // >5 questions/day
  | 'post_run_recap'                    // Group B recap feature

const PLAN_FEATURES: Record<Plan, Set<Feature>> = {
  free: new Set([]),
  trial: new Set([
    'readiness_drivers',
    'weekly_report_generate',
    'history_90d',
    'ai_coach_unlimited',
    'post_run_recap',
    // existing ProFeatures:
    'smart_recommendations',
    'recovery_recommendations',
    'advanced_analytics',
    'personalized_coaching',
    'unlimited_plans',
  ]),
  coached: new Set([/* same as trial */]),
  athlete: new Set([/* same as coached + future features */]),
}

// coached = same as trial (trial is a time-limited coached plan)
PLAN_FEATURES.coached = new Set(PLAN_FEATURES.trial)
PLAN_FEATURES.athlete = new Set([...PLAN_FEATURES.coached])

export function planAllows(plan: Plan, feature: Feature): boolean {
  if (plan === 'trial') return PLAN_FEATURES.trial.has(feature)
  return PLAN_FEATURES[plan]?.has(feature) ?? false
}
```

#### D1b) `v0/lib/billing/requireEntitlement.ts` (server-only)

```typescript
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { planAllows, type Feature, type Plan } from './entitlements'

export type EntitlementResult =
  | { allowed: true; plan: Plan }
  | { allowed: false; plan: Plan; feature: Feature; upgradeUrl: string; preview?: unknown }

export async function getEntitlement(authUserId: string): Promise<Plan> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_entitlements')
    .select('plan, trial_ends_at')
    .eq('user_id', authUserId)
    .single()

  if (!data) return 'free'

  // Trial expired → downgrade to free
  if (data.plan === 'trial' && data.trial_ends_at) {
    const expired = new Date(data.trial_ends_at) < new Date()
    if (expired) {
      // Async downgrade (fire and forget)
      void supabase
        .from('user_entitlements')
        .update({ plan: 'free', updated_at: new Date().toISOString() })
        .eq('user_id', authUserId)
      return 'free'
    }
  }

  return data.plan as Plan
}

export async function requireEntitlement(
  authUserId: string,
  feature: Feature,
  previewData?: unknown
): Promise<EntitlementResult> {
  const plan = await getEntitlement(authUserId)
  const allowed = planAllows(plan, feature)

  if (!allowed) {
    return {
      allowed: false,
      plan,
      feature,
      upgradeUrl: `/pricing?feature=${feature}&src=gate`,
      ...(previewData !== undefined ? { preview: previewData } : {}),
    }
  }

  return { allowed: true, plan }
}
```

#### D1c) Update `v0/lib/subscriptionGates.ts`

Remove the testing bypass. Delegate server checks to Supabase when `authUserId` is available; keep Dexie as client-side cache fallback.

```typescript
// Replace lines 26-29 (the hardcoded return true):
static async hasAccess(userId: number, feature: ProFeature): Promise<boolean> {
  // Removed: TESTING MODE bypass
  try {
    const user = await dbUtils.getUser(userId)
    if (!user) return false
    // ... rest of existing logic unchanged
  }
}
```

#### D1d) Gate these specific endpoints

| Endpoint | Feature to gate | Preview payload |
|---|---|---|
| `POST /api/garmin/reports/weekly` | `weekly_report_generate` | Last week's headline only |
| `GET /api/garmin/metrics/readiness` | `readiness_drivers` | `{ score, state }` (no drivers/confidence) |
| `GET /api/garmin/reports/weekly` | `history_90d` | Last 2 weeks only |
| `POST /api/chat` | `ai_coach_unlimited` | Count remaining free questions |
| `GET /api/garmin/activities/[id]/recap` | `post_run_recap` | null |

**Teaser-first pattern** — don't return bare 402. Return:
```json
{
  "error": "entitlement_required",
  "feature": "readiness_drivers",
  "plan": "free",
  "preview": { "score": 74, "state": "moderate" },
  "upgradeUrl": "/pricing?feature=readiness_drivers&src=panel"
}
```

---

### Step 2 — Typed Analytics Events

**File:** `v0/lib/analytics/events.ts`

Thin typed wrapper over existing `captureServerEvent` / `window.posthog.capture`. **Does not replace `lib/analytics.ts`.**

```typescript
import { captureServerEvent } from '@/lib/server/posthog'

// ─── Event catalog ─────────────────────────────────────────────────────────

// Value-discovery funnel
export const EVT_READINESS_SCORE_SEEN    = 'readiness_score_seen'
export const EVT_FEATURE_TEASER_VIEWED   = 'feature_teaser_viewed'
export const EVT_WEEKLY_REPORT_OPENED    = 'weekly_report_opened'

// Consideration funnel
export const EVT_PAYWALL_VIEWED          = 'paywall_viewed'
export const EVT_PRICING_PAGE_VIEWED     = 'pricing_page_viewed'
export const EVT_PLAN_COMPARISON_EXPANDED = 'plan_comparison_expanded'

// Conversion
export const EVT_TRIAL_STARTED          = 'trial_started'
export const EVT_UPGRADE_CLICKED        = 'upgrade_clicked'
export const EVT_SUBSCRIPTION_STARTED   = 'subscription_started'

// Trial health
export const EVT_TRIAL_DAY1_ACTIVE      = 'trial_day_1_active'
export const EVT_TRIAL_DAY5_NUDGE_SENT  = 'trial_day_5_nudge_sent'
export const EVT_TRIAL_EXPIRED_NO_CONV  = 'trial_expired_no_convert'
export const EVT_TRIAL_CONVERTED        = 'trial_converted'

// ─── Typed helpers ──────────────────────────────────────────────────────────

export async function trackTrialStarted(userId: string, source: 'garmin_connect' | 'paywall' | 'direct') {
  await captureServerEvent(EVT_TRIAL_STARTED, { userId, source })
}

export async function trackPaywallViewed(userId: string, feature: string, src: string) {
  await captureServerEvent(EVT_PAYWALL_VIEWED, { userId, feature, src })
}

export async function trackUpgradeClicked(userId: string, fromPlan: string, toPlan: string, src: string) {
  await captureServerEvent(EVT_UPGRADE_CLICKED, { userId, fromPlan, toPlan, src })
}
```

**PostHog funnel to configure:**
```
readiness_score_seen
  → feature_teaser_viewed
    → paywall_viewed
      → pricing_page_viewed
        → trial_started
          → trial_day_1_active
            → trial_converted   ← North Star (target ≥ 25%)
```

---

### Step 3 — Pricing Page (CRO-Optimised)

**File:** `v0/app/(marketing)/pricing/page.tsx`

**Psychology applied:** Decoy Effect, Anchoring, Good-Better-Best, Loss Aversion framing, Identity-based tier names, Charm Pricing, Social Proof at decision point.

#### Tier naming (not Free/Pro/Premium)

| Old | New | Rationale |
|---|---|---|
| Free | **Starter** | Names the state, not an absence |
| Pro | **Coached** | JTBD: "I want real coaching" — identity-resonant |
| Premium | **Athlete** | Aspirational identity, not a feature list |

#### Pricing (Decoy Effect + Anchoring)

```
Starter — free forever
  ✓ Training plan + GPS logging
  ✓ Basic readiness score
  ✗ Readiness drivers (why your score is what it is)
  ✗ Weekly digest with 3 actions
  ✗ 28-day trend + ACWR
  ✗ Unlimited AI coach

Coached — $9/mo   [★ MOST POPULAR]   ← TARGET
  ✓ Everything in Starter
  ✓ Full readiness drivers + confidence
  ✓ Weekly digest with 3 actions
  ✓ 28-day trend + ACWR
  ✓ Unlimited AI coach
  ✓ Post-run recap

Athlete — $19/mo   ← DECOY (makes Coached look reasonable)
  ✓ Everything in Coached
  ✓ Priority sync
  ✓ Early access features
  ✓ (Future) Direct coach Q&A
```

- Charm pricing: `$9/mo` not `$10`
- Annual anchor: show `$108/yr → $79/yr (save 27%)` above monthly

#### Page structure

```
Hero (Loss Aversion):
  "Your Garmin knows more than you're seeing."
  "Coached plan unlocks the full picture."

3-column table (Coached pre-selected / highlighted)

Social proof row: "X runners upgraded this week"

FAQ (top 3 objections):
  Q: I don't run with Garmin
  A: Works with manual runs too

  Q: Can I cancel anytime?
  A: Yes, no commitment, cancel in 2 clicks

  Q: Is the free plan really useful?
  A: [Honest answer — builds trust]

Bottom CTA: "Start My 7-Day Free Trial — no card required"
```

**Components to build:**
- `v0/components/billing/PricingTable.tsx` — 3-column table, Coached pre-highlighted
- `v0/components/billing/UpgradeCTA.tsx` — inline locked-feature callout
  - Props: `feature: Feature`, `src: string`
  - Renders teaser preview (blurred data) + "See What Your Garmin Data Is Hiding →"
  - On click: fire `paywall_viewed`, navigate to `/pricing?feature=X&src=Y`

**CTA copy variants:**
- Primary: `"Start My 7-Day Free Trial"`
- Locked panel inline: `"See What Your Garmin Data Is Hiding →"`
- Locked panel caption: `"Coaches use this. You should too."`
- Urgency (trial day 5): `"2 days left on your trial — keep your readiness data"`

---

### Step 4 — Trial Page (Garmin Activation Moment)

**File:** `v0/app/(app)/onboarding/trial/page.tsx`

**Psychology applied:** Commitment & Consistency (user just connected Garmin = high intent), Peak-End Rule, Present Bias, Endowment Effect (show real data immediately), Regret Aversion (no card).

#### Garmin callback redirect (1-line change)

**File:** `v0/app/garmin/callback/page.tsx:112`
```typescript
// Before:
router.replace("/?screen=profile")

// After:
router.replace("/onboarding/trial?source=garmin")
```

#### Auto-provision in Garmin callback API

**File:** `v0/app/api/devices/garmin/callback/route.ts` — on success:
```typescript
// Upsert trial ONLY if user has no active trial or paid plan
await supabase
  .from('user_entitlements')
  .upsert(
    { user_id: authUserId, plan: 'trial', trial_ends_at: addDays(new Date(), 7), updated_at: new Date().toISOString() },
    { onConflict: 'user_id', ignoreDuplicates: true }   // never downgrade paid users
  )
await trackTrialStarted(authUserId, 'garmin_connect')
```

#### Trial page UX flow

```
/onboarding/trial?source=garmin

Phase 1 (0–1.5s):
  ✓ "Your Garmin is connected."
  [checkmark animation]
  "Pulling your last 30 days of data..."
  [progress bar animation — creates anticipation/IKEA effect]

Phase 2 (1.5s):
  "Here's what we found:"
  ┌─────────────────────────────────────┐
  │  HRV trend:     [sparkline]         │
  │  Recovery:      74 / 100            │
  │  Training load: Moderate this week  │
  └─────────────────────────────────────┘

  "You've unlocked 7 days of full coaching."

  [Single CTA: "See My Full Readiness Report →"]

  No credit card required  ·  Cancel anytime
```

**Key rules:**
- Show **real Garmin data** immediately (Endowment Effect — they already "own" it)
- Progress animation creates investment before the payoff
- `"Here's what we found:"` is personal, not transactional
- Single CTA navigates to readiness report, not generic dashboard (Goal-Gradient)
- "No credit card" removes regret aversion at the critical moment

---

### Step 5 — Day-5 Trial Nudge

**File:** `v0/app/api/cron/trial-nudge/route.ts`

Runs daily. Queries `expiring_trials` view. Sends push notification + email to users with ≤2 days remaining.

```typescript
// Nudge copy (Loss Aversion framing):
"Your readiness drivers disappear in 2 days"
"Keep seeing why your recovery score changes — upgrade in 30 seconds."
[CTA: "Keep My Coaching →"]
```

Fire: `trackTrialDay5NudgeSent(userId)`

---

## Acceptance Criteria

### Trust
- [ ] `SubscriptionGate.hasAccess()` testing bypass removed — real tier/trial logic active
- [ ] Server `requireEntitlement()` reads from Supabase `user_entitlements`, never Dexie
- [ ] Trial expiry correctly downgrades plan in Supabase

### Gating UX
- [ ] Free users see **teaser data** on locked panels, never blank states
- [ ] Locked endpoints return `{ error, feature, plan, preview, upgradeUrl }` with HTTP 402
- [ ] `UpgradeCTA` renders teaser + navigates to `/pricing?feature=X`

### Conversion UX
- [ ] Pricing page: Coached tier pre-selected, annual saving shown, FAQ present
- [ ] Trial page: shows real Garmin data within 2s, single CTA to readiness report
- [ ] No credit card required at any trial entry point

### Analytics
- [ ] PostHog funnel `readiness_score_seen → trial_started → trial_converted` queryable
- [ ] `trial_converted / trial_started` measurable from day one (target ≥ 25%)
- [ ] `trial_expired_no_convert` cohort identifiable for win-back

### Retention
- [ ] Day-5 nudge fires for users with ≤2 days remaining trial

---

## Tests

### Unit
- `v0/tests/unit/entitlements.test.ts`
  - `planAllows('free', 'readiness_drivers')` → false
  - `planAllows('coached', 'readiness_drivers')` → true
  - `planAllows('trial', 'weekly_report_generate')` → true
  - Trial expired → `getEntitlement()` returns `'free'`

### Integration
- `v0/tests/integration/paywall.test.ts`
  - POST weekly report with free-tier user → 402 + `{ error: 'entitlement_required', plan: 'free', preview: {...} }`
  - POST weekly report with coached user → 200

### E2E (Playwright)
- `v0/e2e/pricing-upgrade-cta.spec.ts`
  - Locked readiness panel shows blurred drivers + UpgradeCTA
  - Clicking CTA navigates to `/pricing?feature=readiness_drivers`
  - Pricing page loads with Coached tier highlighted

---

## Implementation Order

| # | Task | File(s) | Psychology lever |
|---|---|---|---|
| 1 | Migration: `user_entitlements` + trigger + expiring_trials view | `supabase/migrations/*_entitlements_group_d.sql` | Foundation |
| 2 | `lib/billing/entitlements.ts` — plan→feature map | new | — |
| 3 | `lib/billing/requireEntitlement.ts` — server-only gate | new | — |
| 4 | Remove testing bypass from `lib/subscriptionGates.ts` | existing | — |
| 5 | Update locked endpoints to return **preview payload** | 5 API routes | Endowment Effect |
| 6 | `lib/analytics/events.ts` — typed event catalog | new | — |
| 7 | `components/billing/UpgradeCTA.tsx` — teaser-aware | new | Zeigarnik Effect |
| 8 | `components/billing/PricingTable.tsx` — 3-tier decoy layout | new | Decoy Effect + Anchoring |
| 9 | `app/(marketing)/pricing/page.tsx` — full CRO page | new | Loss Aversion framing |
| 10 | Garmin callback: auto-provision trial + redirect fix | `app/garmin/callback/page.tsx`, `app/api/devices/garmin/callback/route.ts` | Commitment & Consistency |
| 11 | `app/(app)/onboarding/trial/page.tsx` — data animation + single CTA | new | Peak-End Rule, Present Bias |
| 12 | `app/api/cron/trial-nudge/route.ts` — day-5 nudge | new | Loss Aversion |
| 13 | Wire `UpgradeCTA` into: ReadinessPanel drivers, WeeklyReport, LoadPanel 90d | existing components | — |
| 14 | Unit + integration + E2E tests | `tests/unit/entitlements.test.ts`, `tests/integration/paywall.test.ts`, `e2e/pricing-upgrade-cta.spec.ts` | — |

---

## Not in Scope (future branch)
- Stripe payment processing (`stripe_customer_id` field reserved in schema)
- Billing dashboard / invoice history
- Annual subscription checkout flow
- Admin subscription override panel
