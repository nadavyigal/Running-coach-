# Profile Page Visual Polish Notes

## Visual System Changes

- Introduced reusable profile UI primitives under `V0/components/profile/`:
  - `variants.ts` for card/status/row style variants
  - `ProfileStatCard` for compact metric cards with optional sparkline
  - section-level building blocks (`ProfileHeroCard`, `PrimaryGoalCard`, `IntegrationsListCard`, etc.)
- Shifted top of page to a premium identity-focused surface:
  - Hero card with layered gradient, avatar identity, quick facts, and clear actions
  - Goal card with conic progress ring + progress bar + trajectory chip
- Standardized spacing rhythm and corner treatment:
  - section cards use `rounded-2xl`
  - compact row/list surfaces use `rounded-xl`
  - reduced “same-weight card soup” by using variant tones (`hero`, `primary`, `secondary`, `muted`, `warning`)

## Card Hierarchy Rules

- `Hero` cards:
  - highest visual emphasis, gradient, stronger shadow, identity content
- `Primary` cards:
  - goal/challenge cards with strong outline and action emphasis
- `Secondary` cards:
  - analytics, settings, data panels, list containers
- `Muted` cards:
  - empty states and low-pressure informational states
- `Warning/Danger` cards:
  - advanced/dev and destructive controls only

## Chart and Analytics Styling Rules

- “Insight first, controls second” approach:
  - analytics summary shown before opening heavy dashboard
  - export controls de-emphasized by placing detailed analytics inside accordion
- Added compact trend cue in momentum stat cards via sparkline bars.
- Preserved existing analytics data wiring and existing `PerformanceAnalyticsDashboard` behavior.

## Motion Rules

- Motion is subtle and utility-focused:
  - hero fade/slide entrance
  - progress transitions and card hover depth
  - accordion transitions for disclosure
- Motion uses transform/opacity-friendly transitions and respects reduced-motion classes (`motion-reduce`).
- No long/ornamental animation loops added.

## State Design Decisions

- Added dedicated profile skeleton (`ProfilePageSkeleton`) for initial load.
- Empty states standardized with `ProfileEmptyState`:
  - no goal
  - no recent runs
  - missing physiological metrics
- Error state keeps recovery paths visible:
  - refresh
  - retry initialization
  - clear data/restart
- Optional/advanced behavior is intentionally collapsed:
  - developer tools moved to accordion under “Advanced”
  - heavy analytics moved behind disclosure
