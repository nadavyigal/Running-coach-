# Today Page Redesign Plan

## Objective
Make the Today screen immediately useful, shorter-feeling, and action-driven by prioritizing high-value guidance above the fold and moving dense analytics behind progressive disclosure.

## New Section Order
1. Hero: Daily Focus
2. Key Metrics Snapshot
3. Progress Summary Graphic
4. Coach Insights
5. Plan + Activities
6. Advanced Analytics (collapsed)
7. Data Quality / Sync / Device State (contextual, low prominence)

## Above Fold vs Below Fold

### Above fold (default)
- Daily status (Run day / Rest day / Recovery)
- One-line coach insight
- Primary action (`Start Run` or `Recovery Action`)
- Secondary actions (`View Plan`, `Sync`)
- 3-5 key metrics with plain-language interpretation
- Compact weekly progress chart

### Below fold
- Workout detail card
- Recent activity summary
- Optional challenge/recap callouts

### Collapsed by default
- Advanced analytics panels
- Deeper performance widgets
- Account/sync details beyond immediate warnings

## Progressive Disclosure Strategy
- Use `Accordion` for:
  - Advanced analytics
  - Additional performance widgets
  - Optional account/sync details
- Keep only one actionable insight stack visible by default.
- Avoid duplicate metrics across sections.

## Metric Priority Tiers

### Primary metrics (always visible)
- Today readiness/recovery
- Weekly completion (`runs completed / planned`)
- Consistency rate
- Goal progress percentage

### Secondary metrics (visible in workout/activities)
- Target distance/duration for today
- Last run summary (distance, duration, RPE)
- Coach confidence label + next step

### Advanced metrics (collapsed)
- Readiness panel internals
- Load and recovery diagnostics
- Habit/community/performance widgets

## User States

### Run day
- Hero status: workout-focused
- Primary CTA: `Start Run`
- Secondary CTA: `Open Plan` / `Sync Garmin`

### Rest day
- Hero status: recovery-focused
- Primary CTA: `Recovery Action` (or record optional run)
- Show rationale for rest to build trust

### No data / partial data / sync error
- Contextual data quality banner with clear action:
  - `Complete check-in`
  - `Sync Garmin`
  - `Retry sync`
- Keep screen usable with fallback values and helper copy.

### New user
- Simplified guidance copy
- Emphasize first meaningful action
- Suppress dense analytics until data exists

## Componentization Plan
- `V0/components/today/DailyFocusCard.tsx`
- `V0/components/today/KeyMetricsGrid.tsx`
- `V0/components/today/CoachInsightsPanel.tsx`
- `V0/components/today/ProgressSummaryChart.tsx`
- `V0/components/today/TodayWorkoutCard.tsx`
- `V0/components/today/AdvancedAnalyticsAccordion.tsx`
- `V0/components/today/DataQualityBanner.tsx`

## UX and Quality Requirements in Implementation
- Mobile-first spacing rhythm and hierarchy
- Sticky mobile action bar (Start / Plan / Sync)
- Skeleton states for loading
- Empty/partial/error states with explicit actions
- Subtle motion only for section entrance/expansion
- Semantic headings and accessible labels/tap targets
