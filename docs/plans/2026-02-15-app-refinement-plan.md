# RunSmart App Refinement Backlog

Date: 2026-02-15  
Branch: `new-design-for-growth`  
Owner: Nadav + Codex

## Scope
This backlog translates the refinement strategy into executable tickets with acceptance criteria. It is optimized for growth impact first: acquisition clarity, onboarding conversion, and early retention signals.

## Delivery Milestones
1. Milestone A: Brand and funnel consistency.
2. Milestone B: Landing and onboarding conversion improvements.
3. Milestone C: In-app growth surfaces and measurement hardening.
4. Milestone D: SEO/public-surface cleanup and release QA.

## Ticket Backlog

### GROW-001: Brand Naming Consistency
Type: Product + UX polish  
Priority: P0

Description:
Standardize brand naming to `RunSmart` across user-facing metadata and legal surfaces.

Acceptance criteria:
1. PWA manifest uses `RunSmart` naming in `name` and `short_name`.
2. Terms page title and copy use `RunSmart` consistently.
3. Privacy page references use `RunSmart` consistently.
4. No new mixed variants (`Run-Smart`, `Run Smart`) are introduced in touched files.

Primary files:
`V0/app/manifest.ts`  
`V0/app/terms/page.tsx`  
`V0/app/privacy/page.tsx`

---

### GROW-002: Landing Metadata Message Refresh
Type: Copywriting + SEO  
Priority: P0

Description:
Replace hard-number growth claims in landing metadata with a stable, benefit-first positioning aligned to feel-adaptive coaching.

Acceptance criteria:
1. `/landing` metadata title and descriptions communicate adaptive coaching value.
2. Open Graph and Twitter metadata match the same positioning direction.
3. No hardcoded user-count claims remain in landing metadata.

Primary files:
`V0/app/landing/(beta)/page.tsx`

---

### GROW-003: Reduce Landing Form Friction
Type: CRO  
Priority: P0

Description:
Align form behavior with copy by removing forced-name validation and allowing zero-friction progress to challenge selection.

Acceptance criteria:
1. Name is optional in the Beta section label and logic.
2. Email validation runs only when email is entered.
3. Continue action works with no name/email entered.
4. Analytics event includes `has_email` and `has_name` flags.

Primary files:
`V0/components/professional-landing-screen.tsx`

---

### GROW-004: Hero Copy Clarity Pass
Type: Copywriting  
Priority: P1

Description:
Rewrite hero supporting copy to emphasize the core differentiator: adaptive coaching based on readiness/feeling.

Acceptance criteria:
1. Hero subtitle is outcome-first and not feature-list language.
2. Supporting CTA subtext avoids contradictory billing language.
3. Language remains concise and scannable on mobile.

Primary files:
`V0/components/professional-landing-screen.tsx`

---

### GROW-005: Early-Access Callout Trust Update
Type: CRO + marketing-psychology  
Priority: P1

Description:
Update Today-screen early-access panel to reduce fragile claims and show dynamic social proof.

Acceptance criteria:
1. Dynamic runner count uses `useBetaSignupCount()` value instead of hardcoded `200+`.
2. Copy no longer claims fixed lifetime discount in this surface.
3. Capacity line no longer depends on hardcoded denominator language.
4. Existing CTA tracking (`early_access_cta_clicked`) remains intact.

Primary files:
`V0/components/today-screen.tsx`

---

### GROW-006: Public Sitemap Cleanup
Type: Technical SEO  
Priority: P0

Description:
Limit sitemap to public marketing/legal routes and include challenge landings. Exclude authenticated in-app utility routes.

Acceptance criteria:
1. Sitemap includes `/`, `/privacy`, `/terms`.
2. Sitemap includes all challenge slug pages from `getAllChallengeSlugs()`.
3. Sitemap excludes `/today`, `/plan`, `/record`, `/chat`, `/profile`, `/onboarding`.
4. Build/lint passes with updated sitemap typing.

Primary files:
`V0/app/sitemap.ts`

---

### GROW-007: Analytics Taxonomy Alignment (Follow-up)
Type: Analytics  
Priority: P1

Description:
Normalize acquisition and activation events into one funnel taxonomy.

Acceptance criteria:
1. Funnel spec documented with canonical event names and required properties.
2. Landing, signup, onboarding, and first-run events map to canonical names.
3. Deprecated or duplicate event names are listed for migration.

Primary files:
`V0/lib/analytics.ts`  
`V0/components/professional-landing-screen.tsx`  
`V0/components/today-screen.tsx`  
`docs/plans/2026-02-15-app-refinement-plan.md`

---

### GROW-008: Backups and Route Hygiene Audit (Follow-up)
Type: Tech debt + risk reduction  
Priority: P2

Description:
Audit backup/alternate route files and define safe removal or archival path.

Acceptance criteria:
1. Backup files are inventoried with owner decision (`keep`, `archive`, `delete`).
2. Active runtime imports do not reference backup variants.
3. Cleanup plan includes rollback notes.

Primary files:
`V0/app/page-backup.tsx`  
`V0/app/page.tsx.backup`  
`V0/app/api/chat/route.ts.broken`  
`V0/app/api/chat/route-working-backup.ts`  
`V0/app/api/chat/route-new.ts`  
`V0/app/api/onboarding/chat/route-new.ts`

## Definition of Done
1. All P0 tickets merged and verified.
2. Lint passes for changed files or project-wide lint passes.
3. Regression smoke check completes for root landing, onboarding entry, today screen callout, and sitemap endpoint.
4. Ticket status and notes are updated in this document before handoff.

