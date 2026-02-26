# Today Page Visual Polish Notes

## Visual Changes Made
- Upgraded the Today hero (`DailyFocusCard`) with stronger visual hierarchy, status-aware accent treatment, refined action buttons, and a compact visual signal motif.
- Refined key metrics with reusable `MetricCard` visuals: trend badges, helper context, unit styling, and animated micro progress meters.
- Reworked weekly progress visualization (`ProgressSummaryChart`) with:
  - premium summary header + readiness ring
  - cleaner trend-focused area chart
  - custom lightweight tooltip
  - explicit no-data chart state
- Polished coaching insights and workout cards with consistent radii, elevation, density, and readability improvements.
- Updated advanced analytics accordion styling for reduced visual noise and better scanability.
- Redesigned data-quality/sync banner into an integrated status component with calm severity cues and clearer CTA presentation.
- Added fold + full-page screenshot capture updates in Playwright Today redesign test.

## Key Design Decisions
- Preserved existing Today IA and data logic. Changes are presentation-only.
- Prioritized mobile readability and “on the move” clarity: stronger title/value/meta contrast, larger tap-safe controls, and compact microcopy under key values.
- Used subtle, meaningful motion only (short entrance/transition animations), with reduced-motion safety through `useReducedMotion` and global reduced-motion CSS.
- Reduced “box soup” by introducing primary/secondary card emphasis and consistent spatial rhythm instead of equal visual weight.
- Kept brand consistency by reusing existing OKLCH token system and app color language rather than introducing a new palette.

## Reusable Patterns Introduced
- `V0/components/today/today-ui.ts`
  - `todayCardVariants` (hero/primary/secondary card hierarchy + interaction states)
  - `todayStatusBadgeVariants` (consistent status chips)
  - `todayTrendBadgeVariants` (metric trend labeling)
  - `todayBannerVariants` (integrated state banner tones)
- `V0/components/today/MetricCard.tsx`
  - reusable metric surface with trend icon, helper microcopy, and meter animation
- Updated e2e snapshot flow:
  - `V0/e2e/today-redesign.spec.ts` now records both fold and full-page images per viewport.
