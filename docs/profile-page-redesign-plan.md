# Profile Page Redesign Plan

## 1) Audit Summary (Pre-Implementation Note)

### Entry Point and Current Architecture
- `?screen=profile` is handled in [`V0/app/page-client.tsx`](../V0/app/page-client.tsx) via `parseMainScreen()` and the `currentScreen` switch.
- The Profile view is a single large component: [`V0/components/profile-screen.tsx`](../V0/components/profile-screen.tsx).
- Current profile screen mixes data loading, business actions, and UI rendering in one file (~1700+ lines).

### Data Sources in Current Profile Screen
- Shared app context: `useData()` (`user`, `userId`, `primaryGoal`, `activeGoals`, `recentRuns`, `allTimeStats`, `refresh`).
- Direct DB and services:
  - `dbUtils.getCurrentUser`, `getPrimaryGoal`, `getUserGoals`, `getRunsInTimeRange`, `setPrimaryGoal`, `deleteGoal`, `mergeGoals`
  - `GoalProgressEngine.calculateGoalProgress`
  - Challenge flow: `getActiveChallenge`, `getChallengeHistory`, `getActiveChallengeTemplates`, `startChallengeAndSyncPlan`
  - Garmin connection checks via `db.wearableDevices` and `/api/devices/garmin/connect`
- Existing feature widgets:
  - `CoachingInsightsWidget`
  - `PerformanceAnalyticsDashboard`
  - `BadgeCabinet`
  - `CommunityStatsWidget`
  - `ReminderSettings`, `UserDataSettings`, `PlanTemplateFlow`, `JoinCohortModal`

### Reuse Opportunities
- Reuse existing data logic and actions; avoid backend changes.
- Reuse shadcn primitives already present in repo: `Card`, `Badge`, `Button`, `Progress`, `Tabs`, `Accordion`, `Separator`, `Dialog`, `AlertDialog`.
- Reuse existing widgets (coaching/analytics/badges/community), but reframe placement and emphasis.
- Reuse existing app tokens in `globals.css` and Tailwind color variables (`--surface-*`, `--primary`, `--muted-*`).

### Refactor Targets
- Split `profile-screen.tsx` into focused, composable profile section components.
- Centralize visual primitives (section wrapper, stat card, status chip, row item) to remove one-off styling.
- Move low-priority and destructive tooling into collapsed/advanced disclosure.
- Add consistent loading/empty/partial/error section states instead of ad-hoc messages.

### Current Visual/UX Inconsistencies
- Box soup: too many equal-weight cards with similar styling.
- Priority inversion: developer/reset and utility rows compete with identity/progress.
- Redundant/mixed headings and large-card rhythm causing perceived length.
- Uneven visual language across widgets (different header sizes, spacing, color tone, empty states).
- Above-the-fold value is weak: identity + goal + momentum are not combined into a clear first scan.

## 2) New IA and Section Order

1. Profile Hero (identity + level + primary quick actions)
2. Current Goal + Progress (single dominant goal card)
3. Momentum Snapshot (3-5 compact stat cards)
4. Challenges & Motivation (featured challenge + compact list)
5. Coaching Profile (summary, style chips, edit CTA)
6. Performance Analytics (tabbed/collapsible, insights first)
7. Achievements & Community (badge cabinet + cohort/community)
8. Devices & Apps (clean grouped status rows)
9. Settings (consistent row list)
10. Advanced / Developer Tools (collapsed by default)

## 3) Above-the-Fold Priorities

- Must show immediately on mobile without deep scroll:
  - Runner identity (name/label, level, role summary)
  - Primary goal + progress + deadline + next step
  - Momentum snapshot (weekly/consistency/streak/volume)
- Primary CTA priority:
  - `Update Goal` / `View Plan` / `Edit Profile`
- Secondary CTA:
  - `View Challenges` / `Coaching Preferences`

## 4) Progressive Disclosure Strategy

- Collapsed or tabbed by default:
  - Long lists (`Recent Runs`, `Past Challenges`, settings subsets)
  - Analytics details and export controls
  - Developer tools
- Keep one-line summaries visible when collapsed:
  - Example: `Devices: Garmin connected • 4 available integrations`

## 5) Information Priority Model

- Primary (always prominent): identity, goal, progress, momentum
- Secondary (discoverable but not dominant): challenges, coaching profile, analytics summary
- Management (utility): integrations, settings
- Advanced (de-emphasized): export/debug/dev/reset actions

## 6) Key User States

### New User (little/no history)
- Hero still complete with profile basics.
- Goal section shows clear CTA to create first goal.
- Momentum cards show friendly placeholders and onboarding nudges.
- Challenges show beginner-friendly recommendations.

### Active Runner (ongoing training)
- Goal progress and momentum front-loaded.
- Challenge status and next recommended action emphasized.
- Analytics quickly available via tabs/collapse.

### No Goals
- Goal card becomes a high-quality empty state with one primary action.

### No Device Connected
- Devices section highlights connection opportunity without alarm tone.

### Sparse/No Data
- Section-level empty/partial states with coaching-friendly copy:
  - “Record 2-3 runs to unlock pace trend insights.”

## 7) Implementation Approach

- Step 1: Add new profile section components under `V0/components/profile/`.
- Step 2: Compose new page flow in `profile-screen.tsx` using existing data/actions.
- Step 3: Add premium visual system primitives (card hierarchy, chips, rows, section headers).
- Step 4: Wire loading/empty/error states per section.
- Step 5: Add Playwright profile visual snapshot flow for target viewports.
